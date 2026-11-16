'use client'

import { Pencil } from 'lucide-react'
import { DialogModal } from '@/components/dialog-modal'
import type { Photo } from '../types'

type Props = {
	photo: Photo
	cityName?: string
	onClose: () => void
	/** 传入则显示「修改信息」按钮 */
	onEdit?: () => void
}

export default function PhotoInfoDialog({ photo, cityName, onClose, onEdit }: Props) {
	return (
		<DialogModal open onClose={onClose} className='card w-[min(960px,94vw)] overflow-hidden p-0'>
			<div className='flex max-h-[88vh] flex-col md:flex-row'>
				<div className='flex min-h-[240px] flex-1 items-center justify-center bg-black/5 md:max-h-[88vh]'>
					<img src={photo.src} alt={photo.title} className='max-h-[45vh] w-full object-contain md:max-h-[88vh]' />
				</div>

				<div className='w-full shrink-0 overflow-y-auto p-6 md:w-[320px]'>
					<h2 className='text-xl leading-snug font-semibold text-[#5B423F]'>{photo.title}</h2>

					<div className='text-secondary mt-2 space-y-1 text-xs'>
						<p>📅 {photo.date}</p>
						{photo.location && <p>📍 {photo.location}</p>}
						{cityName && <p>🗺️ {cityName}</p>}
					</div>

					{photo.description && (
						<p className='mt-4 text-sm leading-relaxed whitespace-pre-wrap text-[#5B423F]/85'>{photo.description}</p>
					)}

					{photo.tags && photo.tags.length > 0 && (
						<div className='mt-4 flex flex-wrap gap-1.5'>
							{photo.tags.map(tag => (
								<span key={tag} className='rounded-full bg-[#5B423F]/8 px-2.5 py-0.5 text-[11px] text-[#5B423F]'>
									#{tag}
								</span>
							))}
						</div>
					)}

					<div className='mt-6 flex gap-2'>
						{onEdit && (
							<button
								type='button'
								onClick={onEdit}
								className='bg-card flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-sm transition-colors hover:bg-white'>
								<Pencil className='h-3.5 w-3.5' />
								修改信息
							</button>
						)}
						<button type='button' onClick={onClose} className='brand-btn flex-1 justify-center rounded-xl px-4 py-2 text-sm'>
							关闭
						</button>
					</div>
				</div>
			</div>
		</DialogModal>
	)
}
