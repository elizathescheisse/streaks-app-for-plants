import styles from './plantIcons.module.css'

// A stylized Monstera deliciosa with three leaves rising from a common base.
// The viewBox is 0 0 100 100; each leaf is its own <g> so it can sway
// independently on hover. Health state and droop are driven by CSS vars
// inherited from .icon's health class — this component has no health logic
// of its own, it just supplies the geometry.

// Path data for a single stylized Monstera leaf, pointing straight up with
// its attach-point at (50, 95) and its tip at (50, 8). Two deep lobes per
// side with notches cut in toward the midrib — enough to read as "Monstera"
// at icon scale without trying to be botanically faithful.
const LEAF_PATH =
  'M 50 95 ' +
  'C 30 88, 16 70, 22 52 ' +    // lower-left bulge
  'L 34 52 ' +                  // notch in
  'C 18 42, 22 22, 38 28 ' +    // upper-left lobe
  'L 42 26 ' +                  // notch in
  'C 38 14, 45 8, 50 10 ' +     // tip-left
  'C 55 8, 62 14, 58 26 ' +     // tip-right (mirror)
  'L 62 28 ' +                  // notch in
  'C 78 22, 82 42, 66 52 ' +    // upper-right lobe
  'L 78 52 ' +                  // notch in
  'C 84 70, 70 88, 50 95 ' +    // back to base
  'Z'

// A simple midrib + two pairs of lateral veins.
const VEIN_PATH =
  'M 50 95 L 50 10 ' +          // midrib
  'M 50 60 L 30 55 ' +          // lower-left lateral
  'M 50 60 L 70 55 ' +          // lower-right lateral
  'M 50 38 L 32 30 ' +          // upper-left lateral
  'M 50 38 L 68 30'              // upper-right lateral

// A subtle brown-tip overlay near the tip — only visible when --tip-burn
// is set to a non-transparent value (i.e. health is okay/struggling).
const TIP_BURN_PATH =
  'M 45 14 Q 50 8 55 14 L 52 18 Q 50 20 48 18 Z'

function Leaf({ className, restRotate, originX = 50, originY = 95, scale = 1 }) {
  return (
    <g
      className={`${styles.leafGroup} ${className}`}
      style={{
        '--rest-rotate': `${restRotate}deg`,
        '--origin-x':    `${originX}px`,
        '--origin-y':    `${originY}px`,
        transformBox:    'fill-box',
      }}
    >
      <g transform={`translate(${50 - 50 * scale} ${95 - 95 * scale}) scale(${scale})`}>
        <path className={styles.leafBlade} d={LEAF_PATH} />
        <path className={styles.tipBurn}   d={TIP_BURN_PATH} />
        <path className={styles.vein}      d={VEIN_PATH} />
      </g>
    </g>
  )
}

export default function Monstera({ health = 'good', ariaLabel }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={`${styles.icon} ${styles[health]}`}
      role={ariaLabel ? 'img' : 'presentation'}
      aria-label={ariaLabel}
    >
      {/* Drawing order: back leaves first, front leaf last (so it's on top) */}
      <Leaf className={styles.leaf2} restRotate={-32} scale={0.7} />
      <Leaf className={styles.leaf3} restRotate={28}  scale={0.72} />
      <Leaf className={styles.leaf1} restRotate={0}   scale={1.0} />
    </svg>
  )
}
