import { addHashedImage, commitFiles, fileTreeItem } from '@/lib/github-commit'
import type { TreeItem } from '@/lib/github-client'
import { buildPicbedUrl, PICBED_CATEGORIES } from '@/lib/picbed'
import { createPicbedBatch } from '@/lib/picbed-upload'
import type { CityRef, NewPhotoDraft, Photo, PhotoPatch } from '../types'
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
			const batch = createPicbedBatch()
			const pending: Array<{ draft: NewPhotoDraft; localPath: string; cdnRepoPath?: string }> = []

			toast.info(`正在上传 ${drafts.length} 张照片...`)

			for (const draft of drafts) {
				const { publicPath, treeItem, picbed } = await addHashedImage(ctx, draft.file, 'images/pictures', uploadedHashes, {
					picbedCategory: PICBED_CATEGORIES.photos
				})
				if (treeItem) treeItems.push(treeItem)
				if (picbed) batch.add(picbed.repoPath, picbed.file)
				pending.push({ draft, localPath: publicPath, cdnRepoPath: picbed?.repoPath })
			}

			const picbedOk = await batch.flush(ctx.token)

			for (const { draft, localPath, cdnRepoPath } of pending) {
				created.push({
					id: createId(),
					src: picbedOk && cdnRepoPath ? buildPicbedUrl(cdnRepoPath) : localPath,
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

export type UpdatePhotoParams = {
	photos: Photo[]
	id: string
	patch: PhotoPatch
}

/**
 * 修改一张照片的信息（标题 / 日期 / 地点 / 说明 / 标签）。
 * 只重写 list.json，不动图片文件本身。
 */
export async function updatePhotoInfo(params: UpdatePhotoParams): Promise<Photo[]> {
	const { photos, id, patch } = params
	const target = photos.find(photo => photo.id === id)
	if (!target) throw new Error('找不到这张照片')

	const location = patch.location?.trim() || undefined
	const description = patch.description?.trim() || undefined

	return commitFiles<Photo[]>({
		message: `修改照片信息: ${target.title} → ${patch.title.trim() || target.title}`,
		successMessage: '照片信息已更新！',
		notifyLocalSync: true,
		prepare: async ctx => {
			const next = photos
				.map(photo =>
					photo.id === id
						? {
								...photo,
								title: patch.title.trim() || photo.title,
								date: patch.date || photo.date,
								location,
								description,
								tags: patch.tags && patch.tags.length > 0 ? patch.tags : undefined
							}
						: photo
				)
				.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

			return { treeItems: [fileTreeItem(LIST_PATH, await ctx.blobFromJson(next))], result: next }
		}
	})
}
