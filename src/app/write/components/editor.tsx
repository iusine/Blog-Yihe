'use client'

import { motion } from 'motion/react'
import { useEffect, useReducer, useRef } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import Link from '@tiptap/extension-link'
import { Placeholder } from '@tiptap/extensions'
import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	Bold,
	Code,
	Eraser,
	Heading1,
	Heading2,
	Heading3,
	Heading4,
	Heading5,
	Heading6,
	Italic,
	List,
	ListOrdered,
	ListTodo,
	ListTree,
	Link2,
	Minus,
	Pilcrow,
	Quote,
	RotateCcw,
	Sigma,
	SquareCode,
	Strikethrough,
	Superscript,
	Table as TableIcon,
	TriangleAlert
} from 'lucide-react'
import { Marked } from 'marked'
import { toast } from 'sonner'
import { TableKit } from '@tiptap/extension-table'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { useWriteStore } from '../stores/write-store'
import { INIT_DELAY } from '@/consts'
import { ResolvedImage } from '../extensions/resolved-image'
import { MathBlock } from '../extensions/math-block'
import { Admonition } from '../extensions/admonition'
import { FootnoteDefinition, FootnoteRef } from '../extensions/footnotes'
import { buildTocMarkdown } from '../lib/toc'
import type { ImageItem } from '../types'
import { cn } from '@/lib/utils'
import { IMAGE_WIDTH_PRESETS } from '@/lib/image-style'
import { promptDialog, selectDialog } from '@/components/themed-dialog'

function imagesToMarkdown(items: ImageItem[]) {
	return items.map(item => (item.type === 'url' ? `![](${item.url})` : `![](local-image:${item.id})`)).join('\n')
}

/** 从拖拽 / 剪贴板里取图片文件；有的浏览器只在 items 里给文件。 */
function imageFilesFromTransfer(transfer: DataTransfer | null): File[] {
	if (!transfer) return []

	const fromFiles = Array.from(transfer.files || []).filter(file => file.type.startsWith('image/'))
	if (fromFiles.length > 0) return fromFiles

	return Array.from(transfer.items || [])
		.filter(item => item.kind === 'file' && item.type.startsWith('image/'))
		.map(item => item.getAsFile())
		.filter((file): file is File => !!file)
}

/** 源码模式下把鼠标落点换算成 textarea 里的字符位置。 */
function sourceCaretFromPoint(textarea: HTMLTextAreaElement, x: number, y: number): number | null {
	const doc = document as Document & {
		caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
	}
	const position = doc.caretPositionFromPoint?.(x, y)
	if (!position || position.offsetNode !== textarea) return null
	return Math.max(0, Math.min(position.offset, textarea.value.length))
}

function insertMarkdownAt(editor: Editor, markdown: string, pos?: number) {
	const target = pos ?? editor.state.selection.from
	editor.chain().focus().insertContentAt(target, markdown, { contentType: 'markdown' }).run()
}

async function setLink(editor: Editor) {
	const previous = editor.getAttributes('link').href as string | undefined
	const url = await promptDialog({
		title: previous ? '编辑链接' : '插入链接',
		message: '输入链接地址；留空会移除当前链接。',
		defaultValue: previous || 'https://',
		placeholder: 'https://',
		confirmText: '应用'
	})
	if (url === null) return

	const href = url.trim()
	if (!href || href === 'https://') {
		editor.chain().focus().extendMarkRange('link').unsetLink().run()
		return
	}

	editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
}

/**
 * Markdown 扩展默认的 marked 不认 `$$...$$`，这里给它加一个 block 级 tokenizer，
 * 配合 MathBlock 节点的 parseMarkdown 就能把已有文章里的公式块读进编辑器。
 */
const markedWithMath = new Marked()
markedWithMath.use({
	extensions: [
		{
			name: 'mathBlock',
			level: 'block',
			start(src: string) {
				return src.indexOf('$$')
			},
			tokenizer(src: string) {
				const match = src.match(/^\$\$([\s\S]+?)\$\$(?:\n+|$)/)
				if (!match) return
				return {
					type: 'mathBlock',
					raw: match[0],
					text: match[1].trim(),
					tokens: []
				}
			}
		}
	]
})

