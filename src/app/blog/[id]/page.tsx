import dayjs from 'dayjs'
import { notFound } from 'next/navigation'
import { listBlogSlugs, readBlog } from '@/lib/blog-store'
import { renderMarkdown } from '@/lib/markdown-renderer'
import { BlogArticle } from './blog-article'

type PageProps = {
	params: Promise<{ id: string }>
}

// 文章随代码一起部署，构建时预渲染成静态 HTML，首屏不需要再等客户端解析 markdown
export async function generateStaticParams() {
	const slugs = await listBlogSlugs()
	return slugs.map(id => ({ id }))
}

export default async function Page({ params }: PageProps) {
	const { id } = await params
	const blog = await readBlog(id)
	if (!blog) notFound()

	const { html, toc } = await renderMarkdown(blog.markdown)
	const title = blog.config.title || blog.slug
	const date = blog.config.date ? dayjs(blog.config.date).format('YYYY年 M月 D日') : ''

	return <BlogArticle slug={blog.slug} title={title} date={date} config={blog.config} html={html} toc={toc} />
}
