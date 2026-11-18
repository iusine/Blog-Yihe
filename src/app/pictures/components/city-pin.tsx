'use client'

import type { Photo } from '../types'
import PhotoStack from './photo-stack'

type CityPinProps = {
	/** 相对地图平面的百分比坐标 */
	x: number
	y: number
	/** 当前相机缩放，用来反向缩放，保证照片组在屏幕上大小恒定 */
	scale: number
	photos: Photo[]
	onOpen: () => void
}

/** 有照片的城市：在地图上挂一小组照片缩略图（城市圆点本身由标注层统一绘制） */
export default function CityPin({ x, y, scale, photos, onOpen }: CityPinProps) {
	if (photos.length === 0) return null

	return (
		<div data-pin className='absolute z-10' style={{ left: `${x}%`, top: `${y}%` }}>
			<div className='relative' style={{ transform: `scale(${1 / scale})`, transformOrigin: '0 0' }}>
				<svg className='pointer-events-none absolute' style={{ left: 4, top: -36, width: 48, height: 42 }} viewBox='0 0 48 42'>
					<path className='photo-wall-guide' d='M3 40 C 18 40, 14 14, 44 9' fill='none' stroke='rgba(91,66,63,0.5)' strokeWidth='1.4' />
					<circle cx='44' cy='9' r='2.6' fill='#2fcbe7' stroke='white' strokeWidth='1.2' />
				</svg>

				<div className='absolute transition-transform duration-200 hover:-translate-y-1' style={{ left: 22, top: -128 }}>
					<PhotoStack photos={photos} onOpen={onOpen} />
				</div>
			</div>
		</div>
	)
}
