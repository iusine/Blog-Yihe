import { createInstallationToken, getInstallationId, signAppJwt } from './github-client'
import { GITHUB_CONFIG } from '@/consts'
import { useAuthStore } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { decrypt, encrypt } from './aes256-util'

const GITHUB_TOKEN_CACHE_KEY = 'github_token'
const GITHUB_PEM_CACHE_KEY = 'p_info'
const GITHUB_PEM_EXP_KEY = 'p_info_exp'

/**
 * 私钥在本机缓存多久。
 *
 * 需求：导入一次之后，刷新页面不用再导入，本地保留 2 小时。
 * 私钥是加密后再存的（AES-GCM，口令来自 NEXT_PUBLIC_GITHUB_ENCRYPT_KEY），
 * 存 localStorage 而不是 sessionStorage，所以关掉标签页再打开也还在（2 小时内）。
 */
export const PEM_CACHE_TTL = 2 * 60 * 60 * 1000

function getTokenFromCache(): string | null {
	if (typeof sessionStorage === 'undefined') return null
	try {
		return sessionStorage.getItem(GITHUB_TOKEN_CACHE_KEY)
	} catch {
		return null
	}
}

function saveTokenToCache(token: string): void {
	if (typeof sessionStorage === 'undefined') return
	try {
		sessionStorage.setItem(GITHUB_TOKEN_CACHE_KEY, token)
	} catch (error) {
		console.error('Failed to save token to cache:', error)
	}
}

function clearTokenCache(): void {
	if (typeof sessionStorage === 'undefined') return
	try {
		sessionStorage.removeItem(GITHUB_TOKEN_CACHE_KEY)
	} catch (error) {
		console.error('Failed to clear token cache:', error)
	}
}

function pemExpired(): boolean {
	try {
		const expiry = Number(localStorage.getItem(GITHUB_PEM_EXP_KEY) || 0)
		return !expiry || expiry <= Date.now()
	} catch {
		return true
	}
}

function clearPemCache(): void {
	if (typeof localStorage === 'undefined') return
	try {
		localStorage.removeItem(GITHUB_PEM_CACHE_KEY)
		localStorage.removeItem(GITHUB_PEM_EXP_KEY)
	} catch (error) {
		console.error('Failed to clear pem cache:', error)
	}
}

export async function getPemFromCache(): Promise<string | null> {
	if (typeof localStorage === 'undefined') return null

	try {
		if (pemExpired()) {
			clearPemCache()
			return null
		}

		const encryptedPem = localStorage.getItem(GITHUB_PEM_CACHE_KEY)
		if (!encryptedPem) return null

		return await decrypt(encryptedPem, GITHUB_CONFIG.ENCRYPT_KEY)
	} catch {
		// 口令换了或者数据损坏，当作没有缓存
		clearPemCache()
		return null
	}
}

export async function savePemToCache(pem: string): Promise<void> {
	if (typeof localStorage === 'undefined') return

	try {
		const encryptedPem = await encrypt(pem, GITHUB_CONFIG.ENCRYPT_KEY)
		localStorage.setItem(GITHUB_PEM_CACHE_KEY, encryptedPem)
		localStorage.setItem(GITHUB_PEM_EXP_KEY, String(Date.now() + PEM_CACHE_TTL))
	} catch (error) {
		console.error('Failed to save pem to cache:', error)
	}
}

/** 私钥缓存还剩多少毫秒（没有缓存或已过期返回 0） */
export function getPemCacheRemaining(): number {
	if (typeof localStorage === 'undefined') return 0
	try {
		const expiry = Number(localStorage.getItem(GITHUB_PEM_EXP_KEY) || 0)
		if (!expiry || expiry <= Date.now()) return 0
		return expiry - Date.now()
	} catch {
		return 0
	}
}

export function clearAllAuthCache(): void {
	clearTokenCache()
	clearPemCache()
}

export async function hasAuth(): Promise<boolean> {
	return !!getTokenFromCache() || !!(await getPemFromCache())
}

/**
 * 统一的认证 Token 获取
 * 自动处理缓存、签发等逻辑
 * @returns GitHub Installation Token
 */
export async function getAuthToken(): Promise<string> {
	// 1. 先尝试从缓存获取 token
	const cachedToken = getTokenFromCache()
	if (cachedToken) {
		toast.info('使用缓存的令牌...')
		return cachedToken
	}

	// 2. 获取私钥（内存 → 本地缓存）
	let privateKey = useAuthStore.getState().privateKey

	if (!privateKey) {
		privateKey = await getPemFromCache()
		if (privateKey) useAuthStore.setState({ privateKey, isAuth: true })
	}

	if (!privateKey) {
		throw new Error('需要先设置私钥。请先导入 GitHub App 的 .pem 私钥文件')
	}

	toast.info('正在签发 JWT...')
	const jwt = signAppJwt(GITHUB_CONFIG.APP_ID, privateKey)

	toast.info('正在获取安装信息...')
	const installationId = await getInstallationId(jwt, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO)

	toast.info('正在创建安装令牌...')
	const token = await createInstallationToken(jwt, installationId)

	saveTokenToCache(token)

	return token
}
