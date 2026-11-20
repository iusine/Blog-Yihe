import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/card'
import { useConfigStore } from './stores/config-store'
import { useLayoutEditStore } from './stores/layout-edit-store'
import { cardPosition } from './home-layout'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { cn } from '@/lib/utils'
import { getLunarDate } from '@/lib/lunar'
import { HomeDraggableLayer } from './home-draggable-layer'

dayjs.locale('zh-cn')

export default function CalendarCard() {
    const router = useRouter()
    const { cardStyles, siteContent } = useConfigStore()
    // 拖拽布局时不要触发跳转
    const editing = useLayoutEditStore(state => state.editing)

    // [修改] 原来每次渲染直接 dayjs()，页面一直开着就不会跨天；
    // 现在存进 state 并每 30 秒对齐一次，零点过后新历和农历都会自动翻到第二天。
    // 初始为 null：服务端预渲染的是构建时的日期，和访客当天对不上会触发 hydration 报错，
    // 所以首帧只画表头和固定高度的空网格，挂载后再填真实日期。
    const [now, setNow] = useState<dayjs.Dayjs | null>(null)

    useEffect(() => {
        setNow(dayjs())
        const timer = setInterval(() => setNow(dayjs()), 30 * 1000)
        return () => clearInterval(timer)
    }, [])

    const currentDate = now?.date() ?? 0
    const firstDayWeekday = now ? (now.startOf('month').day() + 6) % 7 : 0
    const daysInMonth = now?.daysInMonth() ?? 0
    const currentWeekday = now ? (now.day() + 6) % 7 : -1
    const styles = cardStyles.calendarCard
    const pos = cardPosition('calendarCard', cardStyles)

    // [新增] 今天的农历，例如「十月初七」
    const lunar = now ? getLunarDate(now.toDate()) : null
    // 卡片被拖得很小时，格子放不下第二行，只保留公历数字
    const compact = styles.height < 240 || styles.width < 240

    // [新增] 点日期跳到黄历页，带上完整日期，黄历页可以再自由换日期
    const openAlmanac = (dateKey: string) => {
        if (editing) return
        router.push(`/huangli?date=${dateKey}`)
    }
    return (
        <HomeDraggableLayer cardKey='calendarCard' left={pos.left} top={pos.top} offsetX={pos.offsetX} offsetY={pos.offsetY} width={styles.width} height={styles.height}>
            <Card order={styles.order} width={styles.width} height={styles.height} left={pos.left} top={pos.top} className='flex flex-col max-sm:static'>
                {siteContent.enableChristmas && (
                    <>
                        <img
                            src='/images/christmas/snow-7.webp'
                            alt='Christmas decoration'
                            className='pointer-events-none absolute'
                            style={{ width: 150, right: -12, top: -12, opacity: 0.8 }}
                        />
                    </>
                )}

                {/* [修改] 公历后面追加农历，例如「2026/11/15 周日 · 十月初七」；点标题看今天的黄历 */}
                <h3
                    onClick={() => now && openAlmanac(now.format('YYYY-MM-DD'))}
                    title='查看今天的黄历'
                    className='text-secondary hover:text-brand flex cursor-pointer items-baseline gap-1.5 text-sm whitespace-nowrap transition-colors'>
                    {now ? (
                        <>
                            <span>
                                {now.format('YYYY/M/D')} {now.format('ddd')}
                            </span>
                            {lunar && (
                                <span className='text-secondary/70 text-xs' title={`农历${lunar.text}`}>
                                    · {lunar.text}
                                </span>
                            )}
                        </>
                    ) : (
                        // 占位：和真实日期同一行高，挂载后原地替换
                        <span>{'\u00A0'}</span>
                    )}
                </h3>

                <ul
                    className={cn(
                        'text-secondary mt-2 grid h-[208px] flex-1 grid-cols-7 gap-1 text-sm',
                        compact && 'text-xs'
                    )}>
                    {new Array(7).fill(0).map((_, index) => {
                        const isCurrentWeekday = index === currentWeekday
                        return (
                            <li key={index} className={cn('flex items-center justify-center font-medium', isCurrentWeekday && 'text-brand')}>
                                {dates[index]}
                            </li>
                        )
                    })}

                    {now && new Array(firstDayWeekday).fill(0).map((_, index) => (
                        <li key={`empty-${index}`} />
                    ))}

                    {now && new Array(daysInMonth).fill(0).map((_, index) => {
                        const day = index + 1
                        const isToday = day === currentDate
                        // [新增] 每一天都算出自己的农历日，显示在公历数字下面
                        const lunarDay = getLunarDate(now.date(day).toDate())
                        // [新增] 点某个数字 → 打开那一天的黄历
                        const dateKey = now.date(day).format('YYYY-MM-DD')
                        return (
                            <li key={day}>
                                <button
                                    type='button'
                                    onClick={() => openAlmanac(dateKey)}
                                    title={`查看 ${dateKey} 黄历`}
                                    className={cn(
                                        // 所有日子（包括今天）共用同一套 hover 反馈；今天只用品牌色 + 加粗标记，不加描边和横线
                                        'flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-lg leading-none transition-colors hover:bg-brand/15',
                                        isToday && 'font-semibold text-brand'
                                    )}>
                                    <span className={cn('text-[13px]', compact && 'text-xs')}>{day}</span>
                                    {!compact && (
                                        <span className={cn('mt-[3px] text-[9px] tracking-tight', isToday ? 'text-brand/75' : 'text-secondary/60')}>
                                            {lunarDay?.day ?? ''}
                                        </span>
                                    )}
                                </button>
                            </li>
                        )
                    })}
                </ul>
            </Card>
        </HomeDraggableLayer>
    )
}

const dates = ['一', '二', '三', '四', '五', '六', '日']
