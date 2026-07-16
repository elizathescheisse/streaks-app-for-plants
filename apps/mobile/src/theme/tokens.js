// Design tokens ported from apps/web/src/theme/tokens.css + themes.css.
// CSS custom properties have no RN equivalent, so the light/dark palettes
// become plain JS objects consumed via useTheme() (see ThemeContext.js).
//
// Web-only tokens (edge-glow gradients, box-shadows, chart internals) are
// intentionally omitted — RN handles shadows differently and the chart
// lands in Phase 3. Add tokens here as components need them.

// Theme-agnostic primitives (identical in light + dark)
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
}

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 22,
}

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  '2xl': 32,
  '3xl': 48,
}

export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extraBold: '800',
}

// Semantic color palettes — keys match the --color-*/--status-* names from
// themes.css (minus the -- prefix), so porting a component's CSS is a
// near-mechanical lookup.
const dark = {
  bg: '#060b05',
  bgElevated: '#0e1a0c',
  bgSoft: '#0d170a',
  surface: '#1a2e17',
  surface2: '#1f331c',
  surfaceMuted: '#294724',

  border: 'rgba(71, 133, 61, 0.35)',
  borderStrong: 'rgba(71, 133, 61, 0.55)',
  borderHover: 'rgba(71, 133, 61, 0.75)',

  text: '#ffffff',
  textSecondary: '#d9f2d9',
  textMuted: '#73ad73',
  textSoft: '#618a61',

  primary: '#38b247',
  primaryHover: '#45d157',
  primarySoft: 'rgba(54, 178, 71, 0.18)',
  primaryBorder: 'rgba(69, 209, 87, 0.8)',
  onPrimary: '#071407',

  warning: '#e0c740',
  danger: '#e56147',
  info: '#8ccceb',
  dataWater: '#8ccceb',
  water: '#f5d400',

  dangerSoft: 'rgba(229, 97, 71, 0.12)',
  dangerBorder: 'rgba(229, 97, 71, 0.45)',
  dangerText: 'rgba(229, 97, 71, 0.85)',

  overlayScrim: 'rgba(0, 0, 0, 0.55)',
  surfaceHover: 'rgba(41, 71, 36, 0.8)',
  surfaceInset: 'rgba(13, 23, 10, 0.6)',
  emptyBg: 'rgba(26, 46, 23, 0.4)',

  statusThriving: '#40d961',
  statusGood: '#8cd966',
  statusOkay: '#e0c740',
  statusStruggling: '#e56147',
  statusWater: '#f5d400',

  statusThrivingSoft: 'rgba(64, 217, 97, 0.1)',
  statusThrivingBorder: 'rgba(64, 217, 97, 0.4)',
  statusGoodSoft: 'rgba(140, 217, 102, 0.1)',
  statusGoodBorder: 'rgba(140, 217, 102, 0.4)',
  statusOkaySoft: 'rgba(224, 199, 64, 0.1)',
  statusOkayBorder: 'rgba(224, 199, 64, 0.4)',
  statusStrugglingSoft: 'rgba(229, 97, 71, 0.1)',
  statusStrugglingBorder: 'rgba(229, 97, 71, 0.4)',
  statusWaterSoft: 'rgba(245, 212, 0, 0.1)',
  statusWaterBorder: 'rgba(245, 212, 0, 0.45)',

  cardStrugglingBg: 'rgba(229, 97, 71, 0.07)',
  cardStrugglingBorder: 'rgba(229, 97, 71, 0.45)',

  checkBadge: '#18a4e8',
  checkBadgeSoft: 'rgba(24, 164, 232, 0.12)',
  checkBadgeBorder: 'rgba(24, 164, 232, 0.45)',

  moistureTrack: 'rgba(255, 255, 255, 0.12)',
  moistureIdeal: 'rgba(56, 178, 71, 0.35)',
  moistureIdealBorder: 'rgba(56, 178, 71, 0.5)',

  chartMoistureLine: 'rgba(140, 204, 235, 0.65)',
  chartMoistureLineFaint: 'rgba(140, 204, 235, 0.35)',
  chartMoistureLineMuted: 'rgba(140, 204, 235, 0.25)',
  chartMoistureDotDefault: 'rgba(140, 204, 235, 0.9)',
  chartIdealFill: 'rgba(56, 178, 71, 0.12)',
  chartIdealLine: 'rgba(56, 178, 71, 0.35)',
  chartWaterLine: 'rgba(245, 212, 0, 0.5)',
  chartWaterLabel: 'rgba(140, 204, 235, 0.85)',
  chartAxisLabel: 'rgba(150, 180, 150, 0.55)',
  chartAxisLabelFaint: 'rgba(150, 180, 150, 0.4)',
  chartEstimatedRing: 'rgba(255, 255, 255, 0.5)',
}

