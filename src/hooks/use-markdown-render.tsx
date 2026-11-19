import { useEffect, useState, type ReactElement } from 'react'
import { enhanceRenderedHtml } from '@/lib/enhance-html'
import type { TocItem } from '@/lib/markdown-renderer'

type MarkdownRenderResult = {
	content: ReactElement | null
	toc: TocItem[]
	loading: boolean
}

/** 预览/编辑器用的即时渲染；文章页直接使用构建期渲染好的 HTML，不走这里。 */
export function useMarkdownRender(markdown: string, enabled = true): MarkdownRenderResult {
	const [content, setContent] = useState<ReactElement | null>(null)
	const [toc, setToc] = useState<TocItem[]>([])
	const [loading, setLoading] = useState<boolean>(enabled)

	useEffect(() => {
		if (!enabled) {
			setContent(null)
			setToc([])
			setLoading(false)
			return
		}

		let cancelled = false

		async function render() {
			setLoading(true)
			try {
				// 只有这里需要 marked / shiki / katex，动态加载让文章页不必下载它们
				const { renderMarkdown } = await import('@/lib/markdown-renderer')
				const { html, toc } = await renderMarkdown(markdown)
				if (!cancelled) {
					setContent(enhanceRenderedHtml(html))
					setToc(toc)
				}
			} catch (error) {
				console.error('Markdown render error:', error)
				if (!cancelled) {
					setContent(null)
					setToc([])
				}
			} finally {
				if (!cancelled) setLoading(false)
			}
		}

		render()

		return () => {
			cancelled = true
		}
	}, [markdown, enabled])

	return { content, toc, loading }
}
