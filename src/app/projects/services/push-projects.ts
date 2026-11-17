import { commitFiles, addHashedImage, fileTreeItem } from '@/lib/github-commit'
import type { TreeItem } from '@/lib/github-client'
import type { Project } from '../components/project-card'
import type { MediaItem } from '@/components/media-upload-dialog'
import { toast } from 'sonner'

/**
 * 页面里的行数据：`__key` 只在浏览器里用来做稳定的 React key 和图片映射，
 * 写进 list.json 之前会被去掉，仓库里的数据格式不变。
 */
export type ProjectRow = Project & { __key: string }

const LIST_PATH = 'src/app/projects/list.json'

export type PushProjectsParams = {
	projects: ProjectRow[]
	/** 待上传的图片，key 是行的 __key */
	imageItems?: Map<string, MediaItem>
}

function toPlain(row: ProjectRow): Project {
	const { __key, ...rest } = row
	void __key
	return rest
}

export async function pushProjects(params: PushProjectsParams): Promise<Project[]> {
	const { projects, imageItems } = params

	return commitFiles<Project[]>({
		message: '更新项目列表',
		successMessage: '项目已保存！',
		notifyLocalSync: true,
		prepare: async ctx => {
			const treeItems: TreeItem[] = []
			const uploadedHashes = new Set<string>()
			let rows = [...projects]

			if (imageItems && imageItems.size > 0) {
				toast.info('正在上传图片...')
				for (const [key, imageItem] of imageItems.entries()) {
					if (imageItem.type !== 'file') continue

					const { publicPath, treeItem } = await addHashedImage(ctx, imageItem.file, 'images/project', uploadedHashes)
					if (treeItem) treeItems.push(treeItem)
					rows = rows.map(row => (row.__key === key ? { ...row, image: publicPath } : row))
				}
			}

			// 兜底：如果还有 blob: 预览地址说明图片没登记，直接报错，避免把临时地址写进仓库
			const pending = rows.find(row => row.image?.startsWith('blob:'))
			if (pending) throw new Error(`「${pending.name}」的图片还没上传完成，请重新选图后再保存`)

			const plain = rows.map(toPlain)
			treeItems.push(fileTreeItem(LIST_PATH, await ctx.blobFromJson(plain)))
			return { treeItems, result: plain }
		}
	})
}
