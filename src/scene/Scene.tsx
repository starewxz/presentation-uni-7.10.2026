import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { store, bus, setReady } from './store'
import { MODEL_SCALE, MODEL_Y, fitFromAnatomy, fitFromModel, splitMannequin, type BodyFit } from './fit'
import { POSES, buildArm, buildHead, buildLeg, buildTorso } from './anatomy'
import { blendMat, beltAmount, buildGarment, buildSleeve, collarHeight, garmentAt, layerAmount, sleeveLength, withWhiteVertexColors } from './garments'
import { makeBandTexture, makeOrnamentTexture, makeShadowTexture } from './textures'

/*
 * Light 3D for presenting: one canvas, one mannequin (≈2.3k triangles), one dress (≈5k), a few ribbons.
 * No shadows, no post-processing, no physics. Cinematic motion: the dress morphs between looks,
 * the camera dollies between shots, everything eases in over about a second.
 */

/** Camera shots: full body → waist → fabric detail → bust close-up. */
const CAMS = [
  { z: 6, y: -0.02 },
  { z: 3.7, y: 0.3 },
  { z: 2.5, y: 0.1 },
  { z: 3.1, y: 0.58 },
]
const TAN = Math.tan(THREE.MathUtils.degToRad(16))
/** Currently-rendered state. Driver writes it, everything else reads it (no React state in the render loop). */
const cur = {
  visible: 0, x: 0, y: 0, scale: 1, spin: 0.2, angle: 0, pattern: 0, trim: 0, wire: 0, fabric: 0, orbit: 0,
  w: [0, 1, 0, 0, 0] as number[],
  pf: 1, // mannequin cross-fade (pose change)
  body: new THREE.Color('#d9d2c5'),
  garment: new THREE.Color('#111111'),
  camZ: 6, camY: 0,
  fade: 1, px: 0, py: 0, time: 0, vw: 6, vh: 3.4,
}
const timeU = { value: 0 }
const perf = { frames: 0 }
const tmp = new THREE.Color()
const BURGUNDY = new THREE.Color('#7C1F2B')
const IVORY = new THREE.Color('#EDE8DE')
const SAND = new THREE.Color('#B7A58A')
const GRAPHITE = new THREE.Color('#25221f')

/** Never draw more than ~2 megapixels of WebGL: bigger screens get a slightly softer 3D layer instead of a slower one. */
const MAX_PIXELS = 2.0e6

/** One plain low plinth under both feet (replaces the GLB's rod + disc, whose disc never fitted the feet). */
const PLINTH_GEO = new THREE.CylinderGeometry(1, 1.035, 0.034, 72)
function addPlinth(root: THREE.Group, fit: BodyFit) {
  const p = new THREE.Mesh(PLINTH_GEO)
  p.userData.plinth = true
  p.scale.set(fit.plinth.rx, 1, fit.plinth.rz)
  p.position.set(fit.plinth.cx, MODEL_Y - 0.0175, fit.plinth.cz)
  root.add(p)
}

/* ───────── lazily loaded mannequin assets (CC0 GLB served locally) ───────── */

type Key = 'standing' | 'walking' | 'mirror'
interface Loaded { root: THREE.Group; fit: BodyFit }
const loaded: Partial<Record<Key | 'fallback', Loaded>> = {}
const loading: Partial<Record<Key, boolean>> = {}
const sources: Partial<Record<'standing' | 'walking', THREE.Group>> = {}
const failed = { v: false }
const gltf = new GLTFLoader()
const url = (n: string) => `${import.meta.env.BASE_URL}models/mannequin-${n}.glb`

function ensureLoaded(key: Key) {
  if (loaded[key] || loading[key] || failed.v) return
  loading[key] = true
  const base = key === 'mirror' ? 'standing' : key
  const ready = sources[base] ? Promise.resolve(sources[base]!) : gltf.loadAsync(url(base)).then((g) => (sources[base] = g.scene))
  ready
    .then((scene) => {
      const mirror = key === 'mirror'
      const fit = fitFromModel(scene, mirror) // measured on the untouched GLB (the dress is tailored to this)
      const model = scene.clone(true) // what we show: smooth head, feet as shoes, no rod
      splitMannequin(model)
      model.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh && !m.userData.shoe) m.userData.body = true
      })
      const root = new THREE.Group()
      model.scale.set(mirror ? -MODEL_SCALE : MODEL_SCALE, MODEL_SCALE, MODEL_SCALE)
      model.position.y = MODEL_Y
      root.add(model)
      addPlinth(root, fit)
      loaded[key] = { root, fit }
    })
    .catch((e) => {
      console.warn('[mannequin] GLB failed, using the built-in fallback body', e)
      failed.v = true
    })
    .finally(() => {
      loading[key] = false
      bus.wake()
    })
}

