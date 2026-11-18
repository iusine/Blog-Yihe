'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import type { JSONContent } from '@tiptap/core'
import { promptDialog } from '@/components/themed-dialog'

/**
 * 脚注引用（正文里的 [^1]）与脚注定义（文末的 [^1]: 内容）。
 * 两个节点都只保存纯文本，序列化回 Markdown 时与 Typora 语法一致。
 */
export const FootnoteRef = Node.create({
	name: 'footnoteRef',
	inline: true,
	group: 'inline',
	atom: true,
	selectable: false,

	addAttributes() {
		return { id: { default: '1' } }
	},

	parseHTML() {
		return [{ tag: 'sup[data-footnote-ref]' }]
	},

	renderHTML({ HTMLAttributes }) {
		return ['sup', mergeAttributes({ 'data-footnote-ref': '' }, { 'data-id': HTMLAttributes.id }), String(HTMLAttributes.id ?? '')]
	},

	markdownTokenizer: {
		name: 'footnoteRef',
		level: 'inline',
		start(src: string) {
			return src.indexOf('[^')
		},
		tokenize(src: string) {
			const match = src.match(/^\[\^([^\]\s]+)\]/)
			if (!match) return
			return { type: 'footnoteRef', raw: match[0], id: match[1] }
		}
	},

	parseMarkdown(token: any) {
		return { type: 'footnoteRef', attrs: { id: token.id || '1' } }
	},

	renderMarkdown(node: JSONContent) {
		return `[^${node.attrs?.id || '1'}]`
	}
})

export const FootnoteDefinition = Node.create({
	name: 'footnoteDefinition',
	group: 'block',
	atom: true,

	addAttributes() {
		return {
			id: { default: '1' },
			text: { default: '' }
		}
	},

	parseHTML() {
		return [{ tag: 'div[data-footnote-def]' }]
	},

	renderHTML({ HTMLAttributes }) {
		return [
			'div',
			mergeAttributes({ 'data-footnote-def': '' }, { 'data-id': HTMLAttributes.id, 'data-text': HTMLAttributes.text }, { class: 'footnote-def' }),
			`[${HTMLAttributes.id}] ${HTMLAttributes.text || ''}`
		]
	},

	addNodeView() {
		return ReactNodeViewRenderer(FootnoteDefinitionView)
	},

	markdownTokenizer: {
		name: 'footnoteDefinition',
		level: 'block',
		start(src: string) {
			return src.search(/^\[\^[^\]\s]+\]:/m)
		},
		tokenize(src: string) {
			const match = src.match(/^\[\^([^\]\s]+)\]:[ \t]*([^\n]*)(?:\n|$)/)
			if (!match) return
			return { type: 'footnoteDefinition', raw: match[0], id: match[1], text: match[2] }
		}
	},

	parseMarkdown(token: any) {
		return { type: 'footnoteDefinition', attrs: { id: token.id || '1', text: token.text || '' } }
	},

	renderMarkdown(node: JSONContent) {
		return `[^${node.attrs?.id || '1'}]: ${node.attrs?.text || ''}\n`
	}
})

function FootnoteDefinitionView({ node, updateAttributes }: NodeViewProps) {
	const id = String(node.attrs.id || '1')
	const text = String(node.attrs.text || '')

	const edit = async () => {
		const next = await promptDialog({
			title: `编辑脚注 [${id}]`,
			message: '脚注内容会显示在文章末尾。',
			defaultValue: text,
			placeholder: '脚注内容',
			multiline: true,
			confirmText: '保存'
		})
		if (next === null) return
		updateAttributes({ text: next })
	}

	return (
		<NodeViewWrapper
			as='div'
			className='footnote-def text-secondary my-2 flex cursor-pointer items-start gap-2 rounded-lg border border-dashed border-white/15 bg-white/[0.03] px-3 py-2 text-[13px] transition-colors hover:border-white/30'
			data-footnote-def=''
			onClick={edit}
			title='点击编辑脚注内容'>
			<span className='text-brand shrink-0 font-semibold'>[{id}]</span>
			<span className='min-w-0 flex-1 break-words'>{text || '（空脚注，点击编辑）'}</span>
		</NodeViewWrapper>
	)
}
