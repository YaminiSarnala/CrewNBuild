// ---------------------------------------------------------------------------
// Port of the web src/components/landing/octabuild/DayNightSwitch.jsx.
//
// A sun that slides across and becomes a moon, with clouds dropping away and
// stars coming in behind it.
//
// The web version is ~300 lines of CSS: a checkbox driving keyframes for
// shooting stars, comets, an aurora and a twinkling cluster, plus clouds drawn
// entirely from stacked box-shadows. None of that exists on native, so the
// switch is rebuilt with Moti. What is kept is everything the control needs to
// read correctly:
//   - the sky behind it darkening from blue to navy
//   - the circle sliding left to right
//   - the sun crossfading into a spotted moon
//   - clouds dropping out of frame
//   - a field of stars fading in, each twinkling on its own offset
//
// Dropped: the aurora band, the comets and the two shooting stars. They are
// decorative, they animate continuously, and reproducing them would mean a
// dozen more looping animations behind a 90x40 control.
// ---------------------------------------------------------------------------
import { View, Pressable } from 'react-native'
import { MotiView } from 'moti'
import { Easing } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'

const WIDTH = 90
const HEIGHT = 40
const CIRCLE = 34
const INSET = 3

// Web: --transition: 0.5s cubic-bezier(0, -0.02, 0.4, 1.25) — a slight overshoot.
const SWITCH_EASE = Easing.bezier(0, -0.02, 0.4, 1)
const DURATION = 500

// Fixed positions so the stars do not jump between renders.
const STARS = [
  { top: 8, left: 12, delay: 0 },
  { top: 14, left: 30, delay: 300 },
  { top: 9, left: 46, delay: 600 },
  { top: 22, left: 20, delay: 900 },
  { top: 25, left: 40, delay: 1200 },
  { top: 12, left: 60, delay: 450 },
]

function Star({ top, left, delay }) {
  return (
    <MotiView
      from={{ opacity: 0.3, scale: 1 }}
      animate={{ opacity: 1, scale: 1.2 }}
      transition={{
        type: 'timing',
        duration: 1000,
        delay,
        loop: true,
        repeatReverse: true,
      }}
      style={{
        position: 'absolute',
        top,
        left,
        width: 2,
        height: 2,
        borderRadius: 1,
        backgroundColor: '#ffffff',
        shadowColor: '#ffffff',
        shadowOpacity: 1,
        shadowRadius: 2,
      }}
    />
  )
}

/* Web draws the clouds with a long list of box-shadows off one element. Native
   has no shadow spread lists, so they are six real circles instead. */
const CLOUDS = [
  { left: 5, bottom: -10, size: 20, back: false },
  { left: 20, bottom: -5, size: 20, back: false },
  { left: 2, bottom: -14, size: 18, back: true },
  { left: 38, bottom: -4, size: 20, back: false },
  { left: 26, bottom: -12, size: 18, back: true },
  { left: 56, bottom: -8, size: 20, back: false },
]

export default function DayNightSwitch({ night, onChange, label = 'Day and night' }) {
  return (
    <Pressable
      onPress={() => onChange(!night)}
      accessibilityRole="switch"
      accessibilityState={{ checked: night }}
      accessibilityLabel={label}
      style={{ width: WIDTH, height: HEIGHT }}
    >
      <View
        style={{
          width: WIDTH,
          height: HEIGHT,
          borderRadius: HEIGHT / 2,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.25,
          shadowRadius: 2,
          elevation: 2,
        }}
      >
        {/* Day sky */}
        <LinearGradient
          colors={['#3d7eae', '#5490c0']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />

        {/* Night sky fades in over it */}
        <MotiView
          animate={{ opacity: night ? 1 : 0 }}
          transition={{ type: 'timing', duration: DURATION }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <LinearGradient
            colors={['#1d1f2c', '#2d3142']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
        </MotiView>

        {/* Stars — only present at night */}
        <MotiView
          animate={{ opacity: night ? 1 : 0 }}
          transition={{ type: 'timing', duration: DURATION }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          pointerEvents="none"
        >
          {STARS.map((star) => (
            <Star key={`${star.top}-${star.left}`} {...star} />
          ))}
        </MotiView>

        {/* Clouds drop away as night falls. Web: bottom -0.625em -> -4.062em */}
        <MotiView
          animate={{ translateY: night ? 40 : 0 }}
          transition={{ type: 'timing', duration: DURATION, easing: SWITCH_EASE }}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: HEIGHT }}
          pointerEvents="none"
        >
          {CLOUDS.map((cloud, index) => (
            <View
              key={index}
              style={{
                position: 'absolute',
                left: cloud.left,
                bottom: cloud.bottom,
                width: cloud.size,
                height: cloud.size,
                borderRadius: cloud.size / 2,
                backgroundColor: cloud.back ? '#aacadf' : '#f3fdff',
              }}
            />
          ))}
        </MotiView>

        {/* The travelling circle */}
        <MotiView
          animate={{ translateX: night ? WIDTH - CIRCLE - INSET : INSET }}
          transition={{ type: 'timing', duration: DURATION, easing: SWITCH_EASE }}
          style={{ position: 'absolute', top: (HEIGHT - CIRCLE) / 2 }}
        >
          <View
            style={{
              width: CIRCLE,
              height: CIRCLE,
              borderRadius: CIRCLE / 2,
              overflow: 'hidden',
              backgroundColor: '#ecca2f',
              shadowColor: '#000',
              shadowOffset: { width: 1, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 2,
              elevation: 3,
            }}
          >
            {/* Moon face slides over the sun */}
            <MotiView
              animate={{ translateX: night ? 0 : CIRCLE }}
              transition={{ type: 'timing', duration: DURATION, easing: SWITCH_EASE }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: CIRCLE,
                height: CIRCLE,
                borderRadius: CIRCLE / 2,
                backgroundColor: '#c4c9d1',
              }}
            >
              {/* Web: three craters at fixed offsets */}
              <View
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 5,
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: '#959db1',
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  top: 15,
                  left: 22,
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#959db1',
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  top: 5,
                  left: 13,
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: '#959db1',
                }}
              />
            </MotiView>
          </View>
        </MotiView>
      </View>
    </Pressable>
  )
}
