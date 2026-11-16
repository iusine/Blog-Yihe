'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, X } from 'lucide-react'
import { DialogModal } from '@/components/dialog-modal'
import type { NewPhotoDraft } from '../types'
import { todayString } from '../lib/photos'

type Draft = {
	key: string
	file: File
	previewUrl: string
	title: string
	description: string
	tagsInput: string
	date: string
	location: string
}

type PhotoUploadDialogProps = {
	cityName: string
	onClose: () => void
	onSubmit: (drafts: NewPhotoDraft[]) => Promise<void>
}

function titleFromFilename(name: string): string {
	return name.replace(/\.[^.]+$/, '').trim() || '未命名照片'
}

export default function PhotoUploadDialog({ cityName, onClose, onSubmit }: PhotoUploadDialogProps) {
	const inputRef = useRef<HTMLInputElement>(null)
	const [drafts, setDrafts] = useState<Draft[]>([])
	const [saving, setSaving] = useState(false)
	const draftsRef = useRef<Draft[]>([])

	draftsRef.current = drafts

	useEffect(() => {
		return () => {
			for (const draft of draftsRef.current) URL.revokeObjectURL(draft.previewUrl)
		}
	}, [])

	const addFiles = (files: FileList | null) => {
		if (!files || files.length === 0) return
		const next: Draft[] = []
		for (const file of Array.from(files)) {
			if (!file.type.startsWith('image/')) continue
			next.push({
				key: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
				file,
				previewUrl: URL.createObjectURL(file),
				title: titleFromFilename(file.name),
				description: '',
				tagsInput: '',
				date: todayString(),
				location: ''
			})
		}
		if (next.length === 0) {
			toast.error('请选择图片文件')
			return
		}
		setDrafts(previous => [...previous, ...next])
	}

	const updateDraft = (key: string, patch: Partial<Draft>) => {
		setDrafts(previous => previous.map(draft => (draft.key === key ? { ...draft, ...patch } : draft)))
	}

	const removeDraft = (key: string) => {
		setDrafts(previous => {
			const target = previous.find(draft => draft.key === key)
			if (target) URL.revokeObjectURL(target.previewUrl)
			return previous.filter(draft => draft.key !== key)
		})
	}

	const handleSubmit = async () => {
		if (drafts.length === 0) {
			toast.error('先选择要上传的照片')
			return
		}

		setSaving(true)
		try {
			await onSubmit(
				drafts.map(draft => ({
					file: draft.file,
					title: draft.title.trim() || titleFromFilename(draft.file.name),
					description: draft.description,
					tags: draft.tagsInput
						.split(/[,，]/)
						.map(tag => tag.trim())
						.filter(Boolean),
					date: draft.date || todayString(),
					location: draft.location
				}))
			)
			onClose()
		} catch (error: any) {
			console.error('Failed to upload photos:', error)
			toast.error(`上传失败：${error?.message || '未知错误'}`)
		} finally {
			setSaving(false)
		}
	}

	return (
		<DialogModal open onClose={saving ? () => {} : onClose} className='card max-h-[88vh] w-[min(720px,94vw)] overflow-y-auto' lockScroll>
			<div className='mb-4 flex items-start justify-between gap-4'>
				<div>
					<h2 className='text-xl font-bold'>上传照片</h2>
					<p className='text-secondary mt-1 text-xs'>
						上传到 <span className='text-brand'>{cityName}</span>，照片信息会一起写进仓库
					</p>
				</div>
				<button type='button' onClick={onClose} disabled={saving} className='text-secondary rounded-lg border px-2 py-1 text-xs'>
					关闭
				</button>
			</div>

			<input ref={inputRef} type='file' accept='image/*' multiple className='hidden' onChange={event => { addFiles(event.target.files); if (event.currentTarget) event.currentTarget.value = '' }} />

			<button
				type='button'
				onClick={() => inputRef.current?.click()}
				className='mb-4 flex h-24 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#8b7667]/40 bg-white/50 text-sm text-[#5B423F] transition-colors hover:bg-white/80'>
				<Plus className='h-4 w-4' />
				选择照片（可多选）
			</button>

			<div className='space-y-3'>
				{drafts.map(draft => (
					<div key={draft.key} className='flex gap-3 rounded-xl border bg-white/70 p-2.5'>
						<img src={draft.previewUrl} alt={draft.title} className='h-24 w-32 shrink-0 rounded-lg object-cover' />

						<div className='min-w-0 flex-1 space-y-1.5'>
							<input
								value={draft.title}
								onChange={event => updateDraft(draft.key, { title: event.target.value })}
								placeholder='标题'
								className='w-full rounded-md border bg-white px-2 py-1 text-sm font-medium focus:ring-1 focus:ring-[#2fcbe7] focus:outline-none'
							/>
							<div className='grid grid-cols-2 gap-1.5'>
								<input
									type='date'
									value={draft.date}
									onChange={event => updateDraft(draft.key, { date: event.target.value })}
									className='w-full rounded-md border bg-white px-2 py-1 text-xs text-[#5B423F]'
								/>
								<input
									value={draft.location}
									onChange={event => updateDraft(draft.key, { location: event.target.value })}
									placeholder='地点，如 广州塔'
									className='w-full rounded-md border bg-white px-2 py-1 text-xs'
								/>
							</div>
							<textarea
								value={draft.description}
								onChange={event => updateDraft(draft.key, { description: event.target.value })}
								placeholder='照片说明…'
								rows={2}
								className='w-full resize-none rounded-md border bg-white px-2 py-1 text-xs'
							/>
							<input
								value={draft.tagsInput}
								onChange={event => updateDraft(draft.key, { tagsInput: event.target.value })}
								placeholder='标签，用逗号分隔'
								className='w-full rounded-md border bg-white px-2 py-1 text-xs'
							/>
						</div>

						<button type='button' onClick={() => removeDraft(draft.key)} className='text-secondary self-start rounded p-1 hover:bg-black/5' aria-label='移除'>
							<X className='h-4 w-4' />
						</button>
					</div>
				))}
			</div>

			<div className='mt-5 flex gap-3'>
				<button type='button' onClick={onClose} disabled={saving} className='flex-1 rounded-lg border bg-white px-4 py-2 text-sm transition-colors hover:bg-gray-50'>
					取消
				</button>
				<button type='button' onClick={handleSubmit} disabled={saving || drafts.length === 0} className='brand-btn flex-1 justify-center rounded-lg px-4 py-2 text-sm disabled:opacity-60'>
					{saving ? '上传中…' : drafts.length > 0 ? `上传 ${drafts.length} 张` : '上传'}
				</button>
			</div>
		</DialogModal>
	)
}
