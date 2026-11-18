'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getLunarDate } from '@/lib/lunar'
import { getAlmanac, parseDateStr, shiftDateStr, todayStr, type Almanac } from '@/lib/almanac'

const MIN_YEAR = 1900
const MAX_YEAR = 2100
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

export default function HuangliScreen() {
	const router = useRouter()
	const searchParams = useSearchParams()

	// 从 ?date=YYYY-MM-DD 取日期；没带或非法就用今天。
	// 这个组件被 <Suspense> 包着，Next 只会在客户端渲染它，所以这里读「今天」不会和 SSR 不一致。
	const rawDate = searchParams.get('date')
	const dateStr = parseDateStr(rawDate ?? '') ? (rawDate as string) : todayStr()

	const almanac = useMemo(() => getAlmanac(dateStr), [dateStr])
	const isToday = dateStr === todayStr()

	// 地址栏带了非法的 ?date=（比如手改出来的），把地址修正成今天，避免刷新后状态混乱
	useEffect(() => {
		if (rawDate && !parseDateStr(rawDate)) {
			router.replace(`/huangli?date=${todayStr()}`, { scroll: false })
		}
	}, [rawDate, router])

	const go = (next: string) => {
		if (!parseDateStr(next)) return
		router.push(`/huangli?date=${next}`, { scroll: false })
	}

	return (
		<div className='mx-auto w-full max-w-[1000px] px-4 pt-28 pb-16'>
			<div className='flex items-center justify-between'>
				<Link href='/' className='text-secondary hover:text-brand flex items-center gap-1 text-sm transition-colors'>
					<ChevronLeft className='size-4' />
					返回首页
				</Link>
				<span className='text-secondary text-xs tracking-wide'>万年历 · 黄历</span>
			</div>

			<DateToolbar dateStr={dateStr} almanac={almanac} onSelect={go} />

			{almanac ? (
				<AlmanacBody almanac={almanac} isToday={isToday} />
			) : (
				<div className='mt-10 rounded-[28px] border bg-card p-10 text-center'>
					<p className='text-secondary text-sm'>
						{dateStr} 这一天查不到黄历数据（支持的年份约为 {MIN_YEAR}–{MAX_YEAR}），换一天试试。
					</p>
				</div>
			)}
		</div>
	)
}

/** 日期工具条：前一天 / 日期按钮（点开日历浮层）/ 后一天 / 今天 */
function DateToolbar({ dateStr, almanac, onSelect }: { dateStr: string; almanac: Almanac | null; onSelect: (next: string) => void }) {
	const [open, setOpen] = useState(false)
	const anchorRef = useRef<HTMLDivElement>(null)

	// 点浮层外面、按 Esc 都关掉
	useEffect(() => {
		if (!open) return
		const handlePointerDown = (event: MouseEvent) => {
			if (anchorRef.current && !anchorRef.current.contains(event.target as Node)) setOpen(false)
		}
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setOpen(false)
		}
		document.addEventListener('mousedown', handlePointerDown)
		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('mousedown', handlePointerDown)
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [open])

	const parsed = parseDateStr(dateStr)
	const label = `${parsed?.year}/${parsed?.month}/${parsed?.day}`
	const weekday = almanac?.weekday ?? ''
	const lunar = almanac?.lunarMonthDay ?? ''

	return (
		<div className='mt-5 flex justify-center'>
			<div className='flex items-center gap-0.5 rounded-2xl border bg-white/12 p-1 shadow-[0_18px_36px_-28px_rgba(0,0,0,0.45)] backdrop-blur-md'>
				<ToolbarIcon label='前一天' onClick={() => onSelect(shiftDateStr(dateStr, -1))}>
					<ChevronLeft className='size-4' />
				</ToolbarIcon>

				<div ref={anchorRef} className='relative'>
					<button
						type='button'
						onClick={() => setOpen(value => !value)}
						aria-expanded={open}
						aria-haspopup='dialog'
						className='hover:bg-brand/10 flex items-center gap-2 rounded-xl px-3 py-1.5 transition-colors'>
						<span className='text-sm font-medium tabular-nums'>{label}</span>
						<span className='text-secondary text-xs'>{weekday}</span>
						{lunar && <span className='text-secondary hidden text-xs sm:inline'>· {lunar}</span>}
						<ChevronDown className={cn('text-secondary size-3.5 transition-transform', open && 'rotate-180')} />
					</button>

					{open && <DatePicker key={dateStr} value={dateStr} onSelect={onSelect} onClose={() => setOpen(false)} />}
				</div>

				<ToolbarIcon label='后一天' onClick={() => onSelect(shiftDateStr(dateStr, 1))}>
					<ChevronRight className='size-4' />
				</ToolbarIcon>

				<span className='mx-1 h-5 w-px bg-black/10' />

				<button
					type='button'
					onClick={() => onSelect(todayStr())}
					className='text-brand hover:bg-brand/10 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors'>
					今天
				</button>
			</div>
		</div>
	)
}

