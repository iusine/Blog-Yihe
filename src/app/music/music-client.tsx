/* 音乐页：数据走 Meting 网易云接口，版式参考 boke.hiromu.top/music。
 * 播放状态来自全局音乐 store，从首页点封面进来会无缝续播。 */
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ListMusic, Music2, Pause, Play, Repeat, Repeat1, RotateCcw, ScrollText, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useConfigStore } from '@/app/(home)/stores/config-store'
import { useMusicStore } from '@/stores/music-store'
import { DEFAULT_MUSIC_CONFIG, formatTime } from '@/lib/meting'

const MODE_META = {
	loop: { icon: Repeat, label: '列表循环' },
	single: { icon: Repeat1, label: '单曲循环' },
	random: { icon: Shuffle, label: '随机播放' }
}

const CARD = 'rounded-3xl border border-white/15 bg-white/[0.06] shadow-[0_24px_70px_-34px_rgba(0,0,0,0.65)] backdrop-blur-xl'

export default function MusicClient() {
	const { siteContent } = useConfigStore()
	const config = siteContent.music ?? DEFAULT_MUSIC_CONFIG

	const songs = useMusicStore(state => state.songs)
	const status = useMusicStore(state => state.status)
	const error = useMusicStore(state => state.error)
	const index = useMusicStore(state => state.index)
	const isPlaying = useMusicStore(state => state.isPlaying)
	const currentTime = useMusicStore(state => state.currentTime)
	const duration = useMusicStore(state => state.duration)
	const volume = useMusicStore(state => state.volume)
	const muted = useMusicStore(state => state.muted)
	const mode = useMusicStore(state => state.mode)
	const lyrics = useMusicStore(state => state.lyrics)

	const song = songs[index]
	const activeLyricIndex = useMemo(() => {
		for (let i = lyrics.length - 1; i >= 0; i--) {
			if (currentTime >= lyrics[i].time) return i
		}
		return -1
	}, [lyrics, currentTime])
	const activeLyric = lyrics[activeLyricIndex]?.text ?? ''
	const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

	const [tab, setTab] = useState<'lyrics' | 'playlist'>('lyrics')
	const lyricBoxRef = useRef<HTMLDivElement>(null)
	const activeLineRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		useMusicStore.getState().load(config)
	}, [config])

	useEffect(() => {
		if (tab !== 'lyrics') return
		const box = lyricBoxRef.current
		const line = activeLineRef.current
		if (!box || !line) return
		box.scrollTo({ top: Math.max(0, line.offsetTop - box.clientHeight / 2 + line.clientHeight / 2), behavior: 'smooth' })
	}, [activeLyricIndex, tab, lyrics])

	const ModeIcon = MODE_META[mode].icon
	const VolumeIcon = muted || volume === 0 ? VolumeX : volume > 0.5 ? Volume2 : Volume1

	if (status !== 'ready') {
		return (
			<div className='mx-auto w-full max-w-4xl px-4 pt-28 pb-16'>
				<div className={cn(CARD, 'p-4 md:p-6')}>
					<div className='flex h-40 flex-col items-center justify-center gap-3 md:h-64'>
						{status === 'loading' || status === 'idle' ? (
							<>
								<Music2 className='text-brand h-8 w-8 animate-pulse' />
								<div className='text-secondary text-sm font-medium md:text-base'>连接音乐云端中...</div>
							</>
						) : (
							<>
								<div className='text-secondary text-sm font-medium md:text-base'>音乐加载失败：{error}</div>
								<button type='button' onClick={() => useMusicStore.getState().load(config, true)} className='brand-btn text-xs'>
									<RotateCcw className='h-4 w-4' />
									重新加载
								</button>
							</>
						)}
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className='mx-auto w-full max-w-4xl px-4 pt-28 pb-16'>
			{/* 封面模糊光晕背景 */}
			<div className='pointer-events-none fixed inset-0 -z-10 overflow-hidden'>
				<div
					className='bg-brand/20 absolute top-0 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full opacity-30 blur-[120px]'
					style={song?.pic ? { backgroundImage: `url(${song.pic})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
				/>
			</div>

			{/* 播放器 */}
			<section className={cn(CARD, 'mb-4 p-4 md:mb-6 md:p-6')}>
				<div className='flex flex-col items-center gap-4 sm:flex-row md:gap-8'>
					<div className='relative shrink-0'>
						<div className='from-bg relative flex h-36 w-36 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br to-[#16233a] shadow-2xl md:h-48 md:w-48'>
							<div className='absolute inset-3 rounded-full border border-white/5' />
							<div className='absolute inset-6 rounded-full border border-white/5' />
							<div className='absolute inset-9 rounded-full border border-white/5' />
							<div className='absolute inset-12 rounded-full border border-white/5' />
							<div
								className='relative h-[72px] w-[72px] overflow-hidden rounded-full bg-white/10 shadow-inner md:h-24 md:w-24'
								style={{ animation: isPlaying ? 'vinyl-spin 8s linear infinite' : 'none' }}>
								<Music2 className='text-brand absolute inset-0 m-auto h-6 w-6' />
								{song?.pic && (
									<img
										src={song.pic}
										alt=''
										className='absolute inset-0 h-full w-full object-cover'
										onError={event => {
											event.currentTarget.style.display = 'none'
										}}
									/>
								)}
							</div>
							<div className='absolute top-1/2 left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 shadow' />
						</div>
						{isPlaying && <div className='bg-brand/10 absolute inset-0 -z-10 animate-pulse rounded-full blur-xl' />}
					</div>

					<div className='w-full min-w-0 flex-1 text-center sm:text-left'>
						<h1 className='text-primary truncate text-xl font-black md:text-2xl'>{song?.name ?? '未选择歌曲'}</h1>
						<p className='text-secondary mt-1 truncate text-xs font-medium md:text-sm'>{song?.artist ?? ''}</p>

						<div className='mt-4 mb-3 flex items-center gap-2 md:gap-3'>
							<span className='text-secondary w-10 text-right text-[10px] font-bold tabular-nums md:text-xs'>{formatTime(currentTime)}</span>
							<div className='relative flex-1'>
								<div className='h-1.5 overflow-hidden rounded-full bg-white/15'>
									<div className='bg-linear h-full rounded-full transition-all' style={{ width: `${progress}%` }} />
								</div>
								<input
									type='range'
									min={0}
									max={100}
									step={0.1}
									value={progress}
									onChange={event => useMusicStore.getState().seek(Number(event.target.value))}
									title='播放进度'
									aria-label='播放进度'
									className='absolute inset-0 h-full w-full cursor-pointer opacity-0'
								/>
							</div>
							<span className='text-secondary w-10 text-left text-[10px] font-bold tabular-nums md:text-xs'>{formatTime(duration)}</span>
						</div>

						<div className='flex items-center justify-center gap-1.5 sm:justify-start md:gap-2'>
							<button
								type='button'
								onClick={() => useMusicStore.getState().cycleMode()}
								title={MODE_META[mode].label}
								aria-label={MODE_META[mode].label}
								className='text-secondary hover:text-brand flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/10 md:h-9 md:w-9'>
								<ModeIcon className='h-4 w-4' />
							</button>
							<button
								type='button'
								onClick={() => useMusicStore.getState().prev()}
								title='上一首'
								aria-label='上一首'
								className='text-primary hover:text-brand flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/10 md:h-10 md:w-10'>
								<SkipBack className='h-5 w-5' />
							</button>
							<button
								type='button'
								onClick={() => useMusicStore.getState().toggle()}
								title={isPlaying ? '暂停' : '播放'}
								aria-label={isPlaying ? '暂停' : '播放'}
								className='bg-linear shadow-brand/30 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105 hover:opacity-90 md:h-14 md:w-14'>
								{isPlaying ? <Pause className='h-5 w-5 md:h-6 md:w-6' /> : <Play className='ml-0.5 h-5 w-5 md:h-6 md:w-6' />}
							</button>
							<button
								type='button'
								onClick={() => useMusicStore.getState().next()}
								title='下一首'
								aria-label='下一首'
								className='text-primary hover:text-brand flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/10 md:h-10 md:w-10'>
								<SkipForward className='h-5 w-5' />
							</button>
							<div className='ml-1 flex items-center gap-1 md:ml-2'>
								<button
									type='button'
									onClick={() => useMusicStore.getState().toggleMute()}
									title={muted ? '取消静音' : '静音'}
									aria-label={muted ? '取消静音' : '静音'}
									className='text-secondary hover:text-brand flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/10 md:h-9 md:w-9'>
									<VolumeIcon className='h-4 w-4' />
								</button>
								<input
									type='range'
									min={0}
									max={1}
									step={0.01}
									value={muted ? 0 : volume}
									onChange={event => useMusicStore.getState().setVolume(Number(event.target.value))}
									title='音量'
									aria-label='音量'
									className='h-1 w-12 cursor-pointer accent-[var(--color-brand)] md:w-16'
								/>
							</div>
						</div>

						<div className='mt-3 flex h-6 items-center md:mt-4 md:h-7'>
							{activeLyric && <span className='text-brand w-full truncate text-xs font-bold italic md:text-sm'>“{activeLyric}”</span>}
						</div>
					</div>
				</div>
			</section>

			{/* 歌词 / 播放列表切换 */}
			<div className='mb-3 flex gap-1 rounded-2xl border border-white/15 bg-white/[0.04] p-1 backdrop-blur-xl md:mb-4'>
				<button
					type='button'
					onClick={() => setTab('lyrics')}
					className={cn(
						'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all md:py-2.5 md:text-sm',
						tab === 'lyrics' ? 'text-brand bg-white/12 shadow-sm' : 'text-secondary hover:text-primary'
					)}>
					<ScrollText className='h-4 w-4' />
					歌词
				</button>
				<button
					type='button'
					onClick={() => setTab('playlist')}
					className={cn(
						'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all md:py-2.5 md:text-sm',
						tab === 'playlist' ? 'text-brand bg-white/12 shadow-sm' : 'text-secondary hover:text-primary'
					)}>
					<ListMusic className='h-4 w-4' />
					播放列表
				</button>
			</div>

			{tab === 'lyrics' ? (
				<section className={cn(CARD, 'p-4 md:p-6')}>
					<div
						ref={lyricBoxRef}
						className='scrollbar-none relative h-[280px] overflow-y-auto md:h-[400px]'
						style={{
							maskImage: 'linear-gradient(transparent, black 10%, black 90%, transparent)',
							WebkitMaskImage: 'linear-gradient(transparent, black 10%, black 90%, transparent)'
						}}>
						{lyrics.length > 0 ? (
							<div className='space-y-3 py-12 md:space-y-5 md:py-20'>
								{lyrics.map((line, lineIndex) => (
									<div
										key={`${line.time}-${lineIndex}`}
										ref={lineIndex === activeLyricIndex ? activeLineRef : undefined}
										onClick={() => {
											const state = useMusicStore.getState()
											state.seek((line.time / (state.duration || 1)) * 100)
										}}
										className={cn(
											'cursor-pointer text-center transition-all duration-300 select-none',
											lineIndex === activeLyricIndex
												? 'text-brand scale-105 text-base font-black drop-shadow-sm md:text-xl'
												: lineIndex < activeLyricIndex
													? 'text-xs text-white/40 md:text-sm'
													: 'text-secondary text-xs font-medium md:text-sm'
										)}>
										{line.text}
									</div>
								))}
							</div>
						) : (
							<div className='text-secondary flex h-full flex-col items-center justify-center gap-2'>
								<ScrollText className='h-6 w-6' />
								<span className='text-xs font-medium md:text-sm'>暂无歌词</span>
							</div>
						)}
					</div>
				</section>
			) : (
				<section className={cn(CARD, 'p-4 md:p-6')}>
					<div className='scrollbar-none max-h-[280px] space-y-1 overflow-y-auto md:max-h-[400px]'>
						{songs.map((item, itemIndex) => {
							const active = itemIndex === index
							return (
								<button
									type='button'
									key={`${item.name}-${itemIndex}`}
									onClick={() => useMusicStore.getState().playIndex(itemIndex)}
									className={cn(
										'group flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-all duration-300 md:gap-3 md:px-3 md:py-3',
										active ? 'bg-brand/10 shadow-sm' : 'hover:scale-[1.005] hover:bg-white/[0.06] hover:shadow-sm'
									)}>
									<div className='flex w-5 shrink-0 items-center justify-center md:w-6'>
										{active && isPlaying ? (
											<div className='flex h-4 items-end justify-center gap-[2px]'>
												<span className='eq-bar bg-brand h-2 w-1 rounded-t-sm' />
												<span className='eq-bar bg-brand h-3 w-1 rounded-t-sm' style={{ animationDelay: '150ms' }} />
												<span className='eq-bar bg-brand h-4 w-1 rounded-t-sm' style={{ animationDelay: '300ms' }} />
											</div>
										) : (
											<span className={cn('text-[10px] font-bold tabular-nums md:text-xs', active ? 'text-brand' : 'text-secondary')}>
												{String(itemIndex + 1).padStart(2, '0')}
											</span>
										)}
									</div>
									<div className='relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-white/10 shadow-sm md:h-10 md:w-10'>
										<Music2 className='text-secondary absolute inset-0 m-auto h-4 w-4' />
										{item.pic && (
											<img
												src={item.pic}
												alt=''
												loading='lazy'
												className='absolute inset-0 h-full w-full object-cover'
												onError={event => {
													event.currentTarget.style.display = 'none'
												}}
											/>
										)}
									</div>
									<div className='min-w-0 flex-1'>
										<div className={cn('truncate text-xs font-bold md:text-sm', active ? 'text-brand' : 'text-primary')}>{item.name}</div>
										<div className='text-secondary truncate text-[10px] font-medium md:text-xs'>{item.artist}</div>
									</div>
									{active && <div className='text-brand shrink-0'>{isPlaying ? <Pause className='h-4 w-4' /> : <Play className='h-4 w-4' />}</div>}
								</button>
							)
						})}
					</div>
				</section>
			)}
		</div>
	)
}
