import Link from 'next/link'
import { CircleUserRound, Code2, Laptop } from 'lucide-react'

const branches = [
	{ href: '/more/devices', title: '我的设备', description: '记录正在使用的设备与工具。', icon: Laptop },
	{ href: '/more/skills', title: '我的技能', description: '整理我的技术栈与实践方向。', icon: Code2 },
	{ href: '/about', title: '关于本站', description: '介绍本站的想法、设计与搭建过程。', icon: CircleUserRound }
]

export default function MorePage() {
	return (
		<main className='mx-auto min-h-screen w-full max-w-4xl px-6 pt-28 pb-12'>
			<div className='mb-8'><h1 className='mt-2 text-3xl font-semibold text-white'>了解更多</h1><p className='text-secondary mt-2 text-sm'>更多内容正在这里了解。</p></div>
			<div className='grid gap-4 sm:grid-cols-3'>
				{branches.map(branch => <Link key={branch.href} href={branch.href} className='bg-card group rounded-2xl border p-5 backdrop-blur-xl transition-transform hover:-translate-y-1 hover:bg-white/10'><branch.icon className='h-8 w-8 text-white/85 transition-colors group-hover:text-brand' strokeWidth={1.5} /><h2 className='mt-4 font-medium text-white group-hover:text-brand'>{branch.title}</h2><p className='text-secondary mt-2 text-xs leading-relaxed'>{branch.description}</p><span className='text-brand mt-5 block text-xs'>前往了解 →</span></Link>)}
			</div>
		</main>
	)
}
