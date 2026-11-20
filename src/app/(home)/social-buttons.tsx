import GithubSVG from '@/svgs/github.svg'
import { useConfigStore } from './stores/config-store'
import JuejinSVG from '@/svgs/juejin.svg'
import EmailSVG from '@/svgs/email.svg'
import XSVG from '@/svgs/x.svg'
import TgSVG from '@/svgs/tg.svg'
import WechatSVG from '@/svgs/wechat.svg'
import FacebookSVG from '@/svgs/facebook.svg'
import TiktokSVG from '@/svgs/tiktok.svg'
import InstagramSVG from '@/svgs/instagram.svg'
import WeiboSVG from '@/svgs/weibo.svg'
import XiaohongshuSVG from '@/svgs/小红书.svg'
import ZhihuSVG from '@/svgs/知乎.svg'
import BilibiliSVG from '@/svgs/哔哩哔哩.svg'
import QqSVG from '@/svgs/qq.svg'
import { motion, AnimatePresence } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { toast } from 'sonner'
import { HomeDraggableLayer } from './home-draggable-layer'
import { cardPosition } from './home-layout'
import { createPortal } from 'react-dom'

type SocialButtonType =
    | 'github'
    | 'juejin'
    | 'email'
    | 'link'
    | 'x'
    | 'tg'
    | 'wechat'
    | 'facebook'
    | 'tiktok'
    | 'instagram'
    | 'weibo'
    | 'xiaohongshu'
    | 'zhihu'
    | 'bilibili'
    | 'qq'

interface SocialButtonConfig {
    id: string
    type: SocialButtonType
    value: string
    label?: string
    order: number
}

