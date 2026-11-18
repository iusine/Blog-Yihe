import type { Photo } from '../types'

/** 按城市归组，并按拍摄日期倒序（最新在前） */
export function groupPhotosByCity(photos: Photo[]): Map<string, Photo[]> {
	const grouped = new Map<string, Photo[]>()

	for (const photo of photos) {
		const list = grouped.get(photo.city)
		if (list) list.push(photo)
		else grouped.set(photo.city, [photo])
	}

	for (const list of grouped.values()) {
		list.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
	}

	return grouped
}

export function hashString(input: string): number {
	let hash = 2166136261
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i)
		hash = Math.imul(hash, 16777619)
	}
	return hash >>> 0
}

export type ScatterPosition = {
	/** 相对容器的百分比 */
	x: number
	y: number
	rotate: number
	z: number
	scale: number
}

export type PhotoScatterOptions = {
	/** 横向安全边距（百分比），手机上按照片宽度换算后传入 */
	paddingX?: number
	/** 纵向安全边距（百分比） */
	paddingY?: number
}

/**
 * 照片墙的「散落」布局：按网格打底、用 id 哈希做偏移，
 * 保证同一张照片每次打开都在同一个位置（不会乱跳），整体看起来又是随机的。
 */
export function scatterLayout(photos: Photo[], salt = 0, options: PhotoScatterOptions = {}): Map<string, ScatterPosition> {
	const result = new Map<string, ScatterPosition>()
	if (photos.length === 0) return result

	const columns = Math.max(2, Math.ceil(Math.sqrt(photos.length * 1.6)))
	const rows = Math.max(1, Math.ceil(photos.length / columns))

	const paddingX = Math.min(42, Math.max(2, options.paddingX ?? 4))
	const paddingY = Math.min(42, Math.max(2, options.paddingY ?? 8))
	const usableX = Math.max(4, 100 - paddingX * 2)
	const usableY = Math.max(4, 92 - paddingY * 2)

	photos.forEach((photo, index) => {
		const seed = hashString(`${photo.id}:${salt}`)
		const column = index % columns
		const row = Math.floor(index / columns) % rows

		const jitterX = (((seed & 0xff) / 255) * 2 - 1) * (usableX / columns) * 0.22
		const jitterY = ((((seed >> 8) & 0xff) / 255) * 2 - 1) * (usableY / rows) * 0.22

		const x = paddingX + (usableX / columns) * (column + 0.5) + jitterX
		const y = paddingY + (usableY / Math.max(1, rows)) * (row + 0.5) + jitterY

		result.set(photo.id, {
			x: Math.min(options.paddingX === undefined ? 88 : 100 - paddingX, Math.max(options.paddingX === undefined ? 2 : paddingX, x)),
			y: Math.min(options.paddingY === undefined ? 86 : 92 - paddingY, Math.max(options.paddingY === undefined ? 6 : paddingY, y)),
			rotate: ((((seed >> 16) & 0xff) / 255) * 2 - 1) * 7,
			z: 1 + (seed % 20),
			scale: 0.9 + (((seed >> 24) & 0xff) / 255) * 0.2
		})
	})

	return result
}

export function todayString(): string {
	const now = new Date()
	const pad = (n: number) => String(n).padStart(2, '0')
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
