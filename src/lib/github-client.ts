'use client'

import { useAuthStore } from '@/hooks/use-auth'
import { toast } from 'sonner'

export const GH_API = 'https://api.github.com'

const GH_HEADERS: Record<string, string> = {
	Accept: 'application/vnd.github+json',
	'X-GitHub-Api-Version': '2022-11-28'
}

export class GitHubApiError extends Error {
	status: number

	constructor(action: string, status: number, detail: string, hint?: string) {
		super(`${action} failed: ${status}${detail ? ` - ${detail}` : ''}${hint ? `（${hint}）` : ''}`)
		this.name = 'GitHubApiError'
		this.status = status
	}
}

function handle401Error(): void {
	if (typeof sessionStorage === 'undefined') return
	try {
		useAuthStore.getState().clearAuth()
	} catch (error) {
		console.error('Failed to clear auth cache:', error)
	}
}

function handle422Error(): void {
	toast.error('操作太快了，请操作慢一点')
}

export function toBase64Utf8(input: string): string {
	return btoa(unescape(encodeURIComponent(input)))
}

/**
 * GitHub 的 REST 路由不会解码路径里的 %2F：仓库路径必须保留 `/` 字面量，
 * 只对每一段单独编码。否则 `public/blogs/index.json` 会变成
 * `public%2Fblogs%2Findex.json`，接口直接返回 404。
 */
export function encodeRepoPath(path: string): string {
	return path
		.split('/')
		.map(segment => encodeURIComponent(segment))
		.join('/')
}

/**
 * git ref 形如 `heads/main`、`tags/v1.0`，同样不能把 `/` 编成 `%2F`，
 * 否则 `/git/ref/heads%2Fmain` 会 404——这就是发布文章时报
 * `get ref failed: 404` 的直接原因。
 */
export function encodeRef(ref: string): string {
	return ref
		.split('/')
		.map(segment => encodeURIComponent(segment))
		.join('/')
}

async function ghRequest(token: string, path: string, init: RequestInit = {}): Promise<Response> {
	const res = await fetch(`${GH_API}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${token}`,
			...GH_HEADERS,
			...(init.body ? { 'Content-Type': 'application/json' } : {}),
			...(init.headers as Record<string, string> | undefined)
		}
	})
	if (res.status === 401) handle401Error()
	if (res.status === 422) handle422Error()
	return res
}

async function ghFail(action: string, res: Response, hint?: string): Promise<never> {
	let detail = ''
	try {
		const data = await res.json()
		if (typeof data?.message === 'string') detail = data.message
	} catch {
		// 非 JSON 响应（例如网关错误页）就只报状态码
	}
	throw new GitHubApiError(action, res.status, detail, hint)
}

export async function signAppJwt(appId: string, privateKeyPem: string): Promise<string> {
	// jsrsasign 体积很大，只有站主签发令牌时才用得到；按需加载避免拖慢访客首屏
	const { KJUR, KEYUTIL } = await import('jsrsasign')
	const now = Math.floor(Date.now() / 1000)
	const header = { alg: 'RS256', typ: 'JWT' }
	const payload = { iat: now - 60, exp: now + 8 * 60, iss: appId }
	const prv = KEYUTIL.getKey(privateKeyPem) as unknown as string
	return KJUR.jws.JWS.sign('RS256', JSON.stringify(header), JSON.stringify(payload), prv)
}

export async function getInstallationId(jwt: string, owner: string, repo: string): Promise<number> {
	const res = await fetch(`${GH_API}/repos/${owner}/${repo}/installation`, {
		headers: {
			Authorization: `Bearer ${jwt}`,
			...GH_HEADERS
		}
	})
	if (res.status === 401) handle401Error()
	if (res.status === 422) handle422Error()
	if (!res.ok) await ghFail('installation lookup', res, '请确认 GitHub App 已安装到该仓库')
	const data = await res.json()
	return data.id
}

