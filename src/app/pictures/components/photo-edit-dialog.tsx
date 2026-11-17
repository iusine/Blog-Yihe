'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { DialogModal } from '@/components/dialog-modal'
import type { Photo, PhotoPatch } from '../types'

type Props = {
	photo: Photo
	cityName?: string
	onClose: () => void
	onSave: (patch: PhotoPatch) => Promise<void>
}

/** 修改照片信息：标题、日期、地点、说明、标签 */
export default function PhotoEditDialog({ photo, cityName, onClose, onSave }: Props) {
	const [title, setTitle] = useState(photo.title)
	const [date, setDate] = useState(photo.date)
	const [location, setLocation] = useState(photo.location ?? '')
	const [description, setDescription] = useState(photo.description ?? '')
	const [tagsInput, setTagsInput] = useState((photo.tags ?? []).join(', '))
	const [saving, setSaving] = useState(false)

	const handleSubmit = async () => {
		if (!title.trim()) {
			toast.error('标题不能为空')
			return
		}

		setSaving(true)
		try {
			await onSave({
				title: title.trim(),
				date,
				location,
				description,
				tags: tagsInput
					.split(/[,，]/)
					.map(tag => tag.trim())
					.filter(Boolean)
			})
			onClose()
		} catch (error: any) {
			console.error('Failed to update photo:', error)
			toast.error(`保存失败：${error?.message || '未知错误'}`)
		} finally {
			setSaving(false)
		}
	}

	return (
		<DialogModal open onClose={saving ? () => {} : onClose} className='card max-h-[88vh] w-[min(560px,94vw)] overflow-y-auto'>
			<div className='mb-4 flex items-start justify-between gap-4'>
				<div>
					<h2 className='text-lg font-bold'>修改照片信息</h2>
					<p className='text-secondary mt-1 text-xs'>
						{cityName ? `地点归属：${cityName}` : '图片本身不会被替换'}
					</p>
				</div>
			</div>

			<img src={photo.src} alt={title} className='mb-4 max-h-[180px] w-full rounded-xl bg-black/5 object-contain' />

			<div className='space-y-2.5'>
				<label className='block'>
					<span className='text-secondary mb-1 block text-[11px]'>标题</span>
					<input
						value={title}
						onChange={event => setTitle(event.target.value)}
						placeholder='给这张照片起个名字'
						className='w-full rounded-lg border bg-white/10 px-3 py-2 text-sm focus:ring-1 focus:ring-brand focus:outline-none'
					/>
				</label>

				<div className='grid grid-cols-2 gap-2.5'>
					<label className='block'>
						<span className='text-secondary mb-1 block text-[11px]'>日期</span>
						<input
							type='date'
							value={date}
							onChange={event => setDate(event.target.value)}
							className='w-full rounded-lg border bg-white/10 px-3 py-2 text-sm text-white'
						/>
					</label>

					<label className='block'>
						<span className='text-secondary mb-1 block text-[11px]'>地点</span>
						<input
							value={location}
							onChange={event => setLocation(event.target.value)}
							placeholder='如 白云山'
							className='w-full rounded-lg border bg-white/10 px-3 py-2 text-sm focus:ring-1 focus:ring-brand focus:outline-none'
						/>
					</label>
				</div>

				<label className='block'>
					<span className='text-secondary mb-1 block text-[11px]'>说明</span>
					<textarea
						value={description}
						onChange={event => setDescription(event.target.value)}
						rows={4}
						placeholder='这张照片背后的故事…'
						className='w-full resize-none rounded-lg border bg-white/10 px-3 py-2 text-sm focus:ring-1 focus:ring-brand focus:outline-none'
					/>
				</label>

				<label className='block'>
					<span className='text-secondary mb-1 block text-[11px]'>标签（用逗号分隔）</span>
					<input
						value={tagsInput}
						onChange={event => setTagsInput(event.target.value)}
						placeholder='旅行, 夜景'
						className='w-full rounded-lg border bg-white/10 px-3 py-2 text-sm focus:ring-1 focus:ring-brand focus:outline-none'
					/>
				</label>
			</div>

			<div className='mt-5 flex gap-3'>
				<button type='button' onClick={onClose} disabled={saving} className='flex-1 rounded-lg border bg-white/10 px-4 py-2 text-sm transition-colors hover:bg-white/15'>
					取消
				</button>
				<button type='button' onClick={handleSubmit} disabled={saving} className='brand-btn flex-1 justify-center rounded-lg px-4 py-2 text-sm disabled:opacity-60'>
					{saving ? '保存中…' : '保存'}
				</button>
			</div>
		</DialogModal>
	)
}
