import { writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * 开发环境发布站主公钥：直接写 public/message/config.json。
 *
 * 生产环境不走这里 —— 站主在浏览器里已经导入了私钥，前端会直接用 GitHub App
 * 的令牌提交 config.json，不需要服务端持有任何密钥。
 * 这条本地通道的价值是：断网 / 没有 GitHub 令牌时，本地也能把公钥发出来试效果。
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CONFIG_PATH = 'public/message/config.json'

export async function POST(request: Request) {
	if (process.env.NODE_ENV === 'production') {
		return Response.json({ ok: false, error: '生产环境请通过 GitHub 提交公钥' }, { status: 501 })
	}

	let body: { publicKey?: string } | null = null
	try {
		body = (await request.json()) as { publicKey?: string }
	} catch {
		return Response.json({ ok: false, error: '请求格式不正确' }, { status: 400 })
	}

	const publicKey = String(body?.publicKey ?? '').trim()
	if (!publicKey.startsWith('-----BEGIN PUBLIC KEY-----') || !publicKey.includes('-----END PUBLIC KEY-----')) {
		return Response.json({ ok: false, error: '公钥格式不正确' }, { status: 400 })
	}

	await writeFile(path.join(process.cwd(), CONFIG_PATH), `${JSON.stringify({ ownerPublicKey: publicKey }, null, '\t')}\n`, 'utf8')

	return Response.json({ ok: true, mode: 'local' })
}