/** 插入公式块：先问 LaTeX，空内容给一个占位 */
async function insertMathBlock(editor: Editor) {
	const latex = await promptDialog({
		title: '插入公式块',
		message: '输入 LaTeX 源码，不用写 $$。',
		defaultValue: 'E = mc^2',
		multiline: true,
		confirmText: '插入'
	})
	if (latex === null) return
	editor.chain().focus().insertContent({ type: 'mathBlock', attrs: { latex: latex.trim() } }).run()
}

/** 插入目录：按当前标题生成嵌套列表 + 锚点 */
function insertToc(editor: Editor) {
	const toc = buildTocMarkdown(editor)
	if (!toc) {
		toast.info('还没有标题可以生成目录，先写几个 # 标题吧')
		return
	}
	editor.chain().focus().insertContent(`${toc}\n\n`, { contentType: 'markdown' }).run()
	toast.success('已按当前标题生成目录')
}

/** 插入警告框（> [!NOTE] 语法），编辑器里显示为彩色块 */
async function insertAdmonition(editor: Editor) {
	const kind = await selectDialog({
		title: '插入警告框',
		message: '选择一种类型，插入后可以直接改写标题和内容。',
		confirmText: '插入',
		options: [
			{ value: 'note', label: '注意', hint: 'NOTE' },
			{ value: 'tip', label: '提示', hint: 'TIP' },
			{ value: 'important', label: '重要', hint: 'IMPORTANT' },
			{ value: 'warning', label: '警告', hint: 'WARNING' },
			{ value: 'caution', label: '小心', hint: 'CAUTION' }
		]
	})
	if (!kind) return

	editor
		.chain()
		.focus()
		.insertContent({
			type: 'admonition',
			attrs: { kind, title: '' },
			content: [{ type: 'paragraph', content: [{ type: 'text', text: '在这里写内容' }] }]
		})
		.run()
}

/** 插入脚注：正文里放 [^n] 引用，文末追加 [^n]: 内容 定义 */
async function insertFootnote(editor: Editor, markdown: string) {
	const text = await promptDialog({
		title: '插入脚注',
		message: '正文里会插入引用编号，脚注定义自动追加到文末。',
		placeholder: '脚注内容',
		multiline: true,
		confirmText: '插入'
	})
	if (text === null) return

	const used = new Set(Array.from(markdown.matchAll(/\[\^([^\]\s]+)\]/g)).map(match => match[1]))
	let index = 1
	while (used.has(String(index))) index += 1

	editor.chain().focus().insertContent({ type: 'footnoteRef', attrs: { id: String(index) } }).run()
	const end = editor.state.doc.content.size
	editor
		.chain()
		.insertContentAt(end, { type: 'footnoteDefinition', attrs: { id: String(index), text: text.trim() || '脚注内容' } })
		.run()
	toast.success(`已插入脚注 [^${index}]，定义已追加到文末`)
}

/**
 * Typora 风格的段落 / 格式工具条。
 * 覆盖 Typora「段落」菜单里最常用的那些：正文、标题 1-3、引用、有序 / 无序列表、
 * 代码块、分隔线，以及加粗 / 斜体 / 删除线 / 行内代码 / 链接 / 清除格式。
 */
