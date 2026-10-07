import * as THREE from 'three'
import { sample, smooth, sweep, type Key } from './anatomy'
import { fitArmRadius, fitCenter, fitPolar, fitRx, fitRz, type BodyFit } from './fit'

/**
 * Five designed garments. Everything is parametric so that any weighted mix of them morphs smoothly:
 * 0 heritage · 1 LOOK 01 tradition × modern · 2 LOOK 02 couture · 3 LOOK 03 digital · 4 protest silhouette.
 */

interface Fold { n: number; amp: number; p: number; tri: number; ph: number; sw: number }
export interface Mat { rough: number; metal: number; sheen: number; sheenRough: number; clear: number; dark: number }
interface Design {
  hem: number // lowest hem (y)
  tilt: number // how much the front of the hem is lifted
  keys: Key[] // [y, rx]
  folds: Fold[]
  neckF: number; neckB: number // neckline depth front / back
  sleeve: { len: number; puff: number; flare: number; ease: number; A: number; B: number }
  collar: number
  belt: number
  layer: number // organza over-layer amount
  hemWave: number // scalloping of the hem
  mat: Mat
}

const COTTON: Mat = { rough: 0.88, metal: 0, sheen: 0.35, sheenRough: 0.8, clear: 0, dark: 1 }
const SILK: Mat = { rough: 0.46, metal: 0, sheen: 1, sheenRough: 0.32, clear: 0.12, dark: 1 }
const VELVET: Mat = { rough: 0.95, metal: 0, sheen: 1, sheenRough: 0.85, clear: 0, dark: 0.78 }
const METAL: Mat = { rough: 0.3, metal: 0.8, sheen: 0, sheenRough: 0.5, clear: 0.55, dark: 1 }
const SATIN: Mat = { rough: 0.3, metal: 0.05, sheen: 0.7, sheenRough: 0.3, clear: 0.4, dark: 1 }