const light = {
  bg: '#f8faf5',
  bgElevated: '#ffffff',
  bgSoft: '#f1f6ec',
  surface: '#ffffff',
  surface2: '#f4f8f0',
  surfaceMuted: '#e8f0e4',

  border: 'rgba(41, 80, 45, 0.12)',
  borderStrong: 'rgba(69, 112, 62, 0.28)',
  borderHover: 'rgba(69, 112, 62, 0.42)',

  text: '#142017',
  textSecondary: '#2a3d28',
  textMuted: '#5f725d',
  textSoft: '#84927f',

  primary: '#159947',
  primaryHover: '#0f873d',
  primarySoft: 'rgba(21, 153, 71, 0.12)',
  primaryBorder: 'rgba(21, 153, 71, 0.45)',
  onPrimary: '#ffffff',

  warning: '#c9931d',
  danger: '#c75a3d',
  info: '#3a95bf',
  dataWater: '#3a95bf',
  water: '#c9931d',

  dangerSoft: 'rgba(199, 90, 61, 0.1)',
  dangerBorder: 'rgba(199, 90, 61, 0.35)',
  dangerText: '#b04a30',

  overlayScrim: 'rgba(35, 70, 35, 0.28)',
  surfaceHover: '#e4f0df',
  surfaceInset: '#eaf3e5',
  emptyBg: 'rgba(237, 246, 233, 0.9)',

  statusThriving: '#159947',
  statusGood: '#3d9e4a',
  statusOkay: '#c9931d',
  statusStruggling: '#c75a3d',
  statusWater: '#c9931d',

  statusThrivingSoft: 'rgba(21, 153, 71, 0.12)',
  statusThrivingBorder: 'rgba(21, 153, 71, 0.35)',
  statusGoodSoft: 'rgba(61, 158, 74, 0.12)',
  statusGoodBorder: 'rgba(61, 158, 74, 0.35)',
  statusOkaySoft: 'rgba(201, 147, 29, 0.12)',
  statusOkayBorder: 'rgba(201, 147, 29, 0.35)',
  statusStrugglingSoft: 'rgba(199, 90, 61, 0.12)',
  statusStrugglingBorder: 'rgba(199, 90, 61, 0.35)',
  statusWaterSoft: 'rgba(201, 147, 29, 0.12)',
  statusWaterBorder: 'rgba(201, 147, 29, 0.35)',

  cardStrugglingBg: 'rgba(199, 90, 61, 0.08)',
  cardStrugglingBorder: 'rgba(199, 90, 61, 0.35)',

  checkBadge: '#2a8fc4',
  checkBadgeSoft: 'rgba(42, 143, 196, 0.12)',
  checkBadgeBorder: 'rgba(42, 143, 196, 0.35)',

  moistureTrack: 'rgba(69, 112, 62, 0.12)',
  moistureIdeal: 'rgba(21, 153, 71, 0.22)',
  moistureIdealBorder: 'rgba(21, 153, 71, 0.35)',

  chartMoistureLine: 'rgba(58, 149, 191, 0.75)',
  chartMoistureLineFaint: 'rgba(58, 149, 191, 0.4)',
  chartMoistureLineMuted: 'rgba(58, 149, 191, 0.28)',
  chartMoistureDotDefault: 'rgba(58, 149, 191, 0.95)',
  chartIdealFill: 'rgba(21, 153, 71, 0.12)',
  chartIdealLine: 'rgba(21, 153, 71, 0.35)',
  chartWaterLine: 'rgba(201, 147, 29, 0.55)',
  chartWaterLabel: 'rgba(58, 149, 191, 0.9)',
  chartAxisLabel: 'rgba(95, 114, 93, 0.85)',
  chartAxisLabelFaint: 'rgba(95, 114, 93, 0.55)',
  chartEstimatedRing: 'rgba(20, 32, 23, 0.45)',
}

export const palettes = { dark, light }
