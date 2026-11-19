'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Lock } from 'lucide-react'
import { useSize } from '@/hooks/use-size'
import { hashString, scatterLayout } from '../lib/scatter'

const glassColors = [
	{ background: 'rgba(125, 211, 252, 0.18)', border: 'rgba(186, 230, 253, 0.38)' },
	{ background: 'rgba(196, 181, 253, 0.18)', border: 'rgba(221, 214, 254, 0.38)' },
	{ background: 'rgba(110, 231, 183, 0.16)', border: 'rgba(167, 243, 208, 0.36)' },
	{ background: 'rgba(253, 186, 116, 0.17)', border: 'rgba(254, 215, 170, 0.38)' },
	{ background: 'rgba(244, 114, 182, 0.15)', border: 'rgba(251, 207, 232, 0.36)' },
	{ background: 'rgba(147, 197, 253, 0.18)', border: 'rgba(191, 219, 254, 0.38)' }
]

export type WallItem = {
	id: string
	createdAt: string
	anonymous: boolean
	author?: string
	content: string
	ownerOnly: boolean
	/** 是否带「代发」标记 */
	hasDeliver?: boolean
	deliverEmail?: string
	sent?: boolean
}

type Props = {
	items: WallItem[]
	onOpen: (item: WallItem) => void
}

const clampPercent = (value: number, inset: number) => Math.min(100 - inset, Math.max(inset, value))

/**
 * 留言墙本体：卡片按 id 哈希散落、彼此轻微堆叠，可以拖动重新摆放。
 */
