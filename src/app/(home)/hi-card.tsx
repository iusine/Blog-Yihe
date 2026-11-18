/* 中央介绍卡片：留言墙入口。 */
import { useCenterStore } from '@/hooks/use-center'
import Card from '@/components/card'
import { useConfigStore } from './stores/config-store'
import { HomeDraggableLayer } from './home-draggable-layer'
import Link from 'next/link'

/** 按时间段给一句中文问候 */
function getGreeting() {
    const hour = new Date().getHours()

    if (hour >= 5 && hour < 11) {
        return '早上好'
    } else if (hour >= 11 && hour < 13) {
        return '中午好'
    } else if (hour >= 13 && hour < 18) {
        return '下午好'
    } else if (hour >= 18 && hour < 23) {
        return '晚上好'
    } else {
        return '夜深了'
    }
}

export default function HiCard() {
    const center = useCenterStore()
    const { cardStyles } = useConfigStore()
    const greeting = getGreeting()
    const styles = cardStyles.hiCard

    const x = styles.offsetX !== null ? center.x + styles.offsetX : center.x - styles.width / 2
    const y = styles.offsetY !== null ? center.y + styles.offsetY : center.y - styles.height / 2

    return (
        <HomeDraggableLayer cardKey='hiCard' x={x} y={y} width={styles.width} height={styles.height}>
            <Card order={styles.order} width={styles.width} height={styles.height} x={x} y={y} className='relative text-center max-sm:static max-sm:translate-0'>
                <Link href='/message' className='flex h-full flex-col items-center justify-center gap-1.5'>
                    <span className='font-averia text-linear -translate-y-2.5 text-[40px] leading-none'>留言墙</span>

                    <span className='text-secondary mt-1 text-sm'>{greeting}</span>

                    <p className='mt-2 max-w-[260px] text-[15px] leading-relaxed text-white'>
                        我是<span className='text-linear text-[22px]'>一禾</span>，欢迎来到我的网站，可以留下你的足迹。
                    </p>

                    <span className='text-secondary mt-2 text-[11px] transition-colors hover:text-white'>点这里进入留言墙 →</span>
                </Link>
            </Card>
        </HomeDraggableLayer>
    )
}
