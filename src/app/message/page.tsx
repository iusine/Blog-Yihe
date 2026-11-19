import { readMessages, readOwnerPublicKey } from '@/lib/data-store'
import MessageClient from './message-client'

// 每次访问都读最新数据：开发环境读本地文件，线上读仓库的 data 分支
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function Page() {
	const [messages, ownerPublicKey] = await Promise.all([readMessages(), readOwnerPublicKey()])
	return <MessageClient initialMessages={messages} initialOwnerPublicKey={ownerPublicKey} />
}
