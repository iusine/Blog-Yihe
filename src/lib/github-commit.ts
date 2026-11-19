import { toast } from 'sonner'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'
import {
	createBlob,
	createCommit,
	createRef,
	createTree,
	getRef,
	getRepoInfo,
	GitHubApiError,
	toBase64Utf8,
	updateRef,
	type TreeItem
} from '@/lib/github-client'
import { fileToBase64NoPrefix, hashFileSHA256 } from '@/lib/file-utils'
import {
	compressImageFile,
	compressImageForPicbed,
	MAX_PICBED_IMAGE_BYTES,
	MAX_UPLOAD_IMAGE_BYTES
} from '@/lib/image-compress'
import { buildPicbedRepoPath, type PicbedCategory } from '@/lib/picbed'
import { formatBytes, getFileExt, getFilenameExtension } from '@/lib/utils'
import { syncLocalRepo } from '@/lib/dev-sync'

export type CommitContext = {
	token: string
	owner: string
	repo: string
	branch: string
	/** Create a blob from base64 content, returns sha */
	blobFromBase64: (contentBase64: string) => Promise<string>
	/** Create a blob from UTF-8 text, returns sha */
	blobFromText: (text: string) => Promise<string>
	/** Create a blob from JSON (pretty-printed with tabs), returns sha */
	blobFromJson: (data: unknown, space?: string | number) => Promise<string>
}

export type CommitFilesOptions<T = void> = {
	message: string
	successMessage?: string
	/** 本地同步成功后是否额外提示一句（发布文章时开启） */
	notifyLocalSync?: boolean
	/** 目标分支，默认 GITHUB_CONFIG.BRANCH；留言/随笔数据走 `data` 分支避开生产部署 */
	branch?: string
	prepare: (ctx: CommitContext) => Promise<{ treeItems: TreeItem[]; result?: T }>
}

/**
 * 读取分支最新提交。分支不存在时区分两种情况：
 * - 空仓库（还没有任何提交）：返回 null，由调用方创建首个提交；
 * - 分支名写错 / App 没权限：抛出带排查提示的错误，避免误建孤儿分支。
 */
async function resolveBranchHead(token: string, owner: string, repo: string, branch: string): Promise<string | null> {
	try {
		const { sha } = await getRef(token, owner, repo, `heads/${branch}`)
		return sha
	} catch (error) {
		if (!(error instanceof GitHubApiError) || error.status !== 404) throw error

		const info = await getRepoInfo(token, owner, repo)
		if (info.size === 0) {
			toast.info('仓库还是空的，将创建第一个提交...')
			return null
		}

		throw new Error(
			`分支 "${branch}" 不存在（仓库当前默认分支是 "${info.defaultBranch}"）。` +
				`请检查 NEXT_PUBLIC_GITHUB_BRANCH 配置，或先到 GitHub 上创建该分支。`
		)
	}
}

/**
 * Shared GitHub commit pipeline:
 * getAuthToken → getRef → prepare tree → createTree → createCommit → updateRef
 */
export async function commitFiles<T = void>(options: CommitFilesOptions<T>): Promise<T> {
	const { message, successMessage = '发布成功！', notifyLocalSync = false, branch: targetBranch, prepare } = options
	const { OWNER: owner, REPO: repo } = GITHUB_CONFIG
	const branch = targetBranch || GITHUB_CONFIG.BRANCH

	const token = await getAuthToken()

	toast.info('正在获取分支信息...')
	const latestCommitSha = await resolveBranchHead(token, owner, repo, branch)

	const blobFromBase64 = async (contentBase64: string) => {
		const { sha } = await createBlob(token, owner, repo, contentBase64, 'base64')
		return sha
	}

	const blobFromText = async (text: string) => blobFromBase64(toBase64Utf8(text))

	const blobFromJson = async (data: unknown, space: string | number = '\t') =>
		blobFromText(JSON.stringify(data, null, space))

	const ctx: CommitContext = {
		token,
		owner,
		repo,
		branch,
		blobFromBase64,
		blobFromText,
		blobFromJson
	}

	toast.info('正在准备文件...')
	const { treeItems, result } = await prepare(ctx)

	toast.info('正在创建文件树...')
	const treeData = await createTree(token, owner, repo, treeItems, latestCommitSha ?? undefined)

	toast.info('正在创建提交...')
	const commitData = await createCommit(
		token,
		owner,
		repo,
		message,
		treeData.sha,
		latestCommitSha ? [latestCommitSha] : []
	)

	toast.info('正在更新分支...')
	if (latestCommitSha) {
		await updateRef(token, owner, repo, `heads/${branch}`, commitData.sha)
	} else {
		await createRef(token, owner, repo, `refs/heads/${branch}`, commitData.sha)
	}

	// 开发环境：把刚推上去的提交拉回本地，避免「GitHub 有了、本地 public/ 还是旧的」
	const sync = await syncLocalRepo()
	const syncedToLocal = sync.ok && !sync.skipped

	if (notifyLocalSync) {
		toast.success(syncedToLocal ? `${successMessage}（本地仓库已同步，刷新页面可见）` : successMessage)
	} else {
		toast.success(successMessage)
	}

	if (!syncedToLocal && !sync.skipped) {
		toast.warning(`已推送到 GitHub，但本地 git pull 失败：${sync.error ?? '未知原因'}。请手动执行 git pull。`)
	}

	return result as T
}

