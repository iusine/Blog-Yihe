import adjacency from '../data/province-adjacency.json'

/**
 * 省份配色。
 *
 * 规则：
 * 1. **有照片的省份**用饱和色，一眼能看出这块有内容；
 * 2. **相邻的省份颜色不能一样**（把相邻关系当图着色问题，贪心取第一个「邻居没用过」的颜色）；
 * 3. 有照片的省份之间也尽量用不同颜色，避免两块内容区看起来像是同一块。
 *
 * 每条调色板给两个色：`fill` 是底色（没有照片的省份用），`strong` 是有照片时的高饱和版，
 * 两者同一色相，所以整体还是协调的。
 */
export const REGION_PALETTE = [
	{ fill: '#eaf5f8', strong: '#9fdcf0' },
	{ fill: '#ecf7ee', strong: '#a8ddb8' },
	{ fill: '#fbf3e3', strong: '#f1d49b' },
	{ fill: '#fceef0', strong: '#f3bcc6' },
	{ fill: '#f1eef9', strong: '#c9bdec' },
	{ fill: '#fdf1e8', strong: '#f6cda9' },
	{ fill: '#eef6f1', strong: '#9ed3c4' },
	{ fill: '#f5f1e9', strong: '#d3c4a4' },
	{ fill: '#f7eef6', strong: '#e0bfd8' },
	{ fill: '#eef3fb', strong: '#b7c9ee' },
	{ fill: '#faf3ea', strong: '#e7c8a6' },
	{ fill: '#eef7f6', strong: '#a8d8d6' }
] as const

export type RegionColor = (typeof REGION_PALETTE)[number]

/** 各省省会 / 首府，用于在省份地图里把省会名字加粗 */
export const PROVINCE_CAPITALS: Record<string, string> = {
	'110000': '北京市',
	'120000': '天津市',
	'130000': '石家庄市',
	'140000': '太原市',
	'150000': '呼和浩特市',
	'210000': '沈阳市',
	'220000': '长春市',
	'230000': '哈尔滨市',
	'310000': '上海市',
	'320000': '南京市',
	'330000': '杭州市',
	'340000': '合肥市',
	'350000': '福州市',
	'360000': '南昌市',
	'370000': '济南市',
	'410000': '郑州市',
	'420000': '武汉市',
	'430000': '长沙市',
	'440000': '广州市',
	'450000': '南宁市',
	'460000': '海口市',
	'500000': '重庆市',
	'510000': '成都市',
	'520000': '贵阳市',
	'530000': '昆明市',
	'540000': '拉萨市',
	'610000': '西安市',
	'620000': '兰州市',
	'630000': '西宁市',
	'640000': '银川市',
	'650000': '乌鲁木齐市',
	'710000': '台北市',
	'810000': '香港特别行政区',
	'820000': '澳门特别行政区'
}

const neighborMap = adjacency as Record<string, string[]>

/**
 * 给所有省份分色。
 * @param photoCodes 有照片的省份 adcode，这些省之间会尽量错开颜色
 */
export function buildProvinceColorMap(photoCodes: Iterable<string> = []): Record<string, RegionColor> {
	const codes = Object.keys(neighborMap).sort()
	const degree = (code: string) => (neighborMap[code] ?? []).length

	const highlighted = new Set(photoCodes)
	// 先安排有照片的省，再安排其余省份；同组内按度数降序，颜色数量更少
	const ordered = [...codes].sort((a, b) => {
		const highlightDiff = Number(highlighted.has(b)) - Number(highlighted.has(a))
		if (highlightDiff !== 0) return highlightDiff
		return degree(b) - degree(a) || a.localeCompare(b)
	})

	const assigned: Record<string, number> = {}
	const usedByHighlighted = new Set<number>()

	for (const code of ordered) {
		const used = new Set<number>()
		for (const neighbor of neighborMap[code] ?? []) {
			const index = assigned[neighbor]
			if (index !== undefined) used.add(index)
		}
		// 有照片的省还要避开其他有照片省份的颜色
		if (highlighted.has(code)) {
			for (const index of usedByHighlighted) used.add(index)
		}

		let index = 0
		while (used.has(index) && index < REGION_PALETTE.length) index += 1

		// 调色板用完就退而求其次：选「邻居用得最少」的那个
		if (index >= REGION_PALETTE.length) {
			const counts = new Array(REGION_PALETTE.length).fill(0)
			for (const neighbor of neighborMap[code] ?? []) {
				const usedIndex = assigned[neighbor]
				if (usedIndex !== undefined) counts[usedIndex] += 1
			}
			index = counts.indexOf(Math.min(...counts))
		}

		assigned[code] = index
		if (highlighted.has(code)) usedByHighlighted.add(index)
	}

	const result: Record<string, RegionColor> = {}
	for (const code of codes) result[code] = REGION_PALETTE[assigned[code] ?? 0]
	return result
}
