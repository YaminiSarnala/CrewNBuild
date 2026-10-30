// Live 3D build view for the Builder Dashboard.
//
// A small house that builds itself to match a project's progress:
//   0%  site ready (plot, crane, sand and bricks)
//   15% foundation · 25% RCC pillars · 45% ground-floor walls · 55% roof slab
//   75% first floor · 90% roof · 100% painted, lights on, crane and scaffolding gone.
// On open (and when another project is picked) it builds up from zero to the
// project's figure. Drag sideways to turn it; it slowly turns by itself when idle.
//
// Drawn with three.js straight on expo-gl (GLView). @react-three/fiber is not
// used here: on iOS with React Native's New Architecture its <Canvas> draws
// nothing (pmndrs/react-three-fiber#3399), while plain three on expo-gl works.
// Built only from three.js primitives (no model file). If OpenGL cannot start,
// the card shows the project photo instead.
import { Component, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView, PanResponder, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { GLView } from 'expo-gl'
import { useIsFocused } from '@react-navigation/native'
import * as THREE from 'three'
import { Hand } from 'lucide-react-native'

// ---- Progress → stage ------------------------------------------------------
export const BUILD_STAGES = [
  { upTo: 0, key: 'mobile.house3d.stage.notStarted' },
  { upTo: 15, key: 'mobile.house3d.stage.foundation' },
  { upTo: 45, key: 'mobile.house3d.stage.groundFloor' },
  { upTo: 55, key: 'mobile.house3d.stage.slab' },
  { upTo: 75, key: 'mobile.house3d.stage.firstFloor' },
  { upTo: 90, key: 'mobile.house3d.stage.roof' },
  { upTo: 99.99, key: 'mobile.house3d.stage.finishing' },
  { upTo: 100, key: 'mobile.house3d.stage.done' },
]
export const stageKey = (percent) => (BUILD_STAGES.find((stage) => percent <= stage.upTo) || BUILD_STAGES[BUILD_STAGES.length - 1]).key

const clamp01 = (value) => Math.max(0, Math.min(1, value))
const easeOut = (value) => 1 - (1 - value) ** 3
const band = (p, from, to) => easeOut(clamp01((p - from) / (to - from)))

// ---- Colours ---------------------------------------------------------------
const C = {
  sky: '#e6f0f5',
  soil: '#b99c74',
  grass: '#86b862',
  lawn: '#9cc87a',
  concrete: '#a3a8ad',
  brick: '#c2714f',
  plaster: '#f4ede1',
  trim: '#e7dccb',
  roof: '#b5482f',
  glass: '#2c3e50',
  glow: '#ffcf7a',
  door: '#7a4a2a',
  crane: '#f2b21b',
  craneDark: '#3b3f45',
  scaffold: '#c9a04a',
  plank: '#a87b4f',
  sand: '#dcc58f',
  leaf: '#5f9e4f',
  trunk: '#7a5634',
}

// ---- Scene (plain three.js) -------------------------------------------------
function makeMaterials() {
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...extra })
  return {
    plot: std(C.soil),
    lawn: std(C.lawn),
    concrete: std(C.concrete),
    wall: std(C.brick),
    brickRaw: std(C.brick),
    trim: std(C.trim),
    roof: std(C.roof, { roughness: 0.7 }),
    glass: std(C.glass, { emissive: new THREE.Color(C.glow), emissiveIntensity: 0, roughness: 0.25, metalness: 0.2 }),
    door: std(C.door),
    crane: std(C.crane, { roughness: 0.5, metalness: 0.2 }),
    craneDark: std(C.craneDark, { roughness: 0.6, metalness: 0.3 }),
    scaffold: std(C.scaffold, { roughness: 0.6, metalness: 0.3 }),
    plank: std(C.plank),
    sand: std(C.sand),
    leaf: std(C.leaf),
    trunk: std(C.trunk),
    shadow: new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.12, depthWrite: false }),
  }
}

