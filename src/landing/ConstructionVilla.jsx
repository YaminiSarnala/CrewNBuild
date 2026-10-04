// ---------------------------------------------------------------------------
// Port of the web src/components/landing/octabuild/ConstructionVilla.jsx.
//
// The villa, built in Three.js. Every piece of geometry is generated in code
// rather than loaded from a model file, so the scene costs no downloads. Drag to
// turn it; the Day/Night control eases the whole environment between two
// lighting setups.
//
// The web builds a WebGLRenderer against a DOM canvas. React Native has no DOM,
// so expo-gl supplies the GL context and Three.js renders into it unchanged.
// Everything else — the geometry, the lighting model, the build animation, the
// camera orbit — is the same code.
//
// Native replacements, one per browser API the web version used:
//   window.matchMedia          -> AccessibilityInfo.isReduceMotionEnabled
//   document.createElement     -> a DataTexture sky (see skyTexture.js)
//   window.devicePixelRatio    -> PixelRatio.get()
//   host.clientWidth/Height    -> gl.drawingBufferWidth/Height
//   pointer events + capture   -> PanResponder
//   ResizeObserver             -> not needed; GLView reports its own size once
//   IntersectionObserver       -> AppState, so the loop stops when backgrounded
//
// The web also paused rendering when the section scrolled out of view and
// replayed the build on return. A ScrollView cannot report that without extra
// plumbing, so the build plays once on mount and the loop pauses only when the
// app is backgrounded — which is the case that actually drains a battery.
// ---------------------------------------------------------------------------
import { useEffect, useRef, useState } from 'react'
import { View, Text, AppState, PanResponder, PixelRatio } from 'react-native'
import { GLView } from 'expo-gl'
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  WebGLRenderer,
} from 'three'
import DayNightSwitch from './DayNightSwitch'
import { buildMaterials, buildPlan, buildVilla } from './villaGeometry'
import { createSkyTexture } from './skyTexture'

const DAY = {
  sky: '#8fbadf',
  skyTop: '#3f7cbb',
  ground: '#9aa383',
  sun: '#fff3d8',
  sunIntensity: 2.6,
  hemisphere: 1.05,
  ambient: 0.5,
  fill: 0.75,
  glass: '#7f9db4',
  glassGlow: 0.05,
  lamp: 0,
  charcoal: '#24262a',
  wall: '#e9e1d4',
}

const NIGHT = {
  sky: '#2c3f6b',
  skyTop: '#141e3a',
  ground: '#2f3038',
  sun: '#9db4e4',
  sunIntensity: 0.55,
  hemisphere: 0.26,
  ambient: 0.16,
  fill: 0.16,
  glass: '#ffc46a',
  glassGlow: 1.05,
  lamp: 12,
  charcoal: '#3f4249',
  wall: '#9a9184',
}

// Camera sits on a fixed arc; dragging moves it around the model.
const ORBIT_RADIUS = 33
// The compound reaches further forward than back, so the orbit is centred on the
// plot rather than the origin, which would push the gate out of shot.
const PLOT_CENTRE_Z = 1.75
const ORBIT_HEIGHT = 0.72
const IDLE_SPIN = 0.0009

const BUILD_MS = 6200
const SPREAD = 0.6
const PLAN_SHARE = 0.36
const PLAN_SPREAD = 0.75
const RISE_START = 0.3
const PLAN_FADE = 0.6

