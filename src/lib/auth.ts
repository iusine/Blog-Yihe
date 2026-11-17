import { GITHUB_CONFIG } from '@/consts'
import { toast } from 'sonner'
import { decrypt, encrypt } from './aes256-util'
import { GITHUB_PEM_CACHE_KEY, GITHUB_PEM_EXP_KEY, GITHUB_TOKEN_CACHE_KEY, PEM_CACHE_TTL } from './auth-keys'
import { getPrivateKey, setPrivateKeyValue } from './private-key-store'

/**
 * 认证相关：私钥缓存（2 小时）、安装令牌缓存、签发令牌。
 *
 * ⚠️ 这个文件不要 import `hooks/use-auth` 或 `lib/github-client`：
 * 那两个模块会反过来依赖本文件，形成循环依赖。循环一旦成立，
 * `use-auth.ts` 在模块顶层恢复缓存时，本文件的 const 还没初始化，
 * 页面就会报 "Cannot access ... before initialization"。
 * 需要的签名函数放在 getAuthToken 里动态引入。
 */

/**
 * 私钥在本机缓存多久。
 *
 * 需求：导入一次之后，刷新页面不用再导入，本地保留 2 小时。
 * 私钥是加密后再存的（AES-GCM，口令来自 NEXT_PUBLIC_GITHUB_ENCRYPT_KEY），
 * 存 localStorage 而不是 sessionStorage，所以关掉标签页再打开也还在（2 小时内）。
 *
 * 具体数值和键名放在 lib/auth-keys.ts（无依赖模块），避免初始化顺序问题。
 */
export { PEM_CACHE_TTL }

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
		// 口令换了或者数据损坏，当作没有缓存（这里不再抛错，避免影响页面初始化）
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
	setPrivateKeyValue(null)
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
	let privateKey = getPrivateKey()

	if (!privateKey) {
		privateKey = await getPemFromCache()
		if (privateKey) setPrivateKeyValue(privateKey)
	}

	if (!privateKey) {
		throw new Error('需要先设置私钥。请先导入 GitHub App 的 .pem 私钥文件')
	}

	// 3. 动态引入签名相关代码：避免和 github-client → use-auth 形成循环依赖
	const { signAppJwt, getInstallationId, createInstallationToken } = await import('./github-client')

	toast.info('正在签发 JWT...')
	const jwt = signAppJwt(GITHUB_CONFIG.APP_ID, privateKey)

	toast.info('正在获取安装信息...')
	const installationId = await getInstallationId(jwt, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO)

	toast.info('正在创建安装令牌...')
	const token = await createInstallationToken(jwt, installationId)

	saveTokenToCache(token)

	return token
}
