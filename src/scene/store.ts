/** Mutable scene state shared between DOM slides and the single WebGL scene (no React re-renders in the render loop). */

export interface SceneTarget {
  /** 0..1 — mannequin presence */
  visible: number
  /** horizontal position as a fraction of half the viewport width (-1..1) */
  x: number
  /** vertical offset, world units */
  y: number
  scale: number
  /** rotation speed, rad/s */
  spin: number
  /** weights of the 5 garment forms: heritage, look 01, look 02, look 03, protest */
  w: number[]
  /** ornament bands over the whole garment 0..1 */
  pattern: number
  /** ornament on sleeves / collar / belt only 0..1 */
  trim: number
  /** pose: 0 standing · 1 walking (runway) · 2 standing, mirrored */
  pose: number
  /** camera shot: 0 full body · 1 waist · 2 fabric detail · 3 bust close-up */
  cam: number
  /** hologram wireframe 0..1 */
  wire: number
  /** floating silk ribbons 0..1 */
  fabric: number
  /** orbiting miniature garments 0..1 */
  orbit: number
  body: string
  garment: string
}

export const DEFAULT: SceneTarget = {
  visible: 0,
  x: 0,
  y: 0,
  scale: 1,
  spin: 0.2,
  w: [0, 1, 0, 0, 0],
  pattern: 0,
  trim: 0,
  pose: 0,
  cam: 0,
  wire: 0,
  fabric: 0,
  orbit: 0,
  body: '#d9d2c5',
  garment: '#111111',
}

export const store = {
  target: { ...DEFAULT } as SceneTarget,
  ptr: { x: 0, y: 0 },
  reduced: typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  /** true once the WebGL scene has put the mannequin on screen (before that a light DOM placeholder is shown) */
  ready: false,
  version: 0,
}

/** Lets the (demand-driven) renderer wake up when a slide changes the scene. */
export const bus = { wake: () => {} }

const subs = new Set<() => void>()
const notify = () => {
  store.version++
  subs.forEach((f) => f())
  bus.wake()
}
export const subscribe = (f: () => void) => {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}
export const getVersion = () => store.version

/** Replace the target (unspecified fields fall back to defaults). */
export function setScene(p: Partial<SceneTarget>) {
  store.target = { ...DEFAULT, ...p }
  notify()
}

/** Patch the current target (keeps everything else). */
export function patchScene(p: Partial<SceneTarget>) {
  store.target = { ...store.target, ...p }
  notify()
}

export function setReady(v: boolean) {
  if (store.ready === v) return
  store.ready = v
  notify()
}
