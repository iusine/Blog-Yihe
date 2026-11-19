import { toast } from 'sonner'
import { GITHUB_CONFIG } from '@/consts'
import { commitFiles, fileTreeItem } from '@/lib/github-commit'
import type { EssayNote } from '../types'

export async function pushEssays(notes: EssayNote[]): Promise<void> {
	if (process.env.NODE_ENV !== 'production') {
		// 本地开发：写 public/essays/index.json，刷新就能看到
		const res = await fetch('/api/essays', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(notes)
		})
		const data = await res.json().catch(() => ({}))
		if (!res.ok || !data?.ok) throw new Error(data?.error || '保存本地随笔失败')
		toast.success('随笔已发布并同步！')
		return
	}

	// 线上：提交到 data 分支，不会触发整站重新部署
	await commitFiles({
		message: '更新随笔文案',
		successMessage: '随笔已发布并同步！',
		branch: GITHUB_CONFIG.DATA_BRANCH,
		prepare: async ctx => ({
			treeItems: [fileTreeItem('public/essays/index.json', await ctx.blobFromJson(notes, 2))]
		})
	})
}