function ToolbarIcon({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
	return (
		<button
			type='button'
			onClick={onClick}
			aria-label={label}
			title={label}
			className='text-secondary hover:bg-brand/10 hover:text-brand rounded-xl p-2 transition-colors'>
			{children}
		</button>
	)
}

/** 日历浮层：年/月翻页 + 7 列日历，格子下面带农历 */
function DatePicker({ value, onSelect, onClose }: { value: string; onSelect: (next: string) => void; onClose: () => void }) {
	const selected = parseDateStr(value)!
	const today = todayStr()

	const [view, setView] = useState(() => ({ year: selected.year, month: selected.month }))

	const shiftMonth = (offset: number) => {
		setView(current => {
			const date = new Date(current.year, current.month - 1 + offset, 1)
			const year = Math.min(MAX_YEAR, Math.max(MIN_YEAR, date.getFullYear()))
			return { year, month: date.getMonth() + 1 }
		})
	}

	const shiftYear = (offset: number) => {
		setView(current => ({ ...current, year: Math.min(MAX_YEAR, Math.max(MIN_YEAR, current.year + offset)) }))
	}

	const firstWeekday = (new Date(view.year, view.month - 1, 1).getDay() + 6) % 7
	const daysInMonth = new Date(view.year, view.month, 0).getDate()

	return (
		<div
			role='dialog'
			aria-label='选择日期'
			className='absolute top-full left-1/2 z-50 mt-2 w-[318px] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border bg-white/10 p-3 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.35)]'>
			<div className='flex items-center justify-between'>
				<div className='flex items-center'>
					<ToolbarIcon label='上一年' onClick={() => shiftYear(-1)}>
						<ChevronsLeft className='size-4' />
					</ToolbarIcon>
					<ToolbarIcon label='上个月' onClick={() => shiftMonth(-1)}>
						<ChevronLeft className='size-4' />
					</ToolbarIcon>
				</div>

				<span className='text-sm font-medium tabular-nums'>
					{view.year}年{view.month}月
				</span>

				<div className='flex items-center'>
					<ToolbarIcon label='下个月' onClick={() => shiftMonth(1)}>
						<ChevronRight className='size-4' />
					</ToolbarIcon>
					<ToolbarIcon label='下一年' onClick={() => shiftYear(1)}>
						<ChevronsRight className='size-4' />
					</ToolbarIcon>
				</div>
			</div>

			<div className='text-secondary mt-2 grid grid-cols-7 gap-1 text-center text-[11px]'>
				{WEEK_LABELS.map(label => (
					<span key={label} className='py-1'>
						{label}
					</span>
				))}
			</div>

			<div className='grid grid-cols-7 gap-1'>
				{new Array(firstWeekday).fill(0).map((_, index) => (
					<span key={`blank-${index}`} />
				))}

				{new Array(daysInMonth).fill(0).map((_, index) => {
					const day = index + 1
					const dateKey = `${view.year}-${String(view.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
					const lunarDay = getLunarDate(new Date(view.year, view.month - 1, day))?.day ?? ''
					const isSelected = dateKey === value
					const isToday = dateKey === today

					return (
						<button
							key={day}
							type='button'
							onClick={() => {
								onSelect(dateKey)
								onClose()
							}}
							aria-label={`${dateKey}${lunarDay ? ` 农历${lunarDay}` : ''}`}
							aria-current={isSelected ? 'date' : undefined}
							className={cn(
								'flex h-9 flex-col items-center justify-center rounded-lg leading-none transition-colors',
								// 选中的那天用和首页日历 "今天" 相同的品牌渐变，视觉上对齐
								isSelected ? 'bg-linear font-medium' : 'hover:bg-brand/10',
								!isSelected && isToday && 'text-brand border border-brand/40'
							)}>
							<span className='text-[13px]'>{day}</span>
							<span className={cn('mt-[3px] text-[9px] tracking-tight', isSelected ? 'text-white/85' : 'text-secondary/60')}>{lunarDay}</span>
						</button>
					)
				})}
			</div>

			<div className='mt-2 flex items-center justify-between border-t pt-2'>
				<span className='text-secondary text-[11px]'>黄历支持 {MIN_YEAR}–{MAX_YEAR} 年</span>
				<button
					type='button'
					onClick={() => {
						onSelect(today)
						onClose()
					}}
					className='text-brand hover:bg-brand/10 rounded-lg px-2 py-1 text-xs font-medium transition-colors'>
					回到今天
				</button>
			</div>
		</div>
	)
}

function AlmanacBody({ almanac, isToday }: { almanac: Almanac; isToday: boolean }) {
	return (
		<>
			{/* 概要 */}
			<section className='mt-5 rounded-2xl border bg-card p-6'>
				<div className='flex flex-wrap items-start justify-between gap-6'>
					<div>
						<div className='flex flex-wrap items-baseline gap-3'>
							<span className='text-3xl font-semibold'>
								{almanac.month}月{almanac.day}日
							</span>
							<span className='text-secondary text-base'>{almanac.weekday}</span>
							{isToday && <span className='bg-brand/15 text-brand rounded-full px-2 py-0.5 text-xs'>今天</span>}
						</div>

						<div className='text-secondary mt-2 text-sm'>{almanac.lunarText}</div>

						<div className='mt-3 flex flex-wrap gap-2'>
							{almanac.festivals.map(festival => (
								<span key={festival} className='rounded-full bg-rose-400/10 px-2 py-0.5 text-xs text-rose-500'>
									{festival}
								</span>
							))}
							{almanac.jieqi && <span className='bg-brand/10 text-brand rounded-full px-2 py-0.5 text-xs'>{almanac.jieqi}</span>}
							<span className='rounded-full bg-black/5 px-2 py-0.5 text-xs'>生肖{almanac.shengxiao}</span>
							<span className='rounded-full bg-black/5 px-2 py-0.5 text-xs'>{almanac.xingzuo}</span>
						</div>
					</div>

					<div className='text-left sm:text-right'>
						<div className='text-secondary text-xs'>干支</div>
						<div className='mt-1 text-lg font-medium'>
							{almanac.ganzhi.year}年 {almanac.ganzhi.month}月 {almanac.ganzhi.day}日
						</div>
						<div className='text-secondary mt-1 text-xs'>
							日纳音 {almanac.nayin} · 年纳音 {almanac.yearNayin}
						</div>
					</div>
				</div>
			</section>

			{/* 宜 / 忌 */}
			<section className='mt-4 grid gap-4 md:grid-cols-2'>
				<VerbPanel title='宜' items={almanac.yi} tone='good' />
				<VerbPanel title='忌' items={almanac.ji} tone='bad' />
			</section>

			{/* 这一天的基础信息 */}
			<section className='mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
				<InfoTile label='冲煞' value={`${almanac.chong} ${almanac.sha}`} />
				<InfoTile label='值神' value={`${almanac.tianshen.name}（${almanac.tianshen.type}·${almanac.tianshen.luck}）`} />
				<InfoTile label='建除十二神' value={`${almanac.zhixing}日`} />
				<InfoTile label='二十八宿' value={`${almanac.xiu.name}${almanac.xiu.zheng}${almanac.xiu.animal}（${almanac.xiu.luck}）`} />
				<InfoTile label='胎神占方' value={almanac.tai} />
				<InfoTile label='九星' value={almanac.nineStar} />
				<InfoTile label='喜神 / 福神 / 财神' value={`${almanac.positions.xi} / ${almanac.positions.fu} / ${almanac.positions.cai}`} />
				<InfoTile label='节气' value={almanac.jieqi || `${almanac.prevJieqi.name} 之后 · 下个 ${almanac.nextJieqi.name} ${almanac.nextJieqi.date}`} />
				<InfoTile label='彭祖百忌' value={`${almanac.pengzu.gan}；${almanac.pengzu.zhi}`} />
			</section>

			{/* 吉神 / 凶煞 */}
			<section className='mt-4 grid gap-4 md:grid-cols-2'>
				<div className='rounded-[28px] border bg-card p-5'>
					<div className='text-brand text-sm font-medium'>吉神宜趋</div>
					<div className='mt-3 flex flex-wrap gap-2'>
						{almanac.jishen.length ? (
							almanac.jishen.map(name => (
								<span key={name} className='bg-brand/8 text-brand rounded-lg px-2 py-1 text-xs'>
									{name}
								</span>
							))
						) : (
							<span className='text-secondary text-xs'>无</span>
						)}
					</div>
				</div>

				<div className='rounded-[28px] border bg-card p-5'>
					<div className='text-sm font-medium text-rose-500'>凶煞宜忌</div>
					<div className='mt-3 flex flex-wrap gap-2'>
						{almanac.xiongsha.length ? (
							almanac.xiongsha.map(name => (
								<span key={name} className='rounded-lg bg-rose-400/10 px-2 py-1 text-xs text-rose-500'>
									{name}
								</span>
							))
						) : (
							<span className='text-secondary text-xs'>无</span>
						)}
					</div>
				</div>
			</section>

			{/* 十二时辰 */}
			<section className='mt-4 rounded-[28px] border bg-card p-5'>
				<div className='flex items-baseline justify-between'>
					<div className='text-sm font-medium'>时辰吉凶</div>
					<div className='text-secondary text-xs'>共 {almanac.hours.length} 个时辰（含早子 / 晚子）</div>
				</div>

				<div className='mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
					{almanac.hours.map(hour => {
						const good = hour.luck === '吉'
						return (
							<div key={hour.label + hour.range} className='rounded-2xl border p-3'>
								<div className='flex items-center justify-between text-xs'>
									<span className='font-medium'>{hour.label}</span>
									<span className={good ? 'text-brand font-medium' : 'font-medium text-rose-500'}>{hour.luck}</span>
								</div>
								<div className='text-secondary mt-1 text-[11px]'>
									{hour.range} · {hour.ganzhi} · {hour.tianshen}
								</div>
								<div className='text-secondary mt-2 line-clamp-2 text-[11px]'>
									<span className='text-brand'>宜</span> {hour.yi.slice(0, 6).join(' ') || '—'}
								</div>
								<div className='text-secondary line-clamp-2 text-[11px]'>
									<span className='text-rose-500'>忌</span> {hour.ji.slice(0, 6).join(' ') || '—'}
								</div>
							</div>
						)
					})}
				</div>
			</section>

			<p className='text-secondary mt-6 text-center text-[11px]'>
				宜忌、值神、冲煞等数据来自 lunar-typescript（万年历算法），与常见黄历 App 口径一致，仅供传统文化参考。
			</p>
		</>
	)
}

function VerbPanel({ title, items, tone }: { title: string; items: string[]; tone: 'good' | 'bad' }) {
	const good = tone === 'good'
	return (
		<div className={good ? 'rounded-[28px] border border-brand/30 bg-brand/5 p-5' : 'rounded-[28px] border border-rose-400/30 bg-rose-400/10 p-5'}>
			<div className={good ? 'text-brand text-sm font-medium' : 'text-sm font-medium text-rose-500'}>{title}</div>
			<div className='mt-3 flex flex-wrap gap-2'>
				{items.length ? (
					items.map(item => (
						<span key={item} className='rounded-lg border bg-white/10 px-2 py-1 text-xs'>
							{item}
						</span>
					))
				) : (
					<span className='text-secondary text-xs'>无</span>
				)}
			</div>
		</div>
	)
}

function InfoTile({ label, value }: { label: string; value: string }) {
	return (
		<div className='rounded-2xl border bg-card px-4 py-3'>
			<div className='text-secondary text-[11px]'>{label}</div>
			<div className='mt-1 text-sm'>{value}</div>
		</div>
	)
}
