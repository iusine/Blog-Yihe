/* 站主授权入口：访问 /api/music/auth?token=<MUSIC_ACCESS_TOKEN>，
 * 校验通过后种一个 HttpOnly Cookie，之后当前浏览器才能使用 /api/music 的 VIP 音源。 */
import type { NextRequest } from 'next/server'
import { accessCookieHeader, safeEqual } from '../access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
	const token = process.env.MUSIC_ACCESS_TOKEN?.trim()
	if (!token) return new Response('服务器未配置 MUSIC_ACCESS_TOKEN', { status: 503 })

	const provided = request.nextUrl.searchParams.get('token') ?? ''
	if (!provided || !safeEqual(provided, token)) return new Response('访问口令不正确', { status: 401 })

	const nextParam = request.nextUrl.searchParams.get('next') ?? '/music'
	const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/music'

	return new Response(null, {
		status: 302,
		headers: {
			Location: new URL(next, request.url).toString(),
			'Set-Cookie': accessCookieHeader(token),
			'Cache-Control': 'no-store'
		}
	})
}
