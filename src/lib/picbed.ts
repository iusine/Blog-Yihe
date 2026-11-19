/**
 * 自建图床（iusine/Image-bed）的地址约定。
 *
 * 这个模块只做纯字符串处理，不依赖 React / GitHub 客户端，
 * 浏览器和上传流程都可以直接用。
 */

export const PICBED = {
	OWNER: process.env.NEXT_PUBLIC_PICBED_OWNER || 'iusine',
	REPO: process.env.NEXT_PUBLIC_PICBED_REPO || 'Image-bed',
	BRANCH: process.env.NEXT_PUBLIC_PICBED_BRANCH || 'main'
} as const

/** 图床分类目录：照片墙、文章、其他（项目 / 分享 / 博主头像等） */
export const PICBED_CATEGORIES = {
	photos: '博客照片墙',
	articles: '博客文章',
	other: '博客其他'
} as const

export type PicbedCategory = (typeof PICBED_CATEGORIES)[keyof typeof PICBED_CATEGORIES]

const CATEGORY_SET = new Set<string>(Object.values(PICBED_CATEGORIES))

/**
 * jsDelivr 镜像的尝试顺序。
 *
 * 各地网络对镜像的连通性差别很大（有的会 301 到 raw.githubusercontent.com，
 * 有的直接被解析到 127.0.0.1），所以这里只决定「先试谁」，
 * 真正的可用性由 <PicbedImage> 的 onError 逐个降级来兜底。
 */
export const PICBED_ORIGINS = [
	'https://testingcf.jsdelivr.net',
	'https://gcore.jsdelivr.net',
	'https://jsdelivr.b-cdn.net',
	'https://jsd.onmicrosoft.cn',
	'https://quantil.jsdelivr.net',
	'https://fastly.jsdelivr.net',
	'https://cdn.jsdelivr.net',
	'https://jsd.cdn.zzko.cn'
] as const

export const PICBED_CANONICAL_ORIGIN = PICBED_ORIGINS[0]

const RAW_ORIGIN = 'https://raw.githubusercontent.com'

/** 按 / 分段编码：仓库路径和 ref 里的 / 必须保留字面量 */
export function encodePicbedPath(path: string): string {
	return path
		.split('/')
		.map(segment => encodeURIComponent(segment))
		.join('/')
}

function safeDecodePath(path: string): string {
	try {
		return path
			.split('/')
			.map(segment => decodeURIComponent(segment))
			.join('/')
	} catch {
		return path
	}
}

/** 图床仓库里的路径：`博客文章/blogs/<slug>/<hash>.jpg` */
export function buildPicbedRepoPath(category: PicbedCategory, publicDir: string, filename: string): string {
	const dir = publicDir.replace(/^\/+|\/+$/g, '')
	return [category, dir, filename].filter(Boolean).join('/')
}

/** 生成 jsDelivr 地址（默认用主镜像） */
export function buildPicbedUrl(repoPath: string, origin: string = PICBED_CANONICAL_ORIGIN): string {
	return `${origin}/gh/${PICBED.OWNER}/${PICBED.REPO}@${PICBED.BRANCH}/${encodePicbedPath(repoPath)}`
}

export type ParsedPicbedUrl = {
	/** 仓库内路径，已经解码，例如 `博客照片墙/images/pictures/abc.jpg` */
	repoPath: string
	branch: string
	/** 分类目录；不在已知分类下时为 null（例如仓库根目录的 avatar.png） */
	category: PicbedCategory | null
	/** 去掉分类目录后的站内路径，例如 `/images/pictures/abc.jpg` */
	localPath: string | null
}

/**
 * 识别 Image-bed 地址，同时兼容：
 * - `https://<任意镜像>/gh/iusine/Image-bed@main/博客照片墙/...`
 * - `https://<任意镜像>/gh/iusine/Image-bed/博客照片墙/...`（没有 @branch）
 * - `https://raw.githubusercontent.com/iusine/Image-bed/main/博客照片墙/...`
 */
export function parsePicbedUrl(src?: string | null): ParsedPicbedUrl | null {
	if (!src || typeof src !== 'string') return null
	const value = src.trim()

	const ghMatch = value.match(/^https?:\/\/[^/]+\/gh\/([^/]+)\/([^/@]+)(?:@([^/]+))?\/(.+)$/i)
	const rawMatch = value.match(/^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/i)
	const match = ghMatch ?? rawMatch
	if (!match) return null

	const owner = match[1]
	const repo = match[2]
	if (owner.toLowerCase() !== PICBED.OWNER.toLowerCase()) return null
	if (repo.toLowerCase() !== PICBED.REPO.toLowerCase()) return null

	const branch = match[3] || PICBED.BRANCH
	const repoPath = safeDecodePath(match[4])
	const first = repoPath.split('/')[0]

	if (CATEGORY_SET.has(first)) {
		const rest = repoPath.slice(first.length).replace(/^\/+/, '')
		return {
			repoPath,
			branch,
			category: first as PicbedCategory,
			localPath: rest ? `/${encodePicbedPath(rest)}` : null
		}
	}

	return { repoPath, branch, category: null, localPath: null }
}

/**
 * 本地副本的扩展名通常和图床副本一致，但本地会把大于 1MB 的图片重新编码：
 * PNG / AVIF → WebP，BMP → JPEG。渲染时先试同名文件，再试转换后的扩展名。
 */
function mappedLocalPath(localPath: string): string | null {
	const match = localPath.match(/^(.*)\.([a-z0-9]{1,10})$/i)
	if (!match) return null

	const base = match[1]
	const ext = match[2].toLowerCase()
	const mapped = ext === 'png' || ext === 'avif' ? 'webp' : ext === 'bmp' || ext === 'jpeg' ? 'jpg' : ext
	if (mapped === ext) return null
	return `${base}.${mapped}`
}

function uniq(values: string[]): string[] {
	const seen = new Set<string>()
	const result: string[] = []
	for (const value of values) {
		if (!value || seen.has(value)) continue
		seen.add(value)
		result.push(value)
	}
	return result
}

/**
 * 渲染用的候选地址：
 * 图床各镜像 → raw.githubusercontent.com → 站内本地图。
 *
 * 非 Image-bed 地址原样返回，不产生额外请求。
 */
export function picbedCandidateUrls(src?: string | null, fallbackSrc?: string): string[] {
	if (!src) return fallbackSrc ? [fallbackSrc] : []

	const parsed = parsePicbedUrl(src)
	if (!parsed) return uniq([src, fallbackSrc || ''])

	const encodedPath = encodePicbedPath(parsed.repoPath)
	const remotes = PICBED_ORIGINS.map(
		origin => `${origin}/gh/${PICBED.OWNER}/${PICBED.REPO}@${parsed.branch}/${encodedPath}`
	)
	remotes.push(`${RAW_ORIGIN}/${PICBED.OWNER}/${PICBED.REPO}/${encodePicbedPath(parsed.branch)}/${encodedPath}`)

	const locals: string[] = []
	if (parsed.localPath) {
		locals.push(parsed.localPath)
		const mapped = mappedLocalPath(parsed.localPath)
		if (mapped) locals.push(mapped)
	}

	return uniq([src, ...remotes, ...locals, fallbackSrc || ''])
}
