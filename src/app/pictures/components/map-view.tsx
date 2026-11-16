'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus, RefreshCcw } from 'lucide-react'
import { centerOf, featurePath, featuresBounds, isInteractive, type GeoCollection, type GeoFeature, type Point } from '../lib/geo'
import type { Photo } from '../types'
import CityPin from './city-pin'

const PLANE_WIDTH = 1000
/** 地图平面的倾斜角度，制造「三维」俯视感 */
const TILT = 42
const MIN_ZOOM = 0.35
const MAX_ZOOM = 16
/** 低于这个纬度的点（南海诸岛）不参与取景，避免地图被撑高、主体变小 */
const BOUNDS_MIN_LAT = 17.5
/** 倾斜后屏幕上的纵向压缩比例，取景换算时要带上 */
const COS_TILT = Math.cos((TILT * Math.PI) / 180)

type MapViewProps = {
	china: GeoCollection
	province: GeoFeature | null
	cities: GeoCollection | null
	loadingCities: boolean
	photosByCity: Map<string, Photo[]>
	/** 每个省有多少张照片，用来在全国视图上做提示 */
	photoCountByProvince?: Map<string, number>
	onProvinceClick: (feature: GeoFeature) => void
	onCityClick: (feature: GeoFeature) => void
	onReset: () => void
}

type Camera = { scale: number; x: number; y: number }

