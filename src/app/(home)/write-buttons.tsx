import { ANIMATION_DELAY, CARD_SPACING } from '@/consts'
import PenSVG from '@/svgs/pen.svg'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useConfigStore } from './stores/config-store'
import { useCenterStore } from '@/hooks/use-center'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/hooks/use-auth'
import { HomeDraggableLayer } from './home-draggable-layer'
import { DialogModal } from '@/components/dialog-modal'

// 身份认证口令的编码值（2333 → MjMzMw==），避免在界面代码中直接显示口令。
const AUTH_PASSWORD_CODE = 'MjMzMw=='

export default function WriteButton() {
    const center = useCenterStore()
    const { cardStyles, siteContent } = useConfigStore()
    const router = useRouter()
    const styles = cardStyles.writeButtons
    const hiCardStyles = cardStyles.hiCard
    const clockCardStyles = cardStyles.clockCard

    // [新增] 写作前必须先导入私钥（配置弹窗已删除，私钥入口统一挪到这里）
    const { isAuth, setPrivateKey } = useAuthStore()
    const keyInputRef = useRef<HTMLInputElement>(null)

    const [show, setShow] = useState(false)
    const [authOpen, setAuthOpen] = useState(false)
    const [password, setPassword] = useState('')
    const [authError, setAuthError] = useState('')

    useEffect(() => {
        setTimeout(() => setShow(true), styles.order * ANIMATION_DELAY * 1000)
    }, [styles.order])

    const handleWriteClick = () => {
        if (isAuth) {
            router.push('/write')
            return
        }
        setPassword('')
        setAuthError('')
        setAuthOpen(true)
    }

    const verifyPassword = () => {
        if (!/^\d+$/.test(password) || window.btoa(password) !== AUTH_PASSWORD_CODE) {
            setAuthError('密码不正确，请重新输入')
            setPassword('')
            return
        }
        setAuthOpen(false)
        // 密码正确后才允许选择 PEM，导入成功后再进入写作。
        keyInputRef.current?.click()
    }

    const handleKeyFile = async (file: File) => {
        try {
            const text = await file.text()
            if (!/BEGIN [A-Z ]*PRIVATE KEY/.test(text)) {
                toast.error('这不是有效的 .pem 私钥文件')
                return
            }
            await setPrivateKey(text)
            toast.success('身份认证成功，站主功能已开放')
        } catch (error) {
            console.error('Failed to read private key:', error)
            toast.error('读取密钥文件失败')
        }
    }

    if (!show) return null

    const x = styles.offsetX !== null ? center.x + styles.offsetX : center.x + CARD_SPACING + hiCardStyles.width / 2
    const y = styles.offsetY !== null ? center.y + styles.offsetY : center.y - clockCardStyles.offset - styles.height - CARD_SPACING / 2 - clockCardStyles.height

    return (
        <>
        <HomeDraggableLayer cardKey='writeButtons' x={x} y={y} width={styles.width} height={styles.height}>
            <motion.div initial={{ left: x, top: y }} animate={{ left: x, top: y }} className='absolute flex items-center gap-4 max-sm:static'>
                <motion.button
                    onClick={handleWriteClick}
                    title={isAuth ? '写文章' : '身份认证：导入 .pem 私钥'}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{ boxShadow: 'inset 0 0 12px rgba(255, 255, 255, 0.4)' }}
                    className='brand-btn whitespace-nowrap'>
                    {siteContent.enableChristmas && (
                        <>
                            <img
                                src='/images/christmas/snow-8.webp'
                                alt='Christmas decoration'
                                className='pointer-events-none absolute'
                                style={{ width: 60, left: -2, top: -4, opacity: 0.95 }}
                            />
                        </>
                    )}

                    <PenSVG />
                    <span>{isAuth ? '写文章' : '身份认证'}</span>
                </motion.button>

                <input
                    ref={keyInputRef}
                    type='file'
                    accept='.pem'
                    className='hidden'
                    onChange={async event => {
                        const file = event.target.files?.[0]
                        if (file) await handleKeyFile(file)
                        if (event.currentTarget) event.currentTarget.value = ''
                    }}
                />
            </motion.div>
        </HomeDraggableLayer>
        <DialogModal open={authOpen} onClose={() => setAuthOpen(false)} className='card w-[min(380px,92vw)] p-6'>
            <form onSubmit={event => { event.preventDefault(); verifyPassword() }}>
                <div className='mb-5 text-center'>
                    <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/15 text-2xl'>🔐</div>
                    <h2 className='mt-3 text-lg font-semibold text-white'>身份认证</h2>
                    <p className='text-secondary mt-1 text-xs'>请输入认证密码后导入 PEM 私钥</p>
                </div>
                <input autoFocus value={password} onChange={event => { setPassword(event.target.value.replace(/\D/g, '')); setAuthError('') }} inputMode='numeric' type='password' placeholder='输入密码后进行密钥认证' className='focus:ring-brand w-full rounded-lg border bg-white/10 px-3 py-2.5 text-center tracking-[0.2em] text-white outline-none focus:ring-2' />
                {authError && <p className='mt-2 text-center text-xs text-red-300'>{authError}</p>}
                <div className='mt-5 flex gap-3'>
                    <button type='button' onClick={() => setAuthOpen(false)} className='flex-1 rounded-lg border bg-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/15'>取消</button>
                    <button type='submit' className='brand-btn flex-1 justify-center rounded-lg px-4 py-2 text-sm'>继续</button>
                </div>
            </form>
        </DialogModal>
        </>
    )
}
