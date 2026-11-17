'use client'

import { Copy, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { DialogModal } from '@/components/dialog-modal'
import { buildMailBody, type Message } from '../types'
import type { OwnerEntry } from '../lib/decrypt'

type Props = {
	entries: OwnerEntry[]
	onClose: () => void
}

/** 站主专用：待代发队列 + 仅站主留言一览 */
export default function OwnerPanel({ entries, onClose }: Props) {
	const pending = entries.filter(entry => entry.deliverEmail)
	const privateOnes = entries.filter(entry => entry.ownerOnly)

	const copy = async (entry: OwnerEntry) => {
		const mail = entry.deliverEmail
			? `收件人：${entry.deliverEmail}\n主题：来自留言墙的一封信\n\n${buildMailBody(entry)}`
			: buildMailBody(entry)
		try {
			await navigator.clipboard.writeText(mail)
			toast.success('已复制，可以直接粘贴到邮箱')
		} catch {
			toast.error('复制失败，请手动选择文本')
		}
	}

	return (
		<DialogModal open onClose={onClose} className='card max-h-[88vh] w-[min(680px,94vw)] overflow-y-auto'>
			<h2 className='text-xl font-bold'>站主面板</h2>
			<p className='text-secondary mt-1 text-xs'>
				共 {entries.length} 条 · 仅站主 {privateOnes.length} 条 · 待代发 {pending.length} 条
			</p>

			<div className='mt-4 space-y-2'>
				{pending.length === 0 && <p className='text-secondary rounded-xl border border-dashed p-4 text-center text-xs'>暂无待代发的留言</p>}

				{pending.map(entry => (
					<div key={entry.id} className='rounded-xl border bg-[#fffaf0] p-3'>
						<div className='flex flex-wrap items-center gap-2 text-[11px] text-[#8b7667]'>
							<span className='font-medium text-[#5B423F]'>{entry.anonymous ? '匿名' : entry.author || '访客'}</span>
							<span>{entry.createdAt.replace('T', ' ').slice(0, 16)}</span>
							{entry.ownerOnly && <span className='rounded-full bg-[#5B423F]/8 px-1.5 py-0.5'>仅站主</span>}
							<span className='ml-auto flex items-center gap-1'>
								<Mail className='h-3 w-3' />
								{entry.deliverEmail}
							</span>
						</div>

						<p className='mt-2 line-clamp-3 text-[13px] leading-relaxed whitespace-pre-wrap text-[#4a3431]'>{entry.content}</p>

						<div className='mt-2 flex flex-wrap gap-2'>
							<button type='button' onClick={() => copy(entry)} className='flex items-center gap-1 rounded-lg border bg-white px-3 py-1.5 text-xs hover:bg-gray-50'>
								<Copy className='h-3 w-3' />
								复制代发内容
							</button>
							<a
								href={`mailto:${entry.deliverEmail}?subject=${encodeURIComponent('来自留言墙的一封信')}&body=${encodeURIComponent(buildMailBody(entry))}`}
								className='flex items-center gap-1 rounded-lg border bg-white px-3 py-1.5 text-xs hover:bg-gray-50'>
								<Mail className='h-3 w-3' />
								直接发送
							</a>
						</div>
					</div>
				))}
			</div>

			{privateOnes.length > 0 && (
				<>
					<h3 className='mt-6 text-sm font-semibold text-[#5B423F]'>仅站主可见</h3>
					<div className='mt-2 space-y-2'>
						{privateOnes.map(entry => (
							<div key={entry.id} className='rounded-xl border bg-white p-3'>
								<div className='flex items-center gap-2 text-[11px] text-[#8b7667]'>
									<span className='font-medium text-[#5B423F]'>{entry.anonymous ? '匿名' : entry.author || '访客'}</span>
									<span>{entry.createdAt.replace('T', ' ').slice(0, 16)}</span>
								</div>
								<p className='mt-1 line-clamp-3 text-[13px] leading-relaxed whitespace-pre-wrap text-[#4a3431]'>{entry.content}</p>
							</div>
						))}
					</div>
				</>
			)}

			<button type='button' onClick={onClose} className='brand-btn mt-6 w-full justify-center rounded-xl px-4 py-2 text-sm'>
				关闭
			</button>
		</DialogModal>
	)
}

export type { Message }
