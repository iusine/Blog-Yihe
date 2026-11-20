/* 服务端网易云代理：用 .env.local 里的 NETEASE_COOKIE（自己的 VIP 账号）取歌单/完整音频/歌词。
 * 对前端暴露成 Meting 的 query 协议，前端无需感知 Cookie。
 * 部署到生产环境后默认开启访问口令（MUSIC_ACCESS_TOKEN），只允许站主自己播放。 */
import type { NextRequest } from 'next/server'
import { accessCookieHeader, authorizedToken, privateEnabled } from './access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ORIGIN = 'https://music.163.com'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

interface NeteaseTrack {
	id: number
	name?: string
	ar?: { name?: string }[]
	artists?: { name?: string }[]
	al?: { picUrl?: string }
	album?: { picUrl?: string }
}

interface PlaylistDetail {
	playlist?: {
		tracks?: NeteaseTrack[]
		trackIds?: { id: number }[]
	}
}

function headers() {
	const cookie = process.env.NETEASE_COOKIE?.trim()
	return {
		'User-Agent': USER_AGENT,
		Referer: 'https://music.163.com/',
		Accept: 'application/json, text/plain, */*',
		...(cookie ? { Cookie: cookie } : {})
	}
}

async function netease<T>(path: string): Promise<T> {
	const response = await fetch(`${ORIGIN}${path}`, { headers: headers(), cache: 'no-store' })
	if (!response.ok) throw new Error(`网易云接口返回 ${response.status}`)
	return (await response.json()) as T
}

function httpsUrl(url?: string | null) {
	if (!url) return ''
	return url.startsWith('http://') ? `https://${url.slice(7)}` : url
}

function toMeting(track: NeteaseTrack) {
	const artists = track.ar ?? track.artists ?? []
	return {
		name: track.name ?? '',
		artist: artists
			.map(artist => artist.name)
			.filter(Boolean)
			.join(' / '),
		url: `/api/music?server=netease&type=url&id=${track.id}`,
		pic: httpsUrl(track.al?.picUrl ?? track.album?.picUrl),
		lrc: `/api/music?server=netease&type=lrc&id=${track.id}`
	}
}

async function getPlaylist(id: string) {
	const result = await netease<PlaylistDetail>(`/api/v6/playlist/detail?id=${id}&n=1000&s=0`)
	let tracks = result.playlist?.tracks ?? []

	// 歌单太大时 detail 只给 trackIds，再按顺序补一次歌曲详情
	if (tracks.length === 0) {
		const ids = (result.playlist?.trackIds ?? []).map(item => item.id)
		if (ids.length === 0) return []
		const detail = await netease<{ songs?: NeteaseTrack[] }>(`/api/song/detail?ids=${encodeURIComponent(`[${ids.join(',')}]`)}`)
		const map = new Map((detail.songs ?? []).map(song => [song.id, song]))
		tracks = ids.map(songId => map.get(songId)).filter((song): song is NeteaseTrack => Boolean(song))
	}

	return tracks.map(toMeting)
}

/** VIP 账号优先拿 exhigh（320k），失败再退 standard / 老接口 */
async function resolveAudioUrl(id: string) {
	for (const level of ['exhigh', 'standard']) {
		const result = await netease<{ data?: { url?: string | null }[] }>(
			`/api/song/enhance/player/url/v1?ids=%5B${id}%5D&level=${level}&encodeType=flac`
		)
		const url = result.data?.[0]?.url
		if (url) return httpsUrl(url)
	}

	const legacy = await netease<{ data?: { url?: string | null }[] }>(`/api/song/enhance/player/url?ids=%5B${id}%5D&br=320000`)
	return httpsUrl(legacy.data?.[0]?.url)
}

export async function GET(request: NextRequest) {
	// 私密模式：只认 /api/music/auth 种下的口令 Cookie，访客拿不到任何歌单/音源
	const privateMode = privateEnabled()
	const secret = process.env.MUSIC_ACCESS_TOKEN?.trim()
	if (privateMode && !secret) return Response.json({ error: '服务器未配置 MUSIC_ACCESS_TOKEN' }, { status: 503 })
	const authorized = privateMode && secret ? authorizedToken(request) : null
	if (privateMode && !authorized) return Response.json({ error: '音乐服务仅站主可用' }, { status: 403 })

	// 每次通过校验都顺便续期，常用站点不会因 400 天到期而失效
	const renew = authorized ? accessCookieHeader(authorized) : null
	const withRenew = (response: Response) => {
		if (renew) response.headers.set('Set-Cookie', renew)
		return response
	}

	if (!process.env.NETEASE_COOKIE?.trim()) {
		return Response.json({ error: '服务器未配置 NETEASE_COOKIE' }, { status: 503 })
	}

	const { searchParams } = request.nextUrl
	const type = searchParams.get('type') ?? 'playlist'
	const id = searchParams.get('id') ?? ''

	try {
		if (type === 'playlist') {
			if (!/^\d+$/.test(id)) return Response.json({ error: '歌单 id 不合法' }, { status: 400 })
			return withRenew(Response.json(await getPlaylist(id), { headers: { 'Cache-Control': 'no-store' } }))
		}

		if (!/^\d+$/.test(id)) return Response.json({ error: '歌曲 id 不合法' }, { status: 400 })

		if (type === 'url') {
			const url = await resolveAudioUrl(id)
			if (!url) return Response.json({ error: '这首歌没有可用音源（可能已下架或需要更高会员）' }, { status: 404 })
			return withRenew(new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store' } }))
		}

		if (type === 'lrc') {
			const result = await netease<{ lrc?: { lyric?: string } }>(`/api/song/lyric?id=${id}&lv=1&kv=1&tv=-1`)
			return withRenew(
				new Response(result.lrc?.lyric ?? '', {
					headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
				})
			)
		}

		return Response.json({ error: `不支持的类型：${type}` }, { status: 400 })
	} catch (error) {
		return Response.json({ error: error instanceof Error ? error.message : '网易云接口请求失败' }, { status: 502 })
	}
}
