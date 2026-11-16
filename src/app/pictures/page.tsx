'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { toast } from 'sonner'
import { ChevronLeft } from 'lucide-react'
import MapView from './components/map-view'
import PhotoWall from './components/photo-wall'
import PhotoInfoDialog from './components/photo-info-dialog'
import PhotoUploadDialog from './components/photo-upload-dialog'
import { fetchProvinceGeo, type GeoCollection, type GeoFeature } from './lib/geo'
import { groupPhotosByCity } from './lib/photos'
import { pushPhotos } from './services/push-photos'
import type { CityRef, NewPhotoDraft, Photo } from './types'
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
	const [uploadOpen, setUploadOpen] = useState(false)

	const keyInputRef = useRef<HTMLInputElement>(null)
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

	const requestUpload = useCallback(() => {
		if (isAuth) {
			setUploadOpen(true)
			return
		}
		keyInputRef.current?.click()
	}, [isAuth])

	const handleKeyFile = async (file: File) => {
		try {
			const text = await file.text()
			await setPrivateKey(text)
			toast.success('私钥已导入，可以上传照片了')
			setUploadOpen(true)
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

			{/* 顶部：标题 + 面包屑（放在中间，避开左上角的导航卡） */}
			<div className='pointer-events-none absolute inset-x-0 top-5 z-20 flex justify-center px-4 sm:top-7'>
				<div className='pointer-events-auto flex items-center gap-3 rounded-2xl border bg-card/85 px-4 py-2 shadow-[0_18px_30px_-24px_rgba(70,45,30,0.45)] backdrop-blur-md'>
					<h1 className='text-[15px] leading-none font-semibold text-[#5B423F]'>照片墙</h1>
					<span className='h-4 w-px bg-[#5B423F]/15' />

					{province ? (
						<div className='flex items-center gap-1 text-[11px]'>
							<button type='button' onClick={resetToChina} className='text-secondary inline-flex items-center gap-0.5 transition-colors hover:text-[#5B423F]'>
								<ChevronLeft className='h-3 w-3' />
								中国
							</button>
							<span className='text-secondary/50'>/</span>
							<span className='text-[#5B423F]'>{nameOf(province)}</span>
						</div>
					) : (
						<p className='text-secondary text-[11px]'>点省份进入 · 滚轮缩放 · 拖动平移</p>
					)}
				</div>
			</div>

			{/* 左下：操作提示 */}
			{!wallTarget && (
				<p className='text-secondary pointer-events-none absolute bottom-5 left-5 z-10 max-sm:hidden text-[11px]'>
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

			{infoPhoto && <PhotoInfoDialog photo={infoPhoto} cityName={cityRef?.cityName} onClose={() => setInfoPhoto(null)} />}

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
