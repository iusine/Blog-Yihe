import { ANIMATION_DELAY, CARD_SPACING } from '@/consts'
import PenSVG from '@/svgs/pen.svg'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useConfigStore } from './stores/config-store'
import { useCenterStore } from '@/hooks/use-center'
import { useRouter } from 'next/navigation'
import { useSize } from '@/hooks/use-size'
import { useAuthStore } from '@/hooks/use-auth'
import { HomeDraggableLayer } from './home-draggable-layer'

export default function WriteButton() {
    const center = useCenterStore()
    const { cardStyles, siteContent } = useConfigStore()
    const { maxSM } = useSize()
    const router = useRouter()
    const styles = cardStyles.writeButtons
    const hiCardStyles = cardStyles.hiCard
    const clockCardStyles = cardStyles.clockCard

    // [新增] 写作前必须先导入私钥（配置弹窗已删除，私钥入口统一挪到这里）
    const { isAuth, setPrivateKey } = useAuthStore()
    const keyInputRef = useRef<HTMLInputElement>(null)

    const [show, setShow] = useState(false)

    useEffect(() => {
        setTimeout(() => setShow(true), styles.order * ANIMATION_DELAY * 1000)
    }, [styles.order])

    const handleWriteClick = () => {
        if (isAuth) {
            router.push('/write')
            return
        }
        // 没授权就先弹私钥选择，导入成功后再进编辑器
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
            toast.success('私钥已导入，开始写作吧')
            router.push('/write')
        } catch (error) {
            console.error('Failed to read private key:', error)
            toast.error('读取密钥文件失败')
        }
    }

    if (maxSM) return null

    if (!show) return null

    const x = styles.offsetX !== null ? center.x + styles.offsetX : center.x + CARD_SPACING + hiCardStyles.width / 2
    const y = styles.offsetY !== null ? center.y + styles.offsetY : center.y - clockCardStyles.offset - styles.height - CARD_SPACING / 2 - clockCardStyles.height

    return (
        <HomeDraggableLayer cardKey='writeButtons' x={x} y={y} width={styles.width} height={styles.height}>
            <motion.div initial={{ left: x, top: y }} animate={{ left: x, top: y }} className='absolute flex items-center gap-4'>
                <motion.button
                    onClick={handleWriteClick}
                    title={isAuth ? '写文章' : '首次写作需要先导入 .pem 私钥'}
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
                    <span>写文章</span>
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
    )
}
