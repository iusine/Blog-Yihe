import { toast } from 'sonner'
import { createBlob, createCommit, createTree, getRef, GitHubApiError, updateRef, type TreeItem } from '@/lib/github-client'
import { fileToBase64NoPrefix } from '@/lib/file-utils'
import { PICBED } from '@/lib/picbed'

export type PicbedUpload = {
	/** 图床仓库内路径，例如 `博客文章/blogs/demo/abc.jpg` */
	repoPath: string
	file: File
}

export type PicbedBatch = {
	add: (repoPath: string, file: File) => void
	readonly size: number
	/** 一次性提交整批图片；失败只提示，不阻断博客发布 */
	flush: (token: string) => Promise<boolean>
}

async function mapLimit<T, R>(items: T[], limit: number, task: (item: T, index: number) => Promise<R>): Promise<R[]> {
	const results = new Array<R>(items.length)
	let cursor = 0

	async function worker() {
		while (cursor < items.length) {
			const index = cursor++
			results[index] = await task(items[index], index)
		}
	}

	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
	return results
}

/**
 * 收集本次要同步到 Image-bed 的图片，发布时合并成一个提交。
 */
export function createPicbedBatch(): PicbedBatch {
	const files = new Map<string, File>()
	let pending: Promise<boolean> | null = null

	return {
		add(repoPath, file) {
			if (!repoPath || !file) return
			files.set(repoPath, file)
		},
		get size() {
			return files.size
		},
		flush(token) {
			if (pending) return pending
			if (files.size === 0) return Promise.resolve(true)

			const entries = [...files.entries()].map(([repoPath, file]): PicbedUpload => ({ repoPath, file }))
			pending = uploadAll(token, entries)
			return pending
		}
	}
}

async function uploadAll(token: string, uploads: PicbedUpload[]): Promise<boolean> {
	const { OWNER: owner, REPO: repo, BRANCH: branch } = PICBED

	toast.info(`正在同步 ${uploads.length} 张图片到图床...`, { id: 'picbed-sync' })

	try {
		const { sha: head } = await getRef(token, owner, repo, `heads/${branch}`)

		const treeItems = await mapLimit(uploads, 3, async item => {
			const contentBase64 = await fileToBase64NoPrefix(item.file)
			const { sha } = await createBlob(token, owner, repo, contentBase64, 'base64')
			return { path: item.repoPath, mode: '100644', type: 'blob', sha } as TreeItem
		})

		const tree = await createTree(token, owner, repo, treeItems, head)
		const commit = await createCommit(token, owner, repo, `图床上传: ${uploads.length} 张图片`, tree.sha, [head])
		await updateRef(token, owner, repo, `heads/${branch}`, commit.sha)

		toast.success(`图床已同步 ${uploads.length} 张图片`, { id: 'picbed-sync' })
		return true
	} catch (error) {
		console.error('Failed to sync images to picbed:', error)

		let message = error instanceof Error ? error.message : '未知错误'
		if (error instanceof GitHubApiError && error.status === 404) {
			message = `图床仓库 ${owner}/${repo} 的 ${branch} 分支不可访问。请确认 GitHub App 已安装到该仓库，并且分支存在`
		}

		toast.warning(`图床同步失败，本次使用本地图片：${message}`, { id: 'picbed-sync', duration: 7000 })
		return false
	}
}
