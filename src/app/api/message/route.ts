import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { KJUR, KEYUTIL } from 'jsrsasign'

/**
 * 接收留言。
 *
 * 访客没有 GitHub 凭据，所以留言由服务端落库：
 * - 开发环境：直接写 public/message/list.json（本地立刻能看到效果，也方便测试）；
 * - 生产环境：用环境变量里的 GitHub App 私钥提交到仓库。需要的环境变量：
 *   GITHUB_APP_PRIVATE_KEY（.pem 内容）、GITHUB_APP_ID（可选）、GITHUB_OWNER / GITHUB_REPO / GITHUB_BRANCH（可选）。
 *   没配置时返回 501，前端会提示「直接发邮件给 yh_film@163.com」。
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LIST_PATH = 'public/message/list.json'
const OWNER = process.env.GITHUB_OWNER || process.env.NEXT_PUBLIC_GITHUB_OWNER || 'iusine'
const REPO = process.env.GITHUB_REPO || process.env.NEXT_PUBLIC_GITHUB_REPO || 'Blog-Yihe'
const BRANCH = process.env.GITHUB_BRANCH || process.env.NEXT_PUBLIC_GITHUB_BRANCH || 'main'
const APP_ID = process.env.GITHUB_APP_ID || process.env.NEXT_PUBLIC_GITHUB_APP_ID || '5776856'

type Incoming = {
	author?: string
	content?: string
	anonymous?: boolean
	visibility?: 'public' | 'owner'
	cipher?: string
	deliverCipher?: string
}

type StoredMessage = {
	id: string
	createdAt: string
	visibility: 'public' | 'owner'
	anonymous: boolean
	author?: string
	content?: string
	cipher?: string
	deliverCipher?: string
	sent?: boolean
}

function createId(): string {
	return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function fail(message: string, status = 400, code?: string) {
	return Response.json({ ok: false, error: message, code }, { status })
}

function cleanText(value: unknown, max: number): string {
	return String(value ?? '')
		.replace(/\r\n/g, '\n')
		.trim()
		.slice(0, max)
}

async function readLocalList(): Promise<StoredMessage[]> {
	try {
		const raw = await readFile(path.join(process.cwd(), LIST_PATH), 'utf8')
		const data = JSON.parse(raw)
		return Array.isArray(data) ? data : []
	} catch {
		return []
	}
}

async function writeLocalList(list: StoredMessage[]) {
	await writeFile(path.join(process.cwd(), LIST_PATH), `${JSON.stringify(list, null, '\t')}\n`, 'utf8')
}

async function githubRequest(token: string, pathname: string, init: RequestInit = {}) {
	const res = await fetch(`https://api.github.com${pathname}`, {
		...init,
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			...(init.body ? { 'Content-Type': 'application/json' } : {})
		},
		cache: 'no-store'
	})
	if (!res.ok) {
		const detail = await res.text()
		throw new Error(`GitHub ${res.status}: ${detail.slice(0, 200)}`)
	}
	return res.json()
}

/** 用 GitHub App 私钥换一个 installation token */
async function getInstallationToken(): Promise<string> {
	const privateKey = process.env.GITHUB_APP_PRIVATE_KEY
	if (!privateKey) {
		throw Object.assign(new Error('留言服务还没配置：缺少 GITHUB_APP_PRIVATE_KEY 环境变量'), { code: 'NOT_CONFIGURED' })
	}

	const now = Math.floor(Date.now() / 1000)
	const jwt = KJUR.jws.JWS.sign(
		'RS256',
		JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
		JSON.stringify({ iat: now - 60, exp: now + 8 * 60, iss: APP_ID }),
		KEYUTIL.getKey(privateKey) as any
	)

	const installation = (await githubRequest(jwt, `/repos/${OWNER}/${REPO}/installation`)) as { id: number }
	const token = (await githubRequest(jwt, `/app/installations/${installation.id}/access_tokens`, { method: 'POST' })) as { token: string }
	return token.token
}

type RemoteFile = { list: StoredMessage[]; sha?: string }

async function readRemoteList(token: string): Promise<RemoteFile> {
	try {
		const file = (await githubRequest(token, `/repos/${OWNER}/${REPO}/contents/${LIST_PATH}?ref=${encodeURIComponent(BRANCH)}`)) as {
			content?: string
			sha?: string
		}
		const text = Buffer.from(file.content || '', 'base64').toString('utf8')
		const parsed = JSON.parse(text)
		return { list: Array.isArray(parsed) ? parsed : [], sha: file.sha }
	} catch {
		return { list: [] }
	}
}

async function writeRemoteList(token: string, list: StoredMessage[], sha?: string) {
	const content = Buffer.from(`${JSON.stringify(list, null, '\t')}\n`, 'utf8').toString('base64')
	await githubRequest(token, `/repos/${OWNER}/${REPO}/contents/${LIST_PATH}`, {
		method: 'PUT',
		body: JSON.stringify({ message: '留言墙: 新增留言', content, branch: BRANCH, ...(sha ? { sha } : {}) })
	})
}

export async function POST(request: Request) {
	let body: Incoming
	try {
		body = (await request.json()) as Incoming
	} catch {
		return fail('请求格式不正确')
	}

	const visibility = body.visibility === 'owner' ? 'owner' : 'public'
	const anonymous = Boolean(body.anonymous)

	let cipher: string | undefined
	let author: string | undefined
	let content: string | undefined

	if (visibility === 'owner') {
		// 仅站主看见：内容已经在浏览器里用站主公钥加密过
		cipher = cleanText(body.cipher, 20000)
		if (!cipher.startsWith('v1.')) return fail('加密内容格式不正确')
	} else {
		author = anonymous ? '' : cleanText(body.author, 40)
		content = cleanText(body.content, 2000)

		if (!anonymous && !author) return fail('请填写留言者名字，或勾选匿名')
		if (!content) return fail('留言内容不能为空')
	}

	const deliverCipher = body.deliverCipher ? cleanText(body.deliverCipher, 20000) : undefined
	if (deliverCipher && !deliverCipher.startsWith('v1.')) return fail('邮箱加密内容格式不正确')

	const message: StoredMessage = {
		id: createId(),
		createdAt: new Date().toISOString(),
		visibility,
		anonymous,
		...((visibility === 'public' ? { author: author || undefined, content } : { cipher }) as Partial<StoredMessage>),
		...(deliverCipher ? { deliverCipher } : {}),
		...(visibility === 'public' ? { sent: false } : {})
	}

	try {
		if (process.env.NODE_ENV !== 'production') {
			const list = await readLocalList()
			list.unshift(message)
			await writeLocalList(list)
			return Response.json({ ok: true, message, mode: 'local' })
		}

		const token = await getInstallationToken()
		const remote = await readRemoteList(token)
		const next = [message, ...remote.list]
		await writeRemoteList(token, next, remote.sha)
		return Response.json({ ok: true, message, mode: 'github' })
	} catch (error: any) {
		console.error('Failed to save message:', error)
		if (error?.code === 'NOT_CONFIGURED') {
			return fail('留言服务还没配置好，可以直接发邮件给 yh_film@163.com', 501, 'NOT_CONFIGURED')
		}
		return fail(error?.message || '保存留言失败', 500)
	}
}
