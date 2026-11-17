'use client'

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

/**
 * 时钟页。
 *
 * 这里只剩下「当前时间」——原来的秒表 / 计时器（含计次、开始暂停、倒计时输入）已经移除。
 * 时间按秒刷新，并且对齐到整秒边界（不是简单的 setInterval(1000)，那样会越走越偏）。
 *
 * 需要找回旧的秒表 / 计时器实现时，参考仓库的 app/clock/page.tsx 就是完整原版。
 */
export default function ClockPage() {
	// 这个页面在构建时会被预渲染成静态 HTML，如果直接用 new Date() 初始化，
	// 服务端那一刻的秒数和浏览器打开时的秒数必然不同，会触发 hydration 警告。
	// 所以先渲染占位，挂载后再显示真实时间（只差一帧，不会有布局跳动）。
	const [now, setNow] = useState<Date | null>(null)

	useEffect(() => {
		let timer: number

		const tick = () => {
			setNow(new Date())
			// 下一次对齐到「下一个整秒」，这样秒数跳变和系统时间一致
			timer = window.setTimeout(tick, 1000 - (Date.now() % 1000))
		}

		tick()
		return () => window.clearTimeout(timer)
	}, [])

	const hours = now ? now.getHours().toString().padStart(2, '0') : ''
	const minutes = now ? now.getMinutes().toString().padStart(2, '0') : ''
	const seconds = now ? now.getSeconds().toString().padStart(2, '0') : ''

	// 冒号跟着秒数闪烁，像真正的电子钟
	const colonDim = now ? now.getSeconds() % 2 === 1 : false

	// 数字尺寸跟着视口缩放（保持 SevenSegment 原始的 29:52 比例），小屏不撑破屏幕
	const digitClass = 'h-[15.2vw] min-h-[61px] max-h-[140px] w-[8.5vw] min-w-[34px] max-w-[78px]'

	return (
		<div className='flex min-h-[100svh] flex-col items-center justify-center px-6 py-24'>
			<motion.div
				initial={{ opacity: 0, scale: 0.92 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.4, ease: 'easeOut' }}
				className='bg-secondary/20 card-rounded flex items-center justify-center gap-1.5 px-4 py-8 sm:gap-3 sm:px-10 sm:py-12'>
				{now ? (
					<>
						<SevenSegmentDigit value={parseInt(hours[0])} className={digitClass} />
						<SevenSegmentDigit value={parseInt(hours[1])} className={digitClass} />
						<Colon dim={colonDim} className='mx-1 sm:mx-2' />
						<SevenSegmentDigit value={parseInt(minutes[0])} className={digitClass} />
						<SevenSegmentDigit value={parseInt(minutes[1])} className={digitClass} />
						<Colon dim={colonDim} className='mx-1 sm:mx-2' />
						<SevenSegmentDigit value={parseInt(seconds[0])} className={digitClass} />
						<SevenSegmentDigit value={parseInt(seconds[1])} className={digitClass} />
					</>
				) : (
					// 首帧占位：尺寸与真实数字一致，不会引起跳动
					<>
						{new Array(6).fill(0).map((_, index) => (
							<div key={index} className={cn(digitClass, 'bg-primary/5 animate-pulse rounded-lg')} />
						))}
					</>
				)}
			</motion.div>
		</div>
	)
}

interface SevenSegmentDigitProps {
	value: number
	className?: string
}