function EditorToolbar({ editor, disabled }: { editor: Editor | null; disabled: boolean }) {
	// tiptap 的 active 状态不会自动触发 React 重渲染，这里订阅 transaction 手动刷新
	const [, forceUpdate] = useReducer((x: number) => x + 1, 0)

	useEffect(() => {
		if (!editor) return
		const handle = () => forceUpdate()
		editor.on('transaction', handle)
		return () => {
			editor.off('transaction', handle)
		}
	}, [editor])

	if (!editor) return null

	const run = (fn: () => void) => () => {
		fn()
		forceUpdate()
	}

	const item = (active: boolean) =>
		cn(
			'flex h-8 min-w-8 shrink-0 items-center justify-center gap-1 rounded-lg px-2 text-xs transition-colors max-sm:h-9 max-sm:min-w-9',
			active ? 'bg-brand/15 text-brand' : 'text-secondary hover:bg-brand/10 hover:text-brand'
		)

	const Divider = () => <span className='mx-1 h-5 w-px shrink-0 bg-black/10' />

	return (
		<div className={cn('mb-3 rounded-xl border bg-white/[0.08] p-1', disabled && 'hidden')}>
			{/* 手机上改为横向滚动的一行，避免二十多个按钮堆满半个屏幕 */}
			<div className='scrollbar-none flex flex-wrap items-center gap-0.5 max-sm:flex-nowrap max-sm:gap-1 max-sm:overflow-x-auto'>
			{/* 段落 */}
			<button type='button' title='正文' className={item(editor.isActive('paragraph'))} onClick={run(() => editor.chain().focus().setParagraph().run())}>
				<Pilcrow className='size-4' />
			</button>
			{[1, 2, 3, 4, 5, 6].map(level => {
				const HeadingIcons = [Heading1, Heading2, Heading3, Heading4, Heading5, Heading6]
				const Icon = HeadingIcons[level - 1]
				return (
					<button
						key={level}
						type='button'
						title={`标题 ${level}`}
						className={item(editor.isActive('heading', { level }))}
						onClick={run(() => editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run())}>
						<Icon className='size-4' />
					</button>
				)
			})}

			<Divider />

			{/* 块级 */}
			<button type='button' title='引用' className={item(editor.isActive('blockquote'))} onClick={run(() => editor.chain().focus().toggleBlockquote().run())}>
				<Quote className='size-4' />
			</button>
			<button type='button' title='无序列表' className={item(editor.isActive('bulletList'))} onClick={run(() => editor.chain().focus().toggleBulletList().run())}>
				<List className='size-4' />
			</button>
			<button type='button' title='有序列表' className={item(editor.isActive('orderedList'))} onClick={run(() => editor.chain().focus().toggleOrderedList().run())}>
				<ListOrdered className='size-4' />
			</button>
			<button type='button' title='代码块' className={item(editor.isActive('codeBlock'))} onClick={run(() => editor.chain().focus().toggleCodeBlock().run())}>
				<SquareCode className='size-4' />
			</button>
			<button type='button' title='分隔线' className={item(false)} onClick={run(() => editor.chain().focus().setHorizontalRule().run())}>
				<Minus className='size-4' />
			</button>

			<Divider />

			{/* 行内 */}
			<button type='button' title='加粗 (Ctrl+B)' className={item(editor.isActive('bold'))} onClick={run(() => editor.chain().focus().toggleBold().run())}>
				<Bold className='size-4' />
			</button>
			<button type='button' title='斜体 (Ctrl+I)' className={item(editor.isActive('italic'))} onClick={run(() => editor.chain().focus().toggleItalic().run())}>
				<Italic className='size-4' />
			</button>
			<button
				type='button'
				title='删除线 (Ctrl+Shift+S)'
				className={item(editor.isActive('strike'))}
				onClick={run(() => editor.chain().focus().toggleStrike().run())}>
				<Strikethrough className='size-4' />
			</button>
			<button type='button' title='行内代码 (Ctrl+E)' className={item(editor.isActive('code'))} onClick={run(() => editor.chain().focus().toggleCode().run())}>
				<Code className='size-4' />
			</button>
			<button type='button' title='链接 (Ctrl+K)' className={item(editor.isActive('link'))} onClick={run(() => void setLink(editor))}>
				<Link2 className='size-4' />
			</button>

			<Divider />

			{/* [新增] Typora 的任务列表 / 表格 / 公式块 / 目录 */}
			<button type='button' title='任务列表' className={item(editor.isActive('taskList'))} onClick={run(() => editor.chain().focus().toggleTaskList().run())}>
				<ListTodo className='size-4' />
			</button>
			<button
				type='button'
				title='插入表格'
				className={item(editor.isActive('table'))}
				onClick={run(() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}>
				<TableIcon className='size-4' />
			</button>
			<button type='button' title='公式块' className={item(editor.isActive('mathBlock'))} onClick={run(() => void insertMathBlock(editor))}>
				<Sigma className='size-4' />
			</button>
			<button type='button' title='插入目录（按当前标题生成）' className={item(false)} onClick={run(() => insertToc(editor))}>
				<ListTree className='size-4' />
			</button>
			<button type='button' title='警告框（> [!NOTE]）' className={item(editor.isActive('admonition'))} onClick={run(() => void insertAdmonition(editor))}>
				<TriangleAlert className='size-4' />
			</button>
			<button
				type='button'
				title='脚注（[^1] + 文末定义）'
				className={item(false)}
				onClick={run(() => void insertFootnote(editor, useWriteStore.getState().form.md))}>
				<Superscript className='size-4' />
			</button>

			<Divider />

			<button
				type='button'
				title='清除格式'
				className={item(false)}
				onClick={run(() => editor.chain().focus().unsetAllMarks().clearNodes().run())}>
				<Eraser className='size-4' />
			</button>
			</div>

			{/* 光标在表格里时，多出一行表格操作（Typora 的表格右键菜单简化版） */}
			{editor.isActive('table') && (
				<div className='scrollbar-none mt-1 flex w-full flex-wrap items-center gap-1 border-t pt-1 max-sm:flex-nowrap max-sm:overflow-x-auto'>
					<span className='text-secondary px-1 text-[11px]'>表格</span>
					{[
						['+ 行', () => editor.chain().focus().addRowAfter().run()],
						['− 行', () => editor.chain().focus().deleteRow().run()],
						['+ 列', () => editor.chain().focus().addColumnAfter().run()],
						['− 列', () => editor.chain().focus().deleteColumn().run()],
						['切换表头', () => editor.chain().focus().toggleHeaderRow().run()],
						['删除表格', () => editor.chain().focus().deleteTable().run()]
					].map(([label, action]) => (
						<button
							key={label as string}
							type='button'
							className='text-secondary hover:bg-brand/10 hover:text-brand shrink-0 rounded-lg px-2 py-1 text-[11px] whitespace-nowrap transition-colors'
							onClick={run(action as () => void)}>
							{label as string}
						</button>
					))}
				</div>
			)}

			{/* 选中图片时：宽度 / 对齐（Typora 的图片样式） */}
			{editor.isActive('image') && (
				<div className='scrollbar-none mt-1 flex w-full flex-wrap items-center gap-1 border-t pt-1 max-sm:flex-nowrap max-sm:overflow-x-auto'>
					<span className='text-secondary px-1 text-[11px]'>图片</span>
					{(() => {
						const attrs = editor.getAttributes('image')
						const rawWidth = Number(attrs.width)
						const width = Number.isFinite(rawWidth) && rawWidth > 0 ? Math.min(100, Math.max(10, Math.round(rawWidth))) : null
						const align = attrs.align === 'left' || attrs.align === 'right' ? attrs.align : 'center'
						const activeWidth = width ?? 40
						const setAttrs = (patch: Record<string, unknown>) => editor.chain().focus().updateAttributes('image', patch).run()
						const chip = (active: boolean) =>
							cn(
								'flex shrink-0 items-center justify-center rounded-lg px-2 py-1 text-[11px] whitespace-nowrap transition-colors max-sm:px-3 max-sm:py-1.5',
								active ? 'bg-brand/15 text-brand' : 'text-secondary hover:bg-brand/10 hover:text-brand'
							)

						return (
							<>
								{IMAGE_WIDTH_PRESETS.map(preset => (
									<button
										key={preset}
										type='button'
										title={`宽度 ${preset}%`}
										className={chip(activeWidth === preset)}
										onMouseDown={event => event.preventDefault()}
										onClick={() => setAttrs({ width: preset === 40 ? null : preset, height: null })}>
										{preset}%
									</button>
								))}
								<span className='mx-1 h-5 w-px bg-black/10' />
								{(
									[
										{ value: 'left', label: '左对齐', Icon: AlignLeft },
										{ value: 'center', label: '居中', Icon: AlignCenter },
										{ value: 'right', label: '右对齐', Icon: AlignRight }
									] as const
								).map(({ value, label, Icon }) => (
									<button
										key={value}
										type='button'
										title={label}
										className={chip(align === value)}
										onMouseDown={event => event.preventDefault()}
										onClick={() => setAttrs({ align: value === 'center' ? null : value })}>
										<Icon className='size-3.5' />
									</button>
								))}
								<button
									type='button'
									title='恢复默认样式'
									className={chip(false)}
									onMouseDown={event => event.preventDefault()}
									onClick={() => setAttrs({ width: null, height: null, align: null })}>
									<RotateCcw className='size-3.5' />
								</button>
								<span className='text-secondary ml-auto px-1 text-[11px] max-sm:hidden'>拖拽右下角可调整大小</span>
							</>
						)
					})()}
				</div>
			)}
		</div>
	)
}

export function WriteEditor() {
	const { form, updateForm, addFiles, sourceMode, toggleSourceMode } = useWriteStore()
	const addFilesRef = useRef(addFiles)
	const editorRef = useRef<Editor | null>(null)
	const lastEmittedMd = useRef(form.md)
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	addFilesRef.current = addFiles

	/** 源码模式下把图片插入 textarea 的当前光标处（拖入 / 粘贴共用）。 */
	const insertSourceImages = async (files: File[], selectionStart: number, selectionEnd: number) => {
		const resultImages = await addFilesRef.current(files)
		if (resultImages.length === 0) return

		const state = useWriteStore.getState()
		const current = state.form.md
		const start = Math.max(0, Math.min(selectionStart, current.length))
		const end = Math.max(start, Math.min(selectionEnd, current.length))
		const snippet = imagesToMarkdown(resultImages)
		state.updateForm({ md: `${current.slice(0, start)}${snippet}${current.slice(end)}` })

		const caret = start + snippet.length
		requestAnimationFrame(() => {
			const textarea = textareaRef.current
			if (!textarea) return
			textarea.focus()
			textarea.setSelectionRange(caret, caret)
		})

		toast.success(resultImages.length > 1 ? `已添加 ${resultImages.length} 张图片` : '已添加图片')
	}

	// Ctrl+/ 切换源代码模式（和 Typora 的习惯一致）
	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && event.key === '/') {
				event.preventDefault()
				toggleSourceMode()
			}
		}
		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
	}, [toggleSourceMode])

	const editor = useEditor({
		immediatelyRender: false,
		extensions: [
			StarterKit.configure({
				heading: { levels: [1, 2, 3, 4, 5, 6] },
				link: false
			}),
			// [新增] 表格 / 任务列表 / 公式块 / 警告框 / 脚注
			TableKit.configure({
				table: { resizable: true }
			}),
			TaskList,
			TaskItem.configure({ nested: true }),
			MathBlock,
			Admonition,
			FootnoteRef,
			FootnoteDefinition,
			Link.configure({
				openOnClick: false,
				autolink: true,
				HTMLAttributes: {
					class: 'text-blue-500 underline underline-offset-2'
				}
			}),
			ResolvedImage,
			Placeholder.configure({
				placeholder: '用 # 标题 开始写作…'
			}),
			Markdown.configure({
				indentation: { style: 'space', size: 2 },
				// [新增] 让 Markdown 解析认识 $$...$$ 公式块
				marked: markedWithMath as any
			})
		],
		content: form.md,
		contentType: 'markdown',
		onCreate: ({ editor: e }) => {
			editorRef.current = e
			lastEmittedMd.current = e.getMarkdown()
		},
		onDestroy: () => {
			editorRef.current = null
		},
		onUpdate: ({ editor: e }) => {
			const md = e.getMarkdown()
			lastEmittedMd.current = md
			updateForm({ md })
		},
		editorProps: {
			attributes: {
				class: 'prose tiptap-editor min-h-[600px] w-full outline-none'
			},
			handleKeyDown: (_view, event) => {
				if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
					event.preventDefault()
					const current = editorRef.current
					if (current) setLink(current)
					return true
				}
				return false
			},
			handlePaste: (_view, event) => {
				const items = event.clipboardData?.items
				if (!items) return false

				const imageFiles: File[] = []
				for (let i = 0; i < items.length; i++) {
					const item = items[i]
					if (item.type.startsWith('image/')) {
						const file = item.getAsFile()
						if (file) imageFiles.push(file)
					}
				}

				if (imageFiles.length === 0) return false

				event.preventDefault()
				addFilesRef.current(imageFiles).then(resultImages => {
					const current = editorRef.current
					if (!current || resultImages.length === 0) return
					insertMarkdownAt(current, imagesToMarkdown(resultImages))
				})
				return true
			},
			handleDrop: (view, event, _slice, moved) => {
				if (moved) return false

				const files = event.dataTransfer?.files
				if (files && files.length > 0) {
					event.preventDefault()
					const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
					if (imageFiles.length === 0) {
						toast.error('只能拖入图片文件')
						return true
					}

					const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
					addFilesRef.current(imageFiles).then(resultImages => {
						const current = editorRef.current
						if (!current || resultImages.length === 0) return
						insertMarkdownAt(current, imagesToMarkdown(resultImages), coords?.pos)
					})
					return true
				}

				const md = event.dataTransfer?.getData('text/markdown') || event.dataTransfer?.getData('text/plain') || ''
				const trimmed = md.trim()
				if (trimmed && /^!\[[^\]]*\]\([^)]+\)/.test(trimmed)) {
					event.preventDefault()
					const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
					const current = editorRef.current
					if (current) {
						insertMarkdownAt(current, trimmed, coords?.pos)
					}
					return true
				}

				return false
			}
		}
	})

	// 外部 markdown 变化（导入 MD、加载旧文章、源码模式输入）同步进编辑器
	useEffect(() => {
		if (!editor) return
		if (form.md === lastEmittedMd.current) return
		lastEmittedMd.current = form.md
		editor.commands.setContent(form.md, { contentType: 'markdown', emitUpdate: false })
	}, [form.md, editor])

	// 切换模式时才转移焦点（首次加载默认所见即所得，不主动聚焦，避免打开就滚到文末/弹键盘）
	const prevSourceMode = useRef(sourceMode)
	useEffect(() => {
		if (prevSourceMode.current === sourceMode) return
		prevSourceMode.current = sourceMode
		if (sourceMode) {
			textareaRef.current?.focus()
		} else if (editor) {
			editor.commands.focus('end')
		}
	}, [sourceMode, editor])

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.8 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ delay: INIT_DELAY }}
			className='bg-card flex min-h-[800px] w-[800px] flex-col rounded-2xl border p-6 shadow max-lg:w-full max-lg:max-w-[800px] max-sm:min-h-0 max-sm:p-4'>
			{/* 标题单独一行，正文从下一行开始 */}
			<div className='mb-3 shrink-0'>
				<input
					type='text'
					value={form.title}
					onChange={event => updateForm({ title: event.target.value })}
					placeholder='文章标题'
					className='w-full bg-transparent px-2 text-center text-2xl font-semibold outline-none placeholder:text-white/25'
				/>
			</div>
			<div className='mb-3 h-px shrink-0 bg-white/10' />

			{/* 段落 / 格式工具条：源代码模式下没有意义，直接隐藏 */}
			<EditorToolbar editor={editor} disabled={sourceMode} />

			<div className='relative h-[650px] w-full flex-1 overflow-y-auto rounded-xl text-sm max-sm:h-[52svh] max-sm:text-base'>
				{/* 源代码模式：直接编辑 Markdown 文本 */}
				<textarea
					ref={textareaRef}
					value={form.md}
					onChange={event => {
						updateForm({ md: event.target.value })
					}}
					onDragOver={event => {
						if (Array.from(event.dataTransfer?.types || []).includes('Files')) event.preventDefault()
					}}
					onDrop={event => {
						if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return
						event.preventDefault()

						const files = imageFilesFromTransfer(event.dataTransfer)
						if (files.length === 0) {
							toast.error('只能拖入图片文件')
							return
						}

						const textarea = event.currentTarget
						const at = sourceCaretFromPoint(textarea, event.clientX, event.clientY)
						void insertSourceImages(files, at ?? textarea.selectionStart, at ?? textarea.selectionEnd)
					}}
					onPaste={event => {
						const files = imageFilesFromTransfer(event.clipboardData)
						if (files.length === 0) return
						event.preventDefault()
						const textarea = event.currentTarget
						void insertSourceImages(files, textarea.selectionStart, textarea.selectionEnd)
					}}
					spellCheck={false}
					placeholder='在这里直接写 Markdown，例如：# 标题'
					className={cn(
						'text-primary h-full w-full resize-none rounded-xl bg-black/[0.02] p-4 font-mono text-[13px] leading-relaxed outline-none max-sm:text-base',
						!sourceMode && 'hidden'
					)}
				/>

				{/* 所见即所得 */}
				<div className={cn(sourceMode && 'hidden')}>
					<EditorContent editor={editor} />
				</div>
			</div>

			<div className='text-secondary mt-2 flex items-center justify-between text-[11px]'>
				<span>{sourceMode ? '源代码模式：可拖入 / 粘贴图片' : '所见即所得：可拖入 / 粘贴图片，选中图片可调样式'}</span>
				<span>
					{form.md.length} 字符 · Ctrl+/ 切换模式
				</span>
			</div>
		</motion.div>
	)
}
