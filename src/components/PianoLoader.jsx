// The button loader: a row of keys pressed one after another, left to right,
// like fingers running over a piano. Shown inside a button while its action
// (sign in, sign up, send code, save...) is on its way; screens that wait for
// data use skeletons instead (Skeleton.jsx).
//
//   <PianoLoader />                       white keys, for a filled button
//   <PianoLoader color={COLORS.brand[700]} />   for an outline button
import { useEffect, useRef } from 'react'
import { Animated, Easing, View } from 'react-native'

const PRESS_MS = 240
const STEP_MS = 110

export default function PianoLoader({ color = '#ffffff', keys = 5, height = 16, keyWidth = 3.5, gap = 3, style }) {
  const values = useRef(Array.from({ length: keys }, () => new Animated.Value(0))).current

  useEffect(() => {
    // Every key runs the same length of loop, offset by its place, so the
    // run repeats smoothly: wait for my turn, press, release, wait for the rest.
    const loops = values.map((value, index) => Animated.loop(
      Animated.sequence([
        Animated.delay(index * STEP_MS),
        Animated.timing(value, { toValue: 1, duration: PRESS_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: PRESS_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay((keys - 1 - index) * STEP_MS),
      ]),
    ))
    loops.forEach((loop) => loop.start())
    return () => loops.forEach((loop) => loop.stop())
  }, [values, keys])

  return (
    <View
      style={[{ height, flexDirection: 'row', alignItems: 'center', gap }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    >
      {values.map((value, index) => (
        <Animated.View
          key={index}
          style={{
            width: keyWidth,
            height,
            borderRadius: keyWidth / 2,
            backgroundColor: color,
            opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
            transform: [{ scaleY: value.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }],
          }}
        />
      ))}
    </View>
  )
}
