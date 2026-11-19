import { readEssays } from '@/lib/data-store'
import EssayClient from './essay-client'

// 每次访问都读最新数据：开发环境读本地文件，线上读仓库的 data 分支
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function Page() {
	const { notes, ok } = await readEssays()
	return <EssayClient initialNotes={notes} initialRemoteOk={ok} />
}
