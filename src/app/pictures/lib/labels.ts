/**
 * 地图文字标注的排布。
 *
 * 标注不放在倾斜的 3D 平面里（那样字会被压扁），而是在屏幕空间按相机变换算出位置，
 * 所以字永远是正的、清楚的。字会互相压住时，往四周挪一挪；挪不开就再往远一点试。
 */

export type LabelInput = {
	/** 唯一标识，通常是 adcode */
	key: string
	/** 省份/城市中心在平面上的百分比坐标 */
	x: number
	y: number
	text: string
	/** 越大越优先占位（用来让省会先占位置） */
	priority?: number
	/** 手动微调，单位是屏幕像素 */
	offset?: { dx: number; dy: number }
}

export type PlacedLabel = {
	key: string
	text: string
	bold: boolean
	/** 相对容器中心的像素坐标 */
	left: number
	top: number
}

type PlaceOptions = {
	/** 平面坐标百分比 → 相对容器中心的屏幕像素 */
	project: (point: { x: number; y: number }) => { x: number; y: number }
	fontSize: number
	/** 加粗的字宽一点 */
	isBold?: (label: LabelInput) => boolean
	/** 允许的位移尝试，默认向下/上/左右错开 */
	offsets?: Array<[number, number]>
}

const DEFAULT_OFFSETS: Array<[number, number]> = [
	[0, 0],
	[0, -13],
	[0, 13],
	[-18, 0],
	[18, 0],
	[-18, -13],
	[18, -13],
	[-18, 13],
	[18, 13],
	[0, -26],
	[0, 26],
	[-32, 0],
	[32, 0],
	[0, -39],
	[0, 39]
]

function textWidth(text: string, fontSize: number, bold: boolean): number {
	// 中文按 1em 算，英文/数字窄一些
	let width = 0
	for (const char of text) {
		width += /[\u4e00-\u9fa5]/.test(char) ? fontSize : fontSize * 0.62
	}
	return width * (bold ? 1.03 : 1)
}

type Box = { left: number; right: number; top: number; bottom: number }

function overlaps(a: Box, b: Box): boolean {
	const padding = 1.5
	return a.left - padding < b.right && a.right + padding > b.left && a.top - padding < b.bottom && a.bottom + padding > b.top
}

export function placeLabels(inputs: LabelInput[], options: PlaceOptions): PlacedLabel[] {
	const { project, fontSize, isBold, offsets = DEFAULT_OFFSETS } = options
	const height = fontSize * 1.5

	const ordered = [...inputs].sort((a, b) => {
		const boldDiff = Number(Boolean(isBold?.(b))) - Number(Boolean(isBold?.(a)))
		if (boldDiff !== 0) return boldDiff
		return (b.priority ?? 0) - (a.priority ?? 0)
	})

	const placed: PlacedLabel[] = []
	const boxes: Box[] = []

	for (const input of ordered) {
		const anchor = project(input)
		const bold = Boolean(isBold?.(input))
		const width = textWidth(input.text, fontSize, bold)
		const base = { dx: input.offset?.dx ?? 0, dy: input.offset?.dy ?? 0 }

		let chosen: { left: number; top: number } | null = null

		for (const [dx, dy] of offsets) {
			const left = anchor.x + base.dx + dx
			const top = anchor.y + base.dy + dy
			const box: Box = { left: left - width / 2, right: left + width / 2, top: top - height / 2, bottom: top + height / 2 }
			if (!boxes.some(other => overlaps(box, other))) {
				boxes.push(box)
				chosen = { left, top }
				break
			}
		}

		// 实在挪不开也照常显示，避免「省份名字不见了」
		if (!chosen) {
			const left = anchor.x + base.dx
			const top = anchor.y + base.dy
			boxes.push({ left: left - width / 2, right: left + width / 2, top: top - height / 2, bottom: top + height / 2 })
			chosen = { left, top }
		}

		placed.push({ key: input.key, text: input.text, bold, left: chosen.left, top: chosen.top })
	}

	return placed
}
