'use client'

export type SyncLocalRepoResult = {
	ok: boolean
	/** 生产环境 / 非 git 仓库：功能不启用，属于正常情况 */
	skipped?: boolean
	head?: string
	output?: string
	error?: string
}

/**
 * 发布成功后把远端提交拉回本地（只在 `next dev` 下有效）。
 * 生产环境不会发起请求，直接返回 skipped。
 */
export async function syncLocalRepo(): Promise<SyncLocalRepoResult> {
	if (process.env.NODE_ENV === 'production') return { ok: false, skipped: true }

	try {
		const res = await fetch('/api/dev-sync', {
			method: 'POST',
			headers: { Accept: 'application/json' },
			cache: 'no-store'
		})

		if (res.status === 404) return { ok: false, skipped: true }

		const data = (await res.json()) as SyncLocalRepoResult
		return data
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) }
	}
}
