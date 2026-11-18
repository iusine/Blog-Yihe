'use client'

import Link from 'next/link'
import { motion } from 'motion/react'

/** 未认证时不在子页面重复提供密钥入口，统一回首页完成身份认证。 */
export function WriteAuthGate() {
	return (
		<div className='flex min-h-[100svh] items-center justify-center px-6 pt-24 pb-12'>
			<motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className='w-full max-w-[460px] rounded-2xl border bg-card p-8 text-center shadow-[0_30px_60px_-40px_rgba(0,0,0,0.35)]'>
				<div className='text-4xl'>🔐</div>
				<h1 className='mt-4 text-xl font-semibold'>请先完成身份认证</h1>
				<p className='text-secondary mt-3 text-sm leading-relaxed'>请回到首页导入正确的 PEM 私钥。认证成功后，写文章及其他站主功能会自动开放。</p>
				<Link href='/' className='brand-btn mx-auto mt-6 justify-center'>← 返回首页认证</Link>
			</motion.div>
		</div>
	)
}
