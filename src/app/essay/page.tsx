'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { PenLine, Plus, RotateCcw, Star, X } from 'lucide-react'
import { scatterLayout, type ScatterPosition } from '@/app/message/lib/scatter'
import { useAuthStore } from '@/hooks/use-auth'
import { useSize } from '@/hooks/use-size'
import { toast } from 'sonner'
import { pushEssays } from './services/push-essays'

type NoteStyle = 'sunny' | 'mint' | 'sky' | 'lavender' | 'paper'
type EssayNote = { id: string; title: string; content: string; style: NoteStyle; createdAt: string; stars: number }
const STORAGE_KEY = 'blog-yihe-essay-notes'
const styles: Array<{ id: NoteStyle; label: string; className: string }> = [
	{ id: 'sunny', label: '暖阳', className: 'bg-[#fff1b8] text-[#604c27] border-[#f4d978]' },
	{ id: 'mint', label: '薄荷', className: 'bg-[#d9f5e7] text-[#285443] border-[#a9dfc1]' },
	{ id: 'sky', label: '晴空', className: 'bg-[#dceeff] text-[#294d70] border-[#b4d7f5]' },
	{ id: 'lavender', label: '紫藤', className: 'bg-[#eee3ff] text-[#55406f] border-[#d6c2f5]' },
	{ id: 'paper', label: '纸张', className: 'bg-[#fffaf0] text-[#554b3d] border-[#eadfca]' }
]
const styleClass = (style: NoteStyle) => styles.find(item => item.id === style)?.className ?? styles[0].className
const clampPercent = (value: number, inset: number) => Math.min(100 - inset, Math.max(inset, value))

