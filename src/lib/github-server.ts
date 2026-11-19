import { KJUR, KEYUTIL } from 'jsrsasign'

/**
 * 服务端 GitHub 访问（GitHub App 安装令牌）。
 *
 * 留言、随笔这类会频繁变化的数据放在独立的 `data` 分支：
 * 运行时直接读它，写入也只改这个分支，不会触发 main 的生产部署。
 */

const OWNER = process.env.GITHUB_OWNER || process.env.NEXT_PUBLIC_GITHUB_OWNER || 'iusine'
const REPO = process.env.GITHUB_REPO || process.env.NEXT_PUBLIC_GITHUB_REPO || 'Blog-Yihe'
const APP_ID = process.env.GITHUB_APP_ID || process.env.NEXT_PUBLIC_GITHUB_APP_ID || '5776856'

export const DATA_BRANCH = process.env.GITHUB_DATA_BRANCH || process.env.NEXT_PUBLIC_GITHUB_DATA_BRANCH || 'data'

const GH_HEADERS = {
	Accept: 'application/vnd.github+json',
	'X-GitHub-Api-Version': '2022-11-28'
}

function encodeRepoPath(path: string): string {
	return path
		.split('/')
		.map(segment => encodeURIComponent(segment))
		.join('/')
}

async function githubRequest(token: string, pathname: string, init: RequestInit = {}): Promise<unknown> {
	const res = await fetch(`https://api.github.com${pathname}`, {
		...init,
		headers: {
			Authorization: `Bearer ${token}`,
			...GH_HEADERS,
			...(init.body ? { 'Content-Type': 'application/json' } : {})
		},
		cache: 'no-store'
	})

	if (!res.ok) {
		const detail = await res.text()
		throw Object.assign(new Error(`GitHub ${res.status}: ${detail.slice(0, 200)}`), { status: res.status })
	}

	return res.json()
}

type TokenCache = { token: string; expiresAt: number }
let tokenCache: TokenCache | null = null

/** 用 GitHub App 私钥换 installation token，并在进程内缓存到快过期 */
export async function getInstallationToken(): Promise<string> {
	if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token

	const privateKey = process.env.GITHUB_APP_PRIVATE_KEY
	if (!privateKey) {
		throw Object.assign(new Error('服务端还没配置 GITHUB_APP_PRIVATE_KEY'), { code: 'NOT_CONFIGURED' })
	}

	const now = Math.floor(Date.now() / 1000)
	const jwt = KJUR.jws.JWS.sign(
		'RS256',
		JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
		JSON.stringify({ iat: now - 60, exp: now + 8 * 60, iss: APP_ID }),
		KEYUTIL.getKey(privateKey) as any
	)

	const installation = (await githubRequest(jwt, `/repos/${OWNER}/${REPO}/installation`)) as { id: number }
	const token = (await githubRequest(jwt, `/app/installations/${installation.id}/access_tokens`, { method: 'POST' })) as {
		token: string
	}

	tokenCache = { token: token.token, expiresAt: Date.now() + 50 * 60_000 }
	return token.token
}

export type RepoFile<T> = {
	data: T | null
	sha?: string
}

/** 读取分支上的 JSON 文件；文件不存在时返回 data: null */
export async function readRepoJson<T>(path: string, branch = DATA_BRANCH): Promise<RepoFile<T>> {
	const token = await getInstallationToken()

	try {
		const file = (await githubRequest(
			token,
			`/repos/${OWNER}/${REPO}/contents/${encodeRepoPath(path)}?ref=${encodeURIComponent(branch)}`
		)) as { content?: string; sha?: string }

		const text = Buffer.from(file.content || '', 'base64').toString('utf8')
		return { data: JSON.parse(text) as T, sha: file.sha }
	} catch (error) {
		if ((error as { status?: number }).status === 404) return { data: null }
		throw error
	}
}

/** 写入分支上的 JSON 文件；新增文件不传 sha，覆盖已有文件必须传 sha */
export async function writeRepoJson(
	path: string,
	data: unknown,
	options: { message: string; branch?: string; sha?: string }
): Promise<void> {
	const token = await getInstallationToken()
	const content = Buffer.from(`${JSON.stringify(data, null, '\t')}\n`, 'utf8').toString('base64')

	await githubRequest(token, `/repos/${OWNER}/${REPO}/contents/${encodeRepoPath(path)}`, {
		method: 'PUT',
		body: JSON.stringify({
			message: options.message,
			content,
			branch: options.branch ?? DATA_BRANCH,
			...(options.sha ? { sha: options.sha } : {})
		})
	})
}