/**
 * Builds the site. Returns the root group, the stage list (each grows between
 * `from` and `to` of the progress, and shrinks away over `out`), and the crane
 * parts that animate every frame.
 */
function buildScene(m) {
  const root = new THREE.Group()
  const stages = []

  const box = (parent, size, at = [0, 0, 0], mat, rot) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat)
    mesh.position.set(at[0], at[1], at[2])
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2])
    parent.add(mesh)
    return mesh
  }
  const group = (parent, at = [0, 0, 0], rot) => {
    const g = new THREE.Group()
    g.position.set(at[0], at[1], at[2])
    if (rot) g.rotation.set(rot[0], rot[1], rot[2])
    parent.add(g)
    return g
  }
  const stage = (from, to, { out, axis = 'y', at } = {}) => {
    const g = group(root, at)
    stages.push({ group: g, from, to, out, axis })
    return g
  }
  const walls = (parent, width, depth, height, mat, thickness = 0.15) => {
    const y = height / 2
    box(parent, [width, height, thickness], [0, y, depth / 2], mat)
    box(parent, [width, height, thickness], [0, y, -depth / 2], mat)
    box(parent, [thickness, height, depth], [-width / 2, y, 0], mat)
    box(parent, [thickness, height, depth], [width / 2, y, 0], mat)
  }
  const windowAt = (parent, at, size = [0.7, 0.6], side = 'front') => {
    const g = group(parent, at, side === 'side' ? [0, Math.PI / 2, 0] : undefined)
    box(g, [size[0] + 0.1, size[1] + 0.1, 0.04], [0, 0, 0], m.trim)
    box(g, [size[0], size[1], 0.06], [0, 0, 0.01], m.glass)
    box(g, [size[0] + 0.16, 0.06, 0.12], [0, -size[1] / 2 - 0.06, 0.04], m.trim)
  }
  const tree = (parent, at, scale = 1) => {
    const g = group(parent, at)
    g.scale.set(scale, scale, scale)
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.6, 8), m.trunk)
    trunk.position.set(0, 0.3, 0)
    const leaf1 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), m.leaf)
    leaf1.position.set(0, 0.85, 0)
    const leaf2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), m.leaf)
    leaf2.position.set(0.18, 1.15, 0.05)
    g.add(trunk, leaf1, leaf2)
  }

  // Plot and a soft contact shadow.
  const plot = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.7, 0.2, 48), m.plot)
  plot.position.set(0, -0.1, 0)
  root.add(plot)
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(2.9, 40), m.shadow)
  shadow.rotation.set(-Math.PI / 2, 0, 0)
  shadow.position.set(0, 0.005, 0)
  root.add(shadow)

  // Site materials (gone once the house is finished).
  const sand = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.45, 10), m.sand)
  sand.position.set(0, 0.22, 0)
  stage(0, 0.04, { out: [0.9, 0.95], axis: 'all', at: [2.75, 0, -1.9] }).add(sand)
  const bricks = stage(0, 0.04, { out: [0.88, 0.94], axis: 'all', at: [2.9, 0, 0.6] })
  box(bricks, [0.5, 0.06, 0.4], [0, 0.03, 0], m.plank)
  box(bricks, [0.44, 0.3, 0.34], [0, 0.21, 0], m.brickRaw)

  // Foundation.
  box(stage(0.02, 0.15), [4.4, 0.3, 3.4], [0, 0.15, 0], m.concrete)

  // RCC pillars, then brick walls between them.
  const pillars = stage(0.13, 0.25, { at: [0, 0.3, 0] })
  ;[[-2, 1.5], [2, 1.5], [-2, -1.5], [2, -1.5], [0, 1.5], [0, -1.5]].forEach(([x, z]) => box(pillars, [0.24, 1.5, 0.24], [x, 0.75, z], m.concrete))
  walls(stage(0.25, 0.45, { at: [0, 0.3, 0] }), 4, 3, 1.5, m.wall)
  const ground = stage(0.38, 0.45, { axis: 'all', at: [0, 0.3, 0] })
  windowAt(ground, [-1.15, 0.9, 1.56])
  windowAt(ground, [1.15, 0.9, 1.56])
  windowAt(ground, [2.06, 0.9, 0], [0.9, 0.6], 'side')
  box(ground, [0.62, 1.05, 0.06], [0, 0.53, 1.56], m.door)
  box(ground, [1.1, 0.06, 0.5], [0, 1.15, 1.8], m.trim)

  // Roof slab of the ground floor.
  box(stage(0.45, 0.55, { at: [0, 1.8, 0] }), [4.6, 0.18, 3.6], [0, 0.09, 0], m.concrete)

  // First floor and balcony.
  const upper = { w: 3.2, d: 2.6, x: -0.3 }
  walls(stage(0.55, 0.75, { at: [upper.x, 1.98, 0] }), upper.w, upper.d, 1.35, m.wall)
  const upperWindows = stage(0.68, 0.75, { axis: 'all', at: [upper.x, 1.98, 0] })
  windowAt(upperWindows, [-0.8, 0.75, upper.d / 2 + 0.06])
  windowAt(upperWindows, [0.8, 0.75, upper.d / 2 + 0.06], [0.8, 0.9])
  windowAt(upperWindows, [upper.w / 2 + 0.06, 0.75, 0], [0.7, 0.6], 'side')
  const balcony = stage(0.7, 0.78, { at: [1.55, 1.98, 1.15] })
  box(balcony, [0.03, 0.5, 1.0], [0.42, 0.25, 0], m.trim)
  box(balcony, [0.9, 0.5, 0.03], [0, 0.25, 0.5], m.trim)

  // Hip roof: a 4-sided cone, squashed to the floor's depth.
  const roofStage = stage(0.75, 0.9, { at: [upper.x, 3.33, 0] })
  const roofScale = group(roofStage)
  roofScale.scale.set(1, 1, 0.84)
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.7, 1.1, 4), m.roof)
  roof.position.set(0, 0.55, 0)
  roof.rotation.set(0, Math.PI / 4, 0)
  roofScale.add(roof)

  // Scaffolding goes up with the walls and comes down for painting.
  const scaffold = stage(0.2, 0.32, { out: [0.88, 0.95] })
  const xs = [-2.35, -1.2, 0, 1.2, 2.35]
  const zs = [-1.85, 0, 1.85]
  xs.forEach((x) => { box(scaffold, [0.05, 3.6, 0.05], [x, 1.8, 1.85], m.scaffold); box(scaffold, [0.05, 3.6, 0.05], [x, 1.8, -1.85], m.scaffold) })
  zs.forEach((z) => { box(scaffold, [0.05, 3.6, 0.05], [-2.35, 1.8, z], m.scaffold); box(scaffold, [0.05, 3.6, 0.05], [2.35, 1.8, z], m.scaffold) })
  ;[0.9, 1.9, 2.9].forEach((y) => {
    box(scaffold, [4.7, 0.04, 0.04], [0, y, 1.85], m.scaffold)
    box(scaffold, [4.7, 0.04, 0.04], [0, y, -1.85], m.scaffold)
    box(scaffold, [0.04, 0.04, 3.7], [-2.35, y, 0], m.scaffold)
    box(scaffold, [0.04, 0.04, 3.7], [2.35, y, 0], m.scaffold)
    box(scaffold, [4.7, 0.03, 0.28], [0, y + 0.03, 2.0], m.plank)
  })

  // Tower crane: lattice mast, slewing jib, trolley and a swinging load of bricks.
  const craneStage = stage(0, 0.06, { out: [0.9, 0.97] })
  const crane = group(craneStage, [-2.75, 0, -2.25])
  box(crane, [0.9, 0.3, 0.9], [0, 0.15, 0], m.concrete)
  ;[[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]].forEach(([x, z]) => box(crane, [0.05, 5.1, 0.05], [x, 2.85, z], m.crane))
  for (let i = 0; i < 10; i += 1) {
    const y = 0.3 + i * 0.5
    box(crane, [0.34, 0.03, 0.03], [0, y, 0.16], m.crane)
    box(crane, [0.34, 0.03, 0.03], [0, y, -0.16], m.crane)
    box(crane, [0.03, 0.03, 0.34], [0.16, y, 0], m.crane)
    box(crane, [0.03, 0.03, 0.34], [-0.16, y, 0], m.crane)
  }
  const head = group(crane, [0, 5.4, 0])
  box(head, [0.42, 0.38, 0.42], [0, 0, 0], m.craneDark)
  box(head, [3.7, 0.16, 0.16], [1.85, 0.22, 0], m.crane)
  box(head, [1.5, 0.16, 0.16], [-0.75, 0.22, 0], m.crane)
  box(head, [0.45, 0.42, 0.36], [-1.35, 0.02, 0], m.concrete)
  box(head, [0.1, 0.9, 0.1], [0, 0.75, 0], m.crane)
  box(head, [3.4, 0.025, 0.025], [1.6, 0.72, 0], m.craneDark, [0, 0, -0.27])
  box(head, [1.5, 0.025, 0.025], [-0.7, 0.72, 0], m.craneDark, [0, 0, 0.5])
  const trolley = group(head, [2, 0.08, 0])
  box(trolley, [0.22, 0.1, 0.2], [0, 0, 0], m.craneDark)
  const cable = group(head, [2, -1, 0])
  box(cable, [0.015, 1, 0.015], [0, 0, 0], m.craneDark)
  const load = group(head, [2, -2.5, 0])
  box(load, [0.42, 0.06, 0.34], [0, -0.1, 0], m.plank)
  box(load, [0.36, 0.2, 0.28], [0, 0.03, 0], m.brickRaw)

  // Garden on completion.
  const garden = stage(0.95, 1, { axis: 'all' })
  tree(garden, [2.7, 0, 1.9])
  tree(garden, [-2.8, 0, 1.6], 0.8)
  tree(garden, [-2.6, 0, -2.1], 1.1)
  box(garden, [1.0, 0.04, 1.9], [0, 0.02, 2.6], m.trim)
  const bush1 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), m.lawn)
  bush1.position.set(1.9, 0.12, 2.6)
  const bush2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), m.lawn)
  bush2.position.set(-1.9, 0.12, 2.5)
  garden.add(bush1, bush2)

  return { root, stages, crane: { head, trolley, cable, load } }
}

