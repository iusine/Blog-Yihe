'use client'

import { decryptFromOwner } from './crypto'
import type { Message } from '../types'

/** 站主视角的一条留言（已解密） */
export type OwnerEntry = {
	id: string
	createdAt: string
	anonymous: boolean
	author?: string
	content: string
	ownerOnly: boolean
	deliverEmail?: string
}

/**
 * 用私钥把「仅站主」留言和代发邮箱解出来。
 * 访客没有私钥，这些内容在浏览器里根本解不开，所以即使拿到 list.json 也看不到。
 */
export async function decryptOwnerEntries(list: Message[], privateKey: string): Promise<{ entries: OwnerEntry[]; failed: number }> {
	const entries: OwnerEntry[] = []
	let failed = 0

	for (const message of list) {
		try {
			if (message.visibility === 'owner') {
				if (!message.cipher) continue
				const parsed = JSON.parse(await decryptFromOwner(message.cipher, privateKey)) as { author?: string; content?: string; deliverEmail?: string }
				let deliverEmail = parsed.deliverEmail || undefined

				if (!deliverEmail && message.deliverCipher) {
					deliverEmail = await decryptFromOwner(message.deliverCipher, privateKey)
				}

				entries.push({
					id: message.id,
					createdAt: message.createdAt,
					anonymous: !parsed.author,
					author: parsed.author || undefined,
					content: parsed.content || '',
					ownerOnly: true,
					deliverEmail
				})
				continue
			}

			// 公开留言：内容本来就能看，代发邮箱需要解密
			let deliverEmail: string | undefined
			if (message.deliverCipher) {
				deliverEmail = await decryptFromOwner(message.deliverCipher, privateKey)
			}

			entries.push({
				id: message.id,
				createdAt: message.createdAt,
				anonymous: message.anonymous,
				author: message.author,
				content: message.content || '',
				ownerOnly: false,
				deliverEmail
			})
		} catch (error) {
			console.warn('留言解密失败:', message.id, error)
			failed += 1
		}
	}

	return { entries, failed }
}
