/* Meting 网易云接口：MetingJS 背后的那套 API（server/type/id）。
 * 只负责拼地址、拉歌单和解析歌词，播放由全局 music-store 里的 audio 负责。 */

export interface MetingSong {
	name: string
	artist: string
	url: string
	pic: string
	lrc: string
}

export interface LyricLine {
	time: number
	text: string
}

export interface MusicConfig {
	/** Meting API 地址，例如 https://api.injahow.cn/meting/ */
	api: string
	server: string
	type: string
	id: string
}

export const DEFAULT_MUSIC_CONFIG: MusicConfig = {
	api: 'https://api.injahow.cn/meting/',
	server: 'netease',
	type: 'playlist',
	id: '3778678'
}

function buildUrl(api: string, params: Record<string, string>) {
	// api 可以是同源相对地址（如 /api/music），这里补一个 base 让 URL 正常解析
	const base = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
	const url = new URL(api, base)
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value)
	}
	return url.toString()
}

export function metingPlaylistUrl(config: MusicConfig) {
	return buildUrl(config.api, { server: config.server, type: config.type, id: config.id })
}

/** 拉取歌单；Meting 返回的每首歌自带 url / pic / lrc 三个接口地址 */
export async function fetchMetingPlaylist(config: MusicConfig, signal?: AbortSignal): Promise<MetingSong[]> {
	const response = await fetch(metingPlaylistUrl(config), { signal, cache: 'no-store' })
	if (!response.ok) {
		let message = `音乐接口返回 ${response.status}`
		try {
			const payload = (await response.json()) as { error?: string }
			if (payload?.error) message = payload.error
		} catch {}
		throw new Error(message)
	}

	const data: unknown = await response.json()
	if (!Array.isArray(data)) throw new Error('音乐接口返回格式异常')

	return data
		.filter((item): item is MetingSong => Boolean(item && typeof item === 'object' && (item as MetingSong).url && (item as MetingSong).name))
		.map(item => ({
			name: String(item.name ?? ''),
			artist: String(item.artist ?? ''),
			url: String(item.url ?? ''),
			pic: String(item.pic ?? ''),
			lrc: String(item.lrc ?? '')
		}))
}

/** 解析 LRC：一行里可能挂多个时间标签，逐条展开 */
export function parseLrc(raw: string): LyricLine[] {
	const lines: LyricLine[] = []

	for (const rawLine of raw.split('\n')) {
		const text = rawLine.replace(/\[[^\]]*\]/g, '').trim()
		if (!text) continue

		const stamps = rawLine.matchAll(/\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)
		for (const stamp of stamps) {
			const minute = Number(stamp[1])
			const second = Number(stamp[2])
			const fraction = Number((stamp[3] ?? '0').padEnd(3, '0'))
			lines.push({ time: minute * 60 + second + fraction / 1000, text })
		}
	}

	return lines.sort((a, b) => a.time - b.time)
}

export function formatTime(seconds: number) {
	if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
	const minute = Math.floor(seconds / 60)
	const second = Math.floor(seconds % 60)
	return `${minute}:${second.toString().padStart(2, '0')}`
}
