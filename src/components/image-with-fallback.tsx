'use client'

import Image, { type ImageProps } from 'next/image'
import { useEffect, useState } from 'react'

type ImageWithFallbackProps = Omit<ImageProps, 'onError'> & {
	/** 远程图加载失败时使用的项目内路径，例如 `/images/avatar.png` */
	fallbackSrc: string
}

/**
 * next/image 的加载兜底。
 *
 * 背景：头像放在 jsdelivr 上，CDN 偶尔会把大文件当成 `application/octet-stream` 返回，
 * Next 的图片优化器会直接 400（`The requested resource isn't a valid image`），
 * 页面上就是一张裂图。这里监听 onError，失败就换成项目里的本地图。
 *
 * 注意：本地图也失败时不会重复设置，避免死循环。
 */
export default function ImageWithFallback({ src, fallbackSrc, alt, ...rest }: ImageWithFallbackProps) {
	const [currentSrc, setCurrentSrc] = useState<ImageProps['src']>(src)

	useEffect(() => {
		setCurrentSrc(src)
	}, [src])

	return (
		<Image
			{...rest}
			src={currentSrc}
			alt={alt}
			onError={() => {
				if (String(currentSrc) !== fallbackSrc) setCurrentSrc(fallbackSrc)
			}}
		/>
	)
}
