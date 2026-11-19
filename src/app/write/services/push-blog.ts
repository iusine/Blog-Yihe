import { commitFiles, addHashedImage, addHashedFile, fileTreeItem } from '@/lib/github-commit'
import { prepareBlogsIndex } from '@/lib/blog-index'
import type { TreeItem } from '@/lib/github-client'
import { buildPicbedUrl, PICBED_CATEGORIES } from '@/lib/picbed'
import { createPicbedBatch } from '@/lib/picbed-upload'
import type { ImageItem, AttachmentItem, AttachmentMeta } from '../types'
import { toast } from 'sonner'
import { formatDateTimeLocal } from '../stores/write-store'
import { extractFirstH1, normalizeLeadingH1, stripInlineMarkdown, stripLeadingH1IfMatches } from '../lib/md-title'

export type PushBlogParams = {
	form: {
		slug: string
		title: string
		md: string
		tags: string[]
		date?: string
		summary?: string
		hidden?: boolean
		category?: string
	}
	cover?: ImageItem | null
	images?: ImageItem[]
	attachments?: AttachmentItem[]
	mode?: 'create' | 'edit'
	originalSlug?: string | null
}

export async function pushBlog(params: PushBlogParams): Promise<void> {
	const { form, cover, images, attachments, mode = 'create', originalSlug } = params

	if (!form?.slug) throw new Error('需要 slug')

	if (mode === 'edit' && originalSlug && originalSlug !== form.slug) {
		throw new Error('编辑模式下不支持修改 slug，请保持原 slug 不变')
	}

	const basePath = `public/blogs/${form.slug}`
	const commitMessage = mode === 'edit' ? `更新文章: ${form.slug}` : `新增文章: ${form.slug}`

	await commitFiles({
		message: commitMessage,
		successMessage: mode === 'edit' ? '更新成功！' : '发布成功！',
		notifyLocalSync: true,
		prepare: async ctx => {
			const allLocalImages: Array<{ img: Extract<ImageItem, { type: 'file' }>; id: string }> = []

			for (const img of images || []) {
				if (img.type === 'file') allLocalImages.push({ img, id: img.id })
			}
			if (cover?.type === 'file') {
				allLocalImages.push({ img: cover, id: cover.id })
			}

			const uploadedHashes = new Set<string>()
			let mdToUpload = normalizeLeadingH1(form.md)
			let coverPath: string | undefined
			const treeItems: TreeItem[] = []
			const title = stripInlineMarkdown(form.title || extractFirstH1(mdToUpload))
			const attachmentMetas: AttachmentMeta[] = []

			if (allLocalImages.length > 0) {
				toast.info('正在上传图片...')
				const batch = createPicbedBatch()
				const pendingImages: Array<{ id: string; localPath: string; cdnRepoPath?: string }> = []

				for (const { img, id } of allLocalImages) {
					const { publicPath, treeItem, picbed } = await addHashedImage(ctx, img.file, `blogs/${form.slug}`, uploadedHashes, {
						picbedCategory: PICBED_CATEGORIES.articles
					})
					if (treeItem) treeItems.push(treeItem)
					if (picbed) batch.add(picbed.repoPath, picbed.file)
					pendingImages.push({ id, localPath: publicPath, cdnRepoPath: picbed?.repoPath })
				}

				const picbedOk = await batch.flush(ctx.token)

				for (const { id, localPath, cdnRepoPath } of pendingImages) {
					const finalPath = picbedOk && cdnRepoPath ? buildPicbedUrl(cdnRepoPath) : localPath
					const placeholder = `local-image:${id}`
					// 直接替换裸占位符，兼容带样式的写法：![](local-image:id "w=60%")
					mdToUpload = mdToUpload.split(placeholder).join(finalPath)

					if (cover?.type === 'file' && cover.id === id) {
						coverPath = finalPath
					}
				}
			}

			if (cover?.type === 'url') {
				coverPath = cover.url
			}

			const hasLocalAttachments = (attachments || []).some(it => it.type === 'file')
			if (hasLocalAttachments) toast.info('正在上传附件...')

			for (const item of attachments || []) {
				if (item.type === 'file') {
					const { publicPath, treeItem } = await addHashedFile(ctx, item.file, `blogs/${form.slug}`, uploadedHashes)
					if (treeItem) treeItems.push(treeItem)
					attachmentMetas.push({ name: item.name, url: publicPath, size: item.size })
				} else {
					attachmentMetas.push({ name: item.name, url: item.url, size: item.size })
				}
			}

			// 标题独立存放在 config；正文首行若只是重复标题则去掉
			mdToUpload = stripLeadingH1IfMatches(mdToUpload, title)

			toast.info('正在创建文件...')

			treeItems.push(fileTreeItem(`${basePath}/index.md`, await ctx.blobFromText(mdToUpload)))

			const dateStr = form.date || formatDateTimeLocal()
			const config = {
				title,
				tags: form.tags,
				date: dateStr,
				summary: form.summary,
				cover: coverPath,
				hidden: form.hidden,
				category: form.category,
				...(attachmentMetas.length > 0 ? { attachments: attachmentMetas } : {})
			}

			treeItems.push(fileTreeItem(`${basePath}/config.json`, await ctx.blobFromJson(config, 2)))

			const indexJson = await prepareBlogsIndex(
				ctx.token,
				ctx.owner,
				ctx.repo,
				{
					slug: form.slug,
					title,
					tags: form.tags,
					date: dateStr,
					summary: form.summary,
					cover: coverPath,
					hidden: form.hidden,
					category: form.category
				},
				ctx.branch
			)
			treeItems.push(fileTreeItem('public/blogs/index.json', await ctx.blobFromText(indexJson)))

			return { treeItems }
		}
	})
}
