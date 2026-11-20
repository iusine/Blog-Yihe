/* 全站 HTML、全局 CSS 与元信息从哪里开始 */
import '@/styles/globals.css'

import type { Metadata } from 'next'
/* [新增] 全站外壳（背景 / 导航 / Toast / 音乐 / 回到顶部） */
import Layout from '@/layout'
/* [新增] favicon、manifest、标题字体 */
import Head from '@/layout/head'
import siteContent from '@/config/site-content.json'

const {
	meta: { title, description },
	theme
} = siteContent

export const metadata: Metadata = {
	title: siteContent.meta.title,
	description: siteContent.meta.description,
	// [新增] 顺便把 OG / Twitter 卡片信息补全，分享链接时不会只有裸网址
	openGraph: {
		title,
		description
	},
	twitter: {
		title,
		description
	}
}

// [新增] 把 site-content.json 里的主题色注入成 CSS 变量。
// 首页卡片、导航、按钮都通过 var(--color-*) 取色，缺了这段整站会是默认灰色。
const htmlStyle = {
	'--color-brand': theme.colorBrand,
	'--color-primary': theme.colorPrimary,
	'--color-secondary': theme.colorSecondary,
	'--color-brand-secondary': theme.colorBrandSecondary,
	'--color-bg': theme.colorBg,
	'--color-border': theme.colorBorder,
	'--color-card': theme.colorCard,
	'--color-article': theme.colorArticle
} as React.CSSProperties

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang='zh-CN' data-theme='dark' suppressHydrationWarning style={htmlStyle}>
			<Head />

			<body>
				{/* 首屏前先按 localStorage / 当地时间定好主题，避免先闪一下黑夜 */}
				<script
					dangerouslySetInnerHTML={{
						__html: `
					(function () {
						try {
							var mode = localStorage.getItem('yihe-theme') || 'dark';
							var theme = mode;
							if (mode === 'auto') {
								var hour = new Date().getHours();
								theme = hour >= 8 && hour < 20 ? 'light' : 'dark';
							}
							document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
							document.documentElement.style.colorScheme = theme;
						} catch (error) {}
					})();
		      `
					}}
				/>

				{/* [新增] 给 Windows 打标记，用来隐藏滚动条（globals.css 里的 .windows 选择器） */}
				<script
					dangerouslySetInnerHTML={{
						__html: `
					if (/windows|win32/i.test(navigator.userAgent)) {
						document.documentElement.classList.add('windows');
					}
		      `
					}}
				/>

				{/* [修改] 原来直接渲染 children，现在套上 Layout：
				    背景、导航卡片、Toast、音乐卡片、回到顶部按钮都由 Layout 提供 */}
				<Layout>{children}</Layout>

				{/*
				修改前的返回值（已注释，未删除）：
				return (
					<html lang='zh-CN'>
						<body>{children}</body>
					</html>
				)
				*/}
			</body>
		</html>
	)
}
