import { useCallback, useEffect, useState } from 'react'
import { CARE_TIPS, getCareTipSlide } from '../../../../utils/dashboardCare.js'
import SectionPanel from '../SectionPanel'
import styles from './CareTipCard.module.css'

const AUTO_ADVANCE_MS = 8000

export default function CareTipCard({ tipIndex: initialIndex = 0 }) {
  const [index, setIndex] = useState(() => initialIndex % CARE_TIPS.length)
  const slide = getCareTipSlide(index)

  const goTo = useCallback((next) => {
    setIndex(((next % CARE_TIPS.length) + CARE_TIPS.length) % CARE_TIPS.length)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex(i => (i + 1) % CARE_TIPS.length)
    }, AUTO_ADVANCE_MS)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <SectionPanel title="Care Tip" className={styles.wrap}>
      <div className={styles.inner}>
        <div
          className={styles.content}
          role="region"
          aria-roledescription="carousel"
          aria-label="Care tips"
        >
          <p key={index} className={styles.text} aria-live="polite">
            {slide.text}
          </p>
        </div>

        <div className={styles.dots} role="tablist" aria-label="Care tip slides">
          {CARE_TIPS.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Care tip ${i + 1} of ${CARE_TIPS.length}`}
              className={`${styles.dot} ${i === index ? styles.dotActive : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>

        <div className={styles.illustration} aria-hidden="true">
          <div className={styles.plantGlow} />
          <span key={slide.emoji} className={styles.plantEmoji} role="img" aria-label="">
            {slide.emoji}
          </span>
        </div>
      </div>
    </SectionPanel>
  )
}
