import { commitFiles, fileTreeItem } from '@/lib/github-commit'

export type AboutData = {
	title: string
	description: string
	intro: string
	sections: Array<{ id: string; title: string; content: string; category?: string }>
}

export async function pushAbout(data: AboutData): Promise<void> {
	await commitFiles({
		message: '更新关于页面',
		notifyLocalSync: true,
		prepare: async ctx => {
			const sha = await ctx.blobFromJson(data)
			return { treeItems: [fileTreeItem('src/app/about/list.json', sha)] }
		}
	})
}
