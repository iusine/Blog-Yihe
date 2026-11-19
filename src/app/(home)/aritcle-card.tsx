/* 首图和文章入口。 */
import Card from '@/components/card'
import PicbedImage from '@/components/picbed-image'
import { useCenterStore } from '@/hooks/use-center'
import { useLatestBlog } from '@/hooks/use-blog-index'
import { useConfigStore } from './stores/config-store'
import { CARD_SPACING } from '@/consts'
import dayjs from 'dayjs'
import Link from 'next/link'
import { HomeDraggableLayer } from './home-draggable-layer'

export default function ArticleCard() {
    const center = useCenterStore()
    const { cardStyles, siteContent } = useConfigStore()
    const { blog, loading } = useLatestBlog()
    const styles = cardStyles.articleCard
    const hiCardStyles = cardStyles.hiCard
    const navCardStyles = cardStyles.navCard

    // 左边缘与左侧导航卡对齐（原来按社交按钮宽度算，右边会往里缩一截）
    const x = styles.offsetX !== null ? center.x + styles.offsetX : center.x - hiCardStyles.width / 2 - navCardStyles.width - CARD_SPACING
    const y = styles.offsetY !== null ? center.y + styles.offsetY : center.y + hiCardStyles.height / 2 + CARD_SPACING

    return (
        <HomeDraggableLayer cardKey='articleCard' x={x} y={y} width={styles.width} height={styles.height}>
            <Card order={styles.order} width={styles.width} height={styles.height} x={x} y={y} className='space-y-2 max-sm:static'>
                {siteContent.enableChristmas && (
                    <>
                        <img
                            src='/images/christmas/snow-9.webp'
                            alt='Christmas decoration'
                            className='pointer-events-none absolute'
                            style={{ width: 140, left: -12, top: -16, opacity: 0.8 }}
                        />
                    </>
                )}

                <div className='flex items-baseline justify-between gap-2'>
                    <h2 className='text-secondary text-sm'>最新文章</h2>
                    {!loading && blog && <span className='text-secondary shrink-0 text-xs'>{dayjs(blog.date).format('YYYY/M/D')}</span>}
                </div>

                {loading ? (
                    <div className='flex h-[60px] items-center justify-center'>
                        <span className='text-secondary text-xs'>加载中...</span>
                    </div>
                ) : blog ? (
                    <Link href={`/blog/${blog.slug}`} className='flex min-w-0 transition-opacity hover:opacity-80'>
                        {blog.cover ? (
                            <PicbedImage src={blog.cover} alt='cover' className='mr-3 h-12 w-12 shrink-0 rounded-xl border object-cover' />
                        ) : (
                            <div className='text-secondary mr-3 grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10'>+</div>
                        )}
                        <div className='min-w-0 flex-1'>
                            <h3 className='line-clamp-1 text-sm font-medium'>{blog.title || blog.slug}</h3>
                            {blog.summary && <p className='text-secondary mt-1 line-clamp-2 text-xs'>{blog.summary}</p>}
                        </div>
                    </Link>
                ) : (
                    <div className='flex h-[60px] items-center justify-center'>
                        <span className='text-secondary text-xs'>暂无文章</span>
                    </div>
                )}
            </Card>
        </HomeDraggableLayer>
    )
}
