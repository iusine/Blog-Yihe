/* 首图和文章入口。 */
import Card from '@/components/card'
import { useCenterStore } from '@/hooks/use-center'
import { useConfigStore } from './stores/config-store'
import { CARD_SPACING } from '@/consts'
import { useRouter } from 'next/navigation'
import { HomeDraggableLayer } from './home-draggable-layer'
import FootprintStatsView from '@/app/pictures/components/footprint-stats'
import { usePhotoFootprint } from '@/app/pictures/lib/footprint'

export default function ArtCard() {
    const center = useCenterStore()
    const { cardStyles, siteContent } = useConfigStore()
    const router = useRouter()
    const styles = cardStyles.artCard
    const hiCardStyles = cardStyles.hiCard

    const x = styles.offsetX !== null ? center.x + styles.offsetX : center.x - styles.width / 2
    const y = styles.offsetY !== null ? center.y + styles.offsetY : center.y - hiCardStyles.height / 2 - styles.height - CARD_SPACING

    const footprint = usePhotoFootprint()

    return (
        <HomeDraggableLayer cardKey='artCard' x={x} y={y} width={styles.width} height={styles.height}>
            <Card className='p-2 max-sm:static max-sm:translate-0' order={styles.order} width={styles.width} height={styles.height} x={x} y={y}>
                {siteContent.enableChristmas && (
                    <>
                        <img
                            src='/images/christmas/snow-3.webp'
                            alt='Christmas decoration'
                            className='pointer-events-none absolute'
                            style={{ width: 160, right: -8, top: -16, opacity: 0.9 }}
                        />
                    </>
                )}

                {/* 首图固定用 avatar.png：按卡片宽度铺满，上下裁切到这张卡片的比例 */}
                <img
                    onClick={() => router.push('/pictures')}
                    src='/images/avatar.png'
                    alt='wall art'
                    className='h-full w-full cursor-pointer rounded-[32px] object-cover object-center'
                />

                {/* 足迹入口条：底图用 avatar.png，按宽度铺满、上下裁切到这条的比例 */}
                <div
                    onClick={() => router.push('/pictures')}
                    className='absolute inset-x-4 bottom-4 h-12 cursor-pointer overflow-hidden rounded-2xl shadow-[0_12px_24px_-16px_rgba(60,40,30,0.85)] ring-1 ring-white/35 transition-transform duration-200 hover:-translate-y-0.5'>
                    <img
                        src='/images/avatar.png'
                        alt=''
                        aria-hidden
                        className='pointer-events-none absolute inset-0 h-full w-full object-cover object-center'
                    />
                    <span className='pointer-events-none absolute inset-0 bg-gradient-to-r from-[#2f2320]/80 via-[#2f2320]/52 to-[#2f2320]/28' />

                    <div className='relative flex h-full items-center justify-between gap-3 px-3.5'>
                        <span className='flex flex-col leading-none'>
                            <span className='text-[11px] font-semibold text-white'>我的足迹</span>
                            <span className='mt-1 text-[9px] text-white/75'>点开看旅行地图</span>
                        </span>
                        <FootprintStatsView stats={footprint} compact tone='light' />
                    </div>
                </div>
            </Card>
        </HomeDraggableLayer>
    )
}
