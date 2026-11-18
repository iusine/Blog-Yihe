'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import type { JSONContent } from '@tiptap/core'
import { cn } from '@/lib/utils'

export const ADMONITION_KINDS = ['note', 'tip', 'important', 'warning', 'caution'] as const
export type AdmonitionKind = (typeof ADMONITION_KINDS)[number]

const LABELS: Record<AdmonitionKind, string> = {
	note: '注意',
	tip: '提示',
	important: '重要',
	warning: '警告',
	caution: '小心'
}

/**
 * 警告框节点：源码语法与 GitHub / Typora 一致：
 *
 * > [!NOTE]
 * > 这里写内容
 *
 * 编辑器里显示成带颜色的块，点击左上角类型可以切换 NOTE/TIP/...
 */
export const Admonition = Node.create({
	name: 'admonition',
	group: 'block',
	content: 'block+',
	defining: true,

	addAttributes() {
		return {
			kind: { default: 'note' },
			title: { default: '' }
		}
	},

	parseHTML() {
		return [{ tag: 'div[data-admonition]' }]
	},

	renderHTML({ HTMLAttributes }) {
		const kind = HTMLAttributes.kind || 'note'
		const title = HTMLAttributes.title || LABELS[kind as AdmonitionKind] || LABELS.note
		return [
			'div',
			mergeAttributes({ 'data-admonition': '' }, { 'data-kind': kind, class: `admonition admonition-${kind}` }),
			['div', { class: 'admonition-title' }, title],
			['div', { class: 'admonition-body' }, 0]
		]
	},

	addNodeView() {
		return ReactNodeViewRenderer(AdmonitionView)
	},

	markdownTokenizer: {
		name: 'admonition',
		level: 'block',
		start(src: string) {
			return src.search(/^>[ \t]*\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/im)
		},
		tokenize(src: string, _tokens: unknown, helpers: any) {
			const head = src.match(/^>[ \t]*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*([^\n]*)(?:\n|$)/i)
			if (!head) return

			let raw = head[0]
			let rest = src.slice(raw.length)
			const lines: string[] = []

			while (rest.length > 0) {
				const line = rest.match(/^>[^\n]*(?:\n|$)/)
				if (!line || line[0] === '') break
				raw += line[0]
				lines.push(line[0].replace(/^>[ \t]?/, '').replace(/\n$/, ''))
				rest = rest.slice(line[0].length)
			}

			const body = lines.join('\n').trim()
			return {
				type: 'admonition',
				raw,
				kind: head[1].toLowerCase(),
				title: head[2].trim(),
				tokens: body ? helpers.blockTokens(body) : []
			}
		}
	},

	parseMarkdown(token: any, helpers: any) {
		return {
			type: 'admonition',
			attrs: { kind: token.kind || 'note', title: token.title || '' },
			content: helpers.parseChildren(token.tokens || [])
		}
	},

	renderMarkdown(node: JSONContent, helpers: any) {
		const kind = String(node.attrs?.kind || 'note').toUpperCase()
		const title = node.attrs?.title ? ` ${node.attrs.title}` : ''
		const body = String(helpers.renderChildren(node.content || [], '\n\n') || '').trim()
		const quoted = body
			.split('\n')
			.map(line => (line ? `> ${line}` : '>'))
			.join('\n')
		return `> [!${kind}]${title}\n${quoted}\n`
	}
})

function AdmonitionView({ node, updateAttributes, selected }: NodeViewProps) {
	const kind = (node.attrs.kind as AdmonitionKind) || 'note'
	const label = (node.attrs.title as string) || LABELS[kind] || LABELS.note

	const cycleKind = () => {
		const index = ADMONITION_KINDS.indexOf(kind)
		updateAttributes({ kind: ADMONITION_KINDS[(index + 1) % ADMONITION_KINDS.length] })
	}

	return (
		<NodeViewWrapper
			as='div'
			className={cn('admonition', `admonition-${kind}`, selected && 'ring-brand/25 ring-2')}
			data-admonition=''
			data-kind={kind}>
			<div className='admonition-title select-none' contentEditable={false} onClick={cycleKind} title='点击切换警告框类型'>
				{label}
			</div>
			<NodeViewContent className='admonition-body' />
		</NodeViewWrapper>
	)
}
