'use client'

import type { Photo } from '../types'
import PhotoStack from './photo-stack'

type CityPinProps = {
	/** 相对地图平面的百分比坐标 */
	x: number
	y: number
	/** 当前相机缩放，用来反向缩放，保证图钉在屏幕上大小恒定 */
	scale: number
	name: string
	photos: Photo[]
	onOpen: () => void
}

export default function CityPin({ x, y, scale, name, photos, onOpen }: CityPinProps) {
	const hasPhotos = photos.length > 0

	return (
		<div data-pin className='absolute z-10' style={{ left: `${x}%`, top: `${y}%` }}>
			<div className='relative' style={{ transform: `scale(${1 / scale})`, transformOrigin: '0 0' }}>
				<button
					type='button'
					onClick={onOpen}
					aria-label={name}
					className='absolute -top-2.5 -left-2.5 flex h-5 w-5 items-center justify-center'>
					<span
						className={
							hasPhotos
								? 'h-3.5 w-3.5 rounded-full border-2 border-white bg-[#2fcbe7] shadow-[0_0_0_5px_rgba(47,203,231,0.2),0_2px_6px_rgba(0,0,0,0.25)] transition-transform duration-200 hover:scale-125'
								: 'h-2 w-2 rounded-full border border-white bg-[#8b7667]/60 transition-transform duration-200 hover:scale-150'
						}
					/>
				</button>

				{hasPhotos && (
					<>
						<svg className='pointer-events-none absolute' style={{ left: 4, top: -36, width: 48, height: 42 }} viewBox='0 0 48 42'>
							<path className='photo-wall-guide' d='M3 40 C 18 40, 14 14, 44 9' fill='none' stroke='rgba(91,66,63,0.5)' strokeWidth='1.4' />
							<circle cx='3' cy='40' r='2.2' fill='rgba(91,66,63,0.5)' />
							<circle cx='44' cy='9' r='2.6' fill='#2fcbe7' stroke='white' strokeWidth='1.2' />
						</svg>

						<div className='absolute transition-transform duration-200 hover:-translate-y-1' style={{ left: 22, top: -128 }}>
							<PhotoStack photos={photos} onOpen={onOpen} />
						</div>
					</>
				)}
			</div>
		</div>
	)
}
