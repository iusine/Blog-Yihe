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

    const artImages = siteContent.artImages ?? []
    const currentId = siteContent.currentArtImageId
    const currentArt = (currentId ? artImages.find(item => item.id === currentId) : undefined) ?? artImages[0]
    const artUrl = currentArt?.url || '/images/art/cat.png'
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

                <img onClick={() => router.push('/pictures')} src={artUrl} alt='wall art' className='h-full w-full rounded-[32px] object-cover' />

                {/* 足迹入口条：参考高德足迹，点图片进地图页 */}
                <div
                    onClick={() => router.push('/pictures')}
                    className='absolute inset-x-4 bottom-4 flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-white/72 px-3.5 py-2 backdrop-blur-md transition-colors hover:bg-white/88'>
                    <span className='flex flex-col leading-none'>
                        <span className='text-[11px] font-semibold text-[#5B423F]'>我的足迹</span>
                        <span className='text-secondary mt-1 text-[9px]'>点开看旅行地图</span>
                    </span>
                    <FootprintStatsView stats={footprint} compact />
                </div>
            </Card>
        </HomeDraggableLayer>
    )
}
