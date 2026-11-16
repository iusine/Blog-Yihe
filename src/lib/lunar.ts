/**
 * 农历（阴历）换算。
 *
 * 这里不引入第三方农历库，直接用运行环境内置的 Intl 中国农历日历：
 *   new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month: 'long', day: 'numeric' })
 * 它给出的 month 已经是「正月 / 二月 / 闰六月 / 十一月」，day 是数字「7」，
 * 所以只需要把日数字再转成「初七 / 廿三」这种农历写法。
 *
 * 好处：没有依赖、没有打包体积、跟系统日历数据一致；
 * 环境不支持或取不到时返回 null，调用方按「没有农历」降级处理，不会抛错。
 */

const LUNAR_DAY_NAMES = [
	'初一',
	'初二',
	'初三',
	'初四',
	'初五',
	'初六',
	'初七',
	'初八',
	'初九',
	'初十',
	'十一',
	'十二',
	'十三',
	'十四',
	'十五',
	'十六',
	'十七',
	'十八',
	'十九',
	'二十',
	'廿一',
	'廿二',
	'廿三',
	'廿四',
	'廿五',
	'廿六',
	'廿七',
	'廿八',
	'廿九',
	'三十'
]

export type LunarDate = {
	/** 农历月，如「十月」「闰六月」 */
	month: string
	/** 农历日，如「初七」「廿三」 */
	day: string
	/** 完整写法，如「十月初七」 */
	text: string
}

/**
 * Intl 给的十一月/十二月，改成万年历习惯的「冬月/腊月」，
 * 这样日历卡片和黄历页面的写法保持一致（黄历数据来自 lunar-typescript，用的就是冬月/腊月）。
 */
function normalizeMonth(month: string): string {
	const isLeap = month.startsWith('闰')
	const name = isLeap ? month.slice(1) : month
	const mapped = name === '十一月' ? '冬月' : name === '十二月' ? '腊月' : name
	return isLeap ? `闰${mapped}` : mapped
}

// 复用同一个 formatter：Intl.DateTimeFormat 构造比较贵，日历卡片每次渲染要用 30 多次
let cachedFormatter: Intl.DateTimeFormat | null | undefined

function getFormatter(): Intl.DateTimeFormat | null {
	if (cachedFormatter !== undefined) return cachedFormatter
	try {
		cachedFormatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month: 'long', day: 'numeric' })
	} catch {
		cachedFormatter = null
	}
	return cachedFormatter
}

/**
 * 取某个公历日期对应的农历。
 * @param date 公历日期（按运行环境的本地时区）
 * @returns 农历月/日；环境不支持中国农历时返回 null
 */
export function getLunarDate(date: Date): LunarDate | null {
	const formatter = getFormatter()
	if (!formatter) return null

	try {
		const parts = formatter.formatToParts(date)
		const rawMonth = (parts.find(part => part.type === 'month')?.value ?? '').trim()
		const rawDay = (parts.find(part => part.type === 'day')?.value ?? '').trim()
		if (!rawMonth || !rawDay) return null

		const month = normalizeMonth(rawMonth)
		const dayNumber = Number(rawDay)
		// 正常情况下是数字（1~30）；万一某个实现直接给了「初七」，就原样保留
		const day = Number.isInteger(dayNumber) && dayNumber >= 1 && dayNumber <= LUNAR_DAY_NAMES.length ? LUNAR_DAY_NAMES[dayNumber - 1] : rawDay

		return { month, day, text: `${month}${day}` }
	} catch {
		return null
	}
}
