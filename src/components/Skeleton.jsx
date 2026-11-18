// Skeleton loaders: grey placeholder shapes, gently pulsing, shown while API
// data is on its way, in place of a bare spinner. They take the outline of what
// is coming (a list card, a product tile, a figure card) so the screen does not
// jump when the data lands.
//
//   <Skeleton width={120} height={12} />     one block
//   <SkeletonRows count={3} />               plain rows, for inside a panel (PanelState's default)
//   <SkeletonList count={3} />               list cards, for a screen's own list
//   <SkeletonGrid count={4} width={w} />     product / catalogue tiles
//   <SkeletonStats count={4} width={w} />    dashboard figure cards
//   <SkeletonText lines={3} />               a paragraph
//
// One shared animation drives every block on screen, so many skeletons cost no
// more than one, and they all pulse together.
import { createContext, useContext, useEffect, useRef } from 'react'
import { Animated, Easing, View } from 'react-native'
import { createStyles } from '../theme/createStyles'

const PulseContext = createContext(null)

/** Runs one pulse for the skeletons inside it (each group mounts its own). */
function Pulse({ children }) {
  const value = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [value])
  return <PulseContext.Provider value={value}>{children}</PulseContext.Provider>
}

/** Groups custom-shaped Skeletons so they pulse together. */
export const SkeletonGroup = Pulse

/** One placeholder block. Outside a group it runs its own pulse. */
export function Skeleton({ width = '100%', height = 12, radius = 8, style }) {
  const shared = useContext(PulseContext)
  if (!shared) {
    return (
      <Pulse>
        <Skeleton width={width} height={height} radius={radius} style={style} />
      </Pulse>
    )
  }
  const opacity = shared.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] })
  return <Animated.View style={[styles.block, { width, height, borderRadius: radius, opacity }, style]} />
}

/** A few lines of text, the last one shorter. */
export function SkeletonText({ lines = 3, style }) {
  return (
    <Pulse>
      <View style={[{ gap: 8 }, style]}>
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton key={index} width={index === lines - 1 && lines > 1 ? '60%' : '100%'} height={11} />
        ))}
      </View>
    </Pulse>
  )
}

/** Plain rows (a picture and two lines), for a list inside a panel or card. */
export function SkeletonRows({ count = 3, avatar = true, style }) {
  return (
    <Pulse>
      <View style={[{ gap: 16, paddingVertical: 6 }, style]} accessibilityRole="progressbar" accessibilityLabel="Loading">
        {Array.from({ length: count }, (_, index) => (
          <View key={index} style={styles.row}>
            {avatar ? <Skeleton width={38} height={38} radius={19} /> : null}
            <View style={{ flex: 1, gap: 7 }}>
              <Skeleton width={index % 2 ? '50%' : '65%'} height={12} />
              <Skeleton width={index % 2 ? '75%' : '40%'} height={10} />
            </View>
          </View>
        ))}
      </View>
    </Pulse>
  )
}

/** List cards: a round picture, a title and two lines, then a footer row. */
export function SkeletonList({ count = 3, avatar = true, style }) {
  return (
    <Pulse>
      <View style={[{ gap: 12 }, style]} accessibilityRole="progressbar" accessibilityLabel="Loading">
        {Array.from({ length: count }, (_, index) => (
          <View key={index} style={styles.card}>
            <View style={styles.row}>
              {avatar ? <Skeleton width={40} height={40} radius={20} /> : null}
              <View style={{ flex: 1, gap: 7 }}>
                <Skeleton width="55%" height={13} />
                <Skeleton width="35%" height={10} />
              </View>
              <Skeleton width={64} height={20} radius={10} />
            </View>
            <View style={styles.lines}>
              <Skeleton width="90%" height={10} />
              <Skeleton width="70%" height={10} />
            </View>
            <View style={styles.footer}>
              <Skeleton width="40%" height={10} />
              <Skeleton width={80} height={16} />
            </View>
          </View>
        ))}
      </View>
    </Pulse>
  )
}

/** Product / catalogue tiles: a picture, two lines and a price. */
export function SkeletonGrid({ count = 4, width, gap = 10, imageHeight = 120, style }) {
  return (
    <Pulse>
      <View style={[styles.grid, { gap }, style]} accessibilityRole="progressbar" accessibilityLabel="Loading">
        {Array.from({ length: count }, (_, index) => (
          <View key={index} style={[styles.tile, { width }]}>
            <Skeleton height={imageHeight} radius={10} />
            <Skeleton width="85%" height={12} style={{ marginTop: 10 }} />
            <Skeleton width="55%" height={10} style={{ marginTop: 6 }} />
            <Skeleton width="40%" height={15} style={{ marginTop: 10 }} />
          </View>
        ))}
      </View>
    </Pulse>
  )
}

/** Dashboard figure cards: an icon, a label and a number. */
export function SkeletonStats({ count = 4, width, style }) {
  return (
    <Pulse>
      <View style={[styles.grid, { gap: 10 }, style]}>
        {Array.from({ length: count }, (_, index) => (
          <View key={index} style={[styles.stat, { width }]}>
            <Skeleton width={36} height={36} radius={11} />
            <View style={{ flex: 1, gap: 7 }}>
              <Skeleton width="80%" height={10} />
              <Skeleton width="45%" height={18} />
            </View>
          </View>
        ))}
      </View>
    </Pulse>
  )
}

/** A full-width block (a banner or chart). */
export function SkeletonBlock({ height = 120, radius = 16, style }) {
  return <Skeleton height={height} radius={radius} style={style} />
}

const styles = createStyles((c) => ({
  block: { backgroundColor: c.mutedStrong },
  card: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lines: { marginTop: 12, gap: 7, borderTopWidth: 1, borderColor: c.borderSoft, paddingTop: 11 },
  footer: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 9 },
  stat: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 11 },
}))
