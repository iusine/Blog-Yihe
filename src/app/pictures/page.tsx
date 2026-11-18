'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { toast } from 'sonner'
import { ChevronLeft } from 'lucide-react'
import dynamic from 'next/dynamic'
import MapView from './components/map-view'
import FootprintStatsView from './components/footprint-stats'

// 照片墙和三个弹窗只在点击后出现，拆成独立 chunk，访客首屏不下载
const PhotoWall = dynamic(() => import('./components/photo-wall'), { ssr: false })
const PhotoInfoDialog = dynamic(() => import('./components/photo-info-dialog'), { ssr: false })
const PhotoEditDialog = dynamic(() => import('./components/photo-edit-dialog'), { ssr: false })
const PhotoUploadDialog = dynamic(() => import('./components/photo-upload-dialog'), { ssr: false })
import { fetchProvinceGeo, type GeoCollection, type GeoFeature } from './lib/geo'
import { groupPhotosByCity } from './lib/photos'
import { computeFootprint } from './lib/footprint'
import { pushPhotos, updatePhotoInfo } from './services/push-photos'
import type { CityRef, NewPhotoDraft, Photo, PhotoPatch } from './types'
import { useAuthStore } from '@/hooks/use-auth'

type WallTarget = { province: GeoFeature; city: GeoFeature }

function adcodeOf(feature: GeoFeature): string {
	return String(feature.properties.adcode)
}

function nameOf(feature: GeoFeature): string {
	return feature.properties.name ?? ''
}

