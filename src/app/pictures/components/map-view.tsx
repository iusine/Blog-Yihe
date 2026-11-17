'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus, RefreshCcw } from 'lucide-react'
import {
	boundsOf,
	centerOf,
	featurePath,
	featuresBounds,
	isInteractive,
	shortCityName,
	shortProvinceName,
	type GeoCollection,
	type GeoFeature,
	type Point
} from '../lib/geo'
import { buildProvinceColorMap, PROVINCE_CAPITALS } from '../lib/region-colors'
import { placeLabels, type LabelInput } from '../lib/labels'
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

const PROVINCE_FONT = 12
const CITY_FONT = 11
/** 首都（北京）在地图上永远加粗 */
const CAPITAL_CODE = '110000'

/** 小地方挤在一起时，手动把标签推开，避免互相压住 */
const LABEL_NUDGE: Record<string, { dx: number; dy: number }> = {
	'110000': { dx: -6, dy: -12 },
	'120000': { dx: 8, dy: 12 },
	'310000': { dx: 10, dy: -2 },
	'810000': { dx: 14, dy: -10 },
	'820000': { dx: -16, dy: 12 },
	'460000': { dx: 0, dy: 10 }
}

type MapViewProps = {
	china: GeoCollection
	province: GeoFeature | null
	cities: GeoCollection | null
	loadingCities: boolean
	photosByCity: Map<string, Photo[]>
	/** 每个省有多少张照片，决定这个省用不用高饱和色 */
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

	/** 省份配色：相邻省份一定不同色，有照片的省之间也尽量错开 */
	const provinceColors = useMemo(() => {
		const codes: string[] = []
		for (const [code, count] of photoCountByProvince ?? []) {
			if (count > 0) codes.push(code)
		}
		return buildProvinceColorMap(codes)
	}, [photoCountByProvince])

	const chinaPaths = useMemo(
		() =>
			chinaFeatures.map(feature => ({
				feature,
				code: String(feature.properties.adcode),
				name: feature.properties.name ?? '',
				d: featurePath(feature),
				area: (() => {
					const b = boundsOf(feature)
					return (b.maxX - b.minX) * (b.maxY - b.minY)
				})()
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

	/** 平面坐标 → 百分比（用于绝对定位的图钉和文字） */
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
	const capitalCityName = activeProvinceCode ? PROVINCE_CAPITALS[activeProvinceCode] : undefined
	/** 把「屏幕上 1px」换算成 SVG 用户单位，缩放时线宽才不会跟着变粗 */
	const strokeUnits = (pixels: number) => pixels / (pxPerUnit * camera.scale)

	/** 百分比坐标 → 相对容器中心的屏幕像素（和相机的平移/缩放一致） */
	const projectToScreen = useCallback(
		(point: { x: number; y: number }) => ({
			x: (point.x / 100 - 0.5) * planeWidth * camera.scale + camera.x,
			y: (point.y / 100 - 0.5) * planeHeight * COS_TILT * camera.scale + camera.y
		}),
		[planeWidth, planeHeight, camera.scale, camera.x, camera.y]
	)

	const provinceLabelInputs = useMemo<LabelInput[]>(() => {
		if (province) return []
		return chinaPaths.flatMap(({ feature, code, name, area }) => {
			const center = centerOf(feature)
			if (!center) return []
			const percent = toPercent(center)
			return [
				{
					key: code,
					x: percent.x,
					y: percent.y,
					text: shortProvinceName(code, name),
					priority: area,
					offset: LABEL_NUDGE[code]
				}
			]
		})
	}, [chinaPaths, province, toPercent])

	const cityLabelInputs = useMemo<LabelInput[]>(() => {
		if (!province) return []
		return cityPaths.flatMap(({ feature, code, name }) => {
			const center = centerOf(feature)
			if (!center) return []
			const percent = toPercent(center)
			const bounds = boundsOf(feature)
			return [
				{
					key: code,
					x: percent.x,
					y: percent.y,
					text: shortCityName(name),
					priority: (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY)
				}
			]
		})
	}, [cityPaths, province, toPercent])

	const isCityCapital = useCallback(
		(name: string) => Boolean(capitalCityName) && shortCityName(name) === shortCityName(capitalCityName as string),
		[capitalCityName]
	)

	const provinceLabels = useMemo(
		() =>
			placeLabels(provinceLabelInputs, {
				project: projectToScreen,
				fontSize: PROVINCE_FONT,
				isBold: label => label.key === CAPITAL_CODE
			}),
		[provinceLabelInputs, projectToScreen]
	)

	const cityLabels = useMemo(
		() =>
			placeLabels(cityLabelInputs, {
				project: projectToScreen,
				fontSize: CITY_FONT,
				isBold: label => {
					const path = cityPaths.find(item => item.code === label.key)
					return path ? isCityCapital(path.name) : false
				}
			}),
		[cityLabelInputs, projectToScreen, cityPaths, isCityCapital]
	)

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
						<div className='absolute inset-0' aria-hidden style={{ transform: `translateY(${10 / camera.scale}px)`, filter: 'brightness(0.93)' }}>
							<svg width={planeWidth} height={planeHeight} viewBox={`${chinaBounds.minX} ${chinaBounds.minY} ${widthUnits} ${heightUnits}`} className='block'>
								{chinaPaths.map(({ code, d }) => (
									<path
										key={code}
										d={d}
										fill={provinceColors[code]?.fill ?? '#e6dccd'}
										stroke='none'
										opacity={province && activeProvinceCode !== code ? 0 : 1}
									/>
								))}
								{cityPaths.map(({ code, d }) => (
									<path key={code} d={d} fill='#ece2d2' stroke='none' />
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
								const color = provinceColors[code]
								const baseFill = hasPhotos ? (color?.strong ?? '#9fdcf0') : (color?.fill ?? '#eef7f9')
								return (
									<path
										key={code}
										data-adcode={code}
										d={d}
										className='cursor-pointer transition-[fill,opacity] duration-200'
										stroke='rgba(91, 66, 63, 0.4)'
										strokeWidth={strokeUnits(1.1)}
										fill={isHovered ? '#7fd4ea' : isActive ? '#8fdcef' : baseFill}
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
								const hasPhotos = (photosByCity.get(code)?.length ?? 0) > 0
								return (
									<path
										key={code}
										data-adcode={code}
										d={d}
										className='cursor-pointer transition-[fill] duration-200'
										stroke='rgba(91, 66, 63, 0.28)'
										strokeWidth={strokeUnits(1)}
										fill={isHovered ? '#8fdcef' : hasPhotos ? '#bfe8f4' : '#f7fafb'}
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

			{/* 文字标注层：在倾斜平面之外，用相机变换算出位置，所以字永远是正的 */}
			<div className='pointer-events-none absolute inset-0 z-20 overflow-hidden'>
				{(province ? cityLabels : provinceLabels).map(label => (
					<span
						key={label.key}
						className='absolute whitespace-nowrap text-[#3a2b28]'
						style={{
							left: `calc(50% + ${label.left}px)`,
							top: `calc(50% + ${label.top}px)`,
							transform: 'translate(-50%, -50%)',
							fontSize: province ? CITY_FONT : PROVINCE_FONT,
							fontWeight: label.bold ? 700 : 500,
							letterSpacing: province ? 0.2 : 0.8,
							textShadow: '0 0 3px rgba(255,255,255,0.95), 0 0 7px rgba(255,255,255,0.75)'
						}}>
						{label.text}
					</span>
				))}
			</div>

			{/* 悬浮提示 */}
			{tooltip && (
				<div
					className='pointer-events-none fixed z-50 rounded-lg border border-white/15 bg-[#0b1220]/90 px-2.5 py-1 text-xs text-white shadow-lg backdrop-blur-md'
					style={{ left: tooltip.x + 14, top: tooltip.y + 12 }}>
					{tooltip.name}
				</div>
			)}

			{/* 缩放控件 */}
			<div className='absolute right-5 bottom-6 flex flex-col gap-2'>
				<button
					type='button'
					onClick={() => zoomBy(1.35)}
					className='bg-card flex h-9 w-9 items-center justify-center rounded-xl border backdrop-blur-sm transition-colors hover:bg-white/20'
					aria-label='放大'>
					<Plus className='h-4 w-4' />
				</button>
				<button
					type='button'
					onClick={() => zoomBy(0.74)}
					className='bg-card flex h-9 w-9 items-center justify-center rounded-xl border backdrop-blur-sm transition-colors hover:bg-white/20'
					aria-label='缩小'>
					<Minus className='h-4 w-4' />
				</button>
				<button
					type='button'
					onClick={onReset}
					className='bg-card flex h-9 w-9 items-center justify-center rounded-xl border backdrop-blur-sm transition-colors hover:bg-white/20'
					aria-label='回到全国'>
					<RefreshCcw className='h-3.5 w-3.5' />
				</button>
			</div>

			{loadingCities && (
				<div className='absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-white/12 px-4 py-1.5 text-xs text-white shadow backdrop-blur'>
					正在加载省市地图…
				</div>
			)}
		</div>
	)
}
