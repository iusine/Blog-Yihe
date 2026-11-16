/** @type {import('next').NextConfig} */
const nextConfig = {
	// [新增] 关掉开发时左下角的 Next 开发指示器（与参考仓库一致）
	devIndicators: false,
	// [新增] 允许用 127.0.0.1 打开开发服务器（否则 Next 会警告跨域访问 /_next/*）
	allowedDevOrigins: ['127.0.0.1', 'localhost'],
	// [新增] next/image 默认只允许本地图片，远程地址必须在 remotePatterns 里登记，
	// 否则运行时会抛 "Invalid src prop ... hostname is not configured"，整页白屏。
	// 这里放行导航头像所在的 jsDelivr CDN；换成你自己的图床时改 hostname 即可。
	images: {
		remotePatterns: [
			{ protocol: 'https', hostname: 'fastly.jsdelivr.net', pathname: '/**' }
			// 需要放行任意 HTTPS 图床时（不建议，等于全放开）：
			// { protocol: 'https', hostname: '**' }
		]
	},
	reactStrictMode: false,
	pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
	experimental: {
		scrollRestoration: false
	},
	turbopack: {
		rules: {
			'*.svg': {
				loaders: ['@svgr/webpack'],
				as: '*.js'
			}
		},

		resolveExtensions: ['.mdx', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json', 'css']
	},
	webpack: config => {
		config.module.rules.push({
			test: /\.svg$/i,
			use: [{ loader: '@svgr/webpack', options: { svgo: false } }]
		})

		return config
	}
}

export default nextConfig
