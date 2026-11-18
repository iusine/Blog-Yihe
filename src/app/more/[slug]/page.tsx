import Link from 'next/link'
import { redirect } from 'next/navigation'

const titles: Record<string, string> = { devices: '我的设备', skills: '我的技能', about: '关于本站' }

export default async function MoreBranchPage({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params
	if (slug === 'about') redirect('/about')
	const title = titles[slug] ?? '了解更多'
	return <main className='flex min-h-screen items-center justify-center px-6 pt-20'><div className='bg-card w-full max-w-lg rounded-2xl border p-10 text-center backdrop-blur-xl'><div className='text-5xl'>🛠️</div><h1 className='mt-5 text-2xl font-semibold text-white'>{title}</h1><p className='text-secondary mt-3 text-sm'>这个功能还在规划中，敬请期待。</p><Link href='/more' className='brand-btn mx-auto mt-7 justify-center rounded-lg'>返回了解更多</Link></div></main>
}
