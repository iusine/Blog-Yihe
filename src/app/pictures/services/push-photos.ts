import { addHashedImage, commitFiles, fileTreeItem } from '@/lib/github-commit'
import type { TreeItem } from '@/lib/github-client'
import type { CityRef, NewPhotoDraft, Photo } from '../types'
import { toast } from 'sonner'

const LIST_PATH = 'public/pictures/list.json'

function createId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
	}
	return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export type PushPhotosParams = {
	existing: Photo[]
	city: CityRef
	drafts: NewPhotoDraft[]
}

/**
 * 上传照片：图片按内容哈希去重上传到 public/images/pictures，
 * 元信息追加到 public/pictures/list.json，再一起提交到 GitHub。
 */
export async function pushPhotos(params: PushPhotosParams): Promise<Photo[]> {
	const { existing, city, drafts } = params

	return commitFiles<Photo[]>({
		message: `新增照片: ${city.provinceName}${city.cityName} ${drafts.length} 张`,
		successMessage: '照片已上传！',
		notifyLocalSync: true,
		prepare: async ctx => {
			const uploadedHashes = new Set<string>()
			const treeItems: TreeItem[] = []
			const created: Photo[] = []

			toast.info(`正在上传 ${drafts.length} 张照片...`)

			for (const draft of drafts) {
				const { publicPath, treeItem } = await addHashedImage(ctx, draft.file, 'images/pictures', uploadedHashes)
				if (treeItem) treeItems.push(treeItem)

				created.push({
					id: createId(),
					src: publicPath,
					title: draft.title.trim() || '未命名照片',
					description: draft.description.trim() || undefined,
					tags: draft.tags.length > 0 ? draft.tags : undefined,
					date: draft.date,
					location: draft.location.trim() || undefined,
					province: city.province,
					city: city.city
				})
			}

			const next = [...created, ...existing].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
			treeItems.push(fileTreeItem(LIST_PATH, await ctx.blobFromJson(next)))

			return { treeItems, result: next }
		}
	})
}
