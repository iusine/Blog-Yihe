'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { CircleHelp, ListChecks, PencilLine, TriangleAlert } from 'lucide-react'
import { DialogModal } from './dialog-modal'
import { cn } from '@/lib/utils'

type DialogKind = 'confirm' | 'prompt' | 'select'

export type DialogOption = {
	value: string
	label: string
	hint?: string
}

type DialogRequest = {
	id: number
	kind: DialogKind
	title: string
	message?: string
	defaultValue?: string
	placeholder?: string
	multiline?: boolean
	options?: DialogOption[]
	confirmText?: string
	cancelText?: string
	danger?: boolean
	resolve: (value: string | boolean | null) => void
}

type DialogOptions = Omit<DialogRequest, 'id' | 'kind' | 'resolve'>

let current: DialogRequest | null = null
let nextId = 1
const listeners = new Set<() => void>()

function emit() {
	listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function openDialog(kind: DialogKind, options: DialogOptions): Promise<string | boolean | null> {
	return new Promise(resolve => {
		if (current) {
			current.resolve(current.kind === 'confirm' ? false : null)
		}
		current = { ...options, id: nextId, kind, resolve }
		nextId += 1
		emit()
	})
}

export function confirmDialog(options: DialogOptions): Promise<boolean> {
	return openDialog('confirm', options) as Promise<boolean>
}

export function promptDialog(options: DialogOptions): Promise<string | null> {
	return openDialog('prompt', options) as Promise<string | null>
}

export function selectDialog(options: DialogOptions): Promise<string | null> {
	return openDialog('select', options) as Promise<string | null>
}

const KIND_ICONS = {
	confirm: CircleHelp,
	prompt: PencilLine,
	select: ListChecks
}

export function ThemedDialogHost() {
	const request = useSyncExternalStore(
		subscribe,
		() => current,
		() => null
	)
	const [value, setValue] = useState('')
	const [selected, setSelected] = useState('')
	const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
	const confirmRef = useRef<HTMLButtonElement>(null)

	useEffect(() => {
		if (!request) return
		setValue(request.kind === 'prompt' ? request.defaultValue ?? '' : '')
		setSelected(request.kind === 'select' ? request.options?.[0]?.value ?? '' : '')
		const timer = setTimeout(() => {
			if (inputRef.current) {
				inputRef.current.focus()
				inputRef.current.select()
			} else {
				confirmRef.current?.focus()
			}
		}, 60)
		return () => clearTimeout(timer)
	}, [request])

	const close = (result: string | boolean | null) => {
		if (!current) return
		current.resolve(result)
		current = null
		emit()
	}

	const cancel = () => close(current?.kind === 'confirm' ? false : null)

	const submit = () => {
		if (!current) return
		if (current.kind === 'confirm') {
			close(true)
			return
		}
		if (current.kind === 'select') {
			close(selected)
			return
		}
		close(value)
	}

	if (!request) return null

	const Icon = request.danger ? TriangleAlert : KIND_ICONS[request.kind]

	return (
		<DialogModal open onClose={cancel} className='card w-[min(440px,92vw)] rounded-2xl p-6'>
			<form onSubmit={event => { event.preventDefault(); submit() }}>
					<div className='flex items-start gap-3'>
						<span
							className={cn(
								'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl',
								request.danger ? 'bg-red-400/15 text-red-200' : 'bg-brand/15 text-brand'
							)}>
							<Icon className='size-5' />
						</span>
						<div className='min-w-0'>
							<h2 className='text-base font-semibold'>{request.title}</h2>
							{request.message && <p className='text-secondary mt-1 text-sm leading-relaxed'>{request.message}</p>}
						</div>
					</div>

					{request.kind === 'prompt' &&
						(request.multiline ? (
							<textarea
								ref={inputRef as React.RefObject<HTMLTextAreaElement>}
								value={value}
								onChange={event => setValue(event.target.value)}
								placeholder={request.placeholder}
								rows={3}
								className='focus:ring-brand mt-4 w-full resize-none rounded-lg border bg-white/10 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:ring-2'
							/>
						) : (
							<input
								ref={inputRef as React.RefObject<HTMLInputElement>}
								value={value}
								onChange={event => setValue(event.target.value)}
								placeholder={request.placeholder}
								className='focus:ring-brand mt-4 w-full rounded-lg border bg-white/10 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:ring-2'
							/>
						))}

					{request.kind === 'select' && (
						<div className='mt-4 grid gap-2'>
							{(request.options || []).map(option => (
								<button
									key={option.value}
									type='button'
									onClick={() => setSelected(option.value)}
									className={cn(
										'flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors',
										selected === option.value
											? 'border-brand/60 bg-brand/10 text-brand'
											: 'text-white/80 hover:bg-white/10 border-white/10 bg-white/[0.04]'
									)}>
									<span>{option.label}</span>
									{option.hint && (
										<span className={cn('text-[11px]', selected === option.value ? 'text-brand/70' : 'text-secondary')}>{option.hint}</span>
									)}
								</button>
							))}
						</div>
					)}

					<div className='mt-6 flex justify-end gap-3'>
						<button
							type='button'
							onClick={cancel}
							className='rounded-lg border bg-white/10 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/15'>
							{request.cancelText || '取消'}
						</button>
						<button
							ref={confirmRef}
							type='submit'
							className={cn(
								'rounded-lg px-4 py-2 text-sm transition-colors',
								request.danger
									? 'border border-red-300/40 bg-red-400/15 text-red-200 hover:bg-red-400/25'
									: 'brand-btn'
							)}>
							{request.confirmText || '确定'}
						</button>
					</div>
			</form>
		</DialogModal>
	)
}
