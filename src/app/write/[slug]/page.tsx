'use client'

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { useWriteStore } from '../stores/write-store'
import { usePreviewStore } from '../stores/preview-store'
import { useLoadBlog } from '../hooks/use-load-blog'

// 与 /write 一致：编辑器相关模块按需加载
const WriteEditor = dynamic(() => import('../components/editor').then(m => m.WriteEditor), { ssr: false })
const WriteSidebar = dynamic(() => import('../components/sidebar').then(m => m.WriteSidebar), { ssr: false })
const WriteActions = dynamic(() => import('../components/actions').then(m => m.WriteActions), { ssr: false })
const WritePreview = dynamic(() => import('../components/preview').then(m => m.WritePreview), { ssr: false })

export default function EditBlogPage() {
	const params = useParams() as { slug?: string }
	const slug = params?.slug || ''

	const { form, cover } = useWriteStore()
	const { isPreview, closePreview } = usePreviewStore()
	const { loading } = useLoadBlog(slug)

	const coverPreviewUrl = cover ? (cover.type === 'url' ? cover.url : cover.previewUrl) : null

	if (loading) {
		return <div className='text-secondary flex h-screen items-center justify-center text-sm'>加载中...</div>
	}

	if (!slug) {
		return <div className='flex h-screen items-center justify-center text-sm text-red-500'>无效的博客 ID</div>
	}

	return isPreview ? (
		<WritePreview form={form} coverPreviewUrl={coverPreviewUrl} onClose={closePreview} slug={slug} />
	) : (
		<>
			<div className='flex h-full justify-center gap-6 px-6 pt-24 pb-12 max-lg:flex-col max-lg:items-center max-sm:px-3 max-sm:pt-44'>
				<WriteEditor />
				<WriteSidebar />
			</div>

			<WriteActions />
		</>
	)
}
