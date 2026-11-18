'use client'

import { useMemo, useState } from 'react'
import { Camera, Headphones, Keyboard, Laptop, Pencil, Plus, Save, Smartphone, Tablet, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/hooks/use-auth'
import { pushDevices, type Device } from './services/push-devices'
import { confirmDialog } from '@/components/themed-dialog'
import initialDevices from './list.json'

const blankDevice: Device = { id: '', name: '', model: '', category: '桌面设备', year: '', brand: '', status: '主力在役', description: '', specs: '', image: '' }
const deviceCategories = ['桌面设备', '电脑', '手机', '平板', '相机', '键盘', '耳机', '其他']
const DeviceIcon = ({ category }: { category: string }) => {
		if (category.includes('手机')) return <Smartphone className='h-16 w-16 text-white/85' strokeWidth={1.2} />
		if (category.includes('平板')) return <Tablet className='h-16 w-16 text-white/85' strokeWidth={1.2} />
		if (category.includes('相机')) return <Camera className='h-16 w-16 text-white/85' strokeWidth={1.2} />
		if (category.includes('键盘')) return <Keyboard className='h-16 w-16 text-white/85' strokeWidth={1.2} />
		if (category.includes('耳机')) return <Headphones className='h-16 w-16 text-white/85' strokeWidth={1.2} />
		return <Laptop className='h-16 w-16 text-white/85' strokeWidth={1.2} />
}
const CategoryIcon = ({ category }: { category: string }) => {
		if (category.includes('手机')) return <Smartphone className='h-4 w-4' strokeWidth={1.6} />
		if (category.includes('平板')) return <Tablet className='h-4 w-4' strokeWidth={1.6} />
		if (category.includes('相机')) return <Camera className='h-4 w-4' strokeWidth={1.6} />
		if (category.includes('键盘')) return <Keyboard className='h-4 w-4' strokeWidth={1.6} />
		if (category.includes('耳机')) return <Headphones className='h-4 w-4' strokeWidth={1.6} />
		return <Laptop className='h-4 w-4' strokeWidth={1.6} />
}

export default function DevicesPage() {
	const { isAuth } = useAuthStore()
	const [devices, setDevices] = useState<Device[]>(initialDevices as Device[])
	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState<Device>(blankDevice)
	const [saving, setSaving] = useState(false)
	const [categoryOpen, setCategoryOpen] = useState(false)
	const [search, setSearch] = useState('')
	const [category, setCategory] = useState('全部')
	const categories = useMemo(() => ['全部', ...Array.from(new Set(devices.map(device => device.category).filter(Boolean)))], [devices])
	const filteredDevices = useMemo(() => devices.filter(device => {
		const keyword = search.trim().toLowerCase()
		const matchesSearch = !keyword || [device.name, device.model, device.brand, device.description, device.specs].some(value => value?.toLowerCase().includes(keyword))
		return matchesSearch && (category === '全部' || device.category === category)
	}), [devices, search, category])

	const openNew = () => { setDraft({ ...blankDevice, id: `device-${Date.now()}` }); setEditing(true) }
	const openEdit = (device: Device) => { setDraft({ ...device }); setEditing(true) }
	const updateDraft = (key: keyof Device, value: string) => setDraft(previous => ({ ...previous, [key]: value }))
	const saveDraft = () => {
		if (!draft.name.trim()) { toast.error('请填写设备名称'); return }
		if (devices.some(device => device.id === draft.id)) setDevices(previous => previous.map(device => device.id === draft.id ? { ...draft, name: draft.name.trim() } : device))
		else setDevices(previous => [...previous, { ...draft, name: draft.name.trim() }])
		setEditing(false)
	}
	const removeDevice = async (device: Device) => {
		const confirmed = await confirmDialog({ title: '删除设备', message: `确定删除「${device.name}」吗？`, confirmText: '删除', danger: true })
		if (confirmed) setDevices(previous => previous.filter(item => item.id !== device.id))
	}
	const saveAll = async () => {
		setSaving(true)
		try { setDevices(await pushDevices(devices)); toast.success('设备数据已同步'); setEditing(false) } catch (error) { toast.error(error instanceof Error ? error.message : '保存失败') } finally { setSaving(false) }
	}

	return <main className='min-h-screen px-6 pt-28 pb-16'>
		<header className='mx-auto w-full max-w-5xl'><div className='flex items-end justify-between gap-4'><div><h1 className='mt-2 text-3xl font-semibold text-white'>我的设备</h1><p className='text-secondary mt-2 text-sm'>日常使用的数码装备、工作台与生产力工具。</p></div>{isAuth && <div className='flex gap-2'><button type='button' onClick={openNew} className='brand-btn rounded-lg px-4 py-2 text-sm'><Plus className='h-4 w-4' />添加设备</button><button type='button' onClick={saveAll} disabled={saving} className='rounded-lg border bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15'><Save className='mr-1 inline h-4 w-4' />{saving ? '同步中…' : '保存同步'}</button></div>}</div><div className='mt-7 flex flex-col gap-3 sm:flex-row'><input value={search} onChange={event => setSearch(event.target.value)} placeholder='按名称、品牌或规格搜索…' className='w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-brand/60 sm:max-w-sm' /><div className='flex flex-wrap gap-2'>{categories.map(item => <button key={item} type='button' onClick={() => setCategory(item)} className={`flex min-w-[112px] items-center justify-between gap-5 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-xs text-white transition-colors hover:bg-white/15 ${category === item ? 'ring-brand/60 ring-1' : ''}`}><span>{item}</span><CategoryIcon category={item} /></button>)}</div></div></header>
		<section className='mx-auto mt-8 w-full max-w-5xl'><p className='text-secondary mb-5 text-xs'>{filteredDevices.length} 款设备</p><div className='grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3'>{filteredDevices.map(device => <article key={device.id} className='bg-card overflow-hidden rounded-2xl border backdrop-blur-xl transition-transform hover:-translate-y-1'><div className='flex h-40 items-center justify-center bg-white/[0.04]'>{device.image ? <img src={device.image} alt={device.name} className='h-full w-full object-cover' /> : <DeviceIcon category={device.category} />}</div><div className='p-5'><div className='flex items-start justify-between gap-3'><div><div className='flex flex-wrap gap-2 text-[11px]'><span className='text-white/75'>{device.category}</span>{device.status && <span className='rounded-full bg-white/10 px-2 py-0.5 text-white/60'>{device.status}</span>}</div><h2 className='mt-2 text-lg font-semibold text-white'>{device.name}</h2><p className='text-secondary mt-1 text-xs'>{[device.year, device.brand, device.model].filter(Boolean).join(' · ')}</p></div>{isAuth && <div className='flex gap-1'><button type='button' onClick={() => openEdit(device)} className='rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white' aria-label='编辑'><Pencil className='h-3.5 w-3.5' /></button><button type='button' onClick={() => removeDevice(device)} className='rounded-md p-1.5 text-white/60 hover:bg-red-400/15 hover:text-red-200' aria-label='删除'><Trash2 className='h-3.5 w-3.5' /></button></div>}</div><p className='text-secondary mt-4 text-sm leading-relaxed'>{device.description}</p><p className='mt-3 whitespace-pre-wrap text-xs leading-relaxed text-white/65'>{device.specs}</p></div></article>)}</div></section>
		{editing && isAuth && <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm'><div className='bg-card w-full max-w-lg rounded-2xl border p-6 shadow-2xl'><div className='flex items-center justify-between'><h2 className='text-lg font-semibold text-white'>{devices.some(device => device.id === draft.id) ? '编辑设备' : '添加设备'}</h2><button type='button' onClick={() => setEditing(false)} className='rounded-md p-1 text-white/60 hover:bg-white/10'><X className='h-4 w-4' /></button></div><div className='mt-5 grid gap-3 sm:grid-cols-2'>{([['name','设备名称'],['model','型号'],['year','年份'],['brand','品牌'],['status','状态'],['image','图片地址']] as const).map(([key, label]) => <input key={key} value={draft[key] ?? ''} onChange={event => updateDraft(key, event.target.value)} placeholder={label} className='rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40' />)}<div className='relative'><button type='button' onClick={() => setCategoryOpen(value => !value)} className='flex w-full items-center justify-between rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-left text-sm text-white outline-none hover:bg-white/15'><span>{draft.category}</span><span className='text-white/60'>⌄</span></button>{categoryOpen && <div className='absolute top-full left-0 z-20 mt-1 w-full overflow-hidden rounded-lg border border-white/15 bg-[#18243a]/95 p-1 shadow-xl backdrop-blur-xl'>{deviceCategories.map(item => <button key={item} type='button' onClick={() => { updateDraft('category', item); setCategoryOpen(false) }} className='block w-full rounded-md px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white'>{item}</button>)}</div>}</div><textarea value={draft.description} onChange={event => updateDraft('description', event.target.value)} placeholder='简介' rows={3} className='resize-none rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 sm:col-span-2' /><textarea value={draft.specs} onChange={event => updateDraft('specs', event.target.value)} placeholder='配置或补充信息' rows={4} className='resize-none rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 sm:col-span-2' /></div><div className='mt-5 flex justify-end gap-3'><button type='button' onClick={() => setEditing(false)} className='rounded-lg border bg-white/10 px-4 py-2 text-sm text-white/80'>取消</button><button type='button' onClick={saveDraft} className='brand-btn rounded-lg px-5 py-2 text-sm'>确定</button></div></div></div>}
	</main>
}
