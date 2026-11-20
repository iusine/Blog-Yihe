import useSWR from 'swr'
import { useMemo } from 'react'
import { useAuthStore } from '@/hooks/use-auth'
import type { BlogIndexItem } from '@/app/blog/types'

export type { BlogIndexItem } from '@/app/blog/types'

// 改进 fetcher，抛出状态码以便处理 404
// [修改] 不再强制 no-store：让浏览器 HTTP 缓存参与，配合 head 里的 preload，
// 首屏那次请求不必重新建连；SWR 仍然负责刷新，数据更新的时效不变。
const fetcher = async (url: string) => {
	const res = await fetch(url)
	if (!res.ok) {
		const error: any = new Error('Fetch failed')
		error.status = res.status
		throw error
	}
	const data = await res.json()
	return Array.isArray(data) ? data : []
}

export function useBlogIndex() {
	const { isAuth } = useAuthStore()
	const { data, error, isLoading } = useSWR<BlogIndexItem[]>('/blogs/index.json', fetcher, {
		revalidateOnFocus: false,
		revalidateOnReconnect: true
	})

	// [修正] 原来的写法每次渲染都会 filter 出一个新数组，
	// 引用一变，凡是 useEffect(..., [items]) 的组件就会无限循环 setState
	//（/blog 控制台里刷屏的 "Maximum update depth exceeded" 就是它）。
	// 用 useMemo 把结果缓存住，data / isAuth 不变时返回同一个引用。
	// 修改前：
	// let result = data || []
	// if (!isAuth) {
	// 	result = result.filter(item => !item.hidden)
	// }
	const result = useMemo(() => {
		const base = data || []
		return isAuth ? base : base.filter(item => !item.hidden)
	}, [data, isAuth])

	return {
		items: result,
		loading: isLoading,
		error
	}
}

export function useLatestBlog() {
	const { items, loading, error } = useBlogIndex()

	// [修正] 原来直接对 items 调 sort()，会就地打乱 SWR 缓存里的数组顺序；
	// 这里先复制一份再排序。
	const latestBlog = items.length > 0 ? [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] : null

	return {
		blog: latestBlog,
		loading,
		error
	}
}
