/* /api/music 的访问口令逻辑：生产环境私密、Cookie 校验与续期。 */
import { createHash, timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'

export const ACCESS_COOKIE = 'music_access'

/** 浏览器对 Cookie 的实际上限是 400 天（Chrome），每次请求会滑动续期 */
export const ACCESS_MAX_AGE = 400 * 24 * 60 * 60

export function hashToken(token: string) {
	return createHash('sha256').update(token).digest('hex')
}

export function accessCookieHeader(token: string) {
	const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
	return `${ACCESS_COOKIE}=${hashToken(token)}; Path=/api/music; HttpOnly; SameSite=Lax; Max-Age=${ACCESS_MAX_AGE}${secure}`
}

/** 生产环境默认私密；本地开发默认开放。MUSIC_PRIVATE=true/false 可强制覆盖 */
export function privateEnabled() {
	if (process.env.MUSIC_PRIVATE === 'false') return false
	if (process.env.MUSIC_PRIVATE === 'true') return true
	return process.env.NODE_ENV === 'production'
}

/** 返回已授权的口令；未授权返回 null */
export function authorizedToken(request: NextRequest) {
	const token = process.env.MUSIC_ACCESS_TOKEN?.trim()
	if (!token) return null
	const value = request.cookies.get(ACCESS_COOKIE)?.value
	return value && value === hashToken(token) ? token : null
}

export function safeEqual(left: string, right: string) {
	const a = Buffer.from(left)
	const b = Buffer.from(right)
	return a.length === b.length && timingSafeEqual(a, b)
}
