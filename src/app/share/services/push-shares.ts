import { commitFiles, addHashedImage, fileTreeItem } from '@/lib/github-commit'
import type { TreeItem } from '@/lib/github-client'
import { buildPicbedUrl, PICBED_CATEGORIES } from '@/lib/picbed'
import { createPicbedBatch } from '@/lib/picbed-upload'
import type { Share } from '../components/share-card'
import type { MediaItem } from '@/components/media-upload-dialog'
import { toast } from 'sonner'

/** 页面里的行数据：`__key` 只在浏览器里使用，写进 list.json 之前去掉 */
export type ShareRow = Share & { __key: string }

const LIST_PATH = 'src/app/share/list.json'

export type PushSharesParams = {
	shares: ShareRow[]
	/** 待上传的图标，key 是行的 __key */
	logoItems?: Map<string, MediaItem>
}

function toPlain(row: ShareRow): Share {
	const { __key, ...rest } = row
	void __key
	return rest
}

export async function pushShares(params: PushSharesParams): Promise<Share[]> {
	const { shares, logoItems } = params

	return commitFiles<Share[]>({
		message: '更新分享列表',
		successMessage: '分享已保存！',
		notifyLocalSync: true,
		prepare: async ctx => {
			const treeItems: TreeItem[] = []
			const uploadedHashes = new Set<string>()
			const batch = createPicbedBatch()
			const pendingLogos: Array<{ key: string; localPath: string; cdnRepoPath?: string }> = []
			let rows = [...shares]

			if (logoItems && logoItems.size > 0) {
				toast.info('正在上传图标...')
				for (const [key, logoItem] of logoItems.entries()) {
					if (logoItem.type !== 'file') continue

					const { publicPath, treeItem, picbed } = await addHashedImage(ctx, logoItem.file, 'images/share', uploadedHashes, {
						picbedCategory: PICBED_CATEGORIES.other
					})
					if (treeItem) treeItems.push(treeItem)
					if (picbed) batch.add(picbed.repoPath, picbed.file)
					pendingLogos.push({ key, localPath: publicPath, cdnRepoPath: picbed?.repoPath })
				}
			}

			const picbedOk = await batch.flush(ctx.token)
			for (const { key, localPath, cdnRepoPath } of pendingLogos) {
				const logo = picbedOk && cdnRepoPath ? buildPicbedUrl(cdnRepoPath) : localPath
				rows = rows.map(row => (row.__key === key ? { ...row, logo } : row))
			}

			const pending = rows.find(row => row.logo?.startsWith('blob:'))
			if (pending) throw new Error(`「${pending.name}」的图标还没上传完成，请重新选图后再保存`)

			const plain = rows.map(toPlain)
			treeItems.push(fileTreeItem(LIST_PATH, await ctx.blobFromJson(plain)))
			return { treeItems, result: plain }
		}
	})
}
