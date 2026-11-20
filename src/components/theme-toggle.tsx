/* 主题切换：白天 / 黑夜 / 自动。
 * 桌面端固定在右上角，手机端固定在底部居中；/write 编辑器里隐藏，避免遮挡顶部工具栏。 */
'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

type ThemeMode = 'dark' | 'light' | 'auto'

const STORAGE_KEY = 'yihe-theme'
/** 自动模式：当地时间 8:00–20:00 用白天，其余时间用黑夜 */
const LIGHT_START = 8
const LIGHT_END = 20

const OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
	{ mode: 'light', label: '白天', icon: Sun },
	{ mode: 'dark', label: '黑夜', icon: Moon },
	{ mode: 'auto', label: '自动', icon: Monitor }
]

function readMode(): ThemeMode {
	if (typeof window === 'undefined') return 'dark'
	const saved = window.localStorage.getItem(STORAGE_KEY)
	return saved === 'light' || saved === 'auto' ? saved : 'dark'
}

function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
	if (mode !== 'auto') return mode
	const hour = new Date().getHours()
	return hour >= LIGHT_START && hour < LIGHT_END ? 'light' : 'dark'
}

/** 写入 html[data-theme]，CSS 变量与全站配色随之切换 */
function applyTheme(mode: ThemeMode) {
	const theme = resolveTheme(mode)
	const root = document.documentElement
	root.dataset.theme = theme
	root.style.colorScheme = theme
}

export default function ThemeToggle() {
	const pathname = usePathname()
	const [mode, setMode] = useState<ThemeMode>('dark')
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		const saved = readMode()
		setMode(saved)
		applyTheme(saved)
		setMounted(true)
	}, [])

	useEffect(() => {
		if (!mounted) return
		applyTheme(mode)
		if (mode !== 'auto') return

		// 自动模式：每分钟、以及从后台切回前台时重新判断时间
		const sync = () => applyTheme('auto')
		const timer = window.setInterval(sync, 60_000)
		const onVisibility = () => {
			if (!document.hidden) sync()
		}
		document.addEventListener('visibilitychange', onVisibility)
		return () => {
			window.clearInterval(timer)
			document.removeEventListener('visibilitychange', onVisibility)
		}
	}, [mode, mounted])

	const select = (next: ThemeMode) => {
		setMode(next)
		window.localStorage.setItem(STORAGE_KEY, next)
		applyTheme(next)
	}

	// 只在主页显示；其它页面（尤其是编辑页）不出现，避免挡住操作
	if (pathname !== '/') return null

	return (
		<div
			role='group'
			aria-label='主题切换'
			className='theme-toggle fixed top-5 right-5 z-[70] flex items-center gap-0.5 rounded-full border border-white/20 bg-white/10 p-1 shadow-[0_12px_30px_-18px_rgba(0,0,0,0.6)] backdrop-blur-xl max-sm:top-auto max-sm:right-1/2 max-sm:bottom-[calc(1rem+env(safe-area-inset-bottom))] max-sm:translate-x-1/2'>
			{OPTIONS.map(({ mode: option, label, icon: Icon }) => {
				const active = mounted && mode === option
				return (
					<button
						key={option}
						type='button'
						title={label}
						aria-label={label}
						aria-pressed={active}
						onClick={() => select(option)}
						className={cn(
							'flex size-9 items-center justify-center rounded-full transition-colors sm:size-8',
							active ? 'bg-brand/15 text-brand' : 'text-secondary hover:bg-white/10 hover:text-primary'
						)}>
						<Icon className='h-4 w-4' />
					</button>
				)
			})}
		</div>
	)
}
