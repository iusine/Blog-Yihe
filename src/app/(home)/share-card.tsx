'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/card'
import PicbedImage from '@/components/picbed-image'
import { useConfigStore } from './stores/config-store'
import { cardPosition } from './home-layout'
import { CARD_SPACING } from '@/consts'
import shareList from '@/app/share/list.json'
import { HomeDraggableLayer } from './home-draggable-layer'

type ShareItem = {
    name: string
    url: string
    logo: string
    description: string
    tags: string[]
    stars: number
}

/** 和 GitHub / Telegram 两个按钮之间的间距保持一致（gap-3 = 12px） */
const BUTTON_GAP = 12

export default function ShareCard() {
    const { cardStyles } = useConfigStore()
    const [randomItem, setRandomItem] = useState<ShareItem | null>(null)
    const styles = cardStyles.shareCard
    const hiCardStyles = cardStyles.hiCard
    const socialButtonsStyles = cardStyles.socialButtons
    const musicCardStyles = cardStyles.musicCard
    const pos = cardPosition('shareCard', cardStyles)

    useEffect(() => {
        const randomIndex = Math.floor(Math.random() * shareList.length)
        setRandomItem(shareList[randomIndex])
    }, [])

    // 左边缘与留言墙卡片对齐；高度是留言墙的一半
    // 右边缘拉到离音乐播放器 12px（和 GitHub、Telegram 之间的间距一样）
    // 宽度只跟常量有关，不再依赖屏幕中心，所以服务端也能算出来
    const musicLeft = CARD_SPACING + hiCardStyles.width / 2 - musicCardStyles.offset
    const width = Math.max(styles.width, Math.round(musicLeft - BUTTON_GAP - pos.offsetX))

    return (
        <HomeDraggableLayer cardKey='shareCard' left={pos.left} top={pos.top} offsetX={pos.offsetX} offsetY={pos.offsetY} width={width} height={styles.height}>
            <Card order={styles.order} width={width} height={styles.height} left={pos.left} top={pos.top} className='flex flex-col justify-center gap-1.5 !p-4 max-sm:static'>
                <h2 className='text-secondary text-[11px] leading-none'>随机推荐分享</h2>

                {randomItem ? (
                    <a
                        href={randomItem.url}
                        target='_blank'
                        rel='noreferrer'
                        title={randomItem.name}
                        className='flex min-w-0 items-center gap-3 transition-opacity hover:opacity-80'>
                        <span className='relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border bg-white/10 p-1'>
                            <PicbedImage src={randomItem.logo} alt={randomItem.name} className='h-full w-full object-contain' />
                        </span>

                        <span className='min-w-0 flex-1 truncate text-sm font-medium'>{randomItem.name}</span>
                    </a>
                ) : (
                    // 推荐内容是每次打开随机抽的，服务端拿不到，先占住这一行的高度，
                    // 卡片本体和标题首屏就在，内容水合后立刻补上
                    <div className='h-9' aria-hidden />
                )}
            </Card>
        </HomeDraggableLayer>
    )
}