export default function Page() {
	const [china, setChina] = useState<GeoCollection | null>(null)
	const [photos, setPhotos] = useState<Photo[]>([])
	const [province, setProvince] = useState<GeoFeature | null>(null)
	const [cities, setCities] = useState<GeoCollection | null>(null)
	const [loadingCities, setLoadingCities] = useState(false)
	const [wallTarget, setWallTarget] = useState<WallTarget | null>(null)
	const [infoPhoto, setInfoPhoto] = useState<Photo | null>(null)
	const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null)
	const [uploadOpen, setUploadOpen] = useState(false)

	const keyInputRef = useRef<HTMLInputElement>(null)
	/** 导入私钥之后要接着做的事（上传 / 修改），导入前先存起来 */
	const pendingActionRef = useRef<(() => void) | null>(null)
	const { isAuth, setPrivateKey } = useAuthStore()

	useEffect(() => {
		fetch('/geo/china.json')
			.then(res => {
				if (!res.ok) throw new Error(String(res.status))
				return res.json() as Promise<GeoCollection>
			})
			.then(setChina)
			.catch(error => {
				console.error('Failed to load china geo:', error)
				toast.error('地图数据加载失败，请刷新重试')
			})
	}, [])

	useEffect(() => {
		fetch('/pictures/list.json', { cache: 'no-store' })
			.then(res => (res.ok ? res.json() : []))
			.then((data: Photo[]) => setPhotos(Array.isArray(data) ? data : []))
			.catch(error => console.error('Failed to load photos:', error))
	}, [])

	const photosByCity = useMemo(() => groupPhotosByCity(photos), [photos])
	const photoCountByProvince = useMemo(() => {
		const counts = new Map<string, number>()
		for (const photo of photos) counts.set(photo.province, (counts.get(photo.province) ?? 0) + 1)
		return counts
	}, [photos])
	const footprint = useMemo(() => computeFootprint(photos), [photos])

	const openProvince = useCallback(async (feature: GeoFeature) => {
		const adcode = adcodeOf(feature)
		setProvince(feature)
		setCities(null)
		setLoadingCities(true)

		const geo = await fetchProvinceGeo(adcode)
		setLoadingCities(false)

		if (!geo) {
			toast.error('城市地图加载失败，请检查网络后重试')
			setProvince(null)
			return
		}
		setCities(geo)
	}, [])

	const resetToChina = useCallback(() => {
		setProvince(null)
		setCities(null)
		setWallTarget(null)
	}, [])

	const cityRef: CityRef | null = wallTarget
		? {
				province: adcodeOf(wallTarget.province),
				provinceName: nameOf(wallTarget.province),
				city: adcodeOf(wallTarget.city),
				cityName: nameOf(wallTarget.city)
			}
		: null

	/** 需要写入 GitHub 的操作：身份认证统一从首页完成 */
	const requireAuth = useCallback(
		(action: () => void) => {
			if (isAuth) {
				action()
				return
			}
			toast.info('请先回到首页完成身份认证')
		},
		[isAuth]
	)

	const requestUpload = useCallback(() => requireAuth(() => setUploadOpen(true)), [requireAuth])

	const requestEdit = useCallback(
		(photo: Photo) =>
			requireAuth(() => {
				setInfoPhoto(null)
				setEditingPhoto(photo)
			}),
		[requireAuth]
	)

	const handleKeyFile = async (file: File) => {
		try {
			const text = await file.text()
			await setPrivateKey(text)
			toast.success('私钥已导入')
			const action = pendingActionRef.current
			pendingActionRef.current = null
			action?.()
		} catch (error) {
			console.error('Failed to read private key:', error)
			toast.error('读取密钥文件失败')
		}
	}

	const handleUpload = async (drafts: NewPhotoDraft[]) => {
		if (!cityRef) throw new Error('没有选中城市')
		const next = await pushPhotos({ existing: photos, city: cityRef, drafts })
		setPhotos(next)
	}

	const handleSaveEdit = async (patch: PhotoPatch) => {
		const target = editingPhoto
		if (!target) return
		const next = await updatePhotoInfo({ photos, id: target.id, patch })
		setPhotos(next)
		setEditingPhoto(null)
	}

	const wallPhotos = wallTarget ? (photosByCity.get(adcodeOf(wallTarget.city)) ?? []) : []

	return (
		<div className='relative h-[100svh] w-full overflow-hidden'>
			{china ? (
				<MapView
					china={china}
					province={province}
					cities={cities}
					loadingCities={loadingCities}
					photosByCity={photosByCity}
					photoCountByProvince={photoCountByProvince}
					onProvinceClick={openProvince}
					onCityClick={city => {
						if (!province) return
						setWallTarget({ province, city })
					}}
					onReset={resetToChina}
				/>
			) : (
				<div className='flex h-full items-center justify-center'>
					<p className='text-secondary animate-pulse text-sm'>正在加载地图…</p>
				</div>
			)}

			{/* 顶部：足迹统计条（参考高德足迹）+ 面包屑 */}
			<div className='pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-4 max-sm:top-[5.5rem] sm:top-6'>
				<div className='pointer-events-auto flex items-center gap-4 rounded-2xl border bg-card/85 px-5 py-2.5 shadow-[0_18px_30px_-24px_rgba(70,45,30,0.45)] backdrop-blur-md'>
					<div className='flex flex-col justify-center'>
						<h1 className='text-[13px] leading-none font-semibold text-white'>我的足迹</h1>

						{province ? (
							<div className='mt-1.5 flex items-center gap-1 text-[10px]'>
								<button
									type='button'
									onClick={resetToChina}
									className='text-secondary inline-flex items-center gap-0.5 transition-colors hover:text-white'>
									<ChevronLeft className='h-3 w-3' />
									中国
								</button>
								<span className='text-secondary/50'>/</span>
								<span className='text-white'>{nameOf(province)}</span>
							</div>
						) : (
							<p className='text-secondary mt-1.5 text-[10px]'>点省份进入 · 滚轮/双指缩放 · 拖动平移</p>
						)}
					</div>

					<span className='h-9 w-px bg-white/15' />

					<FootprintStatsView stats={footprint} />
				</div>
			</div>

			{/* 左下：操作提示 */}
			{!wallTarget && (
				<p className='text-secondary pointer-events-none absolute bottom-5 left-5 z-10 text-[11px] max-sm:hidden'>
					{province ? '点城市查看/上传照片' : '照片会按城市归档，点击省份开始'}
				</p>
			)}

			<AnimatePresence>
				{wallTarget && (
					<PhotoWall
						key={adcodeOf(wallTarget.city)}
						cityName={nameOf(wallTarget.city)}
						provinceName={nameOf(wallTarget.province)}
						photos={wallPhotos}
						canUpload={isAuth}
						onClose={() => setWallTarget(null)}
						onUpload={requestUpload}
						onOpenPhoto={photo => setInfoPhoto(photo)}
					/>
				)}
			</AnimatePresence>

			{infoPhoto && (
				<PhotoInfoDialog
					photo={infoPhoto}
					cityName={cityRef?.cityName}
					onClose={() => setInfoPhoto(null)}
					onEdit={isAuth ? () => requestEdit(infoPhoto) : undefined}
				/>
			)}

			{editingPhoto && (
				<PhotoEditDialog
					photo={editingPhoto}
					cityName={cityRef?.cityName}
					onClose={() => setEditingPhoto(null)}
					onSave={handleSaveEdit}
				/>
			)}

			{uploadOpen && cityRef && <PhotoUploadDialog cityName={cityRef.cityName} onClose={() => setUploadOpen(false)} onSubmit={handleUpload} />}

			<input
				ref={keyInputRef}
				type='file'
				accept='.pem'
				className='hidden'
				onChange={async event => {
					const file = event.target.files?.[0]
					if (file) await handleKeyFile(file)
					if (event.currentTarget) event.currentTarget.value = ''
				}}
			/>
		</div>
	)
}
