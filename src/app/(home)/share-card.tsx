'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/card'
import { useCenterStore } from '@/hooks/use-center'
import { useConfigStore } from './stores/config-store'
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
    const center = useCenterStore()
    const { cardStyles } = useConfigStore()
    const [randomItem, setRandomItem] = useState<ShareItem | null>(null)
    const styles = cardStyles.shareCard
    const hiCardStyles = cardStyles.hiCard
    const socialButtonsStyles = cardStyles.socialButtons
    const musicCardStyles = cardStyles.musicCard

    useEffect(() => {
        const randomIndex = Math.floor(Math.random() * shareList.length)
        setRandomItem(shareList[randomIndex])
    }, [])

    if (!randomItem) {
        return null
    }

    // 左边缘与留言墙卡片对齐；高度是留言墙的一半
    const x = styles.offsetX !== null ? center.x + styles.offsetX : center.x - hiCardStyles.width / 2
    const y = styles.offsetY !== null ? center.y + styles.offsetY : center.y + hiCardStyles.height / 2 + CARD_SPACING + socialButtonsStyles.height + CARD_SPACING

    // 右边缘拉到离音乐播放器 12px（和 GitHub、Telegram 之间的间距一样）
    const musicLeft = center.x + CARD_SPACING + hiCardStyles.width / 2 - musicCardStyles.offset
    const width = Math.max(styles.width, Math.round(musicLeft - BUTTON_GAP - x))

    return (
        <HomeDraggableLayer cardKey='shareCard' x={x} y={y} width={width} height={styles.height}>
            <Card order={styles.order} width={width} height={styles.height} x={x} y={y} className='flex flex-col justify-center gap-1.5 !p-4 max-sm:static'>
                <h2 className='text-secondary text-[11px] leading-none'>随机推荐分享</h2>

                <a
                    href={randomItem.url}
                    target='_blank'
                    rel='noreferrer'
                    title={randomItem.name}
                    className='flex min-w-0 items-center gap-3 transition-opacity hover:opacity-80'>
                    <span className='relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border bg-white/10 p-1'>
                        <img src={randomItem.logo} alt={randomItem.name} className='h-full w-full object-contain' />
                    </span>

                    <span className='min-w-0 flex-1 truncate text-sm font-medium'>{randomItem.name}</span>
                </a>
            </Card>
        </HomeDraggableLayer>
    )
}
