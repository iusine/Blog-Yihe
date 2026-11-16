/**
 * 黄历（老黄历 / 万年历）数据。
 *
 * 这里用 `lunar-typescript`（6tail 的 6tail/lunar-typescript，MIT）来做换算，
 * 它给出的宜忌、值神、建除、二十八宿、彭祖百忌、吉神凶煞等字段就是各万年历 App 用的那套数据，
 * 自己手写一份「通书」既不可靠也没必要。
 *
 * 说明：这个文件只被 /huangli 页面引用，lunar-typescript（约 450KB）只会打进该路由的 chunk，
 * 不会拖慢首页。
 */
import { Solar } from 'lunar-typescript'

/** 一个时辰（两小时）的吉凶 */
export type AlmanacHour = {
	/** 早子时 / 丑时 / … / 晚子时 */
	label: string
	/** 00:00-00:59 */
	range: string
	/** 干支，如「壬子」 */
	ganzhi: string
	/** 值神，如「白虎」 */
	tianshen: string
	/** 吉 / 凶 */
	luck: string
	/** 该时辰宜做的事 */
	yi: string[]
	/** 该时辰忌做的事 */
	ji: string[]
	/** 冲，如「冲马(丙午)」 */
	chong: string
	/** 煞方，如「南」 */
	sha: string
}

export type Almanac = {
	/** 公历日期 2026-11-15 */
	date: string
	/** 2026年11月15日 */
	solarText: string
	/** 2026 */
	year: number
	/** 11 */
	month: number
	/** 15 */
	day: number
	/** 星期日 */
	weekday: string
	/** 农历二〇二六年十月初七 */
	lunarText: string
	/** 十月初七 */
	lunarMonthDay: string
	/** 干支：丙午 / 己亥 / 癸巳 */
	ganzhi: { year: string; month: string; day: string }
	/** 马 */
	shengxiao: string
	/** 天蝎座 */
	xingzuo: string
	/** 节气名（当天是节气才有值） */
	jieqi: string
	/** 上一个节气 */
	prevJieqi: { name: string; date: string }
	/** 下一个节气 */
	nextJieqi: { name: string; date: string }
	/** 节日（公历 + 农历，如「除夕」） */
	festivals: string[]
	/** 宜 */
	yi: string[]
	/** 忌 */
	ji: string[]
	/** 冲猪(丁亥) */
	chong: string
	/** 煞东 */
	sha: string
	/** 日纳音，如「长流水」 */
	nayin: string
	/** 年柱纳音，如「天河水」 */
	yearNayin: string
	/** 建除十二神，如「破」 */
	zhixing: string
	/** 值神（黄道/黑道） */
	tianshen: { name: string; type: string; luck: string }
	/** 二十八宿 */
	xiu: { name: string; zheng: string; animal: string; luck: string }
	/** 彭祖百忌 */
	pengzu: { gan: string; zhi: string }
	/** 胎神占方 */
	tai: string
	/** 喜神 / 福神 / 财神 方位 */
	positions: { xi: string; fu: string; cai: string }
	/** 吉神宜趋 */
	jishen: string[]
	/** 凶煞宜忌 */
	xiongsha: string[]
	/** 九星，如「四绿木东南」 */
	nineStar: string
	/** 十二时辰吉凶 */
	hours: AlmanacHour[]
}

const HOUR_LABELS = ['早子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时', '晚子时']

/** 把 `2026-11-15` 解析成数字；非法返回 null */
export function parseDateStr(dateStr: string): { year: number; month: number; day: number } | null {
	const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
	if (!matched) return null
	const year = Number(matched[1])
	const month = Number(matched[2])
	const day = Number(matched[3])
	const probe = new Date(year, month - 1, day)
	// 防 2026-02-31 这种「能解析但不存在」的日期
	if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) return null
	return { year, month, day }
}

