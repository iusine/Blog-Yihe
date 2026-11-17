/* 我的项目：编辑（取消/添加/保存/编辑/删除）都需要先导入私钥才会出现。 */
'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { ProjectCard, type Project } from './components/project-card'
import CreateDialog from './components/create-dialog'
import { pushProjects, type ProjectRow } from './services/push-projects'
import { useAuthStore } from '@/hooks/use-auth'
import initialList from './list.json'
import type { ImageItem } from './components/image-upload-dialog'

let rowSeed = 0
const nextKey = () => `project-${(rowSeed += 1)}-${Date.now().toString(36)}`

const toRows = (list: Project[]): ProjectRow[] => list.map(item => ({ ...item, __key: nextKey() }))

export default function Page() {
    const [projects, setProjects] = useState<ProjectRow[]>(() => toRows(initialList as Project[]))
    const [originalProjects, setOriginalProjects] = useState<ProjectRow[]>(projects)
    const [isEditMode, setIsEditMode] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [imageItems, setImageItems] = useState<Map<string, ImageItem>>(new Map())
    const keyInputRef = useRef<HTMLInputElement>(null)
    /** 导入私钥之后要接着做的事 */
    const pendingActionRef = useRef<(() => void) | null>(null)

    const { isAuth, setPrivateKey } = useAuthStore()

    /** 需要私钥的动作：没导入就先弹 .pem 选择框，导入后自动继续 */
    const requireAuth = (action: () => void) => {
        if (isAuth) {
            action()
            return
        }
        pendingActionRef.current = action
        keyInputRef.current?.click()
    }

    const handleUpdate = (updated: Project, old: Project, imageItem?: ImageItem) => {
        const key = (old as ProjectRow).__key
        setProjects(prev => prev.map(item => (item.__key === key ? { ...updated, __key: key } : item)))
        if (imageItem) setImageItems(prev => new Map(prev).set(key, imageItem))
    }

    const handleAdd = () => {
        requireAuth(() => setIsCreateDialogOpen(true))
    }

    const handleSaveProject = (project: Project, imageItem?: ImageItem) => {
        const row: ProjectRow = { ...project, __key: nextKey() }
        setProjects(prev => [...prev, row])
        if (imageItem) setImageItems(prev => new Map(prev).set(row.__key, imageItem))
    }

    const handleDelete = (project: Project) => {
        const key = (project as ProjectRow).__key
        if (!confirm(`确定要删除 ${project.name} 吗？`)) return

        setProjects(prev => prev.filter(item => item.__key !== key))
        setImageItems(prev => {
            const next = new Map(prev)
            next.delete(key)
            return next
        })
        toast.success('已从列表移除，记得点「保存」提交')
    }

    const handleChoosePrivateKey = async (file: File) => {
        try {
            const text = await file.text()
            if (!/BEGIN [A-Z ]*PRIVATE KEY/.test(text)) {
                toast.error('这不是有效的 .pem 私钥文件')
                return
            }

            await setPrivateKey(text)
            toast.success('私钥已导入，2 小时内有效')

            const action = pendingActionRef.current
            pendingActionRef.current = null
            if (action) action()
            else setIsEditMode(true)
        } catch (error) {
            console.error('Failed to read private key:', error)
            toast.error('读取密钥文件失败')
        }
    }

    const handleSave = async () => {
        setIsSaving(true)

        try {
            const saved = await pushProjects({ projects, imageItems })
            const rows = toRows(saved)

            setProjects(rows)
            setOriginalProjects(rows)
            setImageItems(new Map())
            setIsEditMode(false)
        } catch (error: any) {
            console.error('Failed to save:', error)
            toast.error(`保存失败: ${error?.message || '未知错误'}`)
        } finally {
            setIsSaving(false)
        }
    }

    const handleCancel = () => {
        setProjects(originalProjects)
        setImageItems(new Map())
        setIsEditMode(false)
    }

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isAuth && !isEditMode && (e.ctrlKey || e.metaKey) && e.key === ',') {
                e.preventDefault()
                setIsEditMode(true)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [isAuth, isEditMode])

    return (
        <>
            <input
                ref={keyInputRef}
                type='file'
                accept='.pem'
                className='hidden'
                onChange={async e => {
                    const f = e.target.files?.[0]
                    if (f) await handleChoosePrivateKey(f)
                    if (e.currentTarget) e.currentTarget.value = ''
                }}
            />

            <div className='flex flex-col items-center justify-center px-6 pt-32 pb-12'>
                <div className='grid w-full max-w-[1200px] grid-cols-2 gap-6 max-md:grid-cols-1'>
                    {projects.map(project => (
                        <ProjectCard
                            key={project.__key}
                            project={project}
                            isEditMode={isEditMode}
                            onUpdate={handleUpdate}
                            onDelete={() => handleDelete(project)}
                        />
                    ))}
                </div>

                {projects.length === 0 && <p className='text-secondary py-20 text-sm'>还没有项目，导入私钥后点「添加」加一个。</p>}
            </div>

            <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className='absolute top-4 right-6 flex gap-3 max-sm:hidden'>
                {isEditMode ? (
                    <>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleCancel}
                            disabled={isSaving}
                            className='rounded-xl border bg-white/60 px-6 py-2 text-sm'>
                            取消
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleAdd}
                            disabled={isSaving}
                            className='rounded-xl border bg-white/60 px-6 py-2 text-sm'>
                            添加
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleSave} disabled={isSaving} className='brand-btn px-6'>
                            {isSaving ? '保存中...' : '保存'}
                        </motion.button>
                    </>
                ) : isAuth ? (
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsEditMode(true)}
                        className='bg-card rounded-xl border px-6 py-2 text-sm backdrop-blur-sm transition-colors hover:bg-white/80'>
                        编辑
                    </motion.button>
                ) : (
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => keyInputRef.current?.click()}
                        className='bg-card rounded-xl border px-6 py-2 text-sm backdrop-blur-sm transition-colors hover:bg-white/80'>
                        导入密钥
                    </motion.button>
                )}
            </motion.div>

            {isCreateDialogOpen && <CreateDialog project={null} onClose={() => setIsCreateDialogOpen(false)} onSave={handleSaveProject} />}
        </>
    )
}
