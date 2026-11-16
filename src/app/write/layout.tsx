'use client'

import { useAuthStore } from '@/hooks/use-auth'
import { WriteAuthGate } from './components/auth-gate'

/**
 * /write 与 /write/[slug] 共用的守卫：
 * 没导入私钥时不渲染编辑器，直接给出导入入口（对应需求「点击写文章时强制导入私钥」）。
 */
export default function WriteLayout({ children }: { children: React.ReactNode }) {
	const { isAuth } = useAuthStore()

	if (!isAuth) return <WriteAuthGate />

	return <>{children}</>
}
