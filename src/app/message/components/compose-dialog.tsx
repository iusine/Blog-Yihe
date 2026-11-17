'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Mail, Lock, UserX } from 'lucide-react'
import { DialogModal } from '@/components/dialog-modal'
import { encryptForOwner } from '../lib/crypto'
import { buildMailBody, contentLimit, OWNER_EMAIL, type MessageDraft } from '../types'

type Props = {
	onClose: () => void
	/** 站主公钥（没有就无法使用「代发」和「仅站主」两个功能） */
	ownerPublicKey: string | null
	onSubmitted: (result: { ok: boolean; fallback?: boolean }) => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export default function ComposeDialog({ onClose, ownerPublicKey, onSubmitted }: Props) {
	const [author, setAuthor] = useState('')
	const [anonymous, setAnonymous] = useState(false)
	const [content, setContent] = useState('')
	const [sendToOther, setSendToOther] = useState(false)
	const [deliverEmail, setDeliverEmail] = useState('')
	const [ownerOnly, setOwnerOnly] = useState(false)
	const [saving, setSaving] = useState(false)

	const limit = contentLimit(sendToOther)
	const encryptReady = Boolean(ownerPublicKey)
	const remaining = limit - content.length

	useEffect(() => {
		if (content.length > limit) setContent(prev => prev.slice(0, limit))
	}, [limit, content.length])

	const openMailFallback = () => {
		const body = buildMailBody({ content, author, anonymous })
		const subject = encodeURIComponent('留言墙 · 需要代发的留言')
		window.location.href = `mailto:${OWNER_EMAIL}?subject=${subject}&body=${encodeURIComponent(body)}`
	}

	const handleSubmit = async () => {
		if (!anonymous && !author.trim()) {
			toast.error('请填写留言者名字，或勾选「匿名」')
			return
		}
		if (!content.trim()) {
			toast.error('留言内容不能为空')
			return
		}
		if (content.length > limit) {
			toast.error(`留言最多 ${limit} 字`)
			return
		}
		if (sendToOther && !EMAIL_RE.test(deliverEmail.trim())) {
			toast.error('请填写对方的邮箱地址')
			return
		}
		if ((sendToOther || ownerOnly) && !encryptReady) {
			toast.error('站主还没发布公钥，暂时无法使用这个功能')
			return
		}

		setSaving(true)
		try {
			let cipher: string | undefined
			let deliverCipher: string | undefined

			if (ownerOnly && ownerPublicKey) {
				// 只有站主能看：把留言者和正文一起加密
				cipher = await encryptForOwner(
					JSON.stringify({
						author: anonymous ? '' : author.trim(),
						content: content.trim(),
						deliverEmail: sendToOther ? deliverEmail.trim() : ''
					}),
					ownerPublicKey
				)
			}

			if (sendToOther && ownerPublicKey) {
				deliverCipher = await encryptForOwner(deliverEmail.trim(), ownerPublicKey)
			}

			const payload: MessageDraft & { visibility: 'public' | 'owner'; cipher?: string; deliverCipher?: string } = {
				author: author.trim(),
				anonymous,
				content: content.trim(),
				sendToOther,
				deliverEmail: deliverEmail.trim(),
				ownerOnly,
				visibility: ownerOnly ? 'owner' : 'public',
				cipher,
				deliverCipher
			}

			const res = await fetch('/api/message', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			})
			const data = await res.json().catch(() => ({}))

			if (!res.ok || !data?.ok) {
				if (data?.code === 'NOT_CONFIGURED') {
					toast.warning('留言服务还没配置，正在帮你打开邮件…')
					openMailFallback()
					onSubmitted({ ok: false, fallback: true })
					return
				}
				throw new Error(data?.error || `提交失败 (${res.status})`)
			}

			toast.success(sendToOther ? '留言已提交，一禾会帮你代发邮件' : '留言成功，谢谢你的足迹～')
			onSubmitted({ ok: true })
			onClose()
		} catch (error: any) {
			console.error('Failed to submit message:', error)
			toast.error(error?.message || '提交失败，请稍后再试')
		} finally {
			setSaving(false)
		}
	}

	return (
		<DialogModal open onClose={saving ? () => {} : onClose} className='card max-h-[90vh] w-[min(560px,94vw)] overflow-y-auto'>
			<div className='mb-4'>
				<h2 className='text-xl font-bold'>留下一段足迹</h2>
				<p className='text-secondary mt-1 text-xs'>留言会贴在留言墙上，可以选择匿名，或者只让站主看见。</p>
			</div>

			<div className='space-y-3'>
				<div className='flex items-center gap-2'>
					<input
						value={anonymous ? '' : author}
						disabled={anonymous}
						onChange={event => setAuthor(event.target.value)}
						placeholder={anonymous ? '匿名留言' : '留言者（必填）'}
						maxLength={40}
						className='flex-1 rounded-lg border bg-white/10 px-3 py-2 text-sm focus:ring-1 focus:ring-brand focus:outline-none disabled:bg-black/5 disabled:text-white/50'
					/>
					<button
						type='button'
						onClick={() => setAnonymous(value => !value)}
						className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors ${
							anonymous ? 'border-white/30 bg-white/10 text-white/90' : 'bg-white/10 text-white/60 hover:bg-white/15'
						}`}>
						<UserX className='h-3.5 w-3.5' />
						匿名
					</button>
				</div>

				<div>
					<textarea
						value={content}
						onChange={event => setContent(event.target.value.slice(0, limit))}
						rows={sendToOther ? 8 : 4}
						placeholder={sendToOther ? '想托一禾转达的话（最多 2000 字）…' : '想说的话（最多 100 字）…'}
						className='w-full resize-none rounded-lg border bg-white/10 px-3 py-2 text-sm leading-relaxed focus:ring-1 focus:ring-brand focus:outline-none'
					/>
					<div className={`mt-1 text-right text-[11px] ${remaining < 10 ? 'text-red-400' : 'text-secondary'}`}>
						{content.length} / {limit}
					</div>
				</div>

				<label
					className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 transition-colors ${
						encryptReady ? 'bg-white/10 hover:bg-white/[0.06]' : 'cursor-not-allowed bg-black/[0.03] opacity-70'
					}`}>
					<input
						type='checkbox'
						checked={sendToOther}
						disabled={!encryptReady}
						onChange={event => setSendToOther(event.target.checked)}
						className='mt-0.5'
					/>
					<span className='flex-1'>
						<span className='flex items-center gap-1.5 text-sm font-medium'>
							<Mail className='h-3.5 w-3.5' />
							同时发送给 TA
						</span>
						<span className='text-secondary mt-0.5 block text-[11px]'>
							勾选后留言可以写到 2000 字，一禾会用邮箱代发；对方的邮箱只有站主能看到。
						</span>
					</span>
				</label>

				{sendToOther && (
					<input
						type='email'
						value={deliverEmail}
						onChange={event => setDeliverEmail(event.target.value)}
						placeholder='对方邮箱（必填）'
						className='w-full rounded-lg border bg-white/10 px-3 py-2 text-sm focus:ring-1 focus:ring-brand focus:outline-none'
					/>
				)}

				<label
					className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 transition-colors ${
						encryptReady ? 'bg-white/10 hover:bg-white/[0.06]' : 'cursor-not-allowed bg-black/[0.03] opacity-70'
					}`}>
					<input type='checkbox' checked={ownerOnly} disabled={!encryptReady} onChange={event => setOwnerOnly(event.target.checked)} className='mt-0.5' />
					<span className='flex-1'>
						<span className='flex items-center gap-1.5 text-sm font-medium'>
							<Lock className='h-3.5 w-3.5' />
							仅站主看见
						</span>
						<span className='text-secondary mt-0.5 block text-[11px]'>
							内容会用站主公钥加密后保存，其他人看不到；站主导入私钥后才能读。
						</span>
					</span>
				</label>

				{!encryptReady && <p className='text-secondary text-[11px]'>（站主还没发布公钥，上面两个功能暂时不可用）</p>}
			</div>

			<div className='mt-5 flex gap-3'>
				<button type='button' onClick={onClose} disabled={saving} className='flex-1 rounded-lg border bg-white/10 px-4 py-2 text-sm transition-colors hover:bg-white/15'>
					取消
				</button>
				<button type='button' onClick={handleSubmit} disabled={saving} className='brand-btn flex-1 justify-center rounded-lg px-4 py-2 text-sm disabled:opacity-60'>
					{saving ? '提交中…' : '贴上留言墙'}
				</button>
			</div>
		</DialogModal>
	)
}
