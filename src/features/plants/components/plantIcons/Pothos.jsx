import styles from './plantIcons.module.css'
import PlantShell from './PlantShell.jsx'

// Pothos — a bushy rosette of heart-shaped leaves emerging from the pot.
// 3 upper leaves fan upward from S-curved vines; 2 mid-height leaves fill
// in the flanks; 1 small dropper on the left side fades when struggling.
//
// Leaf anchor math: symbol viewBox "0 0 59 68", heart-base at ~(29.5, 5).
// For <use width W height H>, heart-base is at (x + W/2, y + H×5/68).
// To put heart-base at anchor (ax, ay):
//   x = ax − W/2
//   y = ay − H×(5/68)
//
// Rotation → tip direction:
//   rotate(180)  → north (up)
//   rotate(155)  → NNW
//   rotate(-155) → NNE
//   rotate(128)  → NW-ish (mid-left fan)
//   rotate(-128) → NE-ish (mid-right fan)
//   rotate(100)  → roughly west (small dropper)

export default function Pothos({ health = 'good', ariaLabel }) {
  return (
    <PlantShell
      health={health}
      ariaLabel={ariaLabel}
      defs={
        <symbol id="pothos-leaf" viewBox="0 0 59 68">
          {/* Main leaf body — darker green */}
          <path d="M5.791 1.97508C10.6976 -1.22488 16.4687 0.122658 20.791 1.97508C24.0141 3.35642 27.4349 7.12612 28.9662 8.9541C29.3906 9.46072 30.1914 9.46072 30.6158 8.95411C32.1471 7.12612 35.5679 3.35642 38.791 1.97508C43.1133 0.122658 48.8461 -1.16541 53.791 1.97508C58.7359 5.11556 59.2913 13.4751 58.291 20.9751C57.3197 28.2576 54.9345 40.7258 31.9095 64.7882C30.9156 65.8269 29.1791 65.4899 28.5798 64.1831C19.2768 43.8996 2.79107 31.9795 0.791004 20.9751C-1.29913 9.47506 0.884395 5.17504 5.791 1.97508Z" fill="#457028" />
          {/* Right-side highlight — lighter green */}
          <path d="M35.789 34.4751C35.789 22.6538 31.5881 12.3985 30.5298 10.0025C30.3848 9.67422 30.4141 9.29617 30.6284 9.00843C31.6732 7.60628 34.9932 3.43349 38.5654 1.90253C42.8877 0.0501068 48.6205 -1.23796 53.5654 1.90253C58.5103 5.04301 59.0657 13.4025 58.0654 20.9025C57.1041 28.1107 54.0412 41.39 31.6105 65.0504C30.892 65.8082 29.6975 65.1106 30.0153 64.1159C32.1837 57.3285 35.789 45.4264 35.789 34.4751Z" fill="#58833B" />
        </symbol>
      }
      fallenLeaf={
        <use
          className={styles.fallenBloom}
          href="#pothos-leaf"
          x="155" y="200"
          width="32" height="37"
          transform="rotate(105 171 222)"
        />
      }
    >
      {/* Vines — S-curves for the upper three, gentle arcs for the mid pair */}

      {/* Center — swings left then right */}
      <path className={styles.pothosVine} d="M120 188 C88 155, 155 118, 118 80" />
      {/* Left-center — sweeps left then hooks right */}
      <path className={styles.pothosVine} d="M116 188 C78 162, 130 130, 90 100" />
      {/* Right-center — sweeps right then hooks left */}
      <path className={styles.pothosVine} d="M124 188 C162 162, 110 130, 148 95" />
      {/* Mid-left arc — curves out to the left mid-height */}
      <path className={styles.pothosVine} d="M114 188 C85 172, 82 155, 72 120" />
      {/* Mid-right arc — mirror */}
      <path className={styles.pothosVine} d="M126 188 C155 172, 158 155, 168 118" />
      {/* Short dropper vine */}
      <path className={styles.pothosVine} d="M112 186 C95 182, 90 175, 85 162" />

      {/* Leaf 1 — center top, tip UP. Crown of the plant.
          Anchor (118, 80): x=90, y=75 */}
      <use
        className={styles.pothosLeaf}
        href="#pothos-leaf"
        x="90" y="75"
        width="56" height="64"
        transform="rotate(180 118 80)"
      />

      {/* Leaf 2 — left-center, tip NNW.
          Anchor (90, 100): x=64, y=96 */}
      <use
        className={styles.pothosLeaf}
        href="#pothos-leaf"
        x="64" y="96"
        width="52" height="59"
        transform="rotate(155 90 100)"
      />

      {/* Leaf 3 — right-center, tip NNE.
          Anchor (148, 95): x=122, y=91 */}
      <use
        className={styles.pothosLeaf}
        href="#pothos-leaf"
        x="122" y="91"
        width="52" height="59"
        transform="rotate(-155 148 95)"
      />

      {/* Leaf 4 — mid-left, tip NW-ish. Fills the gap between upper cluster
          and pot rim on the left side.
          Anchor (72, 120): x=48, y=116 */}
      <use
        className={styles.pothosLeaf}
        href="#pothos-leaf"
        x="48" y="116"
        width="48" height="54"
        transform="rotate(128 72 120)"
      />

      {/* Leaf 5 — mid-right, tip NE-ish. Mirror of leaf 4.
          Anchor (168, 118): x=144, y=114 */}
      <use
        className={styles.pothosLeaf}
        href="#pothos-leaf"
        x="144" y="114"
        width="48" height="54"
        transform="rotate(-128 168 118)"
      />

      {/* Leaf 6 — small mid-vine dropper on left side. Fades out when
          struggling (the fallen leaf appears on the ground instead).
          Anchor (85, 162): x=69, y=159 */}
      <use
        className={`${styles.pothosLeaf} ${styles.pothosLeafDrops}`}
        href="#pothos-leaf"
        x="69" y="159"
        width="32" height="36"
        transform="rotate(100 85 162)"
      />
    </PlantShell>
  )
}
