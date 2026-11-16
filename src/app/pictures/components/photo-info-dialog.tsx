'use client'

import { DialogModal } from '@/components/dialog-modal'
import type { Photo } from '../types'

export default function PhotoInfoDialog({ photo, cityName, onClose }: { photo: Photo; cityName?: string; onClose: () => void }) {
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

					<button type='button' onClick={onClose} className='brand-btn mt-6 w-full justify-center rounded-xl px-4 py-2 text-sm'>
						关闭
					</button>
				</div>
			</div>
		</DialogModal>
	)
}