function SevenSegmentDigit({ value, className }: SevenSegmentDigitProps) {
	const segmentMap = {
		0: [true, true, true, true, true, true, false],
		1: [false, true, true, false, false, false, false],
		2: [true, true, false, true, true, false, true],
		3: [true, true, true, true, false, false, true],
		4: [false, true, true, false, false, true, true],
		5: [true, false, true, true, false, true, true],
		6: [true, false, true, true, true, true, true],
		7: [true, true, true, false, false, false, false],
		8: [true, true, true, true, true, true, true],
		9: [true, true, true, true, false, true, true]
	}

	const segments = segmentMap[value as keyof typeof segmentMap] || segmentMap[0]
	const activeColor = 'var(--color-primary)'
	const inactiveColor = 'rgba(0, 0, 0, 0.05)'

	// 七段数码里的 1 只点亮右侧两根竖条，格子却和其他数字一样宽；
	// 把它的格子裁到墨迹宽度，冒号前后的间距才不会忽大忽小
	const isNarrow = value === 1
	const glyphViewBox = isNarrow ? '23.2 0 5.4 52' : '0 0 29 52'

	return (
		<svg
			width='29'
			height='52'
			viewBox={glyphViewBox}
			fill='none'
			xmlns='http://www.w3.org/2000/svg'
			className={className}
			style={{ width: 'auto', minWidth: 0, aspectRatio: isNarrow ? '5.4 / 52' : '29 / 52' }}>
			<g>
			<path
				d='M4.20248 3.49482C2.82797 2.27303 3.69218 0 5.53121 0H22.6867C24.5522 0 25.4019 2.32821 23.975 3.52982L23.5791 3.86316C23.2186 4.16681 22.7623 4.33333 22.2909 4.33333H5.90621C5.41638 4.33333 4.94359 4.15358 4.57748 3.82815L4.20248 3.49482Z'
				fill={segments[0] ? activeColor : inactiveColor}
			/>
			<path
				d='M3.85122 24.13C4.16644 23.936 4.5293 23.8333 4.89942 23.8333H23.3022C23.6503 23.8333 23.9923 23.9242 24.2945 24.0969L24.5862 24.2635C25.9298 25.0313 25.9298 26.9687 24.5862 27.7365L24.2945 27.9032C23.9923 28.0758 23.6503 28.1667 23.3022 28.1667H4.89942C4.5293 28.1667 4.16644 28.064 3.85122 27.87L3.58039 27.7033C2.31131 26.9224 2.31132 25.0777 3.58039 24.2967L3.85122 24.13Z'
				fill={segments[6] ? activeColor : inactiveColor}
			/>
			<path
				d='M3.06 23.5458C1.7279 24.3784 -8.31295e-08 23.4207 -1.47217e-07 21.8498L-8.06095e-07 5.69981C-8.77526e-07 3.94893 2.09055 3.04323 3.36788 4.24073L3.70121 4.55323C4.10452 4.93133 4.33333 5.45949 4.33333 6.01231L4.33333 21.6415C4.33333 22.3311 3.97809 22.972 3.39333 23.3375L3.06 23.5458Z'
				fill={segments[5] ? activeColor : inactiveColor}
			/>
			<path
				d='M24.8497 4.25654C26.1428 3.12502 28.1667 4.04338 28.1667 5.76169L28.1667 21.8498C28.1667 23.4207 26.4388 24.3784 25.1067 23.5458L24.7734 23.3375C24.1886 22.972 23.8334 22.3311 23.8334 21.6415L23.8334 6.05336C23.8334 5.47663 24.0823 4.92798 24.5163 4.54821L24.8497 4.25654Z'
				fill={segments[1] ? activeColor : inactiveColor}
			/>
			<path
				d='M23.9259 48.6321C25.1234 49.9094 24.2177 52 22.4669 52L5.69978 52C3.9489 52 3.04321 49.9094 4.24071 48.6321L4.55321 48.2988C4.9313 47.8955 5.45947 47.6667 6.01228 47.6667L22.1544 47.6667C22.7072 47.6667 23.2353 47.8955 23.6134 48.2988L23.9259 48.6321Z'
				fill={segments[3] ? activeColor : inactiveColor}
			/>
			<path
				d='M25.1862 28.489C26.5194 27.7391 28.1667 28.7025 28.1667 30.2322L28.1667 46.6299C28.1667 48.4117 26.0124 49.3041 24.7525 48.0441L24.4191 47.7108C24.0441 47.3357 23.8334 46.827 23.8334 46.2966L23.8334 30.4197C23.8334 29.6971 24.2231 29.0308 24.8528 28.6765L25.1862 28.489Z'
				fill={segments[2] ? activeColor : inactiveColor}
			/>
			<path
				d='M3.4564 47.7859C2.21509 49.1048 4.23823e-07 48.2263 6.6133e-07 46.4152L2.79423e-06 30.1501C3.00022e-06 28.5793 1.72791 27.6216 3.06 28.4541L3.39333 28.6625C3.9781 29.028 4.33334 29.6689 4.33334 30.3585L4.33333 46.061C4.33333 46.5705 4.13891 47.0607 3.78973 47.4317L3.4564 47.7859Z'
				fill={segments[4] ? activeColor : inactiveColor}
			/>
			</g>
		</svg>
	)
}

function Colon({ dim, className }: { dim?: boolean; className?: string }) {
	return (
		<div className={cn('flex flex-col justify-center gap-3 transition-opacity duration-300 sm:gap-5', dim && 'opacity-20', className)}>
			<div className='bg-primary h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5' />
			<div className='bg-primary h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5' />
		</div>
	)
}
