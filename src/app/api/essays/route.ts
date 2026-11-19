import { writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * 开发环境保存随笔：直接写 public/essays/index.json。
 * 线上由站主浏览器用安装令牌提交到 data 分支，不经过这里。
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ESSAY_PATH = 'public/essays/index.json'
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/
const STYLES = new Set(['sunny', 'mint', 'sky', 'lavender', 'paper'])

export async function POST(request: Request) {
	if (process.env.NODE_ENV === 'production') {
		return Response.json({ ok: false, error: '生产环境请通过 GitHub 提交随笔' }, { status: 404 })
	}

	// 只接受本机页面发起的请求
	const origin = request.headers.get('origin')
	if (origin && !LOCAL_ORIGIN.test(origin)) {
		return Response.json({ ok: false, error: 'forbidden' }, { status: 403 })
	}

	let body: unknown
	try {
		body = await request.json()
	} catch {
		return Response.json({ ok: false, error: '请求格式不正确' }, { status: 400 })
	}

	if (!Array.isArray(body)) {
		return Response.json({ ok: false, error: '随笔数据格式不正确' }, { status: 400 })
	}

	const notes = body
		.filter(
			(item): item is Record<string, unknown> =>
				Boolean(item) && typeof item === 'object' && !Array.isArray(item) && typeof (item as Record<string, unknown>).id === 'string'
		)
		.map(item => ({
			id: String(item.id),
			title: typeof item.title === 'string' ? item.title.slice(0, 120) : '',
			content: typeof item.content === 'string' ? item.content.slice(0, 4000) : '',
			style: typeof item.style === 'string' && STYLES.has(item.style) ? item.style : 'sunny',
			createdAt: typeof item.createdAt === 'string' ? item.createdAt.slice(0, 40) : new Date().toISOString(),
			stars: typeof item.stars === 'number' && Number.isFinite(item.stars) ? Math.max(0, Math.min(5, Math.round(item.stars))) : 0
		}))
		.filter(note => note.content.trim())

	try {
		await writeFile(path.join(process.cwd(), ESSAY_PATH), `${JSON.stringify(notes, null, 2)}\n`, 'utf8')
		return Response.json({ ok: true, mode: 'local' })
	} catch (error) {
		console.error('Failed to save essays:', error)
		return Response.json({ ok: false, error: '保存随笔失败' }, { status: 500 })
	}
}
