import type { Editor } from '@tiptap/react'

/** 和 lib/markdown-renderer.ts 的 slugify 保持一致，保证目录里 #锚点 能跳对 */
function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
		.trim()
		.replace(/\s+/g, '-')
}

type Heading = { level: number; text: string }

/** 收集当前文档里的标题（H1-H4） */
export function collectHeadings(editor: Editor): Heading[] {
	const headings: Heading[] = []
	editor.state.doc.descendants(node => {
		if (node.type.name === 'heading') {
			const text = node.textContent.trim()
			if (text) headings.push({ level: node.attrs.level as number, text })
		}
	})
	return headings
}

/** 生成 Markdown 目录（嵌套列表 + 锚点链接），Typora 的 [TOC] 等价物 */
export function buildTocMarkdown(editor: Editor): string {
	const headings = collectHeadings(editor)
	if (headings.length === 0) return ''

	const minLevel = Math.min(...headings.map(h => h.level))
	return headings.map(h => `${'  '.repeat(Math.max(0, h.level - minLevel))}- [${h.text}](#${slugify(h.text)})`).join('\n')
}