const COLOR = { brick: new THREE.Color(C.brick), plaster: new THREE.Color(C.plaster), soil: new THREE.Color(C.soil), grass: new THREE.Color(C.grass) }

/** Applies the progress `p` (0–1) to every stage and to the materials. */
function applyProgress(stages, m, p) {
  stages.forEach(({ group, from, to, out, axis }) => {
    let s = band(p, from, to)
    if (out) s *= 1 - band(p, out[0], out[1])
    group.visible = s > 0.002
    const v = Math.max(s, 0.0001)
    if (axis === 'all') group.scale.set(v, v, v)
    else group.scale.y = v
  })
  // Brick → plaster, bare soil → lawn, windows light up at the very end.
  m.wall.color.lerpColors(COLOR.brick, COLOR.plaster, band(p, 0.9, 0.98))
  m.plot.color.lerpColors(COLOR.soil, COLOR.grass, band(p, 0.92, 1))
  m.glass.emissiveIntensity = band(p, 0.97, 1) * 0.85
}

/**
 * The GL view. `live` holds what changes without re-rendering: target
 * progress, demo mode, rotation, drag state and whether to draw at all.
 */
function HouseGL({ live, onFail }) {
  const frame = useRef(null)
  useEffect(() => () => { if (frame.current) cancelAnimationFrame(frame.current) }, [])

  const onContextCreate = (gl) => {
    try {
      const width = gl.drawingBufferWidth
      const height = gl.drawingBufferHeight
      // three expects a canvas; expo-gl has none, so a minimal stand-in.
      const canvas = {
        width,
        height,
        style: {},
        clientWidth: width,
        clientHeight: height,
        addEventListener: () => {},
        removeEventListener: () => {},
        getContext: () => gl,
      }
      const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: false, powerPreference: 'default' })
      // expo-gl returns no shader info log; three's check would crash on it.
      renderer.debug.checkShaderErrors = false
      renderer.setPixelRatio(1)
      renderer.setSize(width, height, false)
      renderer.setClearColor(C.sky, 1)

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(C.sky)
      scene.fog = new THREE.Fog(C.sky, 20, 36)
      scene.add(new THREE.HemisphereLight('#fff6e5', '#6f7f5e', 1.0))
      const sun = new THREE.DirectionalLight('#fff1dc', 1.7)
      sun.position.set(6, 9, 5)
      scene.add(sun)
      const fill = new THREE.DirectionalLight('#cfe3ff', 0.35)
      fill.position.set(-6, 4, -3)
      scene.add(fill)

      const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100)
      camera.position.set(9, 6.6, 10.5)
      camera.lookAt(0, 2.0, 0)

      const m = makeMaterials()
      const { root, stages, crane } = buildScene(m)
      scene.add(root)

      const clock = new THREE.Clock()
      let shown = 0
      let lastKey = live.current.buildKey

            let frames = 0
      const render = () => {
        frame.current = requestAnimationFrame(render)
        const state = live.current
        frames += 1
        if (frames % 60 === 1) 
        if (!state.active) return
        const step = Math.min(clock.getDelta(), 0.05)
        const time = clock.elapsedTime

        // Progress: loop in demo mode, else move towards the project's figure.
        if (state.buildKey !== lastKey) { lastKey = state.buildKey; shown = 0 }
        if (state.demo) {
          shown = Math.min(1, (time % 13) / 10) // 10 s build, 3 s hold
        } else {
          const delta = state.target - shown
          const speed = 0.08 + Math.abs(delta) * 0.9
          shown += Math.sign(delta) * Math.min(Math.abs(delta), speed * step)
        }
        applyProgress(stages, m, shown)

        // Turn slowly when idle; keep the flick speed after a drag.
        if (!state.dragging) {
          state.spin += (0.18 - state.spin) * Math.min(1, step * 1.5)
          state.angle += state.spin * step
        }
        root.rotation.y = state.angle

        // Crane: slew, trolley in and out, load up and down.
        crane.head.rotation.y = 0.55 + Math.sin(time * 0.22) * 0.85
        const reach = 2.1 + Math.sin(time * 0.37) * 0.9
        const drop = 2.4 + Math.sin(time * 0.5) * 1.2
        crane.trolley.position.x = reach
        crane.cable.position.x = reach
        crane.cable.scale.y = drop
        crane.cable.position.y = -drop / 2
        crane.load.position.set(reach, -drop - 0.12, 0)

        renderer.render(scene, camera)
        gl.endFrameEXP()
      }
      render()
    } catch (error) {
      onFail(error)
    }
  }

  return <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
}

class GLBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() {}
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

// ---- Card ------------------------------------------------------------------
/**
 * Dashboard card. `projects` = [{ id, title, place, percent, image }].
 * With no projects it plays a looping sample build.
 */
export function House3DCard({ projects = [], t, height = 300 }) {
  const focused = useIsFocused()
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState(false)
  const lastDx = useRef(0)

  const demo = !projects.length
  const current = demo ? null : projects[Math.min(index, projects.length - 1)]
  const percent = demo ? 100 : Math.round(current.percent || 0)

  // Read by the GL loop every frame, so changes need no re-render of the view.
  const live = useRef({ angle: -0.7, spin: 0.18, dragging: false, target: 0, demo: true, buildKey: 'demo', active: true })
  live.current.target = clamp01(percent / 100)
  live.current.demo = demo
  live.current.buildKey = current?.id ?? 'demo'
  live.current.active = focused

  const pan = useMemo(() => PanResponder.create({
    // Only sideways drags turn the house, so the page still scrolls up and down.
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
    onPanResponderGrant: () => { live.current.dragging = true; live.current.spin = 0; lastDx.current = 0 },
    onPanResponderMove: (_, g) => { live.current.angle += (g.dx - lastDx.current) * 0.012; lastDx.current = g.dx },
    onPanResponderRelease: (_, g) => { live.current.dragging = false; live.current.spin = Math.max(-3, Math.min(3, g.vx * 2.5)) },
    onPanResponderTerminate: () => { live.current.dragging = false },
    onPanResponderTerminationRequest: () => false,
  }), [])

  const fallback = (
    <Image
      source={current?.image || { uri: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80' }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
    />
  )

  return (
    <View>
      <View style={[styles.card, { height }]}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {failed ? fallback : (
            <GLBoundary fallback={fallback}>
              <HouseGL live={live} onFail={() => setFailed(true)} />
            </GLBoundary>
          )}
        </View>

        {/* Touch layer: sideways drag turns the house. */}
        <View style={StyleSheet.absoluteFill} {...pan.panHandlers} />

        {/* Top: project name and big percent */}
        <View pointerEvents="none" style={styles.top}>
          <View style={styles.titleChip}>
            <Text style={styles.titleText} numberOfLines={1}>{demo ? t('mobile.house3d.demo') : current.title}</Text>
            {!demo && current.place ? <Text style={styles.placeText} numberOfLines={1}>{current.place}</Text> : null}
          </View>
          {!demo ? (
            <View style={styles.percentChip}>
              <Text style={styles.percentText}>{percent}%</Text>
              <Text style={styles.percentSub}>{t('mobile.house3d.complete')}</Text>
            </View>
          ) : null}
        </View>

        {/* Bottom: stage and progress */}
        <LinearGradient pointerEvents="none" colors={['rgba(13,30,22,0)', 'rgba(13,30,22,0.78)']} style={styles.bottom}>
          <Text style={styles.stageText} numberOfLines={1}>{demo ? t('mobile.house3d.demoSub') : t(stageKey(percent))}</Text>
          {!demo ? (
            <View style={styles.track}><View style={[styles.fill, { width: `${percent}%` }]} /></View>
          ) : null}
          <View style={styles.hintRow}>
            <Hand size={11} color="rgba(255,255,255,0.75)" />
            <Text style={styles.hintText}>{t('mobile.house3d.hint')}</Text>
          </View>
        </LinearGradient>
      </View>

      {projects.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
          {projects.map((project, i) => {
            const on = i === index
            return (
              <Pressable key={project.id ?? i} onPress={() => setIndex(i)} style={[styles.pill, on && styles.pillOn]}>
                <Text style={[styles.pillText, on && styles.pillTextOn]} numberOfLines={1}>{project.title}</Text>
                <Text style={[styles.pillPct, on && styles.pillTextOn]}>{Math.round(project.percent || 0)}%</Text>
              </Pressable>
            )
          })}
        </ScrollView>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, overflow: 'hidden', backgroundColor: C.sky },
  top: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  titleChip: { flexShrink: 1, backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  titleText: { fontSize: 13, fontWeight: '800', color: '#14231b' },
  placeText: { fontSize: 11, fontWeight: '600', color: '#5b6b62', marginTop: 1 },
  percentChip: { marginLeft: 'auto', backgroundColor: '#14532d', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' },
  percentText: { fontSize: 20, fontWeight: '900', color: '#ffffff', letterSpacing: -0.5 },
  percentSub: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: 0.6 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingTop: 28, paddingBottom: 12 },
  stageText: { fontSize: 15, fontWeight: '800', color: '#ffffff' },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 8, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: '#f5b31b' },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7 },
  hintText: { fontSize: 10.5, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  pills: { gap: 8, paddingTop: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff', paddingHorizontal: 12, paddingVertical: 7, maxWidth: 220 },
  pillOn: { backgroundColor: '#14532d', borderColor: '#14532d' },
  pillText: { fontSize: 12, fontWeight: '700', color: '#334155', flexShrink: 1 },
  pillPct: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  pillTextOn: { color: '#ffffff' },
})