'use client'

import { useEffect, useState } from 'react'

/**
 * 首页时钟卡用的「IP 定位 + 实时天气」。
 *
 * 全静态站点，所以直接找了几家允许跨域、免密钥的公开接口：
 * - 中文省市：ip.zxinc.org（返回中国 / 广西区 / 柳州市 这种，用制表符分隔）
 * - 经纬度：api.ip.sb，失败再退 ipinfo.io
 * - 天气：open-meteo（支持中文地理编码，不用 key）
 *
 * 结果缓存 30 分钟，避免每次刷新都打一遍接口；任何一步失败都只是不显示，
 * 不影响时钟本身。
 */

export interface LocationWeather {
	province?: string
	city?: string
	temperature?: number
	weatherCode?: number
	isDay?: boolean
	loading: boolean
}

interface CachePayload extends Omit<LocationWeather, 'loading'> {
	timestamp: number
}

const CACHE_KEY = 'home-location-weather-v1'
const CACHE_TTL = 30 * 60 * 1000
const REQUEST_TIMEOUT = 6000

async function fetchJson<T>(url: string): Promise<T | null> {
	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

	try {
		const res = await fetch(url, { signal: controller.signal })
		if (!res.ok) return null
		return (await res.json()) as T
	} catch {
		return null
	} finally {
		clearTimeout(timer)
	}
}

/** 中文省市：返回的 country 形如 "中国\t广西区\t\t柳州市" */
async function fetchChineseRegion() {
	const data = await fetchJson<{ data?: { country?: string } }>('https://ip.zxinc.org/api.php?type=json')
	const raw = data?.data?.country
	if (!raw) return null

	const parts = raw
		.split('\t')
		.map(part => part.trim())
		.filter(Boolean)

	// ["中国", "广西区", "柳州市"]
	const province = parts[1]?.replace(/(特别行政区|自治区|省|市|区)$/, '') ?? ''
	const city = parts[2]?.replace(/(市|区)$/, '') ?? ''

	if (!province && !city) return null
	return { province, city }
}

interface Coordinates {
	latitude?: number
	longitude?: number
	city?: string
	region?: string
	loc?: string
}

async function fetchCoordinates() {
	const sb = await fetchJson<Coordinates>('https://api.ip.sb/geoip')
	if (sb?.latitude !== undefined && sb?.longitude !== undefined) {
		return { latitude: sb.latitude, longitude: sb.longitude, city: sb.city, region: sb.region }
	}

	const ipinfo = await fetchJson<Coordinates>('https://ipinfo.io/json')
	if (ipinfo?.loc) {
		const [lat, lon] = ipinfo.loc.split(',').map(Number)
		if (Number.isFinite(lat) && Number.isFinite(lon)) {
			return { latitude: lat, longitude: lon, city: ipinfo.city, region: ipinfo.region }
		}
	}

	return null
}

/** 没有经纬度时，用城市名去 open-meteo 反查 */
async function geocode(name: string) {
	if (!name) return null
	const data = await fetchJson<{ results?: Array<{ latitude: number; longitude: number }> }>(
		`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=zh&format=json`
	)
	const first = data?.results?.[0]
	return first ? { latitude: first.latitude, longitude: first.longitude } : null
}

interface WeatherPayload {
	current?: { temperature_2m?: number; weather_code?: number; is_day?: number }
}

async function fetchWeather(latitude: number, longitude: number) {
	const data = await fetchJson<WeatherPayload>(
		`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,is_day&timezone=auto`
	)
	if (!data?.current || data.current.temperature_2m === undefined) return null

	return {
		temperature: data.current.temperature_2m,
		weatherCode: data.current.weather_code ?? 0,
		isDay: (data.current.is_day ?? 1) === 1
	}
}

export async function loadLocationWeather(): Promise<Omit<LocationWeather, 'loading'>> {
	const [region, coordinates] = await Promise.all([fetchChineseRegion(), fetchCoordinates()])

	let latitude = coordinates?.latitude
	let longitude = coordinates?.longitude

	if (latitude === undefined || longitude === undefined) {
		const fallbackName = region?.city || region?.province || coordinates?.city || ''
		const geo = await geocode(fallbackName)
		if (geo) {
			latitude = geo.latitude
			longitude = geo.longitude
		}
	}

	if (latitude === undefined || longitude === undefined) {
		return { province: region?.province, city: region?.city }
	}

	const weather = await fetchWeather(latitude, longitude)

	return {
		province: region?.province,
		city: region?.city || coordinates?.city,
		temperature: weather?.temperature,
		weatherCode: weather?.weatherCode,
		isDay: weather?.isDay
	}
}

export function useLocationWeather() {
	const [state, setState] = useState<LocationWeather>({ loading: true })

	useEffect(() => {
		let cancelled = false

		const readCache = (): CachePayload | null => {
			try {
				const raw = sessionStorage.getItem(CACHE_KEY)
				if (!raw) return null
				const parsed = JSON.parse(raw) as CachePayload
				if (!parsed?.timestamp || Date.now() - parsed.timestamp > CACHE_TTL) return null
				return parsed
			} catch {
				return null
			}
		}

		const cached = readCache()
		if (cached) {
			const { timestamp, ...rest } = cached
			setState({ ...rest, loading: false })
			return
		}

		void (async () => {
			const result = await loadLocationWeather()
			if (cancelled) return

			setState({ ...result, loading: false })

			if (result.province || result.city || result.temperature !== undefined) {
				try {
					sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...result, timestamp: Date.now() }))
				} catch {
					// 隐私模式下 sessionStorage 可能不可用，忽略即可
				}
			}
		})()

		return () => {
			cancelled = true
		}
	}, [])

	return state
}

const WEATHER_LABELS: Record<number, string> = {
	0: '晴',
	1: '少云',
	2: '多云',
	3: '阴',
	45: '雾',
	48: '雾凇',
	51: '毛毛雨',
	53: '毛毛雨',
	55: '毛毛雨',
	56: '冻雨',
	57: '冻雨',
	61: '小雨',
	63: '中雨',
	65: '大雨',
	66: '冻雨',
	67: '冻雨',
	71: '小雪',
	73: '中雪',
	75: '大雪',
	77: '雪粒',
	80: '阵雨',
	81: '阵雨',
	82: '强阵雨',
	85: '阵雪',
	86: '阵雪',
	95: '雷阵雨',
	96: '雷阵雨',
	99: '雷阵雨'
}

/** WMO 天气代码 → 中文描述 */
export function describeWeather(code?: number) {
	if (code === undefined) return ''
	return WEATHER_LABELS[code] ?? ''
}

/** WMO 天气代码 → 图标分组 */
export function weatherKind(code?: number): 'sun' | 'cloud' | 'rain' | 'snow' | 'storm' | 'fog' {
	if (code === undefined) return 'cloud'
	if (code === 0 || code === 1) return 'sun'
	if (code === 2 || code === 3) return 'cloud'
	if (code === 45 || code === 48) return 'fog'
	if (code >= 51 && code <= 67) return 'rain'
	if (code >= 71 && code <= 77) return 'snow'
	if (code >= 80 && code <= 82) return 'rain'
	if (code === 85 || code === 86) return 'snow'
	if (code >= 95) return 'storm'
	return 'cloud'
}
