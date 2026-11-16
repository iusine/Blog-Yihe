'use client'

import type { Photo } from '../types'

const CARD_LAYOUT = [
	{ left: 0, top: 0, rotate: -3, scale: 1, z: 30 },
	{ left: 14, top: -10, rotate: 7, scale: 0.9, z: 20 },
	{ left: 26, top: -19, rotate: -10, scale: 0.8, z: 10 }
]

/**
 * 城市上方「最近三张」缩略：第一张最大，第二、第三张在后面稍微小一点、错开一点。
 */
export default function PhotoStack({ photos, onOpen }: { photos: Photo[]; onOpen: () => void }) {
	const stack = photos.slice(0, 3)
	if (stack.length === 0) return null

	return (
		<button type='button' onClick={onOpen} className='relative block cursor-pointer' style={{ width: 150, height: 118 }}>
			{stack.map((photo, index) => {
				const layout = CARD_LAYOUT[index]
				return (
					<span
						key={photo.id}
						className='absolute overflow-hidden rounded-[10px] border-[3px] border-white bg-white shadow-[0_16px_28px_-16px_rgba(70,45,30,0.6)]'
						style={{
							left: layout.left,
							top: layout.top,
							width: 118,
							height: 86,
							transform: `rotate(${layout.rotate}deg) scale(${layout.scale})`,
							zIndex: layout.z
						}}>
						<img src={photo.src} alt={photo.title} className='h-full w-full object-cover' draggable={false} />
					</span>
				)
			})}

			{photos.length > 3 && (
				<span className='absolute right-0 -bottom-1 rounded-full bg-[#5B423F] px-2 py-0.5 text-[10px] text-white/95 shadow' style={{ zIndex: 40 }}>
					+{photos.length - 3}
				</span>
			)}
		</button>
	)
}
