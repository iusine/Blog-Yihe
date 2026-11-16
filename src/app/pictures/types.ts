export type Photo = {
	id: string
	/** 图片地址，例如 /images/pictures/xxxx.jpg */
	src: string
	title: string
	description?: string
	tags?: string[]
	/** 拍摄日期 YYYY-MM-DD */
	date: string
	/** 具体地点，例如「广州塔」 */
	location?: string
	/** 省级 adcode，例如 440000 */
	province: string
	/** 市级 adcode，例如 440100 */
	city: string
}

export type CityRef = {
	province: string
	provinceName: string
	city: string
	cityName: string
}

export type NewPhotoDraft = {
	file: File
	title: string
	description: string
	tags: string[]
	date: string
	location: string
}

/** 可以修改的照片信息（图片本身和归属城市不变） */
export type PhotoPatch = {
	title: string
	date: string
	location?: string
	description?: string
	tags?: string[]
}
