import { motion } from 'motion/react'
import { useState } from 'react'
import { useConfigStore } from './stores/config-store'
import { cardPosition } from './home-layout'
import { useSize } from '@/hooks/use-size'
import { HomeDraggableLayer } from './home-draggable-layer'

export default function HatCard() {
    const { cardStyles, siteContent } = useConfigStore()
    const { maxSM } = useSize()
    const styles = cardStyles.hatCard
    const pos = cardPosition('hatCard', cardStyles)

    const [number, setNumber] = useState(1)

    const hatIndex = siteContent.currentHatIndex ?? 1
    const hatFlipped = siteContent.hatFlipped ?? false

    if (maxSM) return null

    return (
        <HomeDraggableLayer cardKey='hatCard' left={pos.left} top={pos.top} offsetX={pos.offsetX} offsetY={pos.offsetY} width={styles.width} height={styles.height}>
            <motion.div
                style={
                    {
                        position: 'absolute',
                        left: pos.left,
                        top: pos.top,
                        width: styles.width,
                        height: styles.height,
                        ['--card-delay' as string]: `${Math.min(styles.order, 3) * 100}ms`
                    } as React.CSSProperties
                }
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setNumber(number + 1)}
                className='card-enter flex h-full w-full items-center justify-center'>
                {new Array(number)
                    .fill(0)
                    .map((_, index) =>
                        index === 0 ? (
                            <img
                                key={index}
                                src={`/images/hats/${hatIndex}.webp`}
                                alt='hat'
                                className='h-full w-full object-contain'
                                style={{ width: styles.width, height: styles.height, transform: hatFlipped ? 'scaleX(-1)' : 'none' }}
                            />
                        ) : (
                            <img
                                key={index}
                                src={`/images/hats/${hatIndex}.webp`}
                                alt='hat'
                                className='absolute h-full w-full object-contain'
                                style={{ width: styles.width, height: styles.height, transform: hatFlipped ? 'scaleX(-1)' : 'none', bottom: index * 16 }}
                            />
                        )
                    )}
            </motion.div>
        </HomeDraggableLayer>
    )
}
