/* 全站导航菜单、菜单名称和链接。
 * 位置由 cardPosition 算成 CSS 表达式，服务端渲染即可见；
 * 手机端的宽度/位置交给 .nav-card-mobile 的媒体查询，不再依赖 JS 量视口。 */
'use client'

import Card from '@/components/card'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { cardPosition } from '@/app/(home)/home-layout'
import ScrollOutlineSVG from '@/svgs/scroll-outline.svg'
import ScrollFilledSVG from '@/svgs/scroll-filled.svg'
import PenSVG from '@/svgs/pen.svg'
import PenActiveSVG from '@/svgs/pen.svg'
import ProjectsFilledSVG from '@/svgs/projects-filled.svg'
import ProjectsOutlineSVG from '@/svgs/projects-outline.svg'
import ShareFilledSVG from '@/svgs/share-filled.svg'
import ShareOutlineSVG from '@/svgs/share-outline.svg'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { cn } from '@/lib/utils'
import { useSize } from '@/hooks/use-size'
import { useConfigStore } from '@/app/(home)/stores/config-store'
import { HomeDraggableLayer } from '@/app/(home)/home-draggable-layer'
import { Compass } from 'lucide-react'

const list = [
    {
        icon: ScrollOutlineSVG,
        iconActive: ScrollFilledSVG,
        label: '近期文章',
        href: '/blog'
    },
    {
        icon: PenSVG,
        iconActive: PenActiveSVG,
        label: '随笔文案',
        href: '/essay'
    },
    {
        icon: ProjectsOutlineSVG,
        iconActive: ProjectsFilledSVG,
        label: '我的项目',
        href: '/projects'
    },
    {
        icon: ShareOutlineSVG,
        iconActive: ShareFilledSVG,
        label: '推荐分享',
        href: '/share'
    },
    {
        icon: Compass,
        iconActive: Compass,
        label: '了解更多',
        href: '/more'
    }
]

const extraSize = 8

