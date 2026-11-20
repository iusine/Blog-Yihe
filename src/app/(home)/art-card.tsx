/* 首图和文章入口。 */
import Card from '@/components/card'
import { useConfigStore } from './stores/config-store'
import { cardPosition } from './home-layout'
import { useRouter } from 'next/navigation'
import { HomeDraggableLayer } from './home-draggable-layer'
import FootprintStatsView from '@/app/pictures/components/footprint-stats'
import { usePhotoFootprint } from '@/app/pictures/lib/footprint'

export default function ArtCard() {
    const { cardStyles, siteContent } = useConfigStore()
    const router = useRouter()
    const styles = cardStyles.artCard
    const pos = cardPosition('artCard', cardStyles)

    const footprint = usePhotoFootprint()

    return (
        <HomeDraggableLayer cardKey='artCard' left={pos.left} top={pos.top} offsetX={pos.offsetX} offsetY={pos.offsetY} width={styles.width} height={styles.height}>
            <Card className='overflow-hidden !p-0 max-sm:static max-sm:translate-0' order={styles.order} width={styles.width} height={styles.height} left={pos.left} top={pos.top}>
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

                <button
                    type='button'
                    onClick={() => router.push('/pictures')}
                    className='absolute inset-0 flex h-full w-full items-center justify-center rounded-[40px] border-0 bg-transparent px-6 pb-16 text-white'>
                    <span className='flex w-full max-w-none flex-col text-[15px] leading-relaxed text-white'>
                        <span className='text-center text-[14px] whitespace-nowrap'>每抵达一处新的角落，会对这个世界多一分了解。</span>
                    </span>
                </button>

                {/* 足迹入口条：底图用 avatar.png，按宽度铺满、上下裁切到这条的比例 */}
                <div
                    onClick={() => router.push('/pictures')}
                    className='art-footprint-strip absolute inset-x-4 bottom-4 h-12 cursor-pointer overflow-hidden rounded-2xl border-0 p-0 shadow-[0_12px_24px_-16px_rgba(60,40,30,0.85)] ring-1 ring-white/35 transition-transform duration-200 hover:-translate-y-0.5'>
                    <img
                        src='/images/avatar.png'
                        alt=''
                        aria-hidden
                        className='pointer-events-none absolute inset-0 h-full w-full rounded-[inherit] object-cover object-center'
                    />
                    <span className='art-cover-overlay pointer-events-none absolute inset-0 bg-gradient-to-r from-[#2f2320]/80 via-[#2f2320]/52 to-[#2f2320]/28' />

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
