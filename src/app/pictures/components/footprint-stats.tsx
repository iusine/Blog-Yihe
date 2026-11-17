'use client'

import type { FootprintStats } from '../lib/footprint'

type Props = {
	stats: FootprintStats
	/** 首页卡片上的小号版本 */
	compact?: boolean
	/** 深色底（图上）用浅色文字 */
	tone?: 'default' | 'light'
}

/** 高德「我的足迹」那种数字为主的统计条 */
export default function FootprintStatsView({ stats, compact = false, tone = 'default' }: Props) {
	const light = tone === 'light'
	const items = [
		{ key: 'photos', value: stats.photos, unit: '张照片' },
		{ key: 'cities', value: stats.cities, unit: '个城市' },
		{ key: 'places', value: stats.places, unit: '个地点' }
	]

	return (
		<div className={compact ? 'flex items-end gap-3' : 'flex items-end gap-4'}>
			{items.map(item => (
				<div key={item.key} className='flex flex-col items-center'>
					<span
						className={[
							compact ? 'text-[13px] leading-none font-semibold' : 'text-[17px] leading-none font-semibold',
							light ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]' : 'text-white'
						].join(' ')}>
						{item.value}
					</span>
					<span
						className={[
							compact ? 'mt-0.5 text-[9px] leading-none' : 'mt-1 text-[10px] leading-none',
							light ? 'text-white/80' : 'text-secondary'
						].join(' ')}>
						{item.unit}
					</span>
				</div>
			))}
		</div>
	)
}
