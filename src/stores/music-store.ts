/* 全局音乐状态：首页迷你播放器和 /music 页共用同一份 audio，切换路由不断播。 */
import { create } from 'zustand'
import { toast } from 'sonner'
import { fetchMetingPlaylist, parseLrc, type LyricLine, type MetingSong, type MusicConfig } from '@/lib/meting'

export type PlayMode = 'loop' | 'single' | 'random'
type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

interface MusicStore {
	songs: MetingSong[]
	status: LoadStatus
	error: string
	sourceKey: string
	index: number
	isPlaying: boolean
	currentTime: number
	duration: number
	volume: number
	muted: boolean
	lyrics: LyricLine[]
	mode: PlayMode
	load: (config: MusicConfig, force?: boolean) => void
	toggle: () => void
	playIndex: (index: number) => void
	next: () => void
	prev: () => void
	cycleMode: () => void
	seek: (percent: number) => void
	setVolume: (volume: number) => void
	toggleMute: () => void
}

let audio: HTMLAudioElement | null = null
let lyricAbort: AbortController | null = null
let playlistAbort: AbortController | null = null

function pickRandomIndex(length: number, current: number) {
	if (length <= 1) return current
	let next = current
	while (next === current) next = Math.floor(Math.random() * length)
	return next
}

function getAudio() {
	if (typeof window === 'undefined') return null
	if (audio) return audio

	audio = new Audio()
	audio.preload = 'metadata'
	audio.volume = useMusicStore.getState().volume

	audio.addEventListener('timeupdate', () => {
		if (audio) useMusicStore.setState({ currentTime: audio.currentTime })
	})
	audio.addEventListener('loadedmetadata', () => {
		if (audio) useMusicStore.setState({ duration: Number.isFinite(audio.duration) ? audio.duration : 0 })
	})
	audio.addEventListener('durationchange', () => {
		if (audio) useMusicStore.setState({ duration: Number.isFinite(audio.duration) ? audio.duration : 0 })
	})
	audio.addEventListener('ended', () => handleEnded())
	audio.addEventListener('error', () => useMusicStore.setState({ isPlaying: false }))

	return audio
}

function playAudio() {
	const el = getAudio()
	if (!el) return
	el.play()
		.then(() => useMusicStore.setState({ isPlaying: true }))
		.catch(() => {
			useMusicStore.setState({ isPlaying: false })
			toast.error('这首歌暂时无法播放')
		})
}

function loadLyrics(url: string) {
	lyricAbort?.abort()
	if (!url) return

	const controller = new AbortController()
	lyricAbort = controller

	fetch(url, { signal: controller.signal })
		.then(response => (response.ok ? response.text() : ''))
		.then(text => {
			if (!controller.signal.aborted) useMusicStore.setState({ lyrics: parseLrc(text) })
		})
		.catch(() => {})
}

/** 换源但不自动播放；首页/歌词页靠它先拿到时长和歌词 */
function prepareTrack(index: number) {
	const song = useMusicStore.getState().songs[index]
	const el = getAudio()
	if (!song || !el) return

	useMusicStore.setState({ currentTime: 0, duration: 0, lyrics: [] })
	el.src = song.url
	el.load()
	loadLyrics(song.lrc)
}

function handleEnded() {
	const state = useMusicStore.getState()
	const el = getAudio()
	if (!el || state.songs.length === 0) return

	if (state.mode === 'single') {
		el.currentTime = 0
		playAudio()
		return
	}

	state.next()
}

export const useMusicStore = create<MusicStore>((set, get) => ({
	songs: [],
	status: 'idle',
	error: '',
	sourceKey: '',
	index: 0,
	isPlaying: false,
	currentTime: 0,
	duration: 0,
	volume: 0.8,
	muted: false,
	lyrics: [],
	mode: 'loop',

	load: (config, force = false) => {
		const state = get()
		const sourceKey = `${config.api}|${config.server}|${config.type}|${config.id}`

		if (state.status === 'loading') return
		if (!force && state.status === 'ready' && state.sourceKey === sourceKey) return

		playlistAbort?.abort()
		const controller = new AbortController()
		playlistAbort = controller

		set({ status: 'loading', error: '', sourceKey })

		fetchMetingPlaylist(config, controller.signal)
			.then(list => {
				if (controller.signal.aborted) return
				if (list.length === 0) throw new Error('歌单里还没有可播放的歌曲')
				set({ songs: list, index: 0, isPlaying: false, status: 'ready' })
				prepareTrack(0)
			})
			.catch(error => {
				if (controller.signal.aborted) return
				set({ status: 'error', error: error instanceof Error ? error.message : '歌单加载失败' })
			})
	},

	toggle: () => {
		const state = get()
		if (state.songs.length === 0) return

		const el = getAudio()
		if (!el) return

		if (state.isPlaying) {
			el.pause()
			set({ isPlaying: false })
			return
		}

		if (!el.src) prepareTrack(state.index)
		playAudio()
	},

	playIndex: index => {
		const state = get()
		if (!state.songs[index]) return

		if (index !== state.index) {
			prepareTrack(index)
			set({ index })
		}
		set({ isPlaying: true })
		playAudio()
	},

	next: () => {
		const state = get()
		if (state.songs.length === 0) return
		const nextIndex = state.mode === 'random' ? pickRandomIndex(state.songs.length, state.index) : (state.index + 1) % state.songs.length
		get().playIndex(nextIndex)
	},

	prev: () => {
		const state = get()
		if (state.songs.length === 0) return
		get().playIndex((state.index - 1 + state.songs.length) % state.songs.length)
	},

	cycleMode: () => set(state => ({ mode: state.mode === 'loop' ? 'single' : state.mode === 'single' ? 'random' : 'loop' })),

	seek: percent => {
		const el = getAudio()
		if (!el) return
		const total = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : get().duration
		if (!total) return
		el.currentTime = (percent / 100) * total
		set({ currentTime: el.currentTime })
	},

	setVolume: volume => {
		const next = Math.min(1, Math.max(0, volume))
		const el = getAudio()
		if (el) el.volume = next
		set({ volume: next, muted: next === 0 })
	},

	toggleMute: () => {
		const { muted, volume } = get()
		const el = getAudio()

		if (muted || volume === 0) {
			const restored = volume === 0 ? 0.6 : volume
			if (el) el.volume = restored
			set({ muted: false, volume: restored })
			return
		}

		if (el) el.volume = 0
		set({ muted: true })
	}
}))