export const DESIGNS: Design[] = [
  {
    // heritage: long gathered dress, wide sleeves, sash
    hem: -0.97, tilt: 0,
    keys: [[-0.97, 0.52], [-0.6, 0.4], [-0.2, 0.3], [0.08, 0.225], [0.2, 0.19], [0.33, 0.125], [0.45, 0.15], [0.55, 0.17], [0.66, 0.19], [0.72, 0.2], [0.755, 0.12], [0.78, 0.065]],
    folds: [{ n: 15, amp: 0.034, p: 1.2, tri: 0, ph: 0, sw: 0 }, { n: 6, amp: 0.022, p: 0.8, tri: 0, ph: 1, sw: 0.5 }, { n: 23, amp: 0.012, p: 0.6, tri: 0, ph: 2, sw: 0 }],
    neckF: 0.02, neckB: 0, sleeve: { len: 0.98, puff: 0.5, flare: 1.7, ease: 0.3, A: 1, B: 1 },
    collar: 0.035, belt: 1, layer: 0, hemWave: 0.016, mat: COTTON,
  },
  {
    // LOOK 01: fitted bodice, stand collar, slim 3/4 sleeves, flared midi skirt
    hem: -0.76, tilt: 0.04,
    keys: [[-0.76, 0.34], [-0.3, 0.27], [0.08, 0.205], [0.2, 0.175], [0.33, 0.12], [0.45, 0.142], [0.55, 0.162], [0.66, 0.178], [0.72, 0.19], [0.755, 0.1], [0.78, 0.065]],
    folds: [{ n: 9, amp: 0.02, p: 1.1, tri: 0, ph: 0.4, sw: 0.3 }, { n: 4, amp: 0.012, p: 0.7, tri: 0, ph: 1.7, sw: 0 }],
    neckF: 0, neckB: 0, sleeve: { len: 0.82, puff: 0.1, flare: 0.5, ease: 0.2, A: 1, B: 1 },
    collar: 0.075, belt: 0.85, layer: 0, hemWave: 0.008, mat: SILK,
  },
  {
    // LOOK 02: sculptural couture — peplum volume, tulip skirt, boat neck, one dramatic sleeve
    hem: -0.92, tilt: 0.5,
    keys: [[-0.92, 0.3], [-0.55, 0.25], [-0.15, 0.285], [0.08, 0.32], [0.2, 0.225], [0.33, 0.12], [0.45, 0.15], [0.55, 0.17], [0.66, 0.2], [0.72, 0.225], [0.755, 0.12], [0.78, 0.065]],
    folds: [{ n: 7, amp: 0.045, p: 0.9, tri: 0.15, ph: 0.3, sw: 0.9 }, { n: 3, amp: 0.035, p: 0.6, tri: 0, ph: 1.2, sw: 0 }],
    neckF: 0.11, neckB: 0.03, sleeve: { len: 0.74, puff: 1.5, flare: 0.8, ease: 0.25, A: 1, B: 0 },
    collar: 0, belt: 0, layer: 0.8, hemWave: 0.028, mat: VELVET,
  },
  {
    // LOOK 03: digital — geometric sheath, sharp shoulders, translucent over-layer, metallic
    hem: -0.96, tilt: 0.08,
    keys: [[-0.96, 0.17], [-0.5, 0.15], [0.08, 0.185], [0.2, 0.16], [0.33, 0.115], [0.45, 0.14], [0.55, 0.16], [0.66, 0.19], [0.72, 0.24], [0.755, 0.13], [0.78, 0.065]],
    folds: [{ n: 8, amp: 0.028, p: 0.3, tri: 1, ph: 0, sw: 0.3 }, { n: 4, amp: 0.016, p: 0.2, tri: 1, ph: 0.8, sw: 0 }],
    neckF: 0.05, neckB: 0, sleeve: { len: 0.55, puff: 0.7, flare: 0.3, ease: 0.15, A: 1, B: 1 },
    collar: 0.05, belt: 0.4, layer: 1, hemWave: 0.0, mat: METAL,
  },
  {
    // protest silhouette: huge shoulders, short asymmetric volume
    hem: -0.4, tilt: 0.5,
    keys: [[-0.4, 0.46], [-0.1, 0.34], [0.08, 0.26], [0.2, 0.18], [0.33, 0.1], [0.45, 0.17], [0.55, 0.2], [0.66, 0.26], [0.72, 0.34], [0.755, 0.16], [0.78, 0.07]],
    folds: [{ n: 5, amp: 0.1, p: 1.5, tri: 0, ph: 0.4, sw: 1.1 }, { n: 9, amp: 0.03, p: 1, tri: 0.3, ph: 2, sw: 0 }],
    neckF: 0, neckB: 0, sleeve: { len: 0.4, puff: 1.8, flare: 0.5, ease: 0.3, A: 1, B: 1 },
    collar: 0, belt: 0, layer: 0, hemWave: 0.035, mat: SATIN,
  },
]

const SEG = 64
const ROWS = 40
const wave = (x: number, tri: number) => (1 - tri) * Math.sin(x) + tri * (2 / Math.PI) * Math.asin(Math.sin(x))
const norm = (w: number[]) => {
  const s = w.reduce((a, b) => a + b, 0) || 1
  return w.map((x) => x / s)
}
const mix = (wn: number[], f: (d: Design) => number) => DESIGNS.reduce((a, d, k) => a + wn[k] * f(d), 0)

export function blendMat(w: number[]): Mat {
  const wn = norm(w)
  return {
    rough: mix(wn, (d) => d.mat.rough), metal: mix(wn, (d) => d.mat.metal), sheen: mix(wn, (d) => d.mat.sheen),
    sheenRough: mix(wn, (d) => d.mat.sheenRough), clear: mix(wn, (d) => d.mat.clear), dark: mix(wn, (d) => d.mat.dark),
  }
}
export const layerAmount = (w: number[]) => mix(norm(w), (d) => d.layer)
export const beltAmount = (w: number[]) => mix(norm(w), (d) => d.belt)
export const collarHeight = (w: number[]) => mix(norm(w), (d) => d.collar)