export default function Page() {
	const [notes, setNotes] = useState<EssayNote[]>([])
	const [editorOpen, setEditorOpen] = useState(false)
	const [title, setTitle] = useState('')
	const [content, setContent] = useState('')
	const [style, setStyle] = useState<NoteStyle>('sunny')
	const [stars, setStars] = useState(0)
	const [publishing, setPublishing] = useState(false)
	const [positions, setPositions] = useState<Record<string, ScatterPosition>>({})
	const [salt, setSalt] = useState(0)
	const { isAuth } = useAuthStore()
	const { maxSM } = useSize()
	const containerRef = useRef<HTMLDivElement>(null)
	const [canvas, setCanvas] = useState({ width: 0, height: 0 })
	const dragRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(null)
	const zRef = useRef(20)
	const hydratedRef = useRef(false)
	/** 站点上已有的便签 id；null 表示远程读取失败，这时不能拿本地数据去覆盖 */
	const remoteIdsRef = useRef<Set<string> | null>(null)
	const autoSyncedRef = useRef(false)

	useEffect(() => {
		let cancelled = false
		void (async () => {
			let local: EssayNote[] = []
			try {
				const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
				if (Array.isArray(saved)) local = saved.map(note => ({ ...note, stars: typeof note.stars === 'number' ? note.stars : 0 }))
			} catch { local = [] }
			try {
				const response = await fetch('/essays/index.json', { cache: 'no-store' })
				const remote: EssayNote[] = response.ok ? await response.json() : []
				if (!cancelled && Array.isArray(remote)) {
					remoteIdsRef.current = new Set(remote.map(entry => entry.id))
					const merged = [...remote, ...local.filter(item => !remote.some(entry => entry.id === item.id))]
					setNotes(merged.map(note => ({ ...note, stars: typeof note.stars === 'number' ? note.stars : 0 })))
				}
			} catch {
				remoteIdsRef.current = null
				if (!cancelled) setNotes(local)
			}
			if (!cancelled) hydratedRef.current = true
		})()
		return () => { cancelled = true }
	}, [])
	useEffect(() => { if (hydratedRef.current) localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)) }, [notes])
	const cardWidth = maxSM ? 160 : 220
	const insetX = maxSM && canvas.width ? Math.min(40, ((cardWidth / 2 + 8) / canvas.width) * 100) : 8
	const insetY = maxSM && canvas.height ? Math.min(38, (104 / canvas.height) * 100) : 10
	const layoutKey = maxSM && canvas.width ? `${Math.round(canvas.width)}x${Math.round(canvas.height)}` : 'desktop'
	const lastLayoutKeyRef = useRef('')
	const base = useMemo(
		() => scatterLayout(notes.map(note => note.id), salt, maxSM ? { paddingX: insetX, paddingY: insetY } : undefined),
		[notes, salt, maxSM, insetX, insetY]
	)
	useEffect(() => {
		const element = containerRef.current
		if (!element) return
		const observer = new ResizeObserver(([entry]) => {
			setCanvas({ width: entry.contentRect.width, height: entry.contentRect.height })
		})
		observer.observe(element)
		return () => observer.disconnect()
	}, [])
	useEffect(() => {
		const reset = lastLayoutKeyRef.current !== layoutKey
		lastLayoutKeyRef.current = layoutKey
		setPositions(previous => {
			const prior = reset ? {} : previous
			const next: Record<string, ScatterPosition> = {}
			for (const [id, position] of base) {
				const source = prior[id] ?? position
				next[id] = { ...source, x: clampPercent(source.x, insetX), y: clampPercent(source.y, insetY) }
			}
			return next
		})
	}, [base, insetX, insetY, layoutKey])

	// 站主登录后，把只存在于浏览器里的便签补传到站点，否则访客永远看不到它们
	useEffect(() => {
		if (!isAuth || autoSyncedRef.current) return
		const remoteIds = remoteIdsRef.current
		if (!remoteIds || notes.length === 0) return
		const missing = notes.filter(note => !remoteIds.has(note.id))
		if (missing.length === 0) { autoSyncedRef.current = true; return }
		autoSyncedRef.current = true
		void (async () => {
			try {
				await pushEssays(notes)
				remoteIdsRef.current = new Set(notes.map(note => note.id))
				toast.success(`已把 ${missing.length} 张本地便签同步到站点`)
			} catch (error) {
				autoSyncedRef.current = false
				toast.error(error instanceof Error ? error.message : '便签同步失败')
			}
		})()
	}, [isAuth, notes])

	const publish = async () => {
		if (!content.trim()) return
		const note: EssayNote = { id: `essay-${Date.now()}`, title: title.trim(), content: content.trim(), style, createdAt: new Date().toISOString(), stars }
		const nextNotes = [note, ...notes]
		setPublishing(true)
		try {
			await pushEssays(nextNotes)
			setNotes(nextNotes)
			setTitle(''); setContent(''); setStyle('sunny'); setStars(0); setEditorOpen(false)
		} catch (error) {
			toast.error(error instanceof Error ? error.message : '随笔发布失败')
		} finally { setPublishing(false) }
	}
	const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>, id: string) => {
		const position = positions[id]; if (!position) return
		zRef.current += 1
		setPositions(previous => ({ ...previous, [id]: { ...previous[id], z: zRef.current } }))
		dragRef.current = { id, startX: event.clientX, startY: event.clientY, originX: position.x, originY: position.y }
	}
	const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current; const rect = containerRef.current?.getBoundingClientRect(); if (!drag || !rect) return
		const dx = ((event.clientX - drag.startX) / rect.width) * 100; const dy = ((event.clientY - drag.startY) / rect.height) * 100
		setPositions(previous => ({ ...previous, [drag.id]: { ...previous[drag.id], x: clampPercent(drag.originX + dx, insetX), y: clampPercent(drag.originY + dy, insetY) } }))
	}

	return <main className='relative flex min-h-screen flex-col overflow-hidden px-4 pt-24 pb-10 sm:px-8'>
		<header className='pointer-events-auto relative z-30 mx-auto flex w-full max-w-5xl items-end justify-between gap-4'>
			<div><h1 className='mt-2 text-3xl font-semibold text-white'>随笔墙</h1><p className='text-secondary mt-2 text-sm'>我会把喜欢的话记录到这面墙上。</p></div>
			{isAuth && <button type='button' onClick={() => setEditorOpen(true)} className='brand-btn shrink-0 justify-center rounded-lg px-4 py-2.5'><Plus className='h-4 w-4' />写一张</button>}
		</header>
		{isAuth && editorOpen && <section className='bg-card pointer-events-auto relative z-30 mx-auto mt-6 w-full max-w-5xl rounded-2xl border p-5 backdrop-blur-xl'>
			<div className='flex items-center justify-between'><h2 className='flex items-center gap-2 font-medium text-white'><PenLine className='text-brand h-4 w-4' />写一张新的便签</h2><button type='button' onClick={() => setEditorOpen(false)} className='text-secondary rounded-md p-1 hover:bg-white/10'><X className='h-4 w-4' /></button></div>
			<div className='mt-4 grid gap-3 sm:grid-cols-[180px_1fr]'><div className='space-y-3'><input value={title} onChange={event => setTitle(event.target.value)} placeholder='标题（可选）' className='w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40' /><div className='flex flex-wrap gap-2'>{styles.map(item => <button key={item.id} type='button' onClick={() => setStyle(item.id)} className={`h-7 w-7 rounded-full border-2 ${item.className} ${style === item.id ? 'ring-brand ring-2 ring-offset-2 ring-offset-[#101827]' : ''}`} aria-label={item.label} />)}</div><div><p className='text-secondary mb-1 text-[11px]'>喜爱程度</p><div className='flex'>{Array.from({ length: 5 }, (_, index) => <button key={index} type='button' onClick={() => setStars(index + 1)} className='rounded-sm p-0.5 hover:bg-white/10' aria-label={`选择 ${index + 1} 颗星`}><Star className={`h-4 w-4 ${index < stars ? 'fill-brand text-brand' : 'text-white/35'}`} /></button>)}</div></div></div><textarea value={content} onChange={event => setContent(event.target.value)} placeholder='记录一点想说的话……' rows={4} className='w-full resize-none rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm leading-relaxed text-white outline-none placeholder:text-white/40' /></div>
			<div className='mt-4 flex justify-end'><button type='button' onClick={publish} disabled={!content.trim() || publishing} className='brand-btn justify-center rounded-lg px-5 py-2 disabled:cursor-not-allowed disabled:opacity-40'>{publishing ? '同步中…' : '贴到墙上'}</button></div>
		</section>}
		<div ref={containerRef} onPointerMove={handlePointerMove} onPointerUp={() => { dragRef.current = null }} onPointerCancel={() => { dragRef.current = null }} onPointerLeave={() => { dragRef.current = null }} className='relative mx-auto mt-6 min-h-[620px] w-full max-w-5xl flex-1 touch-none overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]'>
			{notes.length === 0 && <div className='flex h-[620px] flex-col items-center justify-center text-center'><div className='text-5xl'>📝</div><p className='mt-3 text-white'>还没有随笔</p><p className='text-secondary mt-2 text-xs'>写下第一张便签，让墙面热闹起来吧。</p></div>}
			{notes.map(note => { const position = positions[note.id]; if (!position) return null; return <div key={note.id} onPointerDown={event => handlePointerDown(event, note.id)} className='absolute cursor-grab select-none active:cursor-grabbing' style={{ width: cardWidth, left: `${clampPercent(position.x, insetX)}%`, top: `${clampPercent(position.y, insetY)}%`, zIndex: position.z, transform: `translate(-50%, -50%) rotate(${position.rotate}deg)` }}><div className={`min-h-[150px] rounded-[6px] border p-4 pb-5 shadow-[0_16px_30px_-18px_rgba(0,0,0,0.55)] ${styleClass(note.style)}`}><div className='mb-3 h-1 w-12 rounded-full bg-black/10' />{note.title && <h3 className='mb-2 text-sm font-semibold'>{note.title}</h3>}<p className='whitespace-pre-wrap break-words text-[13px] leading-relaxed'>{note.content}</p><div className='mt-4 flex items-center justify-between'><time className='text-[10px] opacity-50'>{note.createdAt.slice(0, 10)}</time><span className='flex items-center' aria-label={`喜爱程度 ${note.stars} 星`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} className={`h-3.5 w-3.5 ${index < note.stars ? 'fill-current' : 'opacity-25'}`} />)}</span></div></div></div> })}
			{notes.length > 0 && <button type='button' onClick={() => setSalt(value => value + 1)} className='bg-card absolute right-4 bottom-4 z-50 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs text-white backdrop-blur-sm hover:bg-white/15'><RotateCcw className='h-3.5 w-3.5' />重新散落</button>}
		</div>
	</main>
}