export default function MapView({
	china,
	province,
	cities,
	loadingCities,
	photosByCity,
	photoCountByProvince,
	onProvinceClick,
	onCityClick,
	onReset
}: MapViewProps) {
	const sceneRef = useRef<HTMLDivElement>(null)
	const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null)
	const movedRef = useRef(false)

	const [size, setSize] = useState({ width: 0, height: 0 })
	const [camera, setCamera] = useState<Camera>({ scale: 1, x: 0, y: 0 })
	const [dragging, setDragging] = useState(false)
	const [hoveredCode, setHoveredCode] = useState<string | null>(null)
	const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string } | null>(null)

	const chinaFeatures = useMemo(() => china.features.filter(isInteractive), [china])
	const chinaBounds = useMemo(() => featuresBounds(chinaFeatures, { minLat: BOUNDS_MIN_LAT }), [chinaFeatures])

	const widthUnits = chinaBounds.maxX - chinaBounds.minX
	const heightUnits = chinaBounds.maxY - chinaBounds.minY
	const pxPerUnit = PLANE_WIDTH / widthUnits
	const planeWidth = PLANE_WIDTH
	const planeHeight = heightUnits * pxPerUnit

	const chinaPaths = useMemo(
		() =>
			chinaFeatures.map(feature => ({
				feature,
				code: String(feature.properties.adcode),
				name: feature.properties.name ?? '',
				d: featurePath(feature)
			})),
		[chinaFeatures]
	)

	const cityPaths = useMemo(
		() =>
			(cities?.features ?? []).map(feature => ({
				feature,
				code: String(feature.properties.adcode),
				name: feature.properties.name ?? '',
				d: featurePath(feature)
			})),
		[cities]
	)

	/** 平面坐标 → 百分比（用于绝对定位的图钉） */
	const toPercent = useCallback(
		(point: Point) => ({
			x: ((point.x - chinaBounds.minX) / widthUnits) * 100,
			y: ((point.y - chinaBounds.minY) / heightUnits) * 100
		}),
		[chinaBounds.minX, chinaBounds.minY, widthUnits, heightUnits]
	)

	// 监听容器尺寸，用来计算初始/复位视角
	useEffect(() => {
		const element = sceneRef.current
		if (!element) return
		const observer = new ResizeObserver(entries => {
			const rect = entries[0].contentRect
			setSize({ width: rect.width, height: rect.height })
		})
		observer.observe(element)
		return () => observer.disconnect()
	}, [])

	// 视角：全国 → 适配窗口；选中省份 → 适配该省边界
	useEffect(() => {
		if (!size.width || !size.height) return

		if (!province) {
			const scale = Math.min((size.width * 0.94) / planeWidth, (size.height * 0.8) / (planeHeight * COS_TILT))
			setCamera({ scale, x: 0, y: 0 })
			return
		}

		const bounds = featuresBounds([province], { minLat: BOUNDS_MIN_LAT })
		const provinceWidth = (bounds.maxX - bounds.minX) * pxPerUnit
		const provinceHeight = (bounds.maxY - bounds.minY) * pxPerUnit
		const scale = Math.min((size.width * 0.9) / provinceWidth, (size.height * 0.78) / (provinceHeight * COS_TILT))
		const centerX = ((bounds.minX + bounds.maxX) / 2 - chinaBounds.minX) * pxPerUnit - planeWidth / 2
		const centerY = ((bounds.minY + bounds.maxY) / 2 - chinaBounds.minY) * pxPerUnit - planeHeight / 2

		// 平面绕自身中心旋转，所以纵向偏移要乘 cos(TILT) 才能落在屏幕中心
		setCamera({ scale, x: -centerX * scale, y: -centerY * COS_TILT * scale })
	}, [province, size.width, size.height, pxPerUnit, planeHeight, planeWidth, chinaBounds.minX, chinaBounds.minY])

	const zoomBy = useCallback((factor: number, clientX?: number, clientY?: number) => {
		const element = sceneRef.current
		if (!element) return
		const rect = element.getBoundingClientRect()
		const focusX = (clientX ?? rect.left + rect.width / 2) - rect.left - rect.width / 2
		const focusY = (clientY ?? rect.top + rect.height / 2) - rect.top - rect.height / 2

		setCamera(previous => {
			const nextScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, previous.scale * factor))
			const ratio = nextScale / previous.scale
			return {
				scale: nextScale,
				x: focusX - (focusX - previous.x) * ratio,
				y: focusY - (focusY - previous.y) * ratio
			}
		})
	}, [])

	useEffect(() => {
		const element = sceneRef.current
		if (!element) return
		const handleWheel = (event: WheelEvent) => {
			event.preventDefault()
			zoomBy(event.deltaY > 0 ? 0.88 : 1.14, event.clientX, event.clientY)
		}
		element.addEventListener('wheel', handleWheel, { passive: false })
		return () => element.removeEventListener('wheel', handleWheel)
	}, [zoomBy])

	const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		if ((event.target as HTMLElement).closest('[data-pin]')) return
		dragRef.current = {
			startX: event.clientX,
			startY: event.clientY,
			originX: camera.x,
			originY: camera.y,
			moved: false
		}
		setDragging(true)
		setTooltip(null)
	}

	const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current
		if (!drag) return
		const dx = event.clientX - drag.startX
		const dy = event.clientY - drag.startY
		if (Math.hypot(dx, dy) > 5) drag.moved = true
		setCamera(previous => ({ ...previous, x: drag.originX + dx, y: drag.originY + dy }))
	}

	const endDrag = () => {
		movedRef.current = dragRef.current?.moved ?? false
		dragRef.current = null
		setDragging(false)
	}

	const handleFeatureClick = (feature: GeoFeature, handler: (feature: GeoFeature) => void) => {
		if (movedRef.current) return
		handler(feature)
	}

	const activeProvinceCode = province ? String(province.properties.adcode) : null
	/** 把「屏幕上 1px」换算成 SVG 用户单位，缩放时线宽才不会跟着变粗 */
	const strokeUnits = (pixels: number) => pixels / (pxPerUnit * camera.scale)

	return (
		<div
			ref={sceneRef}
			className='relative h-full w-full touch-none overflow-hidden select-none'
			style={{ cursor: dragging ? 'grabbing' : 'grab' }}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={endDrag}
			onPointerLeave={endDrag}>
			<div className='absolute inset-0 flex items-center justify-center'>
				<div
					style={{
						transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`,
						transition: dragging ? 'none' : 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)',
						transformStyle: 'preserve-3d'
					}}>
					<div
						className='relative'
						style={{ width: planeWidth, height: planeHeight, transform: `rotateX(${TILT}deg)`, transformStyle: 'preserve-3d' }}>
						{/* 挤出层：沿屏幕纵向偏移一点点，露出侧边，制造厚度感（按缩放反算，保持视觉厚度恒定） */}
						<div className='absolute inset-0' aria-hidden style={{ transform: `translateY(${10 / camera.scale}px)` }}>
							<svg width={planeWidth} height={planeHeight} viewBox={`${chinaBounds.minX} ${chinaBounds.minY} ${widthUnits} ${heightUnits}`} className='block'>
								{chinaPaths.map(({ code, d }) => (
									<path
										key={code}
										d={d}
										fill='#e6dccd'
										stroke='none'
										opacity={province && activeProvinceCode !== code ? 0 : 1}
									/>
								))}
								{cityPaths.map(({ code, d }) => (
									<path key={code} d={d} fill='#e6dccd' stroke='none' />
								))}
							</svg>
						</div>

						<div className='absolute inset-0' style={{ filter: `drop-shadow(0 ${34 / camera.scale}px ${24 / camera.scale}px rgba(70, 45, 30, 0.16))` }}>
							<svg
								width={planeWidth}
								height={planeHeight}
								viewBox={`${chinaBounds.minX} ${chinaBounds.minY} ${widthUnits} ${heightUnits}`}
								className='block'>
							{chinaPaths.map(({ feature, code, name, d }) => {
								const isActive = activeProvinceCode === code
								const isHovered = hoveredCode === code
								const hasPhotos = (photoCountByProvince?.get(code) ?? 0) > 0
								return (
									<path
										key={code}
										data-adcode={code}
										d={d}
										className='cursor-pointer transition-[fill,opacity] duration-200'
										stroke='rgba(91, 66, 63, 0.42)'
										strokeWidth={strokeUnits(1.1)}
										fill={
											isActive
												? 'rgba(47, 203, 231, 0.32)'
												: isHovered
													? 'rgba(47, 203, 231, 0.4)'
													: hasPhotos
														? 'rgba(47, 203, 231, 0.14)'
														: 'rgba(255, 255, 255, 0.94)'
										}
										opacity={province && !isActive ? 0.1 : 1}
										onMouseEnter={event => {
											setHoveredCode(code)
											if (!province) setTooltip({ x: event.clientX, y: event.clientY, name })
										}}
										onMouseLeave={() => {
											setHoveredCode(null)
											setTooltip(null)
										}}
										onClick={() => handleFeatureClick(feature, onProvinceClick)}
									/>
								)
							})}

							{cityPaths.map(({ feature, code, name, d }) => {
								const isHovered = hoveredCode === code
								return (
									<path
										key={code}
										data-adcode={code}
										d={d}
										className='cursor-pointer transition-[fill] duration-200'
										stroke='rgba(91, 66, 63, 0.3)'
										strokeWidth={strokeUnits(1)}
										fill={isHovered ? 'rgba(47, 203, 231, 0.34)' : 'rgba(255, 255, 255, 0.94)'}
										onMouseEnter={event => {
											setHoveredCode(code)
											setTooltip({ x: event.clientX, y: event.clientY, name })
										}}
										onMouseLeave={() => {
											setHoveredCode(null)
											setTooltip(null)
										}}
										onClick={() => handleFeatureClick(feature, onCityClick)}
									/>
								)
							})}
							</svg>
						</div>

						{province &&
							cityPaths.map(({ feature, code, name }) => {
								const center = centerOf(feature)
								if (!center) return null
								const position = toPercent(center)
								const photos = photosByCity.get(code) ?? []
								return (
									<CityPin
										key={code}
										x={position.x}
										y={position.y}
										scale={camera.scale}
										name={name}
										photos={photos}
										onOpen={() => onCityClick(feature)}
									/>
								)
							})}
					</div>
				</div>
			</div>

			{/* 悬浮提示 */}
			{tooltip && (
				<div
					className='pointer-events-none fixed z-50 rounded-lg bg-[#5B423F] px-2.5 py-1 text-xs text-white/95 shadow-lg'
					style={{ left: tooltip.x + 14, top: tooltip.y + 12 }}>
					{tooltip.name}
				</div>
			)}

			{/* 缩放控件 */}
			<div className='absolute right-5 bottom-6 flex flex-col gap-2'>
				<button
					type='button'
					onClick={() => zoomBy(1.35)}
					className='bg-card flex h-9 w-9 items-center justify-center rounded-xl border backdrop-blur-sm transition-colors hover:bg-white/80'
					aria-label='放大'>
					<Plus className='h-4 w-4' />
				</button>
				<button
					type='button'
					onClick={() => zoomBy(0.74)}
					className='bg-card flex h-9 w-9 items-center justify-center rounded-xl border backdrop-blur-sm transition-colors hover:bg-white/80'
					aria-label='缩小'>
					<Minus className='h-4 w-4' />
				</button>
				<button
					type='button'
					onClick={onReset}
					className='bg-card flex h-9 w-9 items-center justify-center rounded-xl border backdrop-blur-sm transition-colors hover:bg-white/80'
					aria-label='回到全国'>
					<RefreshCcw className='h-3.5 w-3.5' />
				</button>
			</div>

			{loadingCities && (
				<div className='absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-white/80 px-4 py-1.5 text-xs text-[#5B423F] shadow backdrop-blur'>
					正在加载省市地图…
				</div>
			)}
		</div>
	)
}