/** Garment half-widths (ellipse) and centre at height y — grown just enough to cover the real body; used for belt / collar. */
export function garmentAt(w: number[], fit: BodyFit, y: number) {
  const wn = norm(w)
  let rx = 0
  for (let k = 0; k < DESIGNS.length; k++) if (wn[k]) rx += wn[k] * sample(DESIGNS[k].keys, y)
  rx = Math.max(rx, fitRx(fit, y) + 0.012)
  let rz = Math.max(rx * (0.9 - 0.18 * smooth(0.1, 0.5, y)), fitRz(fit, y) + 0.012)
  if (fit.pol) {
    let k = 1
    for (let j = 0; j < 36; j++) {
      const th = (j / 36) * Math.PI * 2
      const re = (rx * rz) / Math.hypot(rz * Math.cos(th), rx * Math.sin(th))
      k = Math.max(k, (fitPolar(fit, y, th) + 0.012) / re)
    }
    rx *= k
    rz *= k
  }
  const [cx, cz] = fitCenter(fit, y)
  return { rx, rz, cx, cz }
}

/** Skirt / bodice surface for a weighted mix; `layer` builds the translucent over-skirt. */
export function buildGarment(w: number[], fit: BodyFit, layer = false, lod = 0): THREE.BufferGeometry {
  const wn = norm(w)
  const hem0 = mix(wn, (d) => d.hem)
  const tilt = mix(wn, (d) => d.tilt)
  const nF = mix(wn, (d) => d.neckF)
  const nB = mix(wn, (d) => d.neckB)
  const hemWave = mix(wn, (d) => d.hemWave)
  // light meshes: ~5k triangles for the dress, ~2k for the over-skirt, ~1.4k for miniatures (lod 1)
  const SEG_ = lod ? 32 : layer ? 40 : SEG
  const ROWS_ = lod ? 22 : layer ? 24 : ROWS
  const cols = SEG_ + 1
  const pos = new Float32Array(ROWS_ * cols * 3)
  const uv = new Float32Array(ROWS_ * cols * 2)
  const col = new Float32Array(ROWS_ * cols * 3)
  const topBase = layer ? 0.345 : 0.78
  for (let j = 0; j < cols; j++) {
    const th = (j / SEG_) * Math.PI * 2
    const front = Math.max(Math.sin(th), 0)
    const back = Math.max(-Math.sin(th), 0)
    const wv = hemWave * (Math.sin(7 * th + 0.4) * 0.6 + Math.sin(11 * th + 1.3) * 0.4)
    const hemTh = wv + (layer ? hem0 + 0.1 + (tilt * 1.3 + 0.08) * (0.5 + 0.5 * Math.sin(th - 0.6)) : hem0 + tilt * (0.5 + 0.5 * Math.sin(th - 0.6)))
    const topTh = layer ? topBase : topBase - nF * front * front - nB * back * back
    for (let i = 0; i < ROWS_; i++) {
      const u = i / (ROWS_ - 1)
      const y = hemTh + (topTh - hemTh) * u
      let rx = 0
      let d = 0
      const fall = Math.min(Math.max((0.36 - y) / 1.31, 0), 1)
      for (let k = 0; k < DESIGNS.length; k++) {
        const wk = wn[k]
        if (!wk) continue
        rx += wk * sample(DESIGNS[k].keys, y)
        for (const f of DESIGNS[k].folds) {
          const n = layer ? f.n + 3 : f.n
          const amp = f.amp * (layer ? 1.9 : 1)
          d += wk * amp * Math.pow(fall, f.p) * wave(n * th + f.ph + (layer ? 1.3 : 0) + f.sw * y * 3, f.tri)
        }
      }
      if (layer) rx = rx + 0.045 + 0.17 * Math.min(Math.max((0.34 - y) / 1.1, 0), 1)
      const gap = 0.007 + 0.006 * (1 - smooth(0.1, 0.45, y))
      if (!fit.pol) rx = Math.max(rx, fitRx(fit, y) + gap)
      let rz = Math.max(rx * (0.9 - 0.18 * smooth(0.1, 0.5, y)), fit.pol ? 0 : fitRz(fit, y) + gap)
      const sc = (rx + d) / Math.max(rx, 1e-4)
      rx += d
      rz *= sc
      const [cx0, cz0] = fitCenter(fit, y)
      // design radius in direction θ, never inside the real mannequin (this is what makes the dress sit ON the body)
      let r = (rx * rz) / Math.hypot(rz * Math.cos(th), rx * Math.sin(th))
      if (fit.pol) r = Math.max(r, fitPolar(fit, y, th) + gap)
      // rolled hem / neckline edge: a slightly thicker lip
      r += 0.007 * Math.max(0, 1 - u / 0.035) + 0.005 * Math.max(0, 1 - (1 - u) / 0.03)
      const idx = i * cols + j
      pos[idx * 3] = cx0 + Math.cos(th) * r
      pos[idx * 3 + 1] = y
      pos[idx * 3 + 2] = cz0 + Math.sin(th) * r
      uv[idx * 2] = j / SEG_
      uv[idx * 2 + 1] = u
      // baked ambient occlusion: valleys of the folds and gathers at the waist are darker
      let shade = 1 + (d / 0.05) * 0.75
      shade *= 1 - 0.14 * Math.exp(-(((y - 0.33) / 0.05) ** 2))
      shade *= 0.9 + 0.1 * smooth(-1, 0.3, y)
      shade = Math.min(Math.max(shade, 0.66), 1.06)
      col[idx * 3] = col[idx * 3 + 1] = col[idx * 3 + 2] = shade
    }
  }
  const index: number[] = []
  for (let i = 0; i < ROWS_ - 1; i++)
    for (let j = 0; j < SEG_; j++) {
      const a = i * cols + j
      const c = a + cols
      index.push(a, c, a + 1, a + 1, c, c + 1) // counter-clockwise seen from outside: outer face = front face
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  const nrm = g.attributes.normal as THREE.BufferAttribute
  for (let i = 0; i < ROWS_; i++) {
    const a = i * cols
    const b = a + SEG_
    const x = nrm.getX(a) + nrm.getX(b)
    const y = nrm.getY(a) + nrm.getY(b)
    const z = nrm.getZ(a) + nrm.getZ(b)
    const l = Math.hypot(x, y, z) || 1
    nrm.setXYZ(a, x / l, y / l, z / l)
    nrm.setXYZ(b, x / l, y / l, z / l)
  }
  return g
}

/** The garment material reads vertex colours (baked AO); give plain parts a neutral white. */
export function withWhiteVertexColors(g: THREE.BufferGeometry) {
  const n = g.attributes.position.count
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3))
  return g
}

