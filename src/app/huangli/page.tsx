import type { Metadata } from 'next'
import { Suspense } from 'react'
import HuangliScreen from './huangli-screen'

export const metadata: Metadata = {
	title: '黄历',
	description: '万年历黄历：每日宜忌、值神、冲煞、二十八宿、彭祖百忌与十二时辰吉凶'
}

export default function Page() {
	return (
		<Suspense
			fallback={
				<div className='text-secondary flex h-screen items-center justify-center text-sm'>
					黄历加载中…
				</div>
			}>
			<HuangliScreen />
		</Suspense>
	)
}