/** 取某个公历日期的黄历数据；日期非法或超出历法支持范围时返回 null */
export function getAlmanac(dateStr: string): Almanac | null {
	const parsed = parseDateStr(dateStr)
	if (!parsed) return null

	const { year, month, day } = parsed

	try {
		return buildAlmanac(year, month, day)
	} catch {
		// lunar-typescript 对 1900 年以前 / 2100 年以后的数据可能不完整，直接当作不支持
		return null
	}
}

function buildAlmanac(year: number, month: number, day: number): Almanac {
	const solar = Solar.fromYmd(year, month, day)
	const lunar = solar.getLunar()

	const prevJieQi = lunar.getPrevJieQi()
	const nextJieQi = lunar.getNextJieQi()

	const hours: AlmanacHour[] = lunar.getTimes().map((time, index) => ({
		label: HOUR_LABELS[index] ?? `${time.getGanZhi().slice(1)}时`,
		range: `${time.getMinHm()}-${time.getMaxHm()}`,
		ganzhi: time.getGanZhi(),
		tianshen: time.getTianShen(),
		luck: time.getTianShenLuck(),
		yi: time.getYi(),
		ji: time.getJi(),
		chong: time.getChongDesc(),
		sha: time.getSha()
	}))

	const festivals = [...solar.getFestivals(), ...lunar.getFestivals(), ...lunar.getOtherFestivals()]

	return {
		date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
		solarText: `${year}年${month}月${day}日`,
		year,
		month,
		day,
		weekday: `星期${solar.getWeekInChinese()}`,
		lunarText: `农历${lunar.getYearInGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
		lunarMonthDay: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
		ganzhi: {
			year: lunar.getYearInGanZhi(),
			month: lunar.getMonthInGanZhi(),
			day: lunar.getDayInGanZhi()
		},
		shengxiao: lunar.getYearShengXiao(),
		xingzuo: `${solar.getXingZuo()}座`,
		jieqi: lunar.getJieQi(),
		prevJieqi: { name: prevJieQi.getName(), date: prevJieQi.getSolar().toYmd() },
		nextJieqi: { name: nextJieQi.getName(), date: nextJieQi.getSolar().toYmd() },
		festivals: Array.from(new Set(festivals.filter(Boolean))),
		yi: lunar.getDayYi(),
		ji: lunar.getDayJi(),
		chong: `冲${lunar.getDayChongShengXiao()}(${lunar.getDayChongGan()}${lunar.getDayChong()})`,
		sha: `煞${lunar.getDaySha()}`,
		nayin: lunar.getDayNaYin(),
		yearNayin: lunar.getYearNaYin(),
		zhixing: lunar.getZhiXing(),
		tianshen: {
			name: lunar.getDayTianShen(),
			type: lunar.getDayTianShenType(),
			luck: lunar.getDayTianShenLuck()
		},
		xiu: {
			name: lunar.getXiu(),
			zheng: lunar.getZheng(),
			animal: lunar.getAnimal(),
			luck: lunar.getXiuLuck()
		},
		pengzu: { gan: lunar.getPengZuGan(), zhi: lunar.getPengZuZhi() },
		tai: lunar.getDayPositionTai(),
		positions: {
			xi: lunar.getDayPositionXiDesc(),
			fu: lunar.getDayPositionFuDesc(),
			cai: lunar.getDayPositionCaiDesc()
		},
		jishen: lunar.getDayJiShen(),
		xiongsha: lunar.getDayXiongSha(),
		nineStar: (() => {
			const star = lunar.getDayNineStar()
			return `${star.getNumber()}${star.getColor()}${star.getWuXing()} ${star.getPositionDesc()}`
		})(),
		hours
	}
}

/** 今天（本地时区）的 `YYYY-MM-DD` */
export function todayStr(): string {
	const now = new Date()
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** 在 `YYYY-MM-DD` 上加减天数 */
export function shiftDateStr(dateStr: string, offsetDays: number): string {
	const parsed = parseDateStr(dateStr)
	if (!parsed) return dateStr
	const date = new Date(parsed.year, parsed.month - 1, parsed.day + offsetDays)
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
