'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { cn } from '@/lib/utils'
import { promptDialog } from '@/components/themed-dialog'

/**
 * 公式块（Typora 的「公式块」）。
 *
 * - 在编辑器里用 KaTeX 实时渲染，点击可以改 LaTeX 源码；
 * - 序列化成 Markdown 时输出 `$$ ... $$`，和站点的 Markdown 渲染器（lib/markdown-renderer.ts）完全对齐；
 * - 解析靠 Markdown 扩展的自定义 marked 实例（见 components/editor.tsx 里的 mathBlock tokenizer）。
 */
export const MathBlock = Node.create({
	name: 'mathBlock',
	group: 'block',
	atom: true,
	draggable: true,
	selectable: true,
	isolating: true,

	addAttributes() {
		return {
			latex: { default: '' }
		}
	},

	parseHTML() {
		return [{ tag: 'div[data-math-block]' }]
	},

	renderHTML({ HTMLAttributes }) {
		return ['div', mergeAttributes({ 'data-math-block': '' }, { 'data-latex': HTMLAttributes.latex })]
	},

	addNodeView() {
		return ReactNodeViewRenderer(MathBlockView)
	},

	// 下面两个是 @tiptap/markdown 的自定义序列化 / 解析钩子
	parseMarkdown: (token: { text?: string }) => ({
		type: 'mathBlock',
		attrs: { latex: (token?.text || '').trim() }
	}),

	renderMarkdown: (node: { attrs?: { latex?: string } }) => {
		const latex = node?.attrs?.latex ?? ''
		return `$$\n${latex}\n$$\n`
	}
})

function MathBlockView({ node, updateAttributes, selected }: NodeViewProps) {
	const latex = (node.attrs.latex as string) || ''

	const html = useMemo(() => {
		const source = latex.trim() || '\\text{空公式，点击输入}'
		try {
			return katex.renderToString(source, { displayMode: true, throwOnError: false, output: 'html', strict: 'ignore' })
		} catch {
			return ''
		}
	}, [latex])

	const edit = async () => {
		const next = await promptDialog({
			title: '编辑公式',
			message: '输入 LaTeX 源码，不用写 $$。',
			defaultValue: latex,
			multiline: true,
			confirmText: '保存'
		})
		if (next === null) return
		updateAttributes({ latex: next })
	}

	return (
		<NodeViewWrapper
			as='div'
			className={cn(
				'math-block group my-3 cursor-pointer rounded-xl border p-4 text-center transition-colors',
				selected ? 'border-brand/60 ring-brand/15 ring-2' : 'border-black/10 hover:border-brand/40'
			)}
			onClick={edit}
			title='点击编辑公式'>
			<div dangerouslySetInnerHTML={{ __html: html }} />
			<div className='text-secondary mt-1 text-[11px] opacity-0 transition-opacity group-hover:opacity-100'>点击编辑 LaTeX</div>
		</NodeViewWrapper>
	)
}