export const sleeveLength = (w: number[], side: 'A' | 'B') => mix(norm(w), (d) => d.sleeve.len * d.sleeve[side])

/** Sleeve following the arm: shoulder puff → slim forearm → cuff flare. */
export function buildSleeve(w: number[], fit: BodyFit, side: 'A' | 'B'): THREE.BufferGeometry {
  const wn = norm(w)
  const len = sleeveLength(w, side)
  if (len < 0.05) return new THREE.BufferGeometry()
  const puff = mix(wn, (d) => d.sleeve.puff * d.sleeve[side])
  const flare = mix(wn, (d) => d.sleeve.flare)
  const ease = mix(wn, (d) => d.sleeve.ease)
  const s1 = len * 0.86
  const radius = (s: number) => {
    const u = s / s1
    const bump = Math.exp(-(((s - 0.1) / 0.1) ** 2))
    return fitArmRadius(fit, side === 'A' ? 0 : 1, s) * (1 + ease) + puff * 0.055 * bump + flare * 0.06 * Math.pow(u, 2.4) + 0.006
  }
  const g = sweep(side === 'A' ? fit.arm[0] : fit.arm[1], radius, { radial: 20, segs: 20, s0: 0, s1, open: true })
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)) // v = 0 at the cuff
  withWhiteVertexColors(g)
  return g
}

void THREE
