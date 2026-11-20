/* 只负责统一尺寸、绝对坐标和动画。
 * 坐标由 home-layout 算成 CSS 表达式后传入，服务端渲染时就已经在正确位置；
 * 入场动画改用 CSS（挂在 .card-enter 上），HTML 一到就开始，不必等 motion 水合。 */
'use client'

import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

interface Props {
	className?: string
	order: number
	width?: number
	height?: number
	/** 卡片定位值，例如 calc(50% - 180px) */
	left: string
	top: string
	/** 关掉悬停放大/按下缩小（卡片内有滑块、按钮等交互控件时用） */
	interactive?: boolean
	children: React.ReactNode
}

export default function Card({ children, order, width, height, left, top, className, interactive = true }: Props) {
	// 错峰延迟最多 3 档（0.3s），避免最后一张卡等到 0.8s 才出现
	const delay = Math.min(Math.max(order, 0), 3) * 100

	return (
		<motion.div
			className={cn('card squircle card-enter', className)}
			style={
				{
					left,
					top,
					width,
					height,
					'--card-delay': `${delay}ms`
				} as React.CSSProperties
			}
			whileHover={interactive ? { scale: 1.05 } : undefined}
			whileTap={interactive ? { scale: 0.95 } : undefined}>
			{children}
		</motion.div>
	)
}
