'use client'

import type { FootprintStats } from '../lib/footprint'

type Props = {
	stats: FootprintStats
	/** 首页卡片上的小号版本 */
	compact?: boolean
}

/** 高德「我的足迹」那种数字为主的统计条 */
export default function FootprintStatsView({ stats, compact = false }: Props) {
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
						className={
							compact
								? 'text-[13px] leading-none font-semibold text-[#5B423F]'
								: 'text-[17px] leading-none font-semibold text-[#5B423F]'
						}>
						{item.value}
					</span>
					<span className={compact ? 'text-secondary mt-0.5 text-[9px] leading-none' : 'text-secondary mt-1 text-[10px] leading-none'}>
						{item.unit}
					</span>
				</div>
			))}
		</div>
	)
}
