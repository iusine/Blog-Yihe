'use client'

import PicbedImage from '@/components/picbed-image'
import type { Photo } from '../types'

const CARD_LAYOUT = [
	{ left: 0, top: 0, rotate: -3, scale: 1, z: 30 },
	{ left: 14, top: -10, rotate: 7, scale: 0.9, z: 20 },
	{ left: 26, top: -19, rotate: -10, scale: 0.8, z: 10 }
]

/**
 * 城市上方「最近三张」缩略：第一张最大，第二、第三张在后面稍微小一点、错开一点。
 * 缩略图按原图比例显示（只限制最大宽高，不裁切），所以竖图就是竖的、横图就是横的。
 */
export default function PhotoStack({ photos, onOpen }: { photos: Photo[]; onOpen: () => void }) {
	const stack = photos.slice(0, 3)
	if (stack.length === 0) return null

	return (
		<button type='button' onClick={onOpen} className='relative block cursor-pointer' style={{ width: 138, height: 112 }}>
			{stack.map((photo, index) => {
				const layout = CARD_LAYOUT[index]
				return (
					<span
						key={photo.id}
						className='absolute block overflow-hidden rounded-[9px] border-[3px] border-white bg-white/10 shadow-[0_16px_28px_-16px_rgba(70,45,30,0.6)]'
						style={{
							left: layout.left,
							top: layout.top,
							transform: `rotate(${layout.rotate}deg) scale(${layout.scale})`,
							transformOrigin: 'left top',
							zIndex: layout.z
						}}>
						<PicbedImage
							src={photo.src}
							alt={photo.title}
							draggable={false}
							className='block rounded-[5px]'
							style={{ maxHeight: 78, maxWidth: 124, width: 'auto', height: 'auto' }}
						/>
					</span>
				)
			})}

			{photos.length > 3 && (
				<span className='absolute right-0 -bottom-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] text-white/95 shadow' style={{ zIndex: 40 }}>
					+{photos.length - 3}
				</span>
			)}
		</button>
	)
}