export default function MessageWall({ items, onOpen }: Props) {
	const containerRef = useRef<HTMLDivElement>(null)
	const dragRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null)
	const zRef = useRef(100)
	const { maxSM } = useSize()

	const [positions, setPositions] = useState<Record<string, { x: number; y: number; rotate: number; z: number }>>({})
	const [salt, setSalt] = useState(0)
	const [canvas, setCanvas] = useState({ width: 0, height: 0 })

	// 手机上卡片更窄，散落范围也要按卡片实际大小内缩，避免贴边被裁掉
	const cardWidth = maxSM ? 150 : 210
	const insetX = maxSM && canvas.width ? Math.min(40, ((cardWidth / 2 + 8) / canvas.width) * 100) : 8
	const insetY = maxSM && canvas.height ? Math.min(38, (93 / canvas.height) * 100) : 10
	const layoutKey = maxSM && canvas.width ? `${Math.round(canvas.width)}x${Math.round(canvas.height)}` : 'desktop'
	const lastLayoutKeyRef = useRef('')

	const base = useMemo(
		() => scatterLayout(items.map(item => item.id), salt, maxSM ? { paddingX: insetX, paddingY: insetY } : undefined),
		[items, salt, maxSM, insetX, insetY]
	)

	useEffect(() => {
		const element = containerRef.current
		if (!element) return
		const observer = new ResizeObserver(([entry]) => {
			setCanvas({ width: entry.contentRect.width, height: entry.contentRect.height })
		})
		observer.observe(element)
		return () => observer.disconnect()
	}, [])

	useEffect(() => {
		const reset = lastLayoutKeyRef.current !== layoutKey
		lastLayoutKeyRef.current = layoutKey
		setPositions(previous => {
			const prior = reset ? {} : previous
			const next: Record<string, { x: number; y: number; rotate: number; z: number }> = {}
			for (const [id, position] of base) {
				const source = prior[id] ?? position
				next[id] = { ...source, x: clampPercent(source.x, insetX), y: clampPercent(source.y, insetY) }
			}
			return next
		})
	}, [base, insetX, insetY, layoutKey])

	const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>, item: WallItem) => {
		const position = positions[item.id] ?? base.get(item.id)
		if (!position) return
		zRef.current += 1
		const z = zRef.current
		setPositions(previous => ({ ...previous, [item.id]: { ...previous[item.id], z } }))
		dragRef.current = {
			id: item.id,
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

		const dxPx = event.clientX - drag.startX
		const dyPx = event.clientY - drag.startY
		const dx = (dxPx / rect.width) * 100
		const dy = (dyPx / rect.height) * 100
		if (Math.hypot(dxPx, dyPx) > 6) drag.moved = true

		setPositions(previous =>
			previous[drag.id]
				? {
						...previous,
						[drag.id]: {
							...previous[drag.id],
							x: clampPercent(drag.originX + dx, insetX),
							y: clampPercent(drag.originY + dy, insetY)
						}
					}
				: previous
		)
	}

	const handlePointerUp = () => {
		const drag = dragRef.current
		dragRef.current = null
		if (!drag || drag.moved) return
		const item = items.find(entry => entry.id === drag.id)
		if (item) onOpen(item)
	}

	return (
		<div
			ref={containerRef}
			className='relative h-full w-full touch-none overflow-hidden'
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerLeave={handlePointerUp}>
			{items.length === 0 && (
				<div className='flex h-full flex-col items-center justify-center gap-3 text-center'>
					<div className='text-5xl'>📮</div>
					<p className='text-lg font-medium text-white'>留言墙还是空的</p>
					<p className='text-secondary max-w-xs text-xs leading-relaxed'>点右下角的「写留言」，留下你的第一条足迹吧。</p>
				</div>
			)}

			{items.map(item => {
				const position = positions[item.id] ?? base.get(item.id)
				if (!position) return null
				const glass = glassColors[hashString(item.id) % glassColors.length]

				return (
					<div
						key={item.id}
						role='button'
						tabIndex={0}
						onPointerDown={event => handlePointerDown(event, item)}
						onKeyDown={event => {
							if (event.key === 'Enter' || event.key === ' ') onOpen(item)
						}}
						className='absolute cursor-grab touch-none select-none active:cursor-grabbing'
						style={{
							width: cardWidth,
							left: `${clampPercent(position.x, insetX)}%`,
							top: `${clampPercent(position.y, insetY)}%`,
							zIndex: position.z,
							transform: `translate(-50%, -50%) rotate(${position.rotate}deg)`
						}}>
						<div
							className='relative rounded-[6px] border p-3 pb-6 shadow-[0_16px_30px_-18px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-shadow hover:shadow-[0_22px_38px_-18px_rgba(0,0,0,0.6)]'
							style={{ backgroundColor: glass.background, borderColor: glass.border }}>
							{/* 胶带 */}
							<span className='absolute -top-2 left-1/2 h-4 w-14 -translate-x-1/2 rotate-[-2deg] rounded-[2px] bg-white/15' />

							<div className='flex items-center gap-1.5 text-[10px] text-white/60'>
								<span className='truncate font-medium'>{item.anonymous ? '匿名' : item.author || '访客'}</span>
								{item.ownerOnly && (
									<span className='flex items-center gap-0.5 rounded-full bg-white/10 px-1.5 py-0.5'>
										<Lock className='h-2.5 w-2.5' />
										仅站主
									</span>
								)}
								{item.hasDeliver && <span className='rounded-full bg-[#2fcbe7]/20 px-1.5 py-0.5'>代发</span>}
								<span className='ml-auto shrink-0 max-sm:hidden'>{item.createdAt.slice(0, 10)}</span>
							</div>

							<p className='mt-2 line-clamp-5 text-[13px] leading-relaxed break-words whitespace-pre-wrap text-white/90'>{item.content}</p>
						</div>
					</div>
				)
			})}

			{items.length > 0 && (
				<div className='pointer-events-auto absolute right-6 bottom-24 flex flex-col items-end gap-2'>
					<button
						type='button'
						onClick={() => {
							setPositions({})
							setSalt(value => value + 1)
						}}
						className='bg-card rounded-xl border px-3 py-2 text-xs backdrop-blur-sm transition-colors hover:bg-white/20'>
						重新散落
					</button>
				</div>
			)}
		</div>
	)
}
