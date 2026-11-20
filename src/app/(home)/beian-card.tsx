import Card from '@/components/card'
import { useConfigStore } from './stores/config-store'
import { cardPosition } from './home-layout'
import Link from 'next/link'
import { HomeDraggableLayer } from './home-draggable-layer'

export default function BeianCard() {
    const { cardStyles, siteContent } = useConfigStore()
    const styles = cardStyles.beianCard
    const pos = cardPosition('beianCard', cardStyles)

    const beian = siteContent.beian

    if (!beian?.text) {
        return null
    }

    return (
        <HomeDraggableLayer cardKey='beianCard' left={pos.left} top={pos.top} offsetX={pos.offsetX} offsetY={pos.offsetY} width={styles.width} height={styles.height}>
            <Card order={styles.order} width={styles.width} height={styles.height} left={pos.left} top={pos.top} className='flex items-center justify-center max-sm:static'>
                {beian.link ? (
                    <Link href={beian.link} target='_blank' rel='noopener noreferrer' className='text-secondary text-xs transition-opacity hover:opacity-80'>
                        {beian.text}
                    </Link>
                ) : (
                    <span className='text-secondary text-xs'>{beian.text}</span>
                )}
            </Card>
        </HomeDraggableLayer>
    )
}
