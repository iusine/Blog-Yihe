'use client'

import dynamic from 'next/dynamic'
import { useWriteStore } from './stores/write-store'
import { usePreviewStore } from './stores/preview-store'
import { useEffect } from 'react'

// 编辑器（Tiptap / KaTeX / marked）体积大，按需拆包：未登录或只打卡片时不用下载
const WriteEditor = dynamic(() => import('./components/editor').then(m => m.WriteEditor), { ssr: false })
const WriteSidebar = dynamic(() => import('./components/sidebar').then(m => m.WriteSidebar), { ssr: false })
const WriteActions = dynamic(() => import('./components/actions').then(m => m.WriteActions), { ssr: false })
const WritePreview = dynamic(() => import('./components/preview').then(m => m.WritePreview), { ssr: false })

export default function WritePage() {
	const { form, cover, reset } = useWriteStore()
	useEffect(() => reset(), [])
	const { isPreview, closePreview } = usePreviewStore()

	const coverPreviewUrl = cover ? (cover.type === 'url' ? cover.url : cover.previewUrl) : null

	return isPreview ? (
		<WritePreview form={form} coverPreviewUrl={coverPreviewUrl} onClose={closePreview} />
	) : (
		<>
			<div className='flex h-full justify-center gap-6 px-6 pt-24 pb-12 max-lg:flex-col max-lg:items-center max-sm:px-3 max-sm:pt-24 max-sm:pb-24'>
				<WriteEditor />
				<WriteSidebar />
			</div>

			<WriteActions />
		</>
	)
}
