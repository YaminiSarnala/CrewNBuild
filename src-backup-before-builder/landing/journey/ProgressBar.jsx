// Port of the web journey/ProgressBar.jsx.
// Web fills with scaleX so the browser skips layout work. Native has no layout
// cost either way, so the width is animated directly — same look, simpler code.
import { View } from 'react-native'
import { MotiView } from 'moti'
import { EASE_SOFT, OC } from '../shared'

export function ProgressBar({ value, label, tone = 'brand', style }) {
  const filled = Math.max(0, Math.min(100, value))

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: filled }}
      accessibilityLabel={label}
      style={[
        { height: 6, width: '100%', borderRadius: 3, overflow: 'hidden', backgroundColor: OC.sunken },
        style,
      ]}
    >
      <MotiView
        from={{ width: '0%' }}
        animate={{ width: `${filled}%` }}
        transition={{ type: 'timing', duration: 1000, delay: 150, easing: EASE_SOFT }}
        style={{
          height: '100%',
          borderRadius: 3,
          backgroundColor: tone === 'accent' ? '#e8b23c' : '#1a8659',
        }}
      />
    </View>
  )
}
