/**
 * 中国地图的极简地理工具：只做「经纬度 → 平面坐标 → SVG 路径」这一件事。
 *
 * 数据来自阿里 DataV 的行政区划 GeoJSON：
 * - 全国省份：`/geo/china.json`（打包在 public 里，首屏不依赖外网）
 * - 某省的城市：`https://geo.datav.aliyun.com/areas_v3/bound/{adcode}_full.json`（按需拉取，带内存缓存）
 */

export type GeoFeature = {
	type: 'Feature'
	properties: {
		name?: string
		adcode?: number | string
		center?: number[]
		centroid?: number[]
		level?: string
		childrenNum?: number
	}
	geometry: {
		type: 'Polygon' | 'MultiPolygon'
		coordinates: number[][][] | number[][][][]
	}
}

export type GeoCollection = {
	type: 'FeatureCollection'
	features: GeoFeature[]
}

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number }

export type Point = { x: number; y: number }

/** 参考纬度：让中国的横纵比例看起来正常（等距圆柱投影 + 纬度压缩） */
const LAT0 = 35
const LON_SCALE = Math.cos((LAT0 * Math.PI) / 180)

/** 经纬度 → 平面坐标（y 轴翻转，适配 SVG） */
export function project(lonLat: number[]): Point {
	return { x: lonLat[0] * LON_SCALE, y: -lonLat[1] }
}

export function ringsOf(feature: GeoFeature): number[][][] {
	const coordinates = feature.geometry.coordinates
	if (feature.geometry.type === 'Polygon') return coordinates as number[][][]
	return (coordinates as number[][][][]).flat()
}

/** 把一个 feature 的所有环拼成一条 SVG path */
export function featurePath(feature: GeoFeature): string {
	let d = ''
	for (const ring of ringsOf(feature)) {
		for (let i = 0; i < ring.length; i++) {
			const { x, y } = project(ring[i])
			d += `${i === 0 ? 'M' : 'L'}${x.toFixed(3)} ${y.toFixed(3)}`
		}
		d += 'Z'
	}
	return d
}

export function featuresBounds(features: GeoFeature[], options: { minLat?: number } = {}): Bounds {
	let minX = Infinity
	let minY = Infinity
	let maxX = -Infinity
	let maxY = -Infinity

	for (const feature of features) {
		for (const ring of ringsOf(feature)) {
			for (const point of ring) {
				// 南海诸岛的零星岛礁在纬度 3° 左右，会把地图撑得很高，按需忽略
				if (options.minLat !== undefined && point[1] < options.minLat) continue
				const { x, y } = project(point)
				if (x < minX) minX = x
				if (y < minY) minY = y
				if (x > maxX) maxX = x
				if (y > maxY) maxY = y
			}
		}
	}

	return { minX, minY, maxX, maxY }
}

export function centerOf(feature: GeoFeature): Point | null {
	const c = feature.properties.center ?? feature.properties.centroid
	if (!c || c.length < 2) return null
	return project(c)
}

/** 单个 feature 的包围盒，用来给标注排优先级（大省先占位） */
export function boundsOf(feature: GeoFeature): Bounds {
	let minX = Infinity
	let minY = Infinity
	let maxX = -Infinity
	let maxY = -Infinity

	for (const ring of ringsOf(feature)) {
		for (const point of ring) {
			const { x, y } = project(point)
			if (x < minX) minX = x
			if (y < minY) minY = y
			if (x > maxX) maxX = x
			if (y > maxY) maxY = y
		}
	}

	return { minX, minY, maxX, maxY }
}

/** 省份/城市的简称：地图上写「广东」比「广东省」清爽 */
const SHORT_NAMES: Record<string, string> = {
	'110000': '北京',
	'120000': '天津',
	'130000': '河北',
	'140000': '山西',
	'150000': '内蒙古',
	'210000': '辽宁',
	'220000': '吉林',
	'230000': '黑龙江',
	'310000': '上海',
	'320000': '江苏',
	'330000': '浙江',
	'340000': '安徽',
	'350000': '福建',
	'360000': '江西',
	'370000': '山东',
	'410000': '河南',
	'420000': '湖北',
	'430000': '湖南',
	'440000': '广东',
	'450000': '广西',
	'460000': '海南',
	'500000': '重庆',
	'510000': '四川',
	'520000': '贵州',
	'530000': '云南',
	'540000': '西藏',
	'610000': '陕西',
	'620000': '甘肃',
	'630000': '青海',
	'640000': '宁夏',
	'650000': '新疆',
	'710000': '台湾',
	'810000': '香港',
	'820000': '澳门'
}

export function shortProvinceName(code: string, fallback: string): string {
	return SHORT_NAMES[code] ?? fallback.replace(/(省|市|自治区|特别行政区)$/u, '')
}

export function shortCityName(name: string): string {
	return name
		.replace(/市$/u, '')
		.replace(/(土家族苗族|土家族|苗族|彝族|藏族|壮族|回族|蒙古族|朝鲜族|白族|傣族|景颇族|哈尼族|傈僳族|布依族|侗族|瑶族|羌族|纳西族|拉祜族|佤族|水族|仡佬族|黎族|畲族|满族|蒙古族|柯尔克孜|哈萨克|锡伯|塔吉克|裕固|东乡|保安|撒拉|土族|达斡尔|鄂温克|鄂伦春|赫哲|独龙|怒族|德昂|阿昌|普米|基诺|布朗|毛南|仫佬|京族|高山族)自治州$/u, '自治州')
		.replace(/地区$/u, '')
		.replace(/盟$/u, '')
}


/** 全国地图里的「南海诸岛」小图（adcode 是字符串），不参与交互 */
export function isInteractive(feature: GeoFeature): boolean {
	return typeof feature.properties.adcode === 'number' && Boolean(feature.properties.name)
}

const provinceCache = new Map<string, GeoCollection>()

/** 拉取某个省的城市级数据（DataV），失败返回 null */
export async function fetchProvinceGeo(adcode: string | number): Promise<GeoCollection | null> {
	const key = String(adcode)
	const cached = provinceCache.get(key)
	if (cached) return cached

	try {
		const res = await fetch(`https://geo.datav.aliyun.com/areas_v3/bound/${key}_full.json`)
		if (!res.ok) return null
		const data = (await res.json()) as GeoCollection
		provinceCache.set(key, data)
		return data
	} catch {
		return null
	}
}
