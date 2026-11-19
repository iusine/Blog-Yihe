'use client'

import { useEffect, useMemo, useRef, useState, type ImgHTMLAttributes, type SyntheticEvent } from 'react'
import { picbedCandidateUrls } from '@/lib/picbed'

type PicbedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
	src?: string
	/** 额外的兜底地址（一般不需要，图床地址会自动推导站内副本） */
	fallbackSrc?: string
}

/**
 * Image-bed 图片的降级加载：
 * 依次尝试各个 jsDelivr 镜像 → raw.githubusercontent.com → 站内本地副本。
 * 非图床地址（本地图、外部图、blob: 预览）原样透传。
 */
export default function PicbedImage({ src, fallbackSrc, onError, ...rest }: PicbedImageProps) {
	const candidates = useMemo(() => picbedCandidateUrls(src, fallbackSrc), [src, fallbackSrc])
	const [index, setIndex] = useState(0)
	const imgRef = useRef<HTMLImageElement | null>(null)
	const failedRef = useRef(new Set<string>())

	useEffect(() => {
		failedRef.current.clear()
		setIndex(0)
	}, [src, fallbackSrc])

	const safeIndex = Math.min(index, Math.max(0, candidates.length - 1))
	const current = candidates[safeIndex]

	const advance = (candidate?: string) => {
		if (!candidate || failedRef.current.has(candidate)) return
		failedRef.current.add(candidate)
		setIndex(previous => (previous < candidates.length - 1 ? previous + 1 : previous))
	}

	// 图可能在 React 水合之前就已经失败（onError 还没绑定），这里补一次检查
	useEffect(() => {
		const img = imgRef.current
		if (!img || img.getAttribute('src') !== current) return
		if (!img.complete || img.naturalWidth > 0) return
		advance(current)
	}, [current, candidates.length])

	const handleError = (event: SyntheticEvent<HTMLImageElement, Event>) => {
		onError?.(event)
		advance(current)
	}

	if (!current) return null
	return <img {...rest} ref={imgRef} src={current} onError={handleError} />
}