/** Emergency body when the GLB cannot be loaded (built from the analytic anatomy). */
function makeFallback(): Loaded {
  const root = new THREE.Group()
  const p = POSES[0]
  const mk = (g: THREE.BufferGeometry) => {
    const m = new THREE.Mesh(g)
    m.userData.body = true
    root.add(m)
    return m
  }
  mk(buildTorso(p))
  mk(buildLeg(p.legA))
  mk(buildLeg(p.legB))
  mk(buildArm(p.armA))
  mk(buildArm(p.armB))
  mk(buildHead()).position.set(0, 1.03, 0.03)
  const fit = fitFromAnatomy()
  addPlinth(root, fit)
  return { root, fit }
}

function Driver() {
  const { camera, size, invalidate, gl, setDpr } = useThree()
  const quality = useRef({ avg: 12, n: 0, dpr: gl.getPixelRatio(), probe: null as null | { before: number; prev: number }, locked: false })
  useEffect(() => {
    bus.wake = () => invalidate()
    invalidate()
    return () => {
      bus.wake = () => {}
    }
  }, [invalidate])

  // resolution follows a pixel budget (recomputed on resize / fullscreen)
  useEffect(() => {
    const budget = Math.sqrt(MAX_PIXELS / Math.max(size.width * size.height, 1))
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25, Math.max(budget, 0.6))
    const q = quality.current
    q.dpr = dpr
    q.probe = null
    q.locked = false
    q.n = 0
    setDpr(dpr)
  }, [size.width, size.height, setDpr])

  useFrame((_, rawDt) => {
    perf.frames++
    const dt = Math.min(rawDt, 0.05)
    const T = store.target
    const d = (a: number, b: number, l = 3) => THREE.MathUtils.damp(a, b, l, dt)
    const aspect = size.width / size.height
    cur.vw = 2 * TAN * 6 * aspect
    cur.vh = 2 * TAN * 6
    const portrait = aspect < 0.9
    cur.fade = d(cur.fade, portrait ? 0.32 : 1, 4)
    const cp = CAMS[T.cam] ?? CAMS[0]
    cur.camZ = d(cur.camZ, cp.z, 1.5)
    cur.camY = d(cur.camY, cp.y, 1.5)
    const halfW = TAN * cur.camZ * aspect // keeps the figure on the same screen column while the camera moves
    cur.visible = d(cur.visible, T.visible, 2.4)
    cur.x = d(cur.x, portrait ? 0 : T.x * halfW, 2.6)
    cur.y = d(cur.y, T.y + (portrait ? cur.vh * 0.12 : 0), 2.6)
    cur.scale = d(cur.scale, T.scale * (portrait ? 0.6 : 1), 2.6)
    cur.spin = d(cur.spin, store.reduced ? 0 : T.spin, 2)
    cur.pattern = d(cur.pattern, T.pattern, 2.6)
    cur.trim = d(cur.trim, T.trim, 2.6)
    cur.wire = d(cur.wire, T.wire, 2.6)
    cur.fabric = d(cur.fabric, T.fabric, 1.6)
    cur.orbit = d(cur.orbit, T.orbit, 1.6)
    // the dress morphs smoothly from one look to the next
    for (let k = 0; k < 5; k++) cur.w[k] = d(cur.w[k], T.w[k] ?? 0, 2.4)
    const f = 1 - Math.exp(-3 * dt)
    cur.body.lerp(tmp.set(T.body), f)
    cur.garment.lerp(tmp.set(T.garment), f)
    cur.angle += cur.spin * dt
    cur.px += (store.ptr.x - cur.px) * (1 - Math.exp(-3.5 * dt))
    cur.py += (store.ptr.y - cur.py) * (1 - Math.exp(-3.5 * dt))
    if (!store.reduced) cur.time += dt
    timeU.value = cur.time
    // slow cinematic dolly / drift
    camera.position.set(Math.sin(cur.time * 0.17) * 0.12 + cur.px * 0.07, cur.y + cur.camY * cur.scale + Math.sin(cur.time * 0.11) * 0.03, cur.camZ)
    camera.lookAt(0, camera.position.y, 0)

    // adaptive resolution: if frames are slow, try fewer pixels; keep that only if it really helps
    // (otherwise the limit is not the GPU — e.g. power saving — and we put the resolution back)
    if (rawDt < 0.1 && perf.frames > 90) {
      const q = quality.current
      q.avg += (rawDt * 1000 - q.avg) * 0.08
      if (++q.n > 60 && !q.locked) {
        q.n = 0
        if (q.probe) {
          if (q.avg > q.probe.before * 0.85) {
            q.dpr = q.probe.prev
            q.locked = true
            setDpr(q.dpr)
          }
          q.probe = null
        } else if (q.avg > 20 && q.dpr > 0.7) {
          q.probe = { before: q.avg, prev: q.dpr }
          q.dpr = Math.max(0.7, q.dpr - 0.2)
          setDpr(q.dpr)
        }
      }
    }

    // render only while something is visible or moving; slides without 3D cost nothing
    const settled = cur.visible < 0.01 && T.visible === 0 && cur.fabric < 0.01 && T.fabric === 0 && cur.orbit < 0.01 && T.orbit === 0
    if (!settled || loading.standing || loading.walking || loading.mirror) invalidate()
  })
  return null
}