export default function NavCard() {
    const pathname = usePathname()
    const { maxSM, init } = useSize()
    const [hoveredIndex, setHoveredIndex] = useState<number>(0)
    const { siteContent, cardStyles } = useConfigStore()
    const styles = cardStyles.navCard
    const pos = cardPosition('navCard', cardStyles)

    const activeIndex = useMemo(() => {
        const index = list.findIndex(item => pathname === item.href)
        return index >= 0 ? index : undefined
    }, [pathname])

    // 形态只跟路由有关（视口宽度交给 CSS 的 max-sm 处理），这样服务端就能定下来
    const form = pathname === '/' ? 'full' : pathname === '/write' ? 'mini' : 'icons'

    // 手机端实际上一直是图标形态
    const visualForm = form === 'full' && maxSM && init ? 'icons' : form
    const itemHeight = visualForm === 'full' ? 52 : 28

    const position = useMemo(() => {
        if (form === 'full') return { left: pos.left, top: pos.top }
        return { left: '24px', top: '16px' }
    }, [form, pos.left, pos.top])

    const size = useMemo(() => {
        if (form === 'mini') return { width: 64, height: 64 }
        else if (form === 'icons') return { width: 340, height: 64 }
        return { width: styles.width, height: styles.height }
    }, [form, styles.width, styles.height])

    useEffect(() => {
        if (form === 'icons' && activeIndex !== undefined && hoveredIndex !== activeIndex) {
            const timer = setTimeout(() => {
                setHoveredIndex(activeIndex)
            }, 1500)
            return () => clearTimeout(timer)
        }
    }, [hoveredIndex, activeIndex, form])

    return (
        <HomeDraggableLayer cardKey='navCard' left={position.left} top={position.top} offsetX={pos.offsetX} offsetY={pos.offsetY} width={styles.width} height={styles.height}>
            <Card
                order={styles.order}
                width={size.width}
                height={size.height}
                left={position.left}
                top={position.top}
                className={clsx(
                    // 手机端的位置/尺寸交给 CSS；mini（写作页那一颗）保持自己的 64×64
                    form !== 'mini' && 'nav-card-mobile',
                    form === 'mini' && 'p-3',
                    form === 'icons' && 'flex items-center gap-6 overflow-hidden p-3',
                    form === 'full' && 'max-sm:flex max-sm:items-center max-sm:gap-6 max-sm:overflow-hidden max-sm:p-3'
                )}>
                {form === 'full' && siteContent.enableChristmas && (
                    <>
                        <img
                            src='/images/christmas/snow-4.webp'
                            alt='Christmas decoration'
                            className='pointer-events-none absolute max-sm:hidden'
                            style={{ width: 160, left: -18, top: -20, opacity: 0.9 }}
                        />
                    </>
                )}

                <Link className='flex items-center gap-3' href='/'>
                    {/* 用 256×256 的站内副本（92KB）；图床里的原图是 16MB，误走优化器会拖慢首屏 */}
                    <Image
                        src='/images/avatar.png'
                        alt='avatar'
                        width={40}
                        height={40}
                        priority
                        style={{ boxShadow: ' 0 12px 20px -5px #E2D9CE' }}
                        className='rounded-full'
                    />
                    {form === 'full' && <span className='font-averia mt-1 text-2xl leading-none font-medium max-sm:hidden'>{siteContent.meta.title}</span>}
                    {form === 'full' && <span className='text-brand mt-2 text-xs font-medium max-sm:hidden'></span>}
                </Link>

                {form !== 'mini' && (
                    <>
                        {form !== 'icons' && <div className='text-secondary mt-6 text-sm uppercase max-sm:hidden'></div>}

                        <div className={cn('relative mt-2 space-y-2', form === 'icons' && 'mt-0 flex items-center gap-6 space-y-0', form === 'full' && 'max-sm:mt-0 max-sm:flex max-sm:items-center max-sm:gap-6 max-sm:space-y-0')}>
                            {/* 悬停滑块依赖真实尺寸，等挂载后再画，避免首帧位置算错 */}
                            {init && (
                                <motion.div
                                    className='nav-hover-pill absolute max-w-[230px] rounded-full border max-sm:hidden'
                                    layoutId='nav-hover'
                                    initial={false}
                                    animate={
                                        visualForm === 'icons'
                                            ? {
                                                left: hoveredIndex * (itemHeight + 24) - extraSize,
                                                top: -extraSize,
                                                width: itemHeight + extraSize * 2,
                                                height: itemHeight + extraSize * 2
                                            }
                                            : { top: hoveredIndex * (itemHeight + 8), left: 0, width: '100%', height: itemHeight }
                                    }
                                    transition={{
                                        type: 'spring',
                                        stiffness: 400,
                                        damping: 30
                                    }}
                                    style={{ backgroundImage: 'linear-gradient(to right bottom, var(--color-border) 60%, var(--color-card) 100%)' }}
                                />
                            )}

                            {list.map((item, index) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        'text-secondary text-md relative z-10 flex items-center gap-3 rounded-full px-5 py-3',
                                        form === 'icons' && 'p-0',
                                        form === 'full' && 'max-sm:px-0 max-sm:py-0'
                                    )}
                                    onMouseEnter={() => setHoveredIndex(index)}>
                                    <div className='flex h-7 w-7 items-center justify-center'>
                                        {hoveredIndex == index ? <item.iconActive className='text-brand absolute h-7 w-7' /> : <item.icon className='absolute h-7 w-7' />}
                                    </div>
                                    {form !== 'icons' && <span className={clsx('max-sm:hidden', index == hoveredIndex && 'text-primary font-medium')}>{item.label}</span>}
                                </Link>
                            ))}
                        </div>
                    </>
                )}
            </Card>
        </HomeDraggableLayer>
    )
}
