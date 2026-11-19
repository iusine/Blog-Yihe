'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, PenLine, Settings2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import MessageWall, { type WallItem } from './components/message-wall'

// 写留言、详情、站主面板都是按需打开的，拆包后访客只加载留言墙本身
const ComposeDialog = dynamic(() => import('./components/compose-dialog'), { ssr: false })
const MessageDetail = dynamic(() => import('./components/message-detail'), { ssr: false })
const OwnerPanel = dynamic(() => import('./components/owner-panel'), { ssr: false })
import { decryptOwnerEntries, type OwnerEntry } from './lib/decrypt'
import { derivePublicKeyPem } from './lib/crypto'
import type { Message } from './types'
import { useAuthStore } from '@/hooks/use-auth'
import { commitFiles, fileTreeItem } from '@/lib/github-commit'
import { GITHUB_CONFIG } from '@/consts'

const CONFIG_PATH = 'public/message/config.json'

type Props = {
	initialMessages: Message[]
	initialOwnerPublicKey: string | null
}

export default function MessageClient({ initialMessages, initialOwnerPublicKey }: Props) {
	const [messages, setMessages] = useState<Message[]>(initialMessages)
	const [ownerEntries, setOwnerEntries] = useState<OwnerEntry[]>([])
	const [ownerPublicKey, setOwnerPublicKey] = useState<string | null>(initialOwnerPublicKey)
	const [composeOpen, setComposeOpen] = useState(false)
	const [panelOpen, setPanelOpen] = useState(false)
	const [openItem, setOpenItem] = useState<WallItem | null>(null)
	const [publishing, setPublishing] = useState(false)

	const keyInputRef = useRef<HTMLInputElement>(null)
	const pendingRef = useRef<(() => void) | null>(null)
	const { isAuth, privateKey, setPrivateKey } = useAuthStore()

	// 导入私钥后解密「仅站主」留言和代发邮箱
	useEffect(() => {
		let cancelled = false

		if (!isAuth || !privateKey) {
			setOwnerEntries([])
			return
		}

		void (async () => {
			const { entries, failed } = await decryptOwnerEntries(messages, privateKey)
			if (cancelled) return
			setOwnerEntries(entries)
			if (failed > 0) toast.error(`${failed} 条留言解密失败，可能不是同一把私钥`)
		})()

		return () => {
			cancelled = true
		}
	}, [messages, isAuth, privateKey])

	const publicItems = useMemo<WallItem[]>(
		() =>
			messages
				.filter(message => message.visibility === 'public')
				.map(message => ({
					id: message.id,
					createdAt: message.createdAt,
					anonymous: message.anonymous,
					author: message.author,
					content: message.content || '',
					ownerOnly: false,
					hasDeliver: Boolean(message.deliverCipher)
				})),
		[messages]
	)

	const ownerWallItems = useMemo<WallItem[]>(
		() =>
			ownerEntries
				.filter(entry => entry.ownerOnly)
				.map(entry => ({
					id: entry.id,
					createdAt: entry.createdAt,
					anonymous: entry.anonymous,
					author: entry.author,
					content: entry.content,
					ownerOnly: true,
					hasDeliver: Boolean(entry.deliverEmail),
					deliverEmail: entry.deliverEmail
				})),
		[ownerEntries]
	)

	const wallItems = useMemo(() => [...publicItems, ...ownerWallItems], [publicItems, ownerWallItems])

	/** 没导入私钥时，需要私钥的动作先弹文件选择 */
	const requireAuth = (action: () => void) => {
		if (isAuth) {
			action()
			return
		}
		pendingRef.current = action
		keyInputRef.current?.click()
	}

	const handleKeyFile = async (file: File) => {
		try {
			const text = await file.text()
			if (!/BEGIN [A-Z ]*PRIVATE KEY/.test(text)) {
				toast.error('这不是有效的 .pem 私钥文件')
				return
			}
			await setPrivateKey(text)
			toast.success('私钥已导入，2 小时内有效')
			const action = pendingRef.current
			pendingRef.current = null
			action?.()
		} catch (error) {
			console.error('Failed to read private key:', error)
			toast.error('读取密钥文件失败')
		}
	}

	const publishPublicKey = () => {
		requireAuth(async () => {
			const key = useAuthStore.getState().privateKey
			if (!key) return

			setPublishing(true)
			try {
				const pem = await derivePublicKeyPem(key)

				if (process.env.NODE_ENV !== 'production') {
					// 本地开发：直接写 public/message/config.json（断网也能用）
					const res = await fetch('/api/message/public-key', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ publicKey: pem })
					})
					const data = await res.json().catch(() => ({}))
					if (!res.ok || !data?.ok) throw new Error(data?.error || '写入本地公钥失败')
					toast.success('公钥已写入本地 public/message/config.json（提交后线上生效）')
				} else {
					// 线上：用浏览器里已导入的 App 私钥提交到 data 分支，不触发整站部署
					await commitFiles({
						message: '留言墙: 发布站主公钥',
						successMessage: '公钥已发布，代发和「仅站主」功能已开启',
						branch: GITHUB_CONFIG.DATA_BRANCH,
						prepare: async ctx => ({ treeItems: [fileTreeItem(CONFIG_PATH, await ctx.blobFromJson({ ownerPublicKey: pem }))] })
					})
				}

				setOwnerPublicKey(pem)
			} catch (error: any) {
				console.error('Failed to publish public key:', error)
				toast.error(`发布失败：${error?.message || '未知错误'}`)
			} finally {
				setPublishing(false)
			}
		})
	}

	const openCompose = () => setComposeOpen(true)

	return (
		<div className='relative h-[100svh] w-full overflow-hidden'>
			{/* 顶部标题 */}
			<div className='pointer-events-none absolute inset-x-0 top-[5.5rem] z-40 flex justify-center px-4 sm:top-6'>
				<div className='pointer-events-auto flex items-center gap-3 rounded-2xl border bg-card/85 px-5 py-2.5 shadow-[0_18px_30px_-24px_rgba(70,45,30,0.45)] backdrop-blur-md'>
					<div className='flex flex-col'>
						<h1 className='text-[15px] leading-none font-semibold text-white'>留言墙</h1>
						<p className='text-secondary mt-1.5 text-[10px]'>{`共 ${wallItems.length} 条足迹 · 拖动可以重新摆放`}</p>
					</div>

					{isAuth && (
						<>
							<span className='h-7 w-px bg-white/15' />
							<button type='button' onClick={() => setPanelOpen(true)} className='flex items-center gap-1 text-[11px] text-white hover:opacity-70'>
								<Settings2 className='h-3.5 w-3.5' />
								站主面板
								{ownerEntries.length > 0 && (
									<span className='rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]'>{ownerEntries.length}</span>
								)}
							</button>
						</>
					)}
				</div>
			</div>

			{/* 墙 */}
			<div className='absolute inset-0 pt-20 pb-16 max-sm:pt-36'>
				<MessageWall items={wallItems} onOpen={setOpenItem} />
			</div>

			{/* 右下角操作 */}
			<div className='absolute right-6 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-end gap-2'>
				{isAuth && !ownerPublicKey && (
					<button
						type='button'
						onClick={publishPublicKey}
						disabled={publishing}
						className='flex items-center gap-1.5 rounded-xl border bg-white/12 px-3 py-2 text-[11px] text-white shadow backdrop-blur transition-colors hover:bg-white/20 disabled:opacity-60'>
						<KeyRound className='h-3.5 w-3.5' />
						{publishing ? '发布中…' : '发布站主公钥（开启代发/仅站主）'}
					</button>
				)}

				<button type='button' onClick={openCompose} className='brand-btn flex items-center gap-1.5 rounded-2xl px-5 py-3 text-sm shadow-[0_18px_30px_-18px_rgba(70,45,30,0.7)]'>
					<PenLine className='h-4 w-4' />
					写留言
				</button>
			</div>

			{composeOpen && (
				<ComposeDialog
					isOwner={isAuth}
					ownerPublicKey={ownerPublicKey}
					onClose={() => setComposeOpen(false)}
					onSubmitted={result => {
						const message = result.message
						if (!message) return
						setMessages(previous => (previous.some(item => item.id === message.id) ? previous : [message, ...previous]))
					}}
				/>
			)}

			{openItem && (
				<MessageDetail
					item={{
						...openItem,
						deliverEmail: ownerEntries.find(entry => entry.id === openItem.id)?.deliverEmail
					}}
					isOwner={isAuth}
					onClose={() => setOpenItem(null)}
				/>
			)}

			{panelOpen && <OwnerPanel entries={ownerEntries} onClose={() => setPanelOpen(false)} />}

			<input
				ref={keyInputRef}
				type='file'
				accept='.pem'
				className='hidden'
				onChange={async event => {
					const file = event.target.files?.[0]
					if (file) await handleKeyFile(file)
					if (event.currentTarget) event.currentTarget.value = ''
				}}
			/>
		</div>
	)
}