/** Very simple scripted cloth motion: the hem breathes a little (vertex shader), the inside of the fabric is darker. */
function clothify(m: THREE.MeshStandardMaterial, amp: number) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU
    sh.vertexShader =
      'uniform float uTime;\n' +
      sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
      float hw = smoothstep(0.3, -0.95, position.y);
      float an = atan(position.z, position.x);
      float s1 = 0.5 + 0.5 * sin(uTime * 1.25 + an * 3.0 + position.y * 2.2);
      float s2 = 0.5 + 0.5 * sin(uTime * 0.8 - an * 5.0 + position.y * 4.0);
      transformed += normal * (s1 * 0.011 + s2 * 0.007) * hw * ${amp.toFixed(2)};`
      )
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n      if (!gl_FrontFacing) diffuseColor.rgb *= 0.5;')
  }
  m.customProgramCacheKey = () => 'cloth' + amp
}

type MeshRef = THREE.Mesh | null
const swap = (m: MeshRef, g: THREE.BufferGeometry) => {
  if (!m) return
  const old = m.geometry
  m.geometry = g
  old.dispose()
}

function Mannequin() {
  const group = useRef<THREE.Group>(null)
  const slot = useRef<THREE.Group>(null)
  const r = useRef<Record<string, MeshRef>>({})
  const set = (k: string) => (m: MeshRef) => { r.current[k] = m }
  const last = useRef<number[] | null>(null)
  const active = useRef<Key | 'fallback' | null>(null)
  const fit = useRef<BodyFit | null>(null)
  const flags = useRef({ sleeveA: false, sleeveB: false, belt: false, collar: false })
  const announced = useRef(false)
  const warmed = useRef(0)

  const beltGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 0.05, 48, 1, true), [])
  const collarGeo = useMemo(() => withWhiteVertexColors(new THREE.CylinderGeometry(0.88, 1, 1, 32, 1, true)), [])
  const tex = useMemo(() => makeOrnamentTexture(), [])
  const bandTex = useMemo(() => makeBandTexture(), [])
  const blob = useMemo(() => makeShadowTexture(), [])

  // simple materials: matte porcelain body, standard fabrics, unlit ornament overlays
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0 }), [])
  const garmentMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, vertexColors: true })
    clothify(m, 1)
    return m
  }, [])
  const layerMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, transparent: true, vertexColors: true, roughness: 0.35, depthWrite: false })
    clothify(m, 2.2)
    return m
  }, [])
  const wireMat = useMemo(() => new THREE.MeshBasicMaterial({ color: SAND, wireframe: true, transparent: true, depthWrite: false }), [])
  const ornProps = { transparent: true, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }
  const ornMat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, ...ornProps }), [tex])
  const trimMat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, ...ornProps }), [tex])
  const bandMat = useMemo(() => new THREE.MeshBasicMaterial({ map: bandTex, ...ornProps }), [bandTex])
  const beltMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.1, side: THREE.DoubleSide }), [])
  const plinthMat = useMemo(() => new THREE.MeshStandardMaterial({ color: GRAPHITE, roughness: 0.35, metalness: 0.3, transparent: true }), [])
  const shoeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: SAND, roughness: 0.4, metalness: 0.12, transparent: true, vertexColors: true }), [])
  const blobRef = useRef<THREE.Mesh>(null)
  const blobMat = useMemo(() => new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false }), [blob])

  // release GPU resources when the scene goes away
  useEffect(
    () => () => {
      ;[bodyMat, garmentMat, layerMat, wireMat, ornMat, trimMat, bandMat, beltMat, plinthMat, shoeMat, blobMat].forEach((m) => m.dispose())
      ;[tex, bandTex, blob].forEach((t) => t.dispose())
      ;[beltGeo, collarGeo].forEach((g) => g.dispose())
      Object.values(r.current).forEach((m) => m?.geometry.dispose())
      Object.values(loaded).forEach((l) => l?.root.traverse((o) => (o as THREE.Mesh).geometry?.dispose()))
    },
    [bodyMat, garmentMat, layerMat, wireMat, ornMat, trimMat, bandMat, beltMat, plinthMat, shoeMat, blobMat, tex, bandTex, blob, beltGeo, collarGeo]
  )

  const attach = (key: Key | 'fallback') => {
    const l = loaded[key]!
    const s = slot.current!
    while (s.children.length) s.remove(s.children[0])
    l.root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) m.material = m.userData.body ? bodyMat : m.userData.shoe ? shoeMat : plinthMat
    })
    s.add(l.root)
    const pl = l.fit.plinth
    if (blobRef.current) {
      blobRef.current.position.set(pl.cx, MODEL_Y + 0.002, pl.cz)
      blobRef.current.scale.set(pl.rx * 3.2, pl.rz * 3.2, 1)
    }
    fit.current = l.fit
    active.current = key
    last.current = null // rebuild the dress for the new body
  }

  useFrame((_, rawDt) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(rawDt, 0.05)
    const T = store.target
    const vis = cur.visible
    const want: Key = T.pose === 1 ? 'walking' : T.pose === 2 ? 'mirror' : 'standing'
    if (T.visible > 0 || vis > 0.01) {
      ensureLoaded(want)
      if (failed.v && !loaded.fallback) loaded.fallback = makeFallback()
    }
    const target: Key | 'fallback' = failed.v ? 'fallback' : want
    if (loaded[target]) {
      if (!active.current) attach(target)
      else if (active.current !== target) {
        cur.pf = THREE.MathUtils.damp(cur.pf, 0, 9, dt) // cross-fade to the other pose
        if (cur.pf < 0.05) attach(target)
      } else cur.pf = THREE.MathUtils.damp(cur.pf, 1, 7, dt)
    }
    // the second pose is tiny (~125 KB): fetch it quietly once the first mannequin has been on screen for a moment
    if (active.current && active.current !== 'walking') {
      warmed.current += dt
      if (warmed.current > 1.5 && warmed.current < 100 && !loaded.walking && !loading.walking) {
        warmed.current = 100
        ensureLoaded('walking')
      }
    }
    g.visible = vis > 0.01 && !!fit.current
    if (!g.visible) return
    g.scale.setScalar(cur.scale * (0.86 + 0.14 * vis))
    g.position.set(cur.x + cur.px * 0.12, cur.y - (1 - vis) * 0.25 + cur.py * 0.05, 0)
    g.rotation.set(-cur.py * 0.035, cur.angle + cur.px * 0.18, 0)

    const w = cur.w
    const L = last.current
    let dirty = !L
    if (L) for (let k = 0; k < 5; k++) if (Math.abs(L[k] - w[k]) > 1e-4) dirty = true
    const m = r.current
    if (dirty) {
      last.current = [...w]
      const bf = fit.current!
      const body = buildGarment(w, bf)
      swap(m.garment, body)
      if (m.wire) m.wire.geometry = body
      if (m.orn) m.orn.geometry = body
      swap(m.layer, buildGarment(w, bf, true))
      for (const s of ['A', 'B'] as const) {
        const sg = buildSleeve(w, bf, s)
        swap(m['sleeve' + s], sg)
        if (m['sleeveOrn' + s]) m['sleeveOrn' + s]!.geometry = sg
        flags.current[('sleeve' + s) as 'sleeveA' | 'sleeveB'] = sleeveLength(w, s) > 0.05
      }
      // sash
      const bAmt = beltAmount(w)
      const gb = garmentAt(w, bf, 0.33)
      flags.current.belt = bAmt > 0.05
      for (const k of ['belt', 'beltOrn'] as const) {
        const bm = m[k]
        if (!bm) continue
        const e = k === 'beltOrn' ? 0.012 : 0.004
        bm.position.set(gb.cx, 0.33, gb.cz)
        bm.scale.set(gb.rx + e, 0.6 + 0.9 * bAmt, gb.rz + e)
      }
      // stand collar
      const ch = collarHeight(w)
      const nk = garmentAt(w, bf, 0.8)
      flags.current.collar = ch > 0.02
      for (const k of ['collar', 'collarOrn'] as const) {
        const cm = m[k]
        if (!cm) continue
        const e = k === 'collarOrn' ? 0.006 : 0
        cm.position.set(nk.cx, 0.765 + ch / 2, nk.cz)
        cm.scale.set(0.074 + e, Math.max(ch, 0.001), 0.076 + e)
      }
    }

    // fade + materials (opaque whenever fully shown: cheaper, better depth rejection)
    const fade = cur.fade * vis * cur.pf
    const mt = blendMat(w)
    const solid = fade > 0.995
    if (bodyMat.transparent === solid) bodyMat.transparent = !solid
    bodyMat.color.copy(cur.body)
    bodyMat.opacity = fade
    plinthMat.opacity = fade
    shoeMat.opacity = fade
    garmentMat.color.copy(cur.garment).multiplyScalar(mt.dark)
    garmentMat.roughness = mt.rough
    garmentMat.metalness = mt.metal
    garmentMat.envMapIntensity = 1 + 1.4 * mt.metal
    const gSolid = fade > 0.995 && cur.wire < 0.01
    if (garmentMat.transparent === gSolid) garmentMat.transparent = !gSolid
    garmentMat.opacity = fade * (1 - 0.72 * cur.wire)
    garmentMat.emissive.copy(cur.garment).multiplyScalar(0.35 * cur.wire)
    const la = layerAmount(w)
    layerMat.color.copy(cur.garment).lerp(IVORY, 0.12)
    layerMat.opacity = fade * 0.42 * la
    wireMat.opacity = fade * cur.wire
    const lum = cur.garment.r * 0.3 + cur.garment.g * 0.59 + cur.garment.b * 0.11
    const ornCol = lum > 0.42 ? BURGUNDY : IVORY
    ornMat.color.copy(ornCol)
    trimMat.color.copy(ornCol)
    bandMat.color.copy(ornCol)
    ornMat.opacity = fade * cur.pattern
    trimMat.opacity = fade * cur.trim
    bandMat.opacity = fade * cur.trim
    beltMat.color.copy(lum > 0.42 ? BURGUNDY : SAND)
    blobMat.opacity = fade

    // skip draw calls that would be invisible anyway
    const fl = flags.current
    const trimOn = cur.trim > 0.01
    if (m.layer) m.layer.visible = la > 0.03
    if (m.wire) m.wire.visible = cur.wire > 0.01
    if (m.orn) m.orn.visible = cur.pattern > 0.01
    if (m.sleeveA) m.sleeveA.visible = fl.sleeveA
    if (m.sleeveB) m.sleeveB.visible = fl.sleeveB
    if (m.sleeveOrnA) m.sleeveOrnA.visible = fl.sleeveA && trimOn
    if (m.sleeveOrnB) m.sleeveOrnB.visible = fl.sleeveB && trimOn
    if (m.belt) m.belt.visible = fl.belt
    if (m.beltOrn) m.beltOrn.visible = fl.belt && trimOn
    if (m.collar) m.collar.visible = fl.collar
    if (m.collarOrn) m.collarOrn.visible = fl.collar && trimOn

    if (!announced.current && vis > 0.25 && cur.pf > 0.5) {
      announced.current = true
      setReady(true) // the DOM placeholder can go away
    }
  })

  return (
    <group ref={group} visible={false}>
      <group ref={slot} />
      <mesh ref={set('garment')} material={garmentMat} renderOrder={1}><bufferGeometry /></mesh>
      <mesh ref={set('orn')} material={ornMat} scale={[1.004, 1, 1.004]} renderOrder={3}><bufferGeometry /></mesh>
      <mesh ref={set('wire')} material={wireMat} scale={[1.012, 1, 1.012]} renderOrder={4}><bufferGeometry /></mesh>
      <mesh ref={set('layer')} material={layerMat} renderOrder={5}><bufferGeometry /></mesh>
      <mesh ref={set('sleeveA')} material={garmentMat} renderOrder={2}><bufferGeometry /></mesh>
      <mesh ref={set('sleeveB')} material={garmentMat} renderOrder={2}><bufferGeometry /></mesh>
      <mesh ref={set('sleeveOrnA')} material={trimMat} scale={1.012} renderOrder={3}><bufferGeometry /></mesh>
      <mesh ref={set('sleeveOrnB')} material={trimMat} scale={1.012} renderOrder={3}><bufferGeometry /></mesh>
      <mesh ref={set('belt')} geometry={beltGeo} material={beltMat} renderOrder={2} />
      <mesh ref={set('beltOrn')} geometry={beltGeo} material={bandMat} renderOrder={3} />
      <mesh ref={set('collar')} geometry={collarGeo} material={garmentMat} renderOrder={2} />
      <mesh ref={set('collarOrn')} geometry={collarGeo} material={bandMat} renderOrder={3} />
      <mesh ref={blobRef} position={[0, -1.0, 0.04]} rotation={[-Math.PI / 2, 0, 0]} material={blobMat}>
        <planeGeometry args={[1, 1]} />
      </mesh>
    </group>
  )
}

/** Soft studio light: key + fill + rim, plus the environment map (no shadow maps). */
function Lights() {
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[-3, 4, 4]} intensity={2.1} color="#fff0dc" />
      <directionalLight position={[3.5, 1, 3]} intensity={0.75} color="#dfe5f5" />
      <directionalLight position={[3.6, 2, -3.5]} intensity={1.5} color="#ecc7cf" />
    </>
  )
}

/** Slim silk ribbons drifting through the scene. */
const FABRICS = [
  { rx: 0.44, ry: 0.22, sp: 0.16, ph: 0, z: -1.6, y: 0.25, size: 1.5, wid: 0.5, col: 'burgundy' },
  { rx: 0.36, ry: 0.3, sp: -0.12, ph: 2.1, z: -0.4, y: -0.3, size: 1.25, wid: 0.36, col: 'sand' },
  { rx: 0.47, ry: 0.18, sp: 0.2, ph: 4.2, z: 0.7, y: 0.5, size: 0.9, wid: 0.3, col: 'garment' },
  { rx: 0.4, ry: 0.28, sp: -0.09, ph: 5.4, z: -1.1, y: -0.55, size: 1.3, wid: 0.42, col: 'burgundy' },
]

function Fabric({ cfg }: { cfg: (typeof FABRICS)[number] }) {
  const mesh = useRef<THREE.Mesh>(null)
  const geo = useMemo(() => new THREE.PlaneGeometry(cfg.wid, 2.4, 8, 56), [cfg.wid])
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, transparent: true, roughness: 0.45 }), [])
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat]
  )
  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const o = cur.fabric
    m.visible = o > 0.01
    if (!m.visible) return
    const t = cur.time
    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3]
      const y = base[i * 3 + 1]
      const tw = y * 1.5 + t * 0.55 + cfg.ph
      pos.setX(i, x * Math.cos(tw) + Math.sin(y * 1.8 + t * 0.7 + cfg.ph) * 0.25)
      pos.setZ(i, x * Math.sin(tw) + Math.sin(y * 2.4 - t * 1.1 + cfg.ph) * 0.18)
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
    const a = t * cfg.sp * 2 + cfg.ph
    const mx = cur.px * (0.25 + cfg.z * 0.1)
    m.position.set(Math.cos(a) * cfg.rx * cur.vw + mx, cfg.y + Math.sin(a * 0.8) * cfg.ry * cur.vh * 0.5, cfg.z)
    m.rotation.set(Math.sin(a) * 0.3, 0, Math.cos(a * 0.7) * 0.5)
    m.scale.setScalar(cfg.size * 0.72)
    mat.color.copy(cfg.col === 'burgundy' ? BURGUNDY : cfg.col === 'sand' ? SAND : cur.garment)
    mat.opacity = o * 0.55 * cur.fade
  })
  return <mesh ref={mesh} geometry={geo} material={mat} visible={false} />
}

/** Four miniature garments orbiting on a tilted ellipse (slide "cultural code"). Low-poly versions. */
function Orbit() {
  const group = useRef<THREE.Group>(null)
  const geos = useMemo(() => {
    const f = fitFromAnatomy()
    return [0, 1, 2, 3].map((k) => buildGarment([0, 1, 2, 3, 4].map((j) => (j === k ? 1 : 0)), f, false, 1))
  }, [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6, transparent: true, vertexColors: true }), [])
  useEffect(
    () => () => {
      geos.forEach((g) => g.dispose())
      mat.dispose()
    },
    [geos, mat]
  )
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  useFrame(() => {
    const g = group.current
    if (!g) return
    g.visible = cur.orbit > 0.01
    if (!g.visible) return
    mat.color.copy(cur.garment)
    mat.opacity = cur.orbit * cur.fade * 0.8
    meshes.current.forEach((m, k) => {
      if (!m) return
      const a = cur.time * 0.22 + (k * Math.PI) / 2
      m.position.set(Math.cos(a) * cur.vw * 0.44, Math.sin(a) * cur.vh * 0.4, Math.sin(a) * 0.8 - 0.4)
      m.rotation.y = cur.time * 0.5 + k
      m.rotation.z = Math.cos(a) * 0.15
      m.scale.setScalar(0.4 * cur.orbit)
    })
  })
  return (
    <group ref={group} visible={false}>
      {geos.map((geo, k) => (
        <mesh key={k} geometry={geo} material={mat} ref={(m) => { meshes.current[k] = m }} />
      ))}
    </group>
  )
}

/** Development-only HUD: FPS, triangles, draw calls, geometries / textures / programs. Hidden by default — press P to show it. */
function PerfHud() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __perf: typeof perf; __cur: typeof cur; __store: typeof store; __cams: typeof CAMS }
    w.__perf = perf
    w.__cur = cur
    w.__store = store
    w.__cams = CAMS
    const el = document.createElement('div')
    el.style.cssText = 'position:fixed;top:34px;left:50%;transform:translateX(-50%);z-index:99;font:11px/1.5 ui-monospace,monospace;color:#9f9;background:rgba(0,0,0,.7);padding:5px 9px;pointer-events:none;white-space:pre;text-align:center'
    let shown = false
    try {
      shown = localStorage.getItem('perfhud') === '1'
    } catch {
      /* private mode */
    }
    el.style.display = shown ? 'block' : 'none'
    document.body.appendChild(el)
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'p' || e.key === 'P' || e.key === 'з' || e.key === 'З') {
        shown = !shown
        el.style.display = shown ? 'block' : 'none'
        try {
          localStorage.setItem('perfhud', shown ? '1' : '0')
        } catch {
          /* private mode */
        }
      }
    }
    window.addEventListener('keydown', onKey)
    let n0 = perf.frames
    let t0 = performance.now()
    const id = window.setInterval(() => {
      const t = performance.now()
      const fps = ((perf.frames - n0) * 1000) / (t - t0)
      n0 = perf.frames
      t0 = t
      if (!shown) return
      const i = gl.info
      el.textContent = `FPS: ${fps < 1 ? 'idle' : fps.toFixed(0)}  TRIANGLES: ${(i.render.triangles / 1000).toFixed(1)}K  DRAW CALLS: ${i.render.calls}\nGEOMETRIES: ${i.memory.geometries}  TEXTURES: ${i.memory.textures}  PROGRAMS: ${i.programs?.length ?? 0}  DPR: ${gl.getPixelRatio().toFixed(2)}`
    }, 500)
    return () => {
      clearInterval(id)
      window.removeEventListener('keydown', onKey)
      el.remove()
    }
  }, [gl])
  return null
}

export default function Scene() {
  return (
    <Canvas
      className="scene"
      frameloop="demand"
      dpr={[1, 1.25]}
      camera={{ position: [0, 0, 6], fov: 32 }}
      // MSAA is skipped on very large screens: the layer is drawn below native resolution there anyway,
      // and multisampling a huge mostly-empty canvas is what slows integrated GPUs down
      gl={{ antialias: window.innerWidth * window.innerHeight < 2.2e6, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl, scene }) => {
        // tiny procedural studio environment (one-off, no network assets)
        const pm = new THREE.PMREMGenerator(gl)
        const env = pm.fromScene(new RoomEnvironment(), 0.04)
        scene.environment = env.texture
        scene.environmentIntensity = 0.5
        pm.dispose()
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.0
      }}
    >
      <Driver />
      <Lights />
      <Mannequin />
      {FABRICS.map((f, k) => (
        <Fabric key={k} cfg={f} />
      ))}
      <Orbit />
      <PerfHud />
    </Canvas>
  )
}
