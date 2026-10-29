// ---------------------------------------------------------------------------
// Responsive layout for phones AND tablets.
//
// The web app used Tailwind breakpoints (sm/md/lg/xl). React Native has no CSS
// media queries, so this hook is the equivalent: it reads the live window size
// and returns breakpoint flags, a column count, a type scale factor and a max
// content width.
//
// It re-runs on rotation and on split-screen resize, so a tablet user who
// rotates gets the correct layout immediately.
//
// Breakpoints (shortest side, so rotation does not flip a phone into "tablet"):
//   phone        < 600
//   tablet       600 – 899
//   largeTablet  >= 900
// ---------------------------------------------------------------------------
import { useWindowDimensions, PixelRatio } from 'react-native'

export const BREAKPOINTS = {
  tablet: 600,
  largeTablet: 900,
}

export function useResponsive() {
  const { width, height, fontScale } = useWindowDimensions()

  // Using the SHORTEST side to classify the device means a phone held sideways
  // is still treated as a phone, which is what you want.
  const shortestSide = Math.min(width, height)
  const isTablet = shortestSide >= BREAKPOINTS.tablet
  const isLargeTablet = shortestSide >= BREAKPOINTS.largeTablet
  const isLandscape = width > height

  // Column counts for card grids.
  let columns = 1
  if (isLargeTablet) columns = isLandscape ? 3 : 2
  else if (isTablet) columns = 2

  // Cap the content width on big screens so text lines never get unreadably
  // long, and centre it — the tablet equivalent of the web's max-w-7xl.
  const maxContentWidth = isLargeTablet ? 900 : isTablet ? 720 : width

  // Gentle type scale-up on tablets. Capped so a user's OS font-size setting
  // (fontScale) plus our scale can't produce absurd text.
  const typeScale = isLargeTablet ? 1.18 : isTablet ? 1.1 : 1

  /** Scale a design size for the current breakpoint. */
  const scale = (size) => Math.round(size * typeScale)

  /** Horizontal page padding — roomier on tablets, matching the web's sm:px-8. */
  const gutter = isLargeTablet ? 32 : isTablet ? 24 : 20

  return {
    width,
    height,
    shortestSide,
    isPhone: !isTablet,
    isTablet,
    isLargeTablet,
    isLandscape,
    columns,
    maxContentWidth,
    typeScale,
    scale,
    gutter,
    fontScale,
    pixelRatio: PixelRatio.get(),
  }
}
