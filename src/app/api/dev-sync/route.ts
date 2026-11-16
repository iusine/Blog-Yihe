import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

/**
 * 本地同步接口（仅开发环境）：
 * 发布文章是浏览器直连 GitHub API 完成的，只改远端仓库，不会碰本地磁盘。
 * 所以发布成功后由前端调用这里执行一次 `git pull --ff-only`，
 * 把刚推上去的提交拉回工作区，让本地 public/blogs 和仓库保持一致。
 *
 * 生产环境直接 404（线上部署时 GitHub 是唯一数据源，构建会自己拉代码）。
 */

const execFileAsync = promisify(execFile)

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function git(args: string[]): Promise<string> {
	const { stdout, stderr } = await execFileAsync('git', args, {
		cwd: process.cwd(),
		timeout: 60_000,
		windowsHide: true,
		env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
	})
	return `${stdout}${stderr}`.trim()
}

export async function POST(request: Request) {
	if (process.env.NODE_ENV === 'production') {
		return Response.json({ ok: false, error: '本地同步只在开发环境启用' }, { status: 404 })
	}

	// 只接受本机页面发起的请求，避免别的网站跨站触发一次 pull
	const origin = request.headers.get('origin')
	if (origin && !LOCAL_ORIGIN.test(origin)) {
		return Response.json({ ok: false, error: 'forbidden' }, { status: 403 })
	}

	try {
		const output = await git(['pull', '--ff-only', '--no-rebase'])
		const head = await git(['rev-parse', '--short', 'HEAD'])
		return Response.json({ ok: true, head, output })
	} catch (error) {
		const err = error as { stderr?: string; stdout?: string; message?: string }
		const message = (err.stderr || err.stdout || err.message || '').toString().trim()

		if (/not a git repository/i.test(message)) {
			return Response.json({ ok: true, skipped: true, output: message })
		}

		return Response.json({ ok: false, error: message || 'git pull 失败' }, { status: 500 })
	}
}
