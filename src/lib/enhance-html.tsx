import { Fragment, type ReactElement } from 'react'
import parse, { type HTMLReactParserOptions, Element, type DOMNode } from 'html-react-parser'
import { MarkdownImage } from '@/components/markdown-image'
import { CodeBlock } from '@/components/code-block'
import { parseImageStyleTitle } from '@/lib/image-style'

type CodeBlockData = { placeholder: string; code: string; preHtml: string }

function decodeCodeAttribute(value: string): string {
	return value
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&')
}

/**
 * 把 markdown 渲染出的 HTML 转成 React 节点，
 * 同时把 <img> 和代码块替换成可交互组件。
 * 纯同步处理，不依赖 marked / shiki。
 */
export function enhanceRenderedHtml(html: string): ReactElement {
	const codeBlocks: CodeBlockData[] = []

	const processedHtml = html.replace(/<pre\s+data-code="([^"]*)"([^>]*)>([\s\S]*?)<\/pre>/g, (_match, codeAttr, attrs, content) => {
		const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`
		codeBlocks.push({
			placeholder,
			code: decodeCodeAttribute(codeAttr),
			preHtml: `<pre${attrs || ''}>${content}</pre>`
		})
		return placeholder
	})

	const options: HTMLReactParserOptions = {
		replace(domNode: DOMNode) {
			if (domNode instanceof Element && domNode.name === 'img') {
				const { src, alt, title } = domNode.attribs
				const { style, title: realTitle } = parseImageStyleTitle(title)
				return <MarkdownImage src={src} alt={alt} title={realTitle} width={style.width} align={style.align} />
			}

			if (domNode.type === 'text' && domNode.data && domNode.data.includes('__CODE_BLOCK_')) {
				const parts = domNode.data.split(/(__CODE_BLOCK_\d+__)/).filter(Boolean)

				return (
					<>
						{parts.map((part, index) => {
							if (!part.startsWith('__CODE_BLOCK_')) {
								return part ? <Fragment key={index}>{part}</Fragment> : null
							}

							const block = codeBlocks.find(item => item.placeholder === part)
							if (!block) return null

							const preElement = parse(block.preHtml) as ReactElement
							return (
								<CodeBlock key={block.placeholder} code={block.code}>
									{preElement}
								</CodeBlock>
							)
						})}
					</>
				)
			}
		}
	}

	return parse(processedHtml, options) as ReactElement
}
