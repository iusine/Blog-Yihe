import { create } from 'zustand'
import { clearAllAuthCache, getAuthToken as getToken, hasAuth as checkAuth, getPemFromCache, savePemToCache } from '@/lib/auth'
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
		set({ isAuth: true, privateKey: key })
		await savePemToCache(key)
	},

	clearAuth: () => {
		clearAllAuthCache()
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

// 刷新页面时先把本地缓存的私钥恢复出来（2 小时内有效）
getPemFromCache().then(key => {
	if (key) {
		useAuthStore.setState({ privateKey: key, isAuth: true })
		return
	}

	checkAuth().then(isAuth => {
		if (isAuth) useAuthStore.setState({ isAuth })
	})
})
