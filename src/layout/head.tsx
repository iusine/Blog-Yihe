// [新增] 参考 2025-blog-public 的 src/layout/head.tsx：
// 统一声明 viewport、PWA manifest、favicon 与标题字体。
// 原仓库里还有一段 Google Analytics 的 <Script>，这里刻意没有搬过来：
// 它绑定了原作者自己的统计 ID，属于第三方跟踪代码，重建项目里不需要。
export default function Head() {
	return (
		<head>
			<meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover' />
			<link rel='manifest' href='/manifest.json' />
			<link rel='icon' href='/favicon.png' />

			{/* Averia Gruesa Libre 已自托管（见 theme.css 的 @font-face），不再请求 Google Fonts 的阻塞式样式表 */}
			<link rel='preload' href='/fonts/averia-gruesa-libre.woff2' as='font' type='font/woff2' crossOrigin='anonymous' />

			{/* [新增] 首页文章卡要用它；用 prefetch 预热浏览器缓存（preload 会因凭据模式不匹配而报警告） */}
			<link rel='prefetch' href='/blogs/index.json' />
		</head>
	)
}
