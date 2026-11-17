'use client'

import { Copy, Lock, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { DialogModal } from '@/components/dialog-modal'
import { buildMailBody, MAIL_PREFIX } from '../types'

type Props = {
	item: {
		author?: string
		anonymous: boolean
		content: string
		createdAt: string
		ownerOnly: boolean
		deliverEmail?: string
	}
	isOwner: boolean
	onClose: () => void
}

export default function MessageDetail({ item, isOwner, onClose }: Props) {
	const copyMail = async () => {
		const mail = item.deliverEmail
			? `收件人：${item.deliverEmail}\n主题：来自留言墙的一封信\n\n${buildMailBody(item)}`
			: buildMailBody(item)
		try {
			await navigator.clipboard.writeText(mail)
			toast.success('邮件内容已复制，可直接粘贴发送')
		} catch {
			toast.error('复制失败，请手动选择文本')
		}
	}

	return (
		<DialogModal open onClose={onClose} className='card w-[min(620px,94vw)] overflow-hidden'>
			<div className='flex items-start justify-between gap-3'>
				<div className='flex items-center gap-2 text-sm text-white'>
					<span className='font-semibold'>{item.anonymous ? '匿名访客' : item.author || '访客'}</span>
					<span className='text-secondary text-xs'>{item.createdAt.replace('T', ' ').slice(0, 16)}</span>
				</div>
				{item.ownerOnly && (
					<span className='flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white'>
						<Lock className='h-3 w-3' />
						仅站主可见
					</span>
				)}
			</div>

			<p className='mt-4 text-[15px] leading-relaxed break-words whitespace-pre-wrap text-white/90'>{item.content}</p>

			{isOwner && item.deliverEmail && (
				<div className='mt-5 rounded-xl border border-dashed border-white/20 bg-white/[0.06] p-3'>
					<p className='flex items-center gap-1.5 text-xs font-medium text-white'>
						<Mail className='h-3.5 w-3.5' />
						代发：{item.deliverEmail}
					</p>
					<p className='text-secondary mt-1 text-[11px] leading-relaxed whitespace-pre-line'>邮件开头会自动带上：{MAIL_PREFIX}</p>
					<div className='mt-2 flex flex-wrap gap-2'>
						<button type='button' onClick={copyMail} className='flex items-center gap-1 rounded-lg border bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15'>
							<Copy className='h-3 w-3' />
							复制邮件内容
						</button>
						<a
							href={`mailto:${item.deliverEmail}?subject=${encodeURIComponent('来自留言墙的一封信')}&body=${encodeURIComponent(buildMailBody(item))}`}
							className='flex items-center gap-1 rounded-lg border bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15'>
							<Mail className='h-3 w-3' />
							用邮件客户端发送
						</a>
					</div>
				</div>
			)}

			<button type='button' onClick={onClose} className='brand-btn mt-6 w-full justify-center rounded-xl px-4 py-2 text-sm'>
				关闭
			</button>
		</DialogModal>
	)
}
