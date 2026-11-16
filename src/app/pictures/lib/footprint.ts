'use client'

import useSWR from 'swr'
import { useMemo } from 'react'
import type { Photo } from '../types'

/** 足迹统计，参考高德「我的足迹」：照片数 / 城市数 / 地点数 */
export type FootprintStats = {
	photos: number
	cities: number
	places: number
}

/** 地址归一化：去空白、统一大小写，所以「白云山」「 白云山 」算同一个地点 */
export function normalizeAddress(value: string): string {
	return value.trim().replace(/\s+/g, '').toLowerCase()
}

/**
 * 统计足迹。
 * 地点按「城市 + 地址」去重：上传时填了同一个地址的照片算作一个地点；
 * 不同城市里的同名地址（比如两个城市都写「家」）算两个地点。
 */
export function computeFootprint(photos: Photo[]): FootprintStats {
	const cities = new Set<string>()
	const places = new Set<string>()

	for (const photo of photos) {
		if (!photo) continue
		if (photo.city) cities.add(photo.city)

		const address = normalizeAddress(photo.location ?? '')
		if (address) places.add(`${photo.city}|${address}`)
	}

	return { photos: photos.length, cities: cities.size, places: places.size }
}

const fetcher = async (url: string): Promise<Photo[]> => {
	const res = await fetch(url, { cache: 'no-store' })
	if (!res.ok) return []
	const data = await res.json()
	return Array.isArray(data) ? data : []
}

/** 首页卡片用：只读一份照片列表，算出足迹数字 */
export function usePhotoFootprint(): FootprintStats {
	const { data } = useSWR<Photo[]>('/pictures/list.json', fetcher, { revalidateOnFocus: false })
	return useMemo(() => computeFootprint(Array.isArray(data) ? data : []), [data])
}
