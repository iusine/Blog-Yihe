'use client'

import Image from '@tiptap/extension-image'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@/lib/utils'
import PicbedImage from '@/components/picbed-image'
import { useWriteStore } from '../stores/write-store'
import { formatImageStyleTitle, parseImageStyleTitle, type ImageAlign } from '@/lib/image-style'

const MIN_WIDTH = 10

function clampWidth(value: unknown): number | null {
	const parsed = Number(value)
	if (!Number.isFinite(parsed) || parsed <= 0) return null
	return Math.max(MIN_WIDTH, Math.min(100, Math.round(parsed)))
}

function ResolvedImageView({ node, selected, editor, getPos, updateAttributes }: NodeViewProps) {
	const images = useWriteStore(s => s.images)
	const rawSrc = (node.attrs.src as string) || ''

	let src = rawSrc
	if (rawSrc.startsWith('local-image:')) {
		const id = rawSrc.slice('local-image:'.length)
		const found = images.find(img => img.id === id)
		if (found?.type === 'file') {
			src = found.previewUrl
		}
	}

	const width = clampWidth(node.attrs.width)
	const align: ImageAlign = node.attrs.align === 'left' || node.attrs.align === 'right' ? node.attrs.align : 'center'
	const [dragWidth, setDragWidth] = useState<number | null>(null)
	const frameRef = useRef<HTMLDivElement | null>(null)
	const displayWidth = dragWidth ?? width

	const select = () => {
		const pos = getPos()
		if (typeof pos === 'number') editor.commands.setNodeSelection(pos)
	}

	const startResize = (event: ReactPointerEvent<HTMLSpanElement>) => {
		event.preventDefault()
		event.stopPropagation()

		const frame = frameRef.current
		const outer = frame?.parentElement
		if (!frame || !outer) return

		const outerWidth = outer.getBoundingClientRect().width
		if (!outerWidth) return

		const startX = event.clientX
		const startPercent = (frame.getBoundingClientRect().width / outerWidth) * 100

		const nextWidth = (clientX: number) => {
			const next = startPercent + ((clientX - startX) / outerWidth) * 100
			return Math.max(MIN_WIDTH, Math.min(100, Math.round(next)))
		}

		const handleMove = (moveEvent: PointerEvent) => {
			setDragWidth(nextWidth(moveEvent.clientX))
		}

		const handleUp = (upEvent: PointerEvent) => {
			window.removeEventListener('pointermove', handleMove)
			window.removeEventListener('pointerup', handleUp)
			document.body.style.userSelect = ''
			document.body.style.cursor = ''
			setDragWidth(null)
			updateAttributes({ width: nextWidth(upEvent.clientX) })
		}

		document.body.style.userSelect = 'none'
		document.body.style.cursor = 'nwse-resize'
		window.addEventListener('pointermove', handleMove)
		window.addEventListener('pointerup', handleUp)
	}

	return (
		<NodeViewWrapper as='div' className={cn('my-4 flex', align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center')}>
			{/* 选中描边画在框内侧：100% 宽时 ring-offset 会溢出滚动容器，左右两边被裁掉 */}
			<div
				ref={frameRef}
				className={cn('relative w-2/5 max-sm:w-full', selected && 'rounded-xl ring-2 ring-inset ring-blue-400')}
				style={displayWidth ? { width: `${displayWidth}%`, maxWidth: '100%' } : undefined}
				onClick={select}>
				<PicbedImage
					src={src}
					alt={(node.attrs.alt as string) || ''}
					title={(node.attrs.title as string) || undefined}
					className='block h-auto w-full rounded-xl border'
					draggable={false}
				/>
				{selected && (
					<span
						role='slider'
						aria-label='拖动调整图片大小'
						aria-valuemin={MIN_WIDTH}
						aria-valuemax={100}
						aria-valuenow={displayWidth ?? 40}
						title='拖动调整图片大小'
						className='absolute right-1 bottom-1 size-3.5 cursor-nwse-resize touch-none rounded-full border-2 border-white bg-blue-500 shadow max-sm:size-5'
						onPointerDown={startResize}
						onClick={event => event.stopPropagation()}
					/>
				)}
			</div>
		</NodeViewWrapper>
	)
}

export const ResolvedImage = Image.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			align: {
				default: null,
				parseHTML: element => element.getAttribute('data-align'),
				renderHTML: attributes => (attributes.align ? { 'data-align': attributes.align } : {})
			}
		}
	},
	parseMarkdown(token, helpers) {
		const { style, title } = parseImageStyleTitle(token.title)
		return helpers.createNode('image', {
			src: token.href,
			alt: token.text,
			title: title ?? null,
			width: style.width ?? null,
			align: style.align ?? null
		})
	},
	renderMarkdown(node) {
		const attrs = node.attrs || {}
		const styleTitle = formatImageStyleTitle({
			width: clampWidth(attrs.width) ?? undefined,
			align: attrs.align === 'left' || attrs.align === 'right' ? attrs.align : undefined
		})
		const title = styleTitle || attrs.title || ''
		const src = attrs.src || ''
		const alt = attrs.alt || ''
		return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`
	},
	addNodeView() {
		return ReactNodeViewRenderer(ResolvedImageView)
	}
}).configure({
	allowBase64: false
})
