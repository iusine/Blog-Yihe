/**
 * Markdown 里的图片样式约定。
 *
 * CommonMark 的图片语法没有宽度 / 对齐，这里把样式写进 title：
 * `![alt](src "w=60%;a=left")`。渲染时解析出来并交给 <MarkdownImage>。
 * 居中是默认值，不写进 title；宽度按正文宽度的百分比保存。
 */

export type ImageAlign = 'left' | 'center' | 'right'

export type ImageStyle = {
	/** 正文宽度的百分比，10–100 */
	width?: number
	align?: ImageAlign
}

export const IMAGE_WIDTH_PRESETS = [25, 40, 60, 80, 100] as const

const ALIGN_VALUES = new Set<string>(['left', 'center', 'right'])

/** 解析图片 title；不是样式串时原样保留，避免误伤普通 title。 */
export function parseImageStyleTitle(title?: string | null): { style: ImageStyle; title?: string } {
	const raw = (title || '').trim()
	if (!raw) return { style: {} }

	const style: ImageStyle = {}
	let matched = false

	for (const part of raw.split(';')) {
		const separator = part.indexOf('=')
		if (separator <= 0) return { style: {}, title: raw }

		const key = part.slice(0, separator).trim().toLowerCase()
		const value = part.slice(separator + 1).trim().toLowerCase()
		if (!key || !value) return { style: {}, title: raw }

		if (key === 'w' || key === 'width') {
			const match = value.match(/^(\d{1,3})%?$/)
			if (!match) return { style: {}, title: raw }
			const width = Number(match[1])
			if (width < 10 || width > 100) return { style: {}, title: raw }
			style.width = width
			matched = true
			continue
		}

		if (key === 'a' || key === 'align') {
			if (!ALIGN_VALUES.has(value)) return { style: {}, title: raw }
			style.align = value as ImageAlign
			matched = true
			continue
		}

		return { style: {}, title: raw }
	}

	return matched ? { style } : { style: {}, title: raw }
}

/** 生成 title；没有可写的样式时返回 undefined。 */
export function formatImageStyleTitle(style: ImageStyle): string | undefined {
	const parts: string[] = []

	if (typeof style.width === 'number' && Number.isFinite(style.width)) {
		const width = Math.max(10, Math.min(100, Math.round(style.width)))
		parts.push(`w=${width}%`)
	}

	if (style.align && style.align !== 'center') parts.push(`a=${style.align}`)

	return parts.length > 0 ? parts.join(';') : undefined
}

/** 有宽度时用固定百分比；没有宽度时交给站点默认的 max-width 规则。 */
export function imageWidthStyle(width?: number | null): { width: string; maxWidth: string; height: string } | undefined {
	if (typeof width !== 'number' || !Number.isFinite(width)) return undefined
	const safe = Math.max(10, Math.min(100, Math.round(width)))
	return { width: `${safe}%`, maxWidth: '100%', height: 'auto' }
}

export function imageAlignStyle(align?: ImageAlign | null): { marginLeft: string; marginRight: string } | undefined {
	if (align !== 'left' && align !== 'right') return undefined
	return align === 'left' ? { marginLeft: '0', marginRight: 'auto' } : { marginLeft: 'auto', marginRight: '0' }
}