export default function SocialButtons() {
    const { cardStyles, siteContent } = useConfigStore()
    const styles = cardStyles.socialButtons
    const pos = cardPosition('socialButtons', cardStyles)

    const sortedButtons = useMemo(() => {
        const buttons = (siteContent.socialButtons || []) as SocialButtonConfig[]
        return [...buttons].sort((a, b) => a.order - b.order)
    }, [siteContent.socialButtons])

    const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({})
    const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({})
    const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({})

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node
            Object.keys(openDropdowns).forEach(buttonId => {
                if (openDropdowns[buttonId]) {
                    const buttonRef = buttonRefs.current[buttonId]
                    const dropdownRef = dropdownRefs.current[buttonId]
                    if (buttonRef && !buttonRef.contains(target) && dropdownRef && !dropdownRef.contains(target)) {
                        setOpenDropdowns(prev => ({ ...prev, [buttonId]: false }))
                    }
                }
            })
        }

        if (Object.values(openDropdowns).some(Boolean)) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => {
                document.removeEventListener('mousedown', handleClickOutside)
            }
        }
    }, [openDropdowns])

    const iconMap: Record<SocialButtonType, React.ComponentType<{ className?: string }>> = {
        github: GithubSVG,
        juejin: JuejinSVG,
        email: EmailSVG,
        wechat: WechatSVG,
        x: XSVG,
        tg: TgSVG,
        facebook: FacebookSVG,
        tiktok: TiktokSVG,
        instagram: InstagramSVG,
        weibo: WeiboSVG,
        xiaohongshu: XiaohongshuSVG,
        zhihu: ZhihuSVG,
        bilibili: BilibiliSVG,
        qq: QqSVG,
        link: () => null
    }

    const renderButton = (button: SocialButtonConfig, index: number) => {
        // 图标逐个冒出来的效果仍然保留，只是改成 CSS 延迟：
        // HTML 一到就开始，不需要等 JS 里的 setTimeout 排队
        const delayStyle = { '--card-delay': `${Math.min(index * 20, 120)}ms` } as React.CSSProperties

        const commonProps = {
            whileHover: { scale: 1.05 } as const,
            whileTap: { scale: 0.95 } as const,
            style: delayStyle,
            className: 'card-enter'
        }

        const Icon = iconMap[button.type]
        const hasLabel = Boolean(button.label)
        const iconSize = hasLabel ? 'size-6' : 'size-8'

        if (button.type === 'email') {
            return (
                <motion.a
                    key={button.id}
                    href={`mailto:${button.value}`}
                    aria-label='给我发邮件'
                    {...commonProps}
                    className={`card card-enter relative rounded-xl font-medium whitespace-nowrap ${hasLabel ? 'flex items-center gap-2 px-3 py-2.5' : 'p-1.5'}`}>
                    <Icon className={iconSize} />
                    {hasLabel && button.label}
                </motion.a>
            )
        }

        if (button.type === 'wechat' || button.type === 'qq') {
            const messageMap: Record<'wechat' | 'qq', string> = {
                wechat: '微信号已复制到剪贴板',
                qq: 'QQ号已复制到剪贴板'
            }

            const isImagePath = button.value.startsWith('/images/social-buttons/')
            const isOpen = openDropdowns[button.id] || false

            if (isImagePath && (button.type === 'wechat' || button.type === 'qq')) {
                return (
                    <div key={button.id} className='relative'>
                        <motion.button
                            ref={el => {
                                buttonRefs.current[button.id] = el
                            }}
                            onClick={() => {
                                setOpenDropdowns(prev => ({ ...prev, [button.id]: !prev[button.id] }))
                            }}
                            {...commonProps}
                            className='card card-enter btn relative rounded-xl p-1.5'>
                            <Icon className='size-8' />
                        </motion.button>
                        {typeof window !== 'undefined' &&
                            createPortal(
                                <AnimatePresence>
                                    {isOpen && (
                                        <>
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                onClick={() => setOpenDropdowns(prev => ({ ...prev, [button.id]: false }))}
                                                className='fixed inset-0 z-40'
                                            />
                                            <motion.div
                                                ref={el => {
                                                    dropdownRefs.current[button.id] = el
                                                }}
                                                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                                transition={{ duration: 0.2 }}
                                                className='bg-card fixed z-50 rounded-2xl border p-4 backdrop-blur-xl'
                                                style={{
                                                    top: buttonRefs.current[button.id] ? `${buttonRefs.current[button.id]!.getBoundingClientRect().bottom + 8}px` : '0px',
                                                    left: buttonRefs.current[button.id] ? `${buttonRefs.current[button.id]!.getBoundingClientRect().left}px` : '0px',
                                                    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                                                }}>
                                                <img src={button.value} alt='QR Code' className='h-48 w-48 rounded-lg object-cover' />
                                            </motion.div>
                                        </>
                                    )}
                                </AnimatePresence>,
                                document.body
                            )}
                    </div>
                )
            }

            return (
                <motion.button
                    key={button.id}
                    onClick={() => {
                        navigator.clipboard.writeText(button.value).then(() => {
                            toast.success(messageMap[button.type as 'wechat' | 'qq'])
                        })
                    }}
                    {...commonProps}
                    className='card card-enter btn relative rounded-xl p-1.5'>
                    <Icon className='size-8' />
                </motion.button>
            )
        }

        if (button.type === 'link') {
            return (
                <motion.a
                    key={button.id}
                    href={button.value}
                    target='_blank'
                    {...commonProps}
                    className='card card-enter relative flex items-center gap-2 rounded-xl px-3 py-2.5 font-medium whitespace-nowrap'>
                    {hasLabel ? button.label : button.value}
                </motion.a>
            )
        }

        return (
            <motion.a
                key={button.id}
                href={button.value}
                target='_blank'
                {...commonProps}
                className={`card card-enter relative rounded-xl font-medium whitespace-nowrap ${hasLabel ? 'flex items-center gap-2 px-3 py-2.5' : 'p-1.5'}`}>
                <Icon className={iconSize} />
                {hasLabel && button.label}
            </motion.a>
        )
    }

    return (
        <HomeDraggableLayer cardKey='socialButtons' left={pos.left} top={pos.top} offsetX={pos.offsetX} offsetY={pos.offsetY} width={styles.width} height={styles.height}>
            <div className='absolute max-sm:static' style={{ left: pos.left, top: pos.top }}>
                <div className='absolute top-0 left-0 flex flex-row-reverse items-center justify-center gap-3 max-sm:static' style={{ width: styles.width }}>
                    {sortedButtons.map((button, index) => renderButton(button, index))}
                </div>
            </div>
        </HomeDraggableLayer>
    )
}
