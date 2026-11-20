/* 首页卡片的默认坐标：全部由常量推导，服务端和浏览器算出来完全一致。
 * 约定：left = 50% ± dx，top = 50% - 24px ± dy（24px 是原来 center.y 的固定偏移）。
 * 这样首屏 HTML 一到达，卡片就已经在最终位置上，不需要等 JS 量屏幕。 */
import { CARD_SPACING } from '@/consts'
import type { CardStyles } from './stores/config-store'

export type HomeCardKey = keyof CardStyles

/** 原 use-center 里 center.y = 屏幕高度的一半 - 24 */
const CENTER_Y_OFFSET = 24

export interface CardOffset {
	x: number
	y: number
}

/** 把 "50% + npx" 写成合法的 calc，负号单独拼，避免 calc(50% + -168px) 这类写法 */
function fromCenter(value: number, base = '50%'): string {
	if (!value) return base
	const sign = value > 0 ? '+' : '-'
	return `calc(${base} ${sign} ${Math.abs(value)}px)`
}

/** 每张卡相对屏幕中心的默认偏移（未手动拖过时用这个） */
export function getDefaultOffset(key: HomeCardKey, styles: CardStyles): CardOffset {
	const hi = styles.hiCard
	const nav = styles.navCard
	const clock = styles.clockCard
	const calendar = styles.calendarCard
	const music = styles.musicCard
	const social = styles.socialButtons
	const article = styles.articleCard
	const write = styles.writeButtons
	const art = styles.artCard
	const share = styles.shareCard
	const hat = styles.hatCard
	const beian = styles.beianCard

	switch (key) {
		case 'hiCard':
			return { x: -hi.width / 2, y: -hi.height / 2 }

		case 'artCard':
			return { x: -art.width / 2, y: -hi.height / 2 - art.height - CARD_SPACING }

		case 'clockCard':
			return { x: CARD_SPACING + hi.width / 2, y: -clock.offset - clock.height }

		case 'calendarCard':
			return { x: CARD_SPACING + hi.width / 2, y: -clock.offset + CARD_SPACING }

		case 'socialButtons':
			return { x: -social.width / 2, y: hi.height / 2 + CARD_SPACING }

		case 'shareCard':
			return { x: -hi.width / 2, y: hi.height / 2 + CARD_SPACING + social.height + CARD_SPACING }

		case 'articleCard':
			return { x: -hi.width / 2 - nav.width - CARD_SPACING, y: hi.height / 2 + CARD_SPACING }

		case 'writeButtons':
			return { x: CARD_SPACING + hi.width / 2, y: -clock.offset - write.height - CARD_SPACING / 2 - clock.height }

		case 'musicCard':
			return {
				x: CARD_SPACING + hi.width / 2 - music.offset,
				y: -clock.offset + CARD_SPACING + calendar.height + CARD_SPACING
			}

		case 'navCard':
			return { x: -hi.width / 2 - nav.width - CARD_SPACING, y: hi.height / 2 - nav.height }

		case 'hatCard':
			return { x: -hat.width / 2, y: -hat.height }

		case 'beianCard':
			return { x: hi.width / 2 - beian.width + 200, y: hi.height / 2 + CARD_SPACING + 180 }

		default:
			return { x: 0, y: 0 }
	}
}

/** 卡片的最终定位：CSS 字符串给 style，offsetX/offsetY 给拖拽层用 */
export function cardPosition(key: HomeCardKey, styles: CardStyles) {
	const style = styles[key] as { offsetX: number | null; offsetY: number | null }
	const fallback = getDefaultOffset(key, styles)

	const offsetX = style.offsetX ?? fallback.x
	const offsetY = style.offsetY ?? fallback.y

	return {
		left: fromCenter(offsetX),
		top: fromCenter(offsetY - CENTER_Y_OFFSET),
		offsetX,
		offsetY
	}
}
