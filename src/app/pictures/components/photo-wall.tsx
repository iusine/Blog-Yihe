'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowLeft, Shuffle, Upload } from 'lucide-react'
import type { Photo } from '../types'
import { scatterLayout, type ScatterPosition } from '../lib/photos'

type PhotoWallProps = {
	cityName: string
	provinceName: string
	photos: Photo[]
	canUpload: boolean
	onClose: () => void
	onUpload: () => void
	onOpenPhoto: (photo: Photo) => void
}

export default function PhotoWall({ cityName, provinceName, photos, canUpload, onClose, onUpload, onOpenPhoto }: PhotoWallProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const dragRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null)
	const zRef = useRef(200)
	const [salt, setSalt] = useState(0)
	const [positions, setPositions] = useState<Record<string, ScatterPosition>>({})

	useEffect(() => {
		const layout = scatterLayout(photos, salt)
		setPositions(previous => {
			const next: Record<string, ScatterPosition> = {}
			for (const [id, position] of layout) {
				next[id] = previous[id] ?? position
			}
			return next
		})
	}, [photos, salt])

	const ordered = useMemo(() => photos, [photos])

	const bringToFront = (id: string) => {
		zRef.current += 1
		const z = zRef.current
		setPositions(previous => (previous[id] ? { ...previous, [id]: { ...previous[id], z } } : previous))
	}

	const handlePointerDown = (event: React.PointerEvent<HTMLElement>, photo: Photo) => {
		event.preventDefault()
		event.stopPropagation()
		const position = positions[photo.id]
		if (!position) return
		bringToFront(photo.id)
		dragRef.current = {
			id: photo.id,
			startX: event.clientX,
			startY: event.clientY,
			originX: position.x,
			originY: position.y,
			moved: false
		}
	}

	const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current
		const rect = containerRef.current?.getBoundingClientRect()
		if (!drag || !rect) return

		const dx = ((event.clientX - drag.startX) / rect.width) * 100
		const dy = ((event.clientY - drag.startY) / rect.height) * 100
		if (Math.hypot(dx, dy) > 0.4) drag.moved = true

		setPositions(previous =>
			previous[drag.id] ? { ...previous, [drag.id]: { ...previous[drag.id], x: drag.originX + dx, y: drag.originY + dy } } : previous
		)
	}

	const handlePointerUp = () => {
		const drag = dragRef.current
		dragRef.current = null
		if (!drag || drag.moved) return
		const photo = ordered.find(item => item.id === drag.id)
		if (photo) onOpenPhoto(photo)
	}

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.25 }}
			className='fixed inset-0 z-40 bg-[#f6efe6]/80 backdrop-blur-xl'>
			<div className='relative flex h-full w-full flex-col'>
				<header className='relative z-30 flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-8'>
					<div className='flex items-center gap-3'>
						<button
							type='button'
							onClick={onClose}
							className='bg-card flex h-9 w-9 items-center justify-center rounded-xl border transition-colors hover:bg-white'
							aria-label='返回地图'>
							<ArrowLeft className='h-4 w-4' />
						</button>
						<div>
							<p className='text-secondary text-[11px] tracking-wide'>
								{provinceName} · 照片墙
							</p>
							<h2 className='text-xl leading-tight font-semibold text-[#5B423F]'>{cityName}</h2>
						</div>
						<span className='text-secondary mt-3 text-xs'>{photos.length} 张</span>
					</div>

					<div className='flex items-center gap-2'>
						<button
							type='button'
							onClick={() => {
								setSalt(value => value + 1)
								setPositions({})
							}}
							className='bg-card flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs transition-colors hover:bg-white'
							disabled={photos.length === 0}>
							<Shuffle className='h-3.5 w-3.5' />
							重新散落
						</button>
						<button
							type='button'
							onClick={onUpload}
							className='brand-btn flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs'>
							<Upload className='h-3.5 w-3.5' />
							{canUpload ? '上传照片' : '导入私钥后上传'}
						</button>
					</div>
				</header>

				<div
					ref={containerRef}
					className='relative flex-1 touch-none overflow-hidden'
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onPointerLeave={handlePointerUp}>
					{photos.length === 0 && (
						<div className='flex h-full flex-col items-center justify-center gap-3 text-center'>
							<div className='text-5xl'>🖼️</div>
							<p className='text-lg font-medium text-[#5B423F]'>这座城市还没有照片</p>
							<p className='text-secondary max-w-xs text-xs leading-relaxed'>
								点右上角「上传照片」，第一次上传会要求导入 GitHub App 的 .pem 私钥。
							</p>
							<button type='button' onClick={onUpload} className='brand-btn mt-2 rounded-xl px-5 py-2 text-sm'>
								上传第一张
							</button>
						</div>
					)}

					{photos.map(photo => {
						const position = positions[photo.id]
						if (!position) return null
						return (
							<button
								key={photo.id}
								type='button'
								onPointerDown={event => handlePointerDown(event, photo)}
								className='absolute cursor-grab transition-shadow duration-200 select-none active:cursor-grabbing'
								style={{
									left: `${position.x}%`,
									top: `${position.y}%`,
									zIndex: position.z,
									transform: `translate(-50%, -50%) rotate(${position.rotate}deg) scale(${position.scale})`
								}}>
								<span className='block w-fit rounded-[10px] border-[6px] border-white bg-white pb-5 shadow-[0_18px_36px_-18px_rgba(60,40,30,0.55)] transition-shadow'>
									<img
										src={photo.src}
										alt={photo.title}
										className='block rounded-[4px]'
										style={{ maxHeight: 190, maxWidth: 330, width: 'auto', height: 'auto' }}
										draggable={false}
									/>
									<span className='mt-1.5 flex max-w-full items-center justify-between gap-2 px-1 text-[10px] text-[#5B423F]'>
										<span className='truncate'>{photo.title}</span>
										<span className='text-secondary shrink-0'>{photo.date}</span>
									</span>
								</span>
							</button>
						)
					})}

					{photos.length > 0 && (
						<p className='text-secondary pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px]'>
							拖动照片可以重新摆放 · 点一下查看照片信息
						</p>
					)}
				</div>
			</div>
		</motion.div>
	)
}
