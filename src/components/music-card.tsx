/* 首页迷你播放器：一个长方形盒子，四格布局 —— 封面 / 歌名歌手 / 上一首·播放暂停·下一首 / 音量。
 * 点封面或歌名进入 /music，进入音乐页后本卡片隐藏；播放状态在全局 music-store 里，不会断播。 */
'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { Music2, Pause, Play, RotateCcw, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from 'lucide-react'
import Card from '@/components/card'
import { useConfigStore } from '../app/(home)/stores/config-store'
import { cardPosition } from '../app/(home)/home-layout'
import { HomeDraggableLayer } from '../app/(home)/home-draggable-layer'
import { useMusicStore } from '@/stores/music-store'
import { DEFAULT_MUSIC_CONFIG } from '@/lib/meting'

export default function MusicCard() {
	const pathname = usePathname()
	const { cardStyles, siteContent } = useConfigStore()
	const config = siteContent.music ?? DEFAULT_MUSIC_CONFIG
	const styles = cardStyles.musicCard
	const pos = cardPosition('musicCard', cardStyles)

	const songs = useMusicStore(state => state.songs)
	const status = useMusicStore(state => state.status)
	const error = useMusicStore(state => state.error)
	const index = useMusicStore(state => state.index)
	const isPlaying = useMusicStore(state => state.isPlaying)
	const volume = useMusicStore(state => state.volume)
	const muted = useMusicStore(state => state.muted)

	const song = songs[index]
	const ready = status === 'ready'
	const VolumeIcon = muted || volume === 0 ? VolumeX : volume > 0.5 ? Volume2 : Volume1

	const title = song?.name ?? (status === 'error' ? '音乐加载失败' : '我的音乐')
	const subtitle = song?.artist ?? (status === 'error' ? error || '点击重试' : ready ? '网易云歌单' : '正在连接音乐...')

	useEffect(() => {
		useMusicStore.getState().load(config)
	}, [config])

	// 只在首页显示；进入 /music 后这个播放器消失
	if (pathname !== '/') return null

	return (
		<HomeDraggableLayer cardKey='musicCard' left={pos.left} top={pos.top} offsetX={pos.offsetX} offsetY={pos.offsetY} width={styles.width} height={styles.height}>
			<Card order={styles.order} width={styles.width} height={styles.height} left={pos.left} top={pos.top} className={clsx('p-3! max-sm:static')} interactive={false}>
				{siteContent.enableChristmas && (
					<>
						<img
							src='/images/christmas/snow-10.webp'
							alt='Christmas decoration'
							className='pointer-events-none absolute'
							style={{ width: 120, left: -8, top: -12, opacity: 0.8 }}
						/>
						<img
							src='/images/christmas/snow-11.webp'
							alt='Christmas decoration'
							className='pointer-events-none absolute'
							style={{ width: 80, right: -10, top: -12, opacity: 0.8 }}
						/>
					</>
				)}

				<div className='flex h-full items-center gap-1.5'>
					{/* 1. 专辑封面，点击进入音乐页 */}
					<Link
						href='/music'
						aria-label='进入音乐页'
						title='进入音乐页'
						className='group relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/10'>
						<Music2 className='text-secondary absolute inset-0 m-auto h-5 w-5' />
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
						<span className='absolute inset-0 flex items-center justify-center bg-[#0b1220]/45 opacity-0 transition-opacity group-hover:opacity-100'>
							<Music2 className='h-5 w-5 text-white' />
						</span>
					</Link>

					{/* 2. 歌名与歌手 */}
					<Link
						href='/music'
						aria-label='进入音乐页'
						className='hover:bg-white/[0.08] flex h-16 min-w-0 flex-1 flex-col justify-center rounded-xl px-2.5 transition-colors'>
						<div className='text-primary truncate text-sm font-bold'>{title}</div>
						<div className='text-secondary mt-0.5 truncate text-xs'>{subtitle}</div>
					</Link>

					{/* 3. 上一首 / 播放暂停 / 下一首 */}
					<div className='flex h-16 shrink-0 items-center gap-0.5 rounded-xl px-1'>
						<button
							type='button'
							onClick={() => useMusicStore.getState().prev()}
							title='上一首'
							aria-label='上一首'
							disabled={!ready}
							className='text-primary hover:text-brand flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-white/10 disabled:opacity-40'>
							<SkipBack className='h-3.5 w-3.5' />
						</button>
						<button
							type='button'
							onClick={() => useMusicStore.getState().toggle()}
							title={isPlaying ? '暂停' : '播放'}
							aria-label={isPlaying ? '暂停' : '播放'}
							disabled={!ready}
							className='bg-linear flex h-7 w-7 items-center justify-center rounded-full shadow-md transition-all hover:scale-105 hover:opacity-90 disabled:opacity-40'>
							{isPlaying ? <Pause className='h-3.5 w-3.5' /> : <Play className='ml-0.5 h-3.5 w-3.5' />}
						</button>
						<button
							type='button'
							onClick={() => useMusicStore.getState().next()}
							title='下一首'
							aria-label='下一首'
							disabled={!ready}
							className='text-primary hover:text-brand flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-white/10 disabled:opacity-40'>
							<SkipForward className='h-3.5 w-3.5' />
						</button>
					</div>

					{/* 4. 音量 */}
					{status === 'error' ? (
						<button
							type='button'
							onClick={() => useMusicStore.getState().load(config, true)}
							title='重新加载'
							aria-label='重新加载'
							className='text-secondary hover:text-brand flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px] transition-colors'>
							<RotateCcw className='h-4 w-4' />
							重试
						</button>
					) : (
						<div className='flex h-16 shrink-0 items-center gap-1 rounded-xl px-1'>
							<button
								type='button'
								onClick={() => useMusicStore.getState().toggleMute()}
								title={muted ? '取消静音' : '静音'}
								aria-label={muted ? '取消静音' : '静音'}
								className='text-secondary hover:text-brand flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-white/10'>
								<VolumeIcon className='h-3.5 w-3.5' />
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
								className='h-1 w-9 cursor-pointer accent-[var(--color-brand)]'
							/>
						</div>
					)}
				</div>
			</Card>
		</HomeDraggableLayer>
	)
}
