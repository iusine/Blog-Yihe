'use client'

/** 字符串哈希（FNV-1a），用来给每张留言卡生成稳定的散落位置 */
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
}

export type ScatterOptions = {
	/** 横向安全边距（百分比），手机上按卡片宽度换算后传入 */
	paddingX?: number
	/** 纵向安全边距（百分比） */
	paddingY?: number
}

/**
 * 留言墙的散落堆叠布局：网格打底 + 按 id 哈希抖动。
 * 同一张留言每次打开位置都一样（不会乱跳），整体看起来是随手贴上去的。
 */
export function scatterLayout(ids: string[], salt = 0, options: ScatterOptions = {}): Map<string, ScatterPosition> {
	const result = new Map<string, ScatterPosition>()
	if (ids.length === 0) return result

	const columns = Math.max(2, Math.min(5, Math.ceil(Math.sqrt(ids.length * 1.4))))
	const rows = Math.max(1, Math.ceil(ids.length / columns))

	const paddingX = Math.min(42, Math.max(2, options.paddingX ?? 8))
	const paddingY = Math.min(42, Math.max(2, options.paddingY ?? 10))
	const usableX = Math.max(4, 100 - paddingX * 2)
	const usableY = Math.max(4, 100 - paddingY * 2)

	ids.forEach((id, index) => {
		const seed = hashString(`${id}:${salt}`)
		const column = index % columns
		const row = Math.floor(index / columns)

		const jitterX = (((seed & 0xff) / 255) * 2 - 1) * (usableX / columns) * 0.28
		const jitterY = ((((seed >> 8) & 0xff) / 255) * 2 - 1) * (usableY / rows) * 0.26

		// 让相邻两列/两行稍微重叠一点，形成「堆叠」感
		const overlap = 1.06

		const x = paddingX + (usableX / columns) * (column + 0.5) * overlap + jitterX
		const y = paddingY + (usableY / rows) * (row + 0.5) * overlap + jitterY

		result.set(id, {
			x: Math.min(100 - paddingX, Math.max(paddingX, x)),
			y: Math.min(100 - paddingY, Math.max(paddingY, y)),
			rotate: ((((seed >> 16) & 0xff) / 255) * 2 - 1) * 6,
			z: 1 + (seed % 30)
		})
	})

	return result
}
