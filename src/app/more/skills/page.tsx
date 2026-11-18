'use client'

import { useMemo, useState } from 'react'
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/hooks/use-auth'
import { confirmDialog } from '@/components/themed-dialog'
import { pushSkills, type Skill } from './services/push-skills'
import initialSkills from './list.json'

const empty: Skill = { id: '', name: '', category: '前端', level: '0%', description: '' }
const progressOf = (level: string) => {
	const value = Number.parseInt(level, 10)
	if (Number.isFinite(value)) return Math.min(100, Math.max(0, value))
	return level === '精通' ? 95 : level === '熟练' ? 80 : level === '熟悉' ? 65 : level === '入门' ? 35 : 0
}

export default function SkillsPage() {
	const { isAuth } = useAuthStore()
	const [skills, setSkills] = useState<Skill[]>(initialSkills as Skill[])
	const [filter, setFilter] = useState('全部')
	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState(empty)
	const [saving, setSaving] = useState(false)
	const categories = useMemo(() => ['全部', ...Array.from(new Set(skills.map(item => item.category)))], [skills])
	const visible = skills.filter(item => filter === '全部' || item.category === filter)
	const update = (key: keyof Skill, value: string) => setDraft(previous => ({ ...previous, [key]: value }))
	const openNew = () => { setDraft({ ...empty, id: `skill-${Date.now()}` }); setEditing(true) }
	const openEdit = (item: Skill) => { setDraft({ ...item }); setEditing(true) }
	const confirmDraft = () => { if (!draft.name.trim()) return toast.error('请填写技能名称'); setSkills(previous => previous.some(item => item.id === draft.id) ? previous.map(item => item.id === draft.id ? draft : item) : [...previous, draft]); setEditing(false) }
	const remove = async (id: string) => {
		const confirmed = await confirmDialog({ title: '删除技能', message: '确定删除这个技能吗？', confirmText: '删除', danger: true })
		if (confirmed) setSkills(previous => previous.filter(item => item.id !== id))
	}
	const save = async () => { setSaving(true); try { setSkills(await pushSkills(skills)); toast.success('技能数据已同步') } catch (error) { toast.error(error instanceof Error ? error.message : '保存失败') } finally { setSaving(false) } }

	return <main className='min-h-screen px-6 pt-28 pb-16'>
		<header className='mx-auto w-full max-w-5xl'><div className='flex items-end justify-between gap-4'><div><h1 className='mt-2 text-3xl font-semibold text-white'>我的技能</h1><p className='text-secondary mt-2 text-sm'>用来把想法落地为可维护产品的技术与工具。</p></div>{isAuth && <div className='flex gap-2'><button onClick={openNew} className='brand-btn rounded-lg px-4 py-2 text-sm'><Plus className='h-4 w-4' />添加技能</button><button onClick={save} disabled={saving} className='rounded-lg border bg-white/10 px-4 py-2 text-sm text-white'><Save className='mr-1 inline h-4 w-4' />{saving ? '同步中…' : '保存同步'}</button></div>}</div><div className='mt-7 flex flex-wrap gap-2'>{categories.map(item => <button key={item} onClick={() => setFilter(item)} className={`rounded-lg border px-4 py-2 text-xs ${filter === item ? 'border-brand/50 bg-brand/15 text-brand' : 'border-white/10 bg-white/[0.04] text-white/65'}`}>{item}</button>)}</div></header>
		<section className='mx-auto mt-6 grid w-full max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3'><p className='text-secondary text-xs sm:col-span-2 lg:col-span-3'>{visible.length} 项技能</p>{visible.map(item => { const progress = progressOf(item.level); return <article key={item.id} className='bg-card rounded-2xl border p-5 backdrop-blur-xl transition-transform hover:-translate-y-1'><div className='flex items-start justify-between'><div><span className='text-brand text-xs'>{item.category}</span><h2 className='mt-2 text-lg font-semibold text-white'>{item.name}</h2></div>{isAuth && <div className='flex gap-1'><button onClick={() => openEdit(item)} className='rounded-md p-1.5 text-white/60 hover:bg-white/10'><Pencil className='h-3.5 w-3.5' /></button><button onClick={() => remove(item.id)} className='rounded-md p-1.5 text-white/60 hover:bg-red-400/15'><Trash2 className='h-3.5 w-3.5' /></button></div>}</div><div className='mt-5 flex items-center justify-between text-xs'><span className='text-white/65'>熟练度</span><span className='text-brand'>{progress}%</span></div><div className='mt-2 h-2 overflow-hidden rounded-full bg-white/10'><div className='bg-brand h-full rounded-full transition-[width]' style={{ width: `${progress}%` }} /></div><p className='text-secondary mt-4 text-sm leading-relaxed'>{item.description}</p></article> })}</section>
		{editing && isAuth && <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm'><div className='bg-card w-full max-w-lg rounded-2xl border p-6'><div className='flex justify-between'><h2 className='text-lg font-semibold text-white'>编辑技能</h2><button onClick={() => setEditing(false)}><X className='h-4 w-4 text-white/60' /></button></div><div className='mt-5 grid gap-3'><input value={draft.name} onChange={event => update('name', event.target.value)} placeholder='技能名称' className='rounded-lg border bg-white/10 px-3 py-2 text-sm text-white' /><div className='grid grid-cols-2 gap-3'><input value={draft.category} onChange={event => update('category', event.target.value)} placeholder='分类' className='rounded-lg border bg-white/10 px-3 py-2 text-sm text-white' /><input value={draft.level.replace(/[^0-9]/g, '')} onChange={event => update('level', `${event.target.value.replace(/[^0-9]/g, '').slice(0, 3)}%`)} placeholder='熟练度（如 80%）' inputMode='numeric' className='rounded-lg border bg-white/10 px-3 py-2 text-sm text-white' /></div><textarea value={draft.description} onChange={event => update('description', event.target.value)} placeholder='技能描述' rows={4} className='resize-none rounded-lg border bg-white/10 px-3 py-2 text-sm text-white' /></div><div className='mt-5 flex justify-end gap-3'><button onClick={() => setEditing(false)} className='rounded-lg border bg-white/10 px-4 py-2 text-sm text-white/80'>取消</button><button onClick={confirmDraft} className='brand-btn rounded-lg px-5 py-2 text-sm'>确定</button></div></div></div>}
	</main>
}