export async function createInstallationToken(jwt: string, installationId: number): Promise<string> {
	const res = await fetch(`${GH_API}/app/installations/${installationId}/access_tokens`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${jwt}`,
			...GH_HEADERS
		}
	})
	if (res.status === 401) handle401Error()
	if (res.status === 422) handle422Error()
	if (!res.ok) await ghFail('create token', res)
	const data = await res.json()
	return data.token as string
}

export type RepoInfo = {
	defaultBranch: string
	/** 仓库体积（KB），空仓库为 0 */
	size: number
}

/** 读取仓库元信息，用来区分「空仓库」和「分支名写错 / App 没权限」。 */
export async function getRepoInfo(token: string, owner: string, repo: string): Promise<RepoInfo> {
	const res = await ghRequest(token, `/repos/${owner}/${repo}`)
	if (!res.ok) await ghFail('get repo', res, res.status === 404 ? '仓库不存在，或 GitHub App 没有安装到这个仓库' : undefined)
	const data = await res.json()
	return { defaultBranch: String(data.default_branch || 'main'), size: Number(data.size ?? 0) }
}

export async function getFileSha(token: string, owner: string, repo: string, path: string, branch: string): Promise<string | undefined> {
	const res = await ghRequest(token, `/repos/${owner}/${repo}/contents/${encodeRepoPath(path)}?ref=${encodeURIComponent(branch)}`)
	if (res.status === 404) return undefined
	if (!res.ok) await ghFail('get file sha', res)
	const data = await res.json()
	return (data && data.sha) || undefined
}

export async function putFile(token: string, owner: string, repo: string, path: string, contentBase64: string, message: string, branch: string) {
	const sha = await getFileSha(token, owner, repo, path, branch)
	const res = await ghRequest(token, `/repos/${owner}/${repo}/contents/${encodeRepoPath(path)}`, {
		method: 'PUT',
		body: JSON.stringify({ message, content: contentBase64, branch, ...(sha ? { sha } : {}) })
	})
	if (!res.ok) await ghFail('put file', res)
	return res.json()
}

// Batch commit APIs

export async function getRef(token: string, owner: string, repo: string, ref: string): Promise<{ sha: string }> {
	const res = await ghRequest(token, `/repos/${owner}/${repo}/git/ref/${encodeRef(ref)}`)
	if (!res.ok) {
		await ghFail(
			'get ref',
			res,
			res.status === 404 ? `找不到 ${ref}：分支不存在，或 GitHub App 没有该仓库的 Contents 权限` : undefined
		)
	}
	const data = await res.json()
	return { sha: data.object.sha }
}

export async function createRef(token: string, owner: string, repo: string, ref: string, sha: string): Promise<void> {
	const res = await ghRequest(token, `/repos/${owner}/${repo}/git/refs`, {
		method: 'POST',
		body: JSON.stringify({ ref, sha })
	})
	if (!res.ok) await ghFail('create ref', res)
}

export type TreeItem = {
	path: string
	mode: '100644' | '100755' | '040000' | '160000' | '120000'
	type: 'blob' | 'tree' | 'commit'
	content?: string
	sha?: string | null
}

export async function createTree(token: string, owner: string, repo: string, tree: TreeItem[], baseTree?: string): Promise<{ sha: string }> {
	const res = await ghRequest(token, `/repos/${owner}/${repo}/git/trees`, {
		method: 'POST',
		body: JSON.stringify({ tree, base_tree: baseTree })
	})
	if (!res.ok) await ghFail('create tree', res)
	const data = await res.json()
	return { sha: data.sha }
}

export async function createCommit(token: string, owner: string, repo: string, message: string, tree: string, parents: string[]): Promise<{ sha: string }> {
	const res = await ghRequest(token, `/repos/${owner}/${repo}/git/commits`, {
		method: 'POST',
		body: JSON.stringify({ message, tree, parents })
	})
	if (!res.ok) await ghFail('create commit', res)
	const data = await res.json()
	return { sha: data.sha }
}

export async function updateRef(token: string, owner: string, repo: string, ref: string, sha: string, force = false): Promise<void> {
	const res = await ghRequest(token, `/repos/${owner}/${repo}/git/refs/${encodeRef(ref)}`, {
		method: 'PATCH',
		body: JSON.stringify({ sha, force })
	})
	if (!res.ok) await ghFail('update ref', res, res.status === 422 ? '远端分支已被其他提交更新，请重试' : undefined)
}

export async function readTextFileFromRepo(token: string, owner: string, repo: string, path: string, ref: string): Promise<string | null> {
	const res = await ghRequest(token, `/repos/${owner}/${repo}/contents/${encodeRepoPath(path)}?ref=${encodeURIComponent(ref)}`)
	if (res.status === 404) return null
	if (!res.ok) await ghFail('read file', res)
	const data: any = await res.json()
	if (Array.isArray(data) || !data.content) return null
	try {
		return decodeURIComponent(escape(atob(data.content)))
	} catch {
		return atob(data.content)
	}
}

export async function listRepoFilesRecursive(token: string, owner: string, repo: string, path: string, ref: string): Promise<string[]> {
	async function fetchPath(targetPath: string): Promise<string[]> {
		const res = await ghRequest(token, `/repos/${owner}/${repo}/contents/${encodeRepoPath(targetPath)}?ref=${encodeURIComponent(ref)}`)
		if (res.status === 404) return []
		if (!res.ok) await ghFail('read directory', res)
		const data: any = await res.json()
		if (Array.isArray(data)) {
			const files: string[] = []
			for (const item of data) {
				if (item.type === 'file') {
					files.push(item.path)
				} else if (item.type === 'dir') {
					const nested = await fetchPath(item.path)
					files.push(...nested)
				}
			}
			return files
		}
		if (data?.type === 'file') return [data.path]
		if (data?.type === 'dir') return fetchPath(data.path)
		return []
	}

	return fetchPath(path)
}

export async function createBlob(
	token: string,
	owner: string,
	repo: string,
	content: string,
	encoding: 'utf-8' | 'base64' = 'base64'
): Promise<{ sha: string }> {
	const res = await ghRequest(token, `/repos/${owner}/${repo}/git/blobs`, {
		method: 'POST',
		body: JSON.stringify({ content, encoding })
	})
	if (!res.ok) await ghFail('create blob', res)
	const data = await res.json()
	return { sha: data.sha }
}
