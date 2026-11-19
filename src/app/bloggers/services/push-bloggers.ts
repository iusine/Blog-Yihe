import { commitFiles, addHashedImage, fileTreeItem } from '@/lib/github-commit'
import type { TreeItem } from '@/lib/github-client'
import { buildPicbedUrl, PICBED_CATEGORIES } from '@/lib/picbed'
import { createPicbedBatch } from '@/lib/picbed-upload'
import type { Blogger } from '../grid-view'
import type { MediaItem } from '@/components/media-upload-dialog'
import { toast } from 'sonner'

export type PushBloggersParams = {
	bloggers: Blogger[]
	avatarItems?: Map<string, MediaItem>
}

export async function pushBloggers(params: PushBloggersParams): Promise<Blogger[]> {
	const { bloggers, avatarItems } = params
	const blobBloggers = bloggers.filter(b => b.avatar.startsWith('blob:'))
	if (blobBloggers.length > 0) {
		const missing = blobBloggers.filter(b => !avatarItems?.has(b.url))
		if (missing.length > 0) {
			throw new Error(`头像未上传完成：${missing.map(b => b.name).join('、')}`)
		}
	}

	return commitFiles<Blogger[]>({
		message: '更新博主列表',
		prepare: async ctx => {
			const treeItems: TreeItem[] = []
			const uploadedHashes = new Set<string>()
			const batch = createPicbedBatch()
			const pendingAvatars: Array<{ url: string; localPath: string; cdnRepoPath?: string }> = []
			let updatedBloggers = [...bloggers]

			if (avatarItems && avatarItems.size > 0) {
				toast.info('正在上传头像...')
				for (const [url, avatarItem] of avatarItems.entries()) {
					if (avatarItem.type !== 'file') continue

					const { publicPath, treeItem, picbed } = await addHashedImage(ctx, avatarItem.file, 'images/blogger', uploadedHashes, {
						picbedCategory: PICBED_CATEGORIES.other
					})
					if (treeItem) treeItems.push(treeItem)
					if (picbed) batch.add(picbed.repoPath, picbed.file)
					pendingAvatars.push({ url, localPath: publicPath, cdnRepoPath: picbed?.repoPath })
				}
			}

			const picbedOk = await batch.flush(ctx.token)
			for (const { url, localPath, cdnRepoPath } of pendingAvatars) {
				const avatar = picbedOk && cdnRepoPath ? buildPicbedUrl(cdnRepoPath) : localPath
				updatedBloggers = updatedBloggers.map(b => (b.url === url ? { ...b, avatar } : b))
			}

			const sha = await ctx.blobFromJson(updatedBloggers)
			treeItems.push(fileTreeItem('src/app/bloggers/list.json', sha))
			return { treeItems, result: updatedBloggers }
		}
	})
}