export default function ConstructionVilla({ isNight: nightFromParent, onModeChange, height = 330 }) {
  const [ownNight, setOwnNight] = useState(false)
  const isNight = nightFromParent === undefined ? ownNight : nightFromParent

  const chooseMode = (night) => {
    if (onModeChange) onModeChange(night)
    else setOwnNight(night)
  }

  const [reducedMotion, setReducedMotion] = useState(false)

  // The scene is built once and driven through refs, so React never re-renders
  // on a frame.
  const nightTarget = useRef(0)
  const settings = useRef({ reducedMotion })
  settings.current = { reducedMotion }

  // Drag state lives in refs so PanResponder can write to it without re-rendering.
  const drag = useRef({ dragging: false, velocity: 0 })

  useEffect(() => {
    nightTarget.current = isNight ? 1 : 0
  }, [isNight])

  useEffect(() => {
    let cancelled = false
    // Web: window.matchMedia("(prefers-reduced-motion: reduce)")
    AccessibilityInfoSafe().then((reduced) => {
      if (!cancelled) setReducedMotion(reduced)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const panResponder = useRef(
    PanResponder.create({
      // Claim horizontal drags only, so vertical scrolling still reaches the page.
      onMoveShouldSetPanResponder: (event, gesture) =>
        Math.abs(gesture.dx) > Math.abs(gesture.dy) && Math.abs(gesture.dx) > 4,
      onPanResponderGrant: () => {
        drag.current.dragging = true
        drag.current.velocity = 0
      },
      onPanResponderMove: (event, gesture) => {
        // Web: (event.clientX - lastX) * 0.006
        const travelled = gesture.dx * 0.006
        drag.current.delta = travelled - (drag.current.lastDx || 0)
        drag.current.lastDx = travelled
      },
      onPanResponderRelease: () => {
        drag.current.dragging = false
        drag.current.lastDx = 0
      },
      onPanResponderTerminate: () => {
        drag.current.dragging = false
        drag.current.lastDx = 0
      },
    }),
  ).current

  const onContextCreate = (gl) => {
    const build = { geometries: [], parts: [], planLines: [] }
    const materials = buildMaterials()
    const scene = new Scene()

    const { texture: skyTexture, paint: paintSky } = createSkyTexture(DAY, NIGHT)
    scene.background = skyTexture
    scene.fog = new Fog(DAY.sky, 50, 70)

    // A near plane this close eats depth precision; the scene is ~40 units across.
    const camera = new PerspectiveCamera(
      34,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      1,
      140,
    )
        if (typeof global.WebGL2RenderingContext === 'undefined') {
      global.WebGL2RenderingContext = gl.constructor
    }

    // three r150+ demands a canvas even when a context is supplied; on native
    // there is no DOM, so hand it a minimal stub backed by the expo-gl context.
    const canvasStub = {
      width: gl.drawingBufferWidth,
      height: gl.drawingBufferHeight,
      clientWidth: gl.drawingBufferWidth,
      clientHeight: gl.drawingBufferHeight,
      style: {},
      addEventListener: () => {},
      removeEventListener: () => {},
      getContext: () => gl,
    }
    const renderer = new WebGLRenderer({
      canvas: canvasStub,
      context: gl,
      antialias: true,
      alpha: false,
    })
    renderer.setPixelRatio(Math.min(PixelRatio.get(), 1.6))
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight, false)
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = PCFSoftShadowMap

    const groundGeometry = new PlaneGeometry(140, 140)
    const ground = new Mesh(groundGeometry, materials.ground)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)
    build.geometries.push(groundGeometry)

    scene.add(buildVilla(materials, build))
    scene.add(buildPlan(materials, build))

    const hemisphere = new HemisphereLight('#eaf2ff', '#8a8f88', DAY.hemisphere)
    const ambient = new AmbientLight('#ffffff', DAY.ambient)
    const sun = new DirectionalLight(DAY.sun, DAY.sunIntensity)
    sun.position.set(16, 22, 12)
    sun.castShadow = true
    // Web uses 1024; halved here because a phone renders this every frame.
    sun.shadow.mapSize.set(512, 512)
    sun.shadow.camera.left = -20
    sun.shadow.camera.right = 20
    sun.shadow.camera.top = 20
    sun.shadow.camera.bottom = -14
    sun.shadow.camera.far = 70
    sun.shadow.bias = -0.0009
    // A cool back light, night only, so dark roof slabs keep an edge against the sky.
    const rim = new DirectionalLight('#a8c4ff', 0)
    rim.position.set(-15, 12, -18)
    // A soft fill opposite the sun, or the left flank and rear flatten into grey.
    const fill = new DirectionalLight('#c8d8ea', DAY.fill)
    fill.position.set(-16, 11, -14)
    scene.add(hemisphere, ambient, sun, rim, fill)

    const makeLamp = (colour, range, strength, x, y, z) => {
      const light = new PointLight(colour, 0, range, 2)
      light.position.set(x, y, z)
      light.visible = false
      scene.add(light)
      return { light, strength }
    }

    const lamps = [
      makeLamp('#ffb45e', 16, 1.0, 2.0, 5.4, 5.2),
      makeLamp('#ffc978', 14, 0.8, -6.5, 2.4, 5.4),
      makeLamp('#ffd9a0', 22, 1.6, -0.6, 2.4, 0.4),
      makeLamp('#ffd9a0', 22, 1.6, 0.4, 6.0, -0.4),
      makeLamp('#ffca82', 18, 0.7, 6.4, 2.6, 10.4),
      makeLamp('#ffd9a0', 16, 0.9, 2.4, 9.5, 0.9),
      makeLamp('#7fd4ff', 12, 0.6, 6.7, 1.1, -4.6),
      makeLamp('#ffd9a0', 18, 1.2, 7.5, 5.6, 0.55),
      makeLamp('#ffca82', 12, 0.5, 6.6, 2.4, 1.0),
      makeLamp('#ffc978', 20, 0.8, -2.0, 2.6, -5.6),
      makeLamp('#ffc978', 16, 0.6, -7.6, 2.4, -1.5),
      makeLamp('#ffc978', 18, 0.7, 0.0, 2.8, 8.0),
    ]

    build.parts.sort((a, b) => a.baseY - b.baseY)

    let angle = -0.72
    let lastFrame = Date.now()
    let night = nightTarget.current
    let raised = 0
    let skyDirty = true
    let lastSkyPaint = 0

    const dayColour = new Color()
    const nightColour = new Color()
    const blended = new Color()
    const mixColour = (from, to, amount) => {
      dayColour.set(from)
      nightColour.set(to)
      return blended.copy(dayColour).lerp(nightColour, amount)
    }

    // The plan draws itself line by line, riding up on the slab as it is poured.
    const applyPlan = (progress, deck) => {
      const fade = Math.min(1, Math.max(0, (raised - PLAN_FADE) / 0.25))
      materials.planLine.opacity = 1 - fade

      const total = build.planLines.length
      build.planLines.forEach((line, index) => {
        const start = (index / Math.max(1, total - 1)) * PLAN_SPREAD
        const step = Math.min(1, Math.max(0, (progress - start) / (1 - PLAN_SPREAD)))
        const drawn = Math.max(0.0001, 1 - Math.pow(1 - step, 3))
        line.mesh.scale[line.axis] = drawn
        line.mesh.position[line.axis] = line.from + (line.length * drawn) / 2
        line.mesh.position.y = 0.07 + deck
        line.mesh.visible = drawn > 0.002 && fade < 1
      })
    }

    // Each piece grows upward from its own base. Parts were sorted by height, so
    // the villa assembles from the slab up rather than appearing at once.
    const applyBuild = () => {
      const rise = Math.max(0, (raised - RISE_START) / (1 - RISE_START))
      lamps.forEach(({ light }) => {
        light.visible = rise > 0.05
      })

      const total = build.parts.length
      build.parts.forEach((part, index) => {
        const start = (index / Math.max(1, total - 1)) * SPREAD
        const step = Math.min(1, Math.max(0, (rise - start) / (1 - SPREAD)))
        const eased = 1 - Math.pow(1 - step, 3)
        const scale = Math.max(0.0001, eased)
        part.mesh.scale.y = scale
        part.mesh.visible = eased > 0.001
        if (!part.anchored) part.mesh.position.y = part.baseY + (part.height * scale) / 2
      })

      const slab = build.parts[0]
      applyPlan(Math.min(1, raised / PLAN_SHARE), slab.height * slab.mesh.scale.y)
    }

    const applyLighting = () => {
      const horizon = mixColour(DAY.sky, NIGHT.sky, night)
      // Marked rather than painted here: applyLighting runs every frame of the
      // fade, and repainting the sky that often is what made it crawl on the web.
      skyDirty = true
      scene.fog.color.copy(horizon)
      materials.ground.color.copy(mixColour(DAY.ground, NIGHT.ground, night))
      materials.glass.color.copy(mixColour(DAY.glass, NIGHT.glass, night))
      materials.glass.emissive.copy(materials.glass.color)
      materials.glass.emissiveIntensity =
        DAY.glassGlow + (NIGHT.glassGlow - DAY.glassGlow) * night
      sun.color.copy(mixColour(DAY.sun, NIGHT.sun, night))
      sun.intensity = DAY.sunIntensity + (NIGHT.sunIntensity - DAY.sunIntensity) * night
      sun.castShadow = night < 0.6
      rim.intensity = 1.5 * night
      fill.intensity = DAY.fill + (NIGHT.fill - DAY.fill) * night
      materials.charcoal.color.copy(mixColour(DAY.charcoal, NIGHT.charcoal, night))
      materials.wall.color.copy(mixColour(DAY.wall, NIGHT.wall, night))
      hemisphere.intensity = DAY.hemisphere + (NIGHT.hemisphere - DAY.hemisphere) * night
      ambient.intensity = DAY.ambient + (NIGHT.ambient - DAY.ambient) * night
      lamps.forEach(({ light, strength }) => {
        light.intensity = NIGHT.lamp * strength * night
      })
      materials.water.emissiveIntensity = 0.06 + 0.55 * night
      // The sun sinks as night comes in, so shadows lengthen on the way down.
      sun.position.set(16 - 8 * night, 22 - 16 * night, 12 + 6 * night)
    }

    const render = () => {
      const { reducedMotion: still } = settings.current
      const now = Date.now()
      // Clamped so returning from the background does not jump the animation.
      const seconds = Math.min(0.05, (now - lastFrame) / 1000)
      lastFrame = now

      if (drag.current.dragging) {
        const delta = drag.current.delta || 0
        angle -= delta
        drag.current.velocity = -delta * 0.5
        drag.current.delta = 0
      } else if (Math.abs(drag.current.velocity) > 0.00002) {
        angle += drag.current.velocity
        drag.current.velocity *= 0.94
      } else {
        drag.current.velocity = 0
        if (!still) angle += IDLE_SPIN
      }

      if (raised < 1) {
        if (still) raised = 1
        else raised = Math.min(1, raised + (seconds * 1000) / BUILD_MS)
        applyBuild()
      }

      const gap = nightTarget.current - night
      if (Math.abs(gap) > 0.002) {
        night += gap * (still ? 0.4 : 0.1)
        applyLighting()
      } else if (night !== nightTarget.current) {
        night = nightTarget.current
        applyLighting()
      }

      camera.position.set(
        Math.sin(angle) * ORBIT_RADIUS,
        ORBIT_RADIUS * ORBIT_HEIGHT * 0.52,
        Math.cos(angle) * ORBIT_RADIUS + PLOT_CENTRE_Z,
      )
      // Aiming below the middle of the house lifts it up the frame and keeps the
      // compound and gate in shot along the bottom.
      camera.lookAt(0, 3.2, PLOT_CENTRE_Z)
      skyTexture.offset.x = -angle / (Math.PI * 2)

      if (skyDirty && now - lastSkyPaint > 90) {
        paintSky(night)
        lastSkyPaint = now
        skyDirty = false
      }

      renderer.render(scene, camera)
      // Required by expo-gl: hands the finished frame to the native surface.
      gl.endFrameEXP()

      frameRef.current = requestAnimationFrame(render)
    }

    applyBuild()
    applyLighting()
    frameRef.current = requestAnimationFrame(render)

    // Kept so the unmount effect can stop the loop and free GPU memory.
    disposeRef.current = () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      build.geometries.forEach((geometry) => geometry.dispose())
      Object.values(materials).forEach((material) => material.dispose?.())
      skyTexture.dispose()
      renderer.dispose()
    }
  }

  const frameRef = useRef(0)
  const disposeRef = useRef(null)

  // Nothing renders while the app is in the background.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && frameRef.current) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = 0
      }
    })
    return () => subscription.remove()
  }, [])

  useEffect(() => () => disposeRef.current?.(), [])

  return (
    <View
      className="relative overflow-hidden rounded-3xl"
      style={{
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 28 },
        shadowOpacity: 0.22,
        shadowRadius: 22,
        elevation: 10,
      }}
    >
      <GLView
        style={{ width: '100%', height }}
        onContextCreate={onContextCreate}
        {...panResponder.panHandlers}
      />

      <View
        className="absolute inset-x-0 top-0 flex-row items-start justify-between"
        style={{ gap: 12, padding: 16 }}
        pointerEvents="box-none"
      >
        <View pointerEvents="auto">
          <DayNightSwitch night={isNight} onChange={chooseMode} />
        </View>
        <Text
          className="font-sansSemi"
          style={{ fontSize: 11, color: isNight ? '#ffffff' : '#17201c', opacity: 0.6 }}
        >
          Drag to rotate
        </Text>
      </View>
    </View>
  )
}

/** Reads the OS "reduce motion" setting without importing it at module scope. */
async function AccessibilityInfoSafe() {
  try {
    const { AccessibilityInfo } = require('react-native')
    return await AccessibilityInfo.isReduceMotionEnabled()
  } catch {
    return false
  }
}