export function fileTreeItem(path: string, sha: string | null): TreeItem {
	return { path, mode: '100644', type: 'blob', sha }
}

/**
 * Hash a local file, upload blob once per hash, return public URL + tree item.
 * `publicDir` is the path under /public, e.g. `images/share` → `/images/share/{hash}.ext`
 */
export async function addHashedFile(
	ctx: CommitContext,
	file: File,
	publicDir: string,
	uploadedHashes: Set<string>,
	options?: { ext?: string }
): Promise<{ publicPath: string; treeItem: TreeItem | null; hash: string }> {
	const hash = await hashFileSHA256(file)
	const ext = options?.ext ?? (getFilenameExtension(file.name) || getFileExt(file.name))
	const filename = `${hash}${ext}`
	const dir = publicDir.replace(/^\/+|\/+$/g, '')
	const publicPath = `/${dir}/${filename}`
	const repoPath = `public/${dir}/${filename}`

	if (uploadedHashes.has(hash)) {
		return { publicPath, treeItem: null, hash }
	}

	const contentBase64 = await fileToBase64NoPrefix(file)
	const sha = await ctx.blobFromBase64(contentBase64)
	uploadedHashes.add(hash)

	return {
		publicPath,
		treeItem: fileTreeItem(repoPath, sha),
		hash
	}
}

export type HashedImageResult = {
	publicPath: string
	treeItem: TreeItem | null
	hash: string
	/** 需要另外提交到 Image-bed 的副本（未上传，由调用方合并成一次提交） */
	picbed?: { repoPath: string; file: File }
}

/**
 * 准备一张图片：
 * - 本地副本：超过 1MB 压到 1MB 以内（见 lib/image-compress.ts）；
 * - 图床副本：超过 5MB 才压到 5MB 以内，否则保留原图；
 * - 两份副本用「原图 hash + 扩展名」命名，方便渲染时从图床地址推导出本地地址。
 */
export async function addHashedImage(
	ctx: CommitContext,
	file: File,
	publicDir: string,
	uploadedHashes: Set<string>,
	options: { picbedCategory?: PicbedCategory } = {}
): Promise<HashedImageResult> {
	const hash = await hashFileSHA256(file)
	const originalExt = getFilenameExtension(file.name) || getFileExt(file.name)
	let source = file

	try {
		const oversized = file.size > MAX_UPLOAD_IMAGE_BYTES
		if (oversized) toast.info(`正在压缩图片（${formatBytes(file.size)}）…`, { id: 'image-compress' })

		const result = await compressImageFile(file)
		source = result.file

		if (result.compressed) {
			toast.success(`图片已压缩：${formatBytes(result.originalSize)} → ${formatBytes(result.size)}`, { id: 'image-compress' })
		} else if (oversized) {
			toast.info('这张图片无法进一步压缩，将按原样上传', { id: 'image-compress' })
		}

		if (result.compressed && result.size > MAX_UPLOAD_IMAGE_BYTES) {
			toast.warning(`这张图片压到 ${formatBytes(result.size)} 仍超过 1MB，已按最佳效果上传`)
		}
	} catch (error) {
		console.error('Failed to compress image:', error)
	}

	const dir = publicDir.replace(/^\/+|\/+$/g, '')
	const localExt = getFilenameExtension(source.name) || originalExt
	const publicPath = `/${dir}/${hash}${localExt}`
	const repoPath = `public/${dir}/${hash}${localExt}`

	// 去重键带上扩展名：同名内容的不同格式不会互相覆盖
	const uploadKey = `${hash}${localExt}`
	let treeItem: TreeItem | null = null
	if (!uploadedHashes.has(uploadKey)) {
		const contentBase64 = await fileToBase64NoPrefix(source)
		const sha = await ctx.blobFromBase64(contentBase64)
		uploadedHashes.add(uploadKey)
		treeItem = fileTreeItem(repoPath, sha)
	}

	let picbed: HashedImageResult['picbed']
	if (options.picbedCategory) {
		let cdnSource = file

		if (file.size > MAX_PICBED_IMAGE_BYTES) {
			toast.info(`图床原图超过 5MB，正在压缩（${formatBytes(file.size)}）…`, { id: 'picbed-compress' })
			try {
				const result = await compressImageForPicbed(file)
				cdnSource = result.file

				if (result.compressed) {
					toast.success(`图床副本已压缩：${formatBytes(result.originalSize)} → ${formatBytes(result.size)}`, {
						id: 'picbed-compress'
					})
				} else {
					toast.info('这张图片无法进一步压缩，图床副本将按原样上传', { id: 'picbed-compress' })
				}

				if (result.compressed && result.size > MAX_PICBED_IMAGE_BYTES) {
					toast.warning(`图床副本压到 ${formatBytes(result.size)} 仍超过 5MB，已按最佳效果上传`)
				}
			} catch (error) {
				console.error('Failed to compress image for picbed:', error)
			}
		}

		const cdnExt = getFilenameExtension(cdnSource.name) || originalExt
		picbed = {
			repoPath: buildPicbedRepoPath(options.picbedCategory, dir, `${hash}${cdnExt}`),
			file: cdnSource
		}
	}

	return { publicPath, treeItem, hash, picbed }
}
