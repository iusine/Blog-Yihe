import { readFile } from 'node:fs/promises'
import path from 'node:path'
import messageFallback from '../../public/message/list.json'
import configFallback from '../../public/message/config.json'
import essayFallback from '../../public/essays/index.json'
import type { Message } from '@/app/message/types'
import { NOTE_STYLES, type EssayNote, type NoteStyle } from '@/app/essay/types'
import { DATA_BRANCH, readRepoJson } from './github-server'

/**
 * 留言 / 随笔 / 站主公钥的运行时读取。
 *
 * - 开发环境：读本地 public 下的文件，写完立刻能看到；
 * - 生产环境：读 GitHub 的 `data` 分支，新增留言不会触发 main 的重新部署。
 */

const MESSAGE_PATH = 'public/message/list.json'
const CONFIG_PATH = 'public/message/config.json'
const ESSAY_PATH = 'public/essays/index.json'

const isRecord = (value: unknown): value is Record<string, unknown> =>
	Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.slice(0, max) : '')

function normalizeMessages(input: unknown): Message[] {
	if (!Array.isArray(input)) return []

	const list: Message[] = []
	for (const item of input) {
		if (!isRecord(item) || typeof item.id !== 'string' || !item.id) continue
		if (item.visibility !== 'public' && item.visibility !== 'owner') continue

		const message: Message = {
			id: item.id,
			createdAt: text(item.createdAt, 40),
			visibility: item.visibility,
			anonymous: Boolean(item.anonymous)
		}

		if (typeof item.author === 'string') message.author = item.author.slice(0, 40)
		if (typeof item.content === 'string') message.content = item.content.slice(0, 4000)
		if (typeof item.cipher === 'string') message.cipher = item.cipher
		if (typeof item.deliverCipher === 'string') message.deliverCipher = item.deliverCipher
		if (typeof item.sent === 'boolean') message.sent = item.sent

		// 缺正文的公开留言 / 缺密文的仅站主留言都无法展示，直接跳过
		if (message.visibility === 'public' && !message.content) continue
		if (message.visibility === 'owner' && !message.cipher) continue

		list.push(message)
	}

	return list
}

function normalizeEssays(input: unknown): EssayNote[] {
	if (!Array.isArray(input)) return []

	const notes: EssayNote[] = []
	for (const item of input) {
		if (!isRecord(item) || typeof item.id !== 'string' || !item.id) continue

		const content = text(item.content, 4000)
		if (!content.trim()) continue

		const style =
			typeof item.style === 'string' && (NOTE_STYLES as string[]).includes(item.style) ? (item.style as NoteStyle) : 'sunny'
		const stars =
			typeof item.stars === 'number' && Number.isFinite(item.stars) ? Math.max(0, Math.min(5, Math.round(item.stars))) : 0

		notes.push({
			id: item.id,
			title: text(item.title, 120),
			content,
			style,
			createdAt: text(item.createdAt, 40),
			stars
		})
	}

	return notes
}

function normalizeOwnerPublicKey(input: unknown): string | null {
	if (!isRecord(input)) return null
	const value = input.ownerPublicKey
	return typeof value === 'string' && value.includes('BEGIN PUBLIC KEY') ? value : null
}

async function readLocalJson(file: string): Promise<unknown> {
	const raw = await readFile(path.join(process.cwd(), file), 'utf8')
	return JSON.parse(raw)
}

export async function readMessages(): Promise<Message[]> {
	if (process.env.NODE_ENV !== 'production') {
		try {
			return normalizeMessages(await readLocalJson(MESSAGE_PATH))
		} catch (error) {
			console.error('读取本地留言失败，使用内置快照:', error)
			return normalizeMessages(messageFallback)
		}
	}

	try {
		const { data } = await readRepoJson<unknown>(MESSAGE_PATH, DATA_BRANCH)
		if (Array.isArray(data)) return normalizeMessages(data)
		console.warn('data 分支缺少留言文件，使用内置快照')
	} catch (error) {
		console.error('读取 data 分支留言失败，使用内置快照:', error)
	}
	return normalizeMessages(messageFallback)
}

export type EssaysResult = {
	notes: EssayNote[]
	/** 远程数据读取成功（或文件尚不存在）时为 true；失败时前端不要用本地便签覆盖 */
	ok: boolean
}

export async function readEssays(): Promise<EssaysResult> {
	if (process.env.NODE_ENV !== 'production') {
		try {
			return { notes: normalizeEssays(await readLocalJson(ESSAY_PATH)), ok: true }
		} catch (error) {
			console.error('读取本地随笔失败，使用内置快照:', error)
			return { notes: normalizeEssays(essayFallback), ok: false }
		}
	}

	try {
		const { data } = await readRepoJson<unknown>(ESSAY_PATH, DATA_BRANCH)
		if (data === null) return { notes: [], ok: true }
		if (!Array.isArray(data)) throw new Error('随笔数据格式不正确')
		return { notes: normalizeEssays(data), ok: true }
	} catch (error) {
		console.error('读取 data 分支随笔失败，使用内置快照:', error)
		return { notes: normalizeEssays(essayFallback), ok: false }
	}
}

export async function readOwnerPublicKey(): Promise<string | null> {
	if (process.env.NODE_ENV !== 'production') {
		try {
			return normalizeOwnerPublicKey(await readLocalJson(CONFIG_PATH))
		} catch {
			return normalizeOwnerPublicKey(configFallback)
		}
	}

	try {
		const { data } = await readRepoJson<unknown>(CONFIG_PATH, DATA_BRANCH)
		if (data !== null) return normalizeOwnerPublicKey(data)
	} catch (error) {
		console.error('读取 data 分支公钥失败，使用内置快照:', error)
	}
	return normalizeOwnerPublicKey(configFallback)
}
