/* 推荐分享：编辑（取消/添加/保存/编辑/删除）都需要先导入私钥才会出现。 */
'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import GridView from './grid-view'

// 新建/编辑弹窗只有站主会打开，拆包让访客不下载上传与发布逻辑
const CreateDialog = dynamic(() => import('./components/create-dialog'), { ssr: false })
import { pushShares, type ShareRow } from './services/push-shares'
import { useAuthStore } from '@/hooks/use-auth'
import { confirmDialog } from '@/components/themed-dialog'
import initialList from './list.json'
import type { Share } from './components/share-card'
import type { LogoItem } from './components/logo-upload-dialog'

let rowSeed = 0
const nextKey = () => `share-${(rowSeed += 1)}-${Date.now().toString(36)}`

const toRows = (list: Share[]): ShareRow[] => list.map(item => ({ ...item, __key: nextKey() }))

export default function Page() {
    const [shares, setShares] = useState<ShareRow[]>(() => toRows(initialList as Share[]))
    const [originalShares, setOriginalShares] = useState<ShareRow[]>(shares)
    const [isEditMode, setIsEditMode] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [logoItems, setLogoItems] = useState<Map<string, LogoItem>>(new Map())
    const keyInputRef = useRef<HTMLInputElement>(null)
    /** 导入私钥之后要接着做的事 */
    const pendingActionRef = useRef<(() => void) | null>(null)

    const { isAuth, setPrivateKey } = useAuthStore()

    const requireAuth = (action: () => void) => {
        if (isAuth) {
            action()
            return
        }
        pendingActionRef.current = action
        keyInputRef.current?.click()
    }

    const handleUpdate = (updated: Share, old: Share, logoItem?: LogoItem) => {
        const key = (old as ShareRow).__key
        setShares(prev => prev.map(item => (item.__key === key ? { ...updated, __key: key } : item)))
        if (logoItem) setLogoItems(prev => new Map(prev).set(key, logoItem))
    }

    const handleAdd = () => {
        requireAuth(() => setIsCreateDialogOpen(true))
    }

    const handleSaveShare = (share: Share, logoItem?: LogoItem) => {
        const row: ShareRow = { ...share, __key: nextKey() }
        setShares(prev => [...prev, row])
        if (logoItem) setLogoItems(prev => new Map(prev).set(row.__key, logoItem))
    }

    const handleDelete = async (share: Share) => {
        const key = (share as ShareRow).__key
        const confirmed = await confirmDialog({
            title: '删除分享',
            message: `确定要删除 ${share.name} 吗？`,
            confirmText: '删除',
            danger: true
        })
        if (!confirmed) return

        setShares(prev => prev.filter(item => item.__key !== key))
        setLogoItems(prev => {
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
            const saved = await pushShares({ shares, logoItems })
            const rows = toRows(saved)

            setShares(rows)
            setOriginalShares(rows)
            setLogoItems(new Map())
            setIsEditMode(false)
        } catch (error: any) {
            console.error('Failed to save:', error)
            toast.error(`保存失败: ${error?.message || '未知错误'}`)
        } finally {
            setIsSaving(false)
        }
    }

    const handleCancel = () => {
        setShares(originalShares)
        setLogoItems(new Map())
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

            <GridView shares={shares} isEditMode={isEditMode} onUpdate={handleUpdate} onDelete={handleDelete} />

            <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className='absolute top-4 right-6 flex gap-3 max-sm:hidden'>
                {isEditMode ? (
                    <>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleCancel}
                            disabled={isSaving}
                            className='rounded-xl border bg-white/10 px-6 py-2 text-sm'>
                            取消
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleAdd}
                            disabled={isSaving}
                            className='rounded-xl border bg-white/10 px-6 py-2 text-sm'>
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
                        className='bg-card rounded-xl border px-6 py-2 text-sm backdrop-blur-sm transition-colors hover:bg-white/20'>
                        编辑
                    </motion.button>
                ) : null}
            </motion.div>

            {isCreateDialogOpen && <CreateDialog share={null} onClose={() => setIsCreateDialogOpen(false)} onSave={handleSaveShare} />}
        </>
    )
}
