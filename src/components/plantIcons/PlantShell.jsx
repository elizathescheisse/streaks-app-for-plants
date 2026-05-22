import styles from './plantIcons.module.css'

// Shared shell for animated plant icons.
//
// Owns everything that's the same across species:
//   - The SVG element + health-state className
//   - Soft shadow under the pot
//   - The .sway group that wraps the plant body (children)
//   - The terracotta pot (drawn after .sway so swinging leaves cross in front)
//   - The two thriving-state sparkles
//   - Reduced-motion handling (in plantIcons.module.css)
//
// Each species component supplies the geometry that's unique to that plant:
//   defs        — <symbol> definitions reused by the species (optional)
//   children    — stems + leaves, rendered inside the swaying group
//   fallenLeaf  — a <use>/<path> rendered after the pot, visible only when
//                 .struggling (faded in via CSS). Shape should match the
//                 species' leaves so it looks like one of them dropped off.
//                 Optional — plants without leaves (e.g. cacti) skip this.
//
// The shell uses a fixed 240×240 viewBox; plants should be drawn within
// roughly y=30..190 so the pot at y=187..226 sits cleanly below them.
export default function PlantShell({
  health = 'good',
  ariaLabel,
  defs,
  fallenLeaf,
  children,
}) {
  return (
    <svg
      viewBox="0 0 240 240"
      className={`${styles.icon} ${styles[health]}`}
      role={ariaLabel ? 'img' : 'presentation'}
      aria-label={ariaLabel}
      preserveAspectRatio="xMidYMid meet"
    >
      {defs && <defs>{defs}</defs>}

      {/* Soft shadow under the pot */}
      <ellipse cx="120" cy="218" rx="58" ry="10" className={styles.potShadow} />

      {/* Whole plant sways gently on hover — species provides stems + leaves */}
      <g className={styles.sway}>
        {children}
      </g>

      {/* Pot — drawn after the sway so leaves animate in front when tilted */}
      <ellipse className={styles.soil} cx="120" cy="190" rx="42" ry="11" />
      <path    className={styles.pot}  d="M78 187 H162 L153 226 H87 Z" />
      <path    className={styles.potRim} d="M82 187 H158" />
      <path    className={styles.potHighlight} d="M96 203 C107 209, 133 209, 145 202" />
      <path    className={styles.potLine} d="M98 220 H142" />

      {/* Struggling: species-provided fallen leaf next to the pot */}
      {fallenLeaf}

      {/* Thriving: two sparkles pulsing out of sync. Positions are tuned for
          a plant drawn within the recommended canvas area; species can override
          by rendering their own sparkles instead and not setting health="thriving"
          — but in practice these defaults work for most plants. */}
      <g className={styles.sparkle}>
        <path d="M194 42 L198 52 L208 56 L198 60 L194 70 L190 60 L180 56 L190 52 Z" />
      </g>
      <g className={styles.sparkle2}>
        <path d="M75 17 L77 23 L83 25 L77 27 L75 33 L73 27 L67 25 L73 23 Z" />
      </g>
    </svg>
  )
}
