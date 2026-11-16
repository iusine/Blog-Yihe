'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { useAuthStore } from '@/hooks/use-auth'

/**
 * 写作前的强制私钥导入。
 *
 * 原来首页有一个「配置」弹窗，可以在里面导入私钥；按需求把配置功能去掉后，
 * 私钥入口统一挪到写作这一侧：进 /write 之前必须导入 GitHub App 的 .pem，否则不给进编辑器。
 * 私钥只留在浏览器内存（可选的会话缓存由 lib/auth.ts 处理），不会上传到任何服务器。
 */
export function WriteAuthGate() {
	const { setPrivateKey } = useAuthStore()
	const inputRef = useRef<HTMLInputElement>(null)
	const [loading, setLoading] = useState(false)

	const handleFile = async (file: File) => {
		try {
			const text = await file.text()

			// 简单校验，避免选错文件后到发布那一步才报错
			if (!/BEGIN [A-Z ]*PRIVATE KEY/.test(text)) {
				toast.error('这不是有效的 .pem 私钥文件')
				return
			}

			setLoading(true)
			await setPrivateKey(text)
			toast.success('私钥已导入，可以开始写作了')
		} catch (error) {
			console.error('Failed to read private key:', error)
			toast.error('读取密钥文件失败')
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className='flex min-h-[100svh] items-center justify-center px-6 pt-24 pb-12'>
			<motion.div
				initial={{ opacity: 0, scale: 0.95 }}
				animate={{ opacity: 1, scale: 1 }}
				className='w-full max-w-[460px] rounded-[32px] border bg-card p-8 text-center shadow-[0_30px_60px_-40px_rgba(0,0,0,0.35)]'>
				<div className='text-4xl'>🔑</div>

				<h1 className='mt-4 text-xl font-semibold'>写文章需要先导入私钥</h1>

				<p className='text-secondary mt-3 text-sm leading-relaxed'>
					编辑与发布都会把改动提交到 GitHub 仓库，所以需要 GitHub App 的私钥（<code className='rounded bg-black/5 px-1'>.pem</code>）。
					<br />
					私钥只保存在当前浏览器里，不会上传到任何服务器。
				</p>

				<button type='button' onClick={() => inputRef.current?.click()} disabled={loading} className='brand-btn mx-auto mt-6 justify-center disabled:opacity-60'>
					{loading ? '导入中…' : '选择 .pem 私钥文件'}
				</button>

				<Link href='/' className='text-secondary hover:text-brand mt-5 block text-xs transition-colors'>
					← 先回首页
				</Link>

				<input
					ref={inputRef}
					type='file'
					accept='.pem'
					className='hidden'
					onChange={async event => {
						const file = event.target.files?.[0]
						if (file) await handleFile(file)
						if (event.currentTarget) event.currentTarget.value = ''
					}}
				/>
			</motion.div>
		</div>
	)
}
