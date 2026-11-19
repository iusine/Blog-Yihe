'use client'

import { useEffect, useState } from 'react'
import { DialogModal } from '@/components/dialog-modal'
import PicbedImage from '@/components/picbed-image'
import { imageAlignStyle, imageWidthStyle, type ImageAlign } from '@/lib/image-style'

type MarkdownImageProps = {
	src: string
	alt?: string
	title?: string
	width?: number
	align?: ImageAlign
}

export function MarkdownImage({ src, alt = '', title = '', width, align }: MarkdownImageProps) {
	const [display, setDisplay] = useState(false)
	const [resolvedSrc, setResolvedSrc] = useState(src)

	useEffect(() => {
		setResolvedSrc(src)
	}, [src])

	const inlineStyle = { ...imageWidthStyle(width), ...imageAlignStyle(align) }
	const style = Object.keys(inlineStyle).length > 0 ? inlineStyle : undefined

	return (
		<>
			<PicbedImage
				src={src}
				alt={alt}
				title={title || undefined}
				style={style}
				loading='lazy'
				onLoad={event => setResolvedSrc(event.currentTarget.currentSrc || src)}
				onClick={() => setDisplay(true)}
				className='cursor-pointer transition-opacity hover:opacity-80'
			/>
			<DialogModal open={display} onClose={() => setDisplay(false)} className='max-w-none bg-transparent p-0'>
				<PicbedImage src={resolvedSrc} alt={alt} className='max-h-[90vh] max-w-full rounded-2xl object-contain' />
			</DialogModal>
		</>
	)
}
