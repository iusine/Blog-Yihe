'use client'

/**
 * 上传前的图片压缩：把超过 1MB 的图片压到 1MB 以内再提交到 GitHub。
 *
 * 纯浏览器实现（createImageBitmap + canvas），不引入任何压缩库：
 * 1. 长边超过 MAX_EDGE 的先等比缩小（网页展示用不到更大分辨率）；
 * 2. 先降编码质量，质量降到 0.62 还超标就继续缩尺寸，循环到达标为止；
 * 3. 带透明通道的（PNG/WebP/AVIF）输出 WebP 保留透明；其余输出 JPEG，
 *    并在画布上铺白底，避免透明区域变黑。
 *
 * GIF（动图）和 SVG 不处理，直接原样上传。
 */

/** 默认上限：1MB */
export const MAX_UPLOAD_IMAGE_BYTES = 1024 * 1024

/** 长边上限，超过就等比缩小 */
const MAX_EDGE = 2560

/** 可以重新编码的位图格式 */
const COMPRESSIBLE = /^image\/(jpe?g|pjpeg|png|webp|avif|bmp)$/i

/** 这些格式可能有透明通道，统一输出 WebP，避免丢透明 */
const KEEP_ALPHA = /^image\/(png|webp|avif)$/i

export type CompressImageResult = {
	/** 压缩后的文件；不需要压缩时就是原文件 */
	file: File
	originalSize: number
	size: number
	compressed: boolean
}

type Decoded = {
	source: CanvasImageSource
	width: number
	height: number
	release: () => void
}

function outputName(file: File, mime: string): string {
	const base = file.name.replace(/\.[^./\\]+$/, '') || 'image'
	return `${base}${mime === 'image/webp' ? '.webp' : '.jpg'}`
}

function toBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('图片编码失败'))), mime, quality)
	})
}

async function decode(file: File): Promise<Decoded> {
	if (typeof createImageBitmap === 'function') {
		try {
			const bitmap = await createImageBitmap(file)
			return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
		} catch {
			// 浏览器不认识的格式会落到下面的 <img> 解码
		}
	}

	const url = URL.createObjectURL(file)
	try {
		const img = await new Promise<HTMLImageElement>((resolve, reject) => {
			const el = new Image()
			el.onload = () => resolve(el)
			el.onerror = () => reject(new Error('图片解码失败'))
			el.src = url
		})
		return {
			source: img,
			width: img.naturalWidth,
			height: img.naturalHeight,
			release: () => URL.revokeObjectURL(url)
		}
	} catch (error) {
		URL.revokeObjectURL(url)
		throw error
	}
}

function wrap(file: File, blob: Blob, mime: string, originalSize: number): CompressImageResult {
	const output = new File([blob], outputName(file, mime), { type: mime, lastModified: Date.now() })
	return { file: output, originalSize, size: output.size, compressed: true }
}

/**
 * 把图片压到 `maxBytes` 以内。已经足够小、或者格式不适合重新编码时原样返回。
 */
export async function compressImageFile(file: File, maxBytes: number = MAX_UPLOAD_IMAGE_BYTES): Promise<CompressImageResult> {
	const originalSize = file.size
	const unchanged: CompressImageResult = { file, originalSize, size: originalSize, compressed: false }

	if (originalSize <= maxBytes) return unchanged
	if (!COMPRESSIBLE.test(file.type)) return unchanged

	const mime = KEEP_ALPHA.test(file.type) ? 'image/webp' : 'image/jpeg'

	let decoded: Decoded
	try {
		decoded = await decode(file)
	} catch {
		// 解码失败（例如 HEIC）：保持原样，交给上传流程
		return unchanged
	}

	try {
		const fitScale = Math.min(1, MAX_EDGE / Math.max(decoded.width, decoded.height))
		let scale = fitScale
		let quality = 0.86
		let best: { blob: Blob; mime: string } | null = null

		for (let attempt = 0; attempt < 14; attempt++) {
			const width = Math.max(1, Math.round(decoded.width * scale))
			const height = Math.max(1, Math.round(decoded.height * scale))

			const canvas = document.createElement('canvas')
			canvas.width = width
			canvas.height = height

			const ctx = canvas.getContext('2d')
			if (!ctx) return unchanged

			if (mime === 'image/jpeg') {
				ctx.fillStyle = '#ffffff'
				ctx.fillRect(0, 0, width, height)
			}
			ctx.imageSmoothingEnabled = true
			ctx.imageSmoothingQuality = 'high'
			ctx.drawImage(decoded.source, 0, 0, width, height)

			const blob = await toBlob(canvas, mime, quality)
			const actualMime = blob.type || mime
			if (!best || blob.size < best.blob.size) best = { blob, mime: actualMime }

			if (blob.size <= maxBytes) return wrap(file, blob, actualMime, originalSize)

			if (Math.max(width, height) <= 320) break

			if (quality > 0.62) {
				quality = Math.max(0.62, quality - 0.08)
			} else {
				quality = 0.86
				scale *= 0.78
			}
		}

		// 兜底：用循环里最小的结果；如果反而比原图大，就不压了
		if (best && best.blob.size < originalSize) return wrap(file, best.blob, best.mime, originalSize)
		return unchanged
	} finally {
		decoded.release()
	}
}
