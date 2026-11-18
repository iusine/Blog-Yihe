import { commitFiles } from '@/lib/github-commit'
import { fileTreeItem } from '@/lib/github-commit'

export type PublishedEssay = {
	id: string
	title: string
	content: string
	style: string
	createdAt: string
	stars: number
}

export async function pushEssays(notes: PublishedEssay[]): Promise<void> {
	await commitFiles({
		message: '更新随笔文案',
		successMessage: '随笔已发布并同步！',
		notifyLocalSync: true,
		prepare: async ctx => ({
			treeItems: [fileTreeItem('public/essays/index.json', await ctx.blobFromJson(notes, 2))]
		})
	})
}
