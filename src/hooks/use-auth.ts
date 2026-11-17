import { create } from 'zustand'
import { clearAllAuthCache, getAuthToken as getToken, hasAuth as checkAuth, getPemFromCache, savePemToCache } from '@/lib/auth'
import { getPrivateKey, setPrivateKeyValue } from '@/lib/private-key-store'

interface AuthStore {
	// State
	isAuth: boolean
	privateKey: string | null

	// Actions
	setPrivateKey: (key: string) => void
	clearAuth: () => void
	refreshAuthState: () => void
	getAuthToken: () => Promise<string>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
	isAuth: false,
	privateKey: null,

	/**
	 * 导入私钥。
	 * 每次导入都会加密后写进 localStorage，2 小时内刷新页面/重开标签页都不用再导入。
	 */
	setPrivateKey: async (key: string) => {
		setPrivateKeyValue(key)
		set({ isAuth: true, privateKey: key })
		await savePemToCache(key)
	},

	clearAuth: () => {
		clearAllAuthCache()
		setPrivateKeyValue(null)
		set({ isAuth: false, privateKey: null })
	},

	refreshAuthState: async () => {
		set({ isAuth: await checkAuth() })
	},

	getAuthToken: async () => {
		const token = await getToken()
		get().refreshAuthState()
		return token
	}
}))

/**
 * 刷新页面时把本地缓存的私钥恢复出来（2 小时内有效）。
 *
 * 这段放在 use-auth 自己的模块里是安全的：`lib/auth` 不反向依赖本文件，
 * 所以执行到这里时它的常量都已初始化。
 * 任何异常都忽略，页面照常显示（只是需要重新导入私钥）。
 */
export async function restoreAuthFromCache(): Promise<void> {
	try {
		const key = await getPemFromCache()
		if (key) {
			setPrivateKeyValue(key)
			useAuthStore.setState({ privateKey: key, isAuth: true })
			return
		}

		const isAuth = await checkAuth()
		if (isAuth) useAuthStore.setState({ isAuth })
	} catch (error) {
		console.warn('恢复私钥缓存失败，需要重新导入:', error)
	}
}

// 只在浏览器执行；模块加载即尝试恢复，避免首屏按钮闪一下
if (typeof window !== 'undefined') {
	void restoreAuthFromCache()
}
