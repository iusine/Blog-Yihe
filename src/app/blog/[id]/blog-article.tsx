'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { BlogPreview } from '@/components/blog-preview'
import { useReadArticles } from '@/hooks/use-read-articles'
import { useAuthStore } from '@/hooks/use-auth'
import LiquidGrass from '@/components/liquid-grass'
import type { BlogConfig } from '@/app/blog/types'
import type { TocItem } from '@/lib/markdown-renderer'

type BlogArticleProps = {
	slug: string
	title: string
	date: string
	config: BlogConfig
	/** 构建期渲染好的正文 */
	html: string
	toc: TocItem[]
}

export function BlogArticle({ slug, title, date, config, html, toc }: BlogArticleProps) {
	const router = useRouter()
	const { markAsRead } = useReadArticles()
	const { isAuth } = useAuthStore()

	useEffect(() => {
		markAsRead(slug)
	}, [slug, markAsRead])

	// 隐藏文章只给管理员看：未导入私钥时，即使拿到直链也不显示正文
	if (config.hidden && !isAuth) {
		return (
			<div className='flex h-full flex-col items-center justify-center gap-2 px-6 text-center'>
				<div className='text-3xl'>🔒</div>
				<div className='text-secondary text-sm'>这篇文章被作者设为隐藏，仅管理员可见</div>
			</div>
		)
	}

	const handleEdit = () => {
		router.push(`/write/${slug}`)
	}

	return (
		<>
			<BlogPreview
				html={html}
				toc={toc}
				title={title}
				tags={config.tags || []}
				date={date}
				summary={config.summary}
				cover={config.cover}
				slug={slug}
				attachments={config.attachments}
				instant
			/>

			{isAuth && (
				<motion.button
					initial={{ opacity: 0, scale: 0.6 }}
					animate={{ opacity: 1, scale: 1 }}
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
					onClick={handleEdit}
					className='absolute top-4 right-6 rounded-xl border bg-white/10 px-6 py-2 text-sm backdrop-blur-sm transition-colors hover:bg-white/20 max-sm:hidden'>
					编辑
				</motion.button>
			)}

			{slug === 'liquid-grass' && <LiquidGrass />}
		</>
	)
}
