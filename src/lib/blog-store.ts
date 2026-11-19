import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { BlogConfig } from '@/app/blog/types'

/**
 * 文章正文的构建期读取。
 *
 * `public/blogs` 随代码一起部署，文章变更本身就会触发重新部署，
 * 所以这里直接用 fs 读本地文件，配合 generateStaticParams 在构建时预渲染。
 */
export type StoredBlog = {
	slug: string
	config: BlogConfig
	markdown: string
}

const BLOG_ROOT = path.join(process.cwd(), 'public', 'blogs')

/** 只接受单段路径，拦掉分隔符和 `.`/`..`，其余字符沿用历史 slug 的写法 */
export function normalizeBlogSlug(value: unknown): string | null {
	if (typeof value !== 'string') return null
	const slug = value.trim()
	if (!slug || slug.length > 120) return null
	if (slug === '.' || slug === '..') return null
	if (/[\\/\0]/.test(slug)) return null
	return slug
}

export async function listBlogSlugs(): Promise<string[]> {
	try {
		const raw = await readFile(path.join(BLOG_ROOT, 'index.json'), 'utf8')
		const data = JSON.parse(raw)
		if (!Array.isArray(data)) return []

		const slugs: string[] = []
		for (const item of data) {
			const slug = normalizeBlogSlug(item?.slug)
			if (slug && !slugs.includes(slug)) slugs.push(slug)
		}
		return slugs
	} catch {
		return []
	}
}

export async function readBlog(slug: unknown): Promise<StoredBlog | null> {
	const safeSlug = normalizeBlogSlug(slug)
	if (!safeSlug) return null

	const dir = path.join(BLOG_ROOT, safeSlug)

	let markdown: string
	try {
		markdown = await readFile(path.join(dir, 'index.md'), 'utf8')
	} catch {
		return null
	}

	let config: BlogConfig = {}
	try {
		const parsed = JSON.parse(await readFile(path.join(dir, 'config.json'), 'utf8'))
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) config = parsed as BlogConfig
	} catch {
		// 没有 config.json 时仍展示正文
	}

	return { slug: safeSlug, config, markdown }
}
