import * as THREE from 'three'

/** Fashion-mannequin anatomy: lofted torso, swept limbs, egg head, three editorial poses. */

export type V3 = [number, number, number]
export type Key = [number, number]

export const FLOOR = -1.0
export const NECK_Y = 0.78

/** Cubic Hermite sample of keyframes [x, value] sorted by x. */
export function sample(keys: Key[], t: number): number {
  const n = keys.length
  if (t <= keys[0][0]) return keys[0][1]
  if (t >= keys[n - 1][0]) return keys[n - 1][1]
  let k = 0
  while (t > keys[k + 1][0]) k++
  const tan = (i: number) => {
    const a = keys[Math.max(i - 1, 0)]
    const b = keys[Math.min(i + 1, n - 1)]
    return (b[1] - a[1]) / (b[0] - a[0])
  }
  const [t0, r0] = keys[k]
  const [t1, r1] = keys[k + 1]
  const h = t1 - t0
  const s = (t - t0) / h
  const s2 = s * s
  const s3 = s2 * s
  return (2 * s3 - 3 * s2 + 1) * r0 + (s3 - 2 * s2 + s) * h * tan(k) + (-2 * s3 + 3 * s2) * r1 + (s3 - s2) * h * tan(k + 1)
}
export const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

/* ───────── poses ───────── */

export interface Pose {
  px: number; pz: number // pelvis offset
  sx: number; sz: number // shoulder-line offset
  headTilt: number; headYaw: number
  legA: V3[]; legB: V3[] // hip, knee, ankle, toe
  armA: V3[]; armB: V3[] // shoulder, elbow, wrist, hand
}

const L = (hx: number, knee: V3, ankle: V3, toe: V3): V3[] => [[hx, 0.02, 0], knee, ankle, toe]

export const POSES: Pose[] = [
  // 0 · elegant stand: weight on one leg, free leg slightly forward, one hand at the waist
  {
    px: -0.028, pz: 0, sx: 0.02, sz: 0.01, headTilt: -0.07, headYaw: 0.18,
    legA: L(0.05, [0.085, -0.5, 0.0], [0.09, -0.905, -0.01], [0.09, -0.995, 0.12]),
    legB: L(-0.1, [-0.07, -0.52, 0.07], [-0.05, -0.91, 0.15], [-0.045, -0.995, 0.27]),
    armA: [[0.19, 0.7, 0], [0.265, 0.43, -0.03], [0.275, 0.18, 0.02], [0.265, 0.07, 0.05]],
    armB: [[-0.19, 0.7, 0], [-0.31, 0.44, -0.04], [-0.12, 0.31, 0.12], [-0.06, 0.29, 0.16]],
  },
  // 1 · runway: mid-stride, arms in counter-swing
  {
    px: 0.012, pz: 0.01, sx: -0.01, sz: -0.01, headTilt: 0.02, headYaw: -0.1,
    legA: L(0.075, [0.08, -0.52, -0.1], [0.07, -0.9, -0.27], [0.07, -0.985, -0.17]),
    legB: L(-0.075, [-0.05, -0.5, 0.15], [-0.04, -0.95, 0.24], [-0.04, -0.995, 0.36]),
    armA: [[0.19, 0.7, 0], [0.25, 0.44, 0.1], [0.2, 0.22, 0.24], [0.18, 0.13, 0.3]],
    armB: [[-0.19, 0.7, 0], [-0.25, 0.45, -0.1], [-0.23, 0.22, -0.2], [-0.22, 0.12, -0.25]],
  },
  // 2 · editorial: hip pushed out, hand on hip, other hand lifted to the collarbone
  {
    px: 0.055, pz: 0, sx: -0.035, sz: 0.02, headTilt: 0.1, headYaw: -0.22,
    legA: L(0.085, [0.1, -0.5, 0.0], [0.1, -0.905, -0.02], [0.1, -0.995, 0.1]),
    legB: L(-0.065, [-0.03, -0.52, 0.11], [0.04, -0.935, 0.13], [0.06, -0.995, 0.26]),
    armA: [[0.19, 0.7, 0], [0.345, 0.45, -0.03], [0.185, 0.27, 0.06], [0.15, 0.24, 0.08]],
    armB: [[-0.19, 0.7, 0], [-0.3, 0.5, 0.06], [-0.15, 0.63, 0.15], [-0.1, 0.66, 0.16]],
  },
]

const flat = (p: Pose): number[] => [p.px, p.pz, p.sx, p.sz, p.headTilt, p.headYaw, ...p.legA.flat(), ...p.legB.flat(), ...p.armA.flat(), ...p.armB.flat()]
const chunk = (a: number[], o: number, n: number): V3[] => Array.from({ length: n }, (_, i) => [a[o + i * 3], a[o + i * 3 + 1], a[o + i * 3 + 2]] as V3)

export function blendPose(w: number[]): Pose {
  const sum = w.reduce((a, b) => a + b, 0) || 1
  const f = POSES.map(flat)
  const out = f[0].map((_, i) => f.reduce((a, p, k) => a + p[i] * (w[k] / sum), 0))
  return {
    px: out[0], pz: out[1], sx: out[2], sz: out[3], headTilt: out[4], headYaw: out[5],
    legA: chunk(out, 6, 4), legB: chunk(out, 18, 4), armA: chunk(out, 30, 4), armB: chunk(out, 42, 4),
  }
}

/** Centre-line of the torso at height y (contrapposto: pelvis and shoulders shift in opposite directions). */
export function centerAt(p: Pose, y: number): [number, number] {
  const s = smooth(-0.1, 0.74, y)
  return [p.px + (p.sx - p.px) * s, p.pz + (p.sz - p.pz) * s]
}

/* ───────── body measurements ───────── */

/** Torso half-widths [y, rx], [y, rz]. */
export const TORSO_RX: Key[] = [
  [-0.14, 0.135], [0, 0.165], [0.08, 0.175], [0.2, 0.152], [0.33, 0.114], [0.45, 0.134], [0.55, 0.152],
  [0.64, 0.165], [0.7, 0.182], [0.74, 0.12], [0.775, 0.05], [0.92, 0.042],
]
export const TORSO_RZ: Key[] = [
  [-0.14, 0.095], [0, 0.108], [0.08, 0.115], [0.2, 0.104], [0.33, 0.084], [0.45, 0.092], [0.55, 0.108],
  [0.64, 0.098], [0.7, 0.088], [0.74, 0.07], [0.775, 0.05], [0.92, 0.044],
]

const ARM_R: Key[] = [[0, 0.047], [0.1, 0.04], [0.46, 0.031], [0.55, 0.034], [0.85, 0.021], [0.92, 0.024], [1, 0.006]]
const LEG_R: Key[] = [[0, 0.098], [0.2, 0.088], [0.49, 0.057], [0.62, 0.062], [0.89, 0.031], [0.93, 0.034], [0.97, 0.022], [1, 0.006]]
export const armRadius = (s: number) => sample(ARM_R, s)

/* ───────── geometry helpers ───────── */

function finish(pos: Float32Array, uv: Float32Array, rows: number, cols: number): THREE.BufferGeometry {
  const index: number[] = []
  for (let i = 0; i < rows - 1; i++)
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j
      const c = a + cols
      index.push(a, a + 1, c, a + 1, c + 1, c)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(index)
  g.computeVertexNormals()
  // hide the seam: average normals of first / last column
  const n = g.attributes.normal as THREE.BufferAttribute
  for (let i = 0; i < rows; i++) {
    const a = i * cols
    const b = a + cols - 1
    const x = n.getX(a) + n.getX(b)
    const y = n.getY(a) + n.getY(b)
    const z = n.getZ(a) + n.getZ(b)
    const l = Math.hypot(x, y, z) || 1
    n.setXYZ(a, x / l, y / l, z / l)
    n.setXYZ(b, x / l, y / l, z / l)
  }
  return g
}

/** Tube along a Catmull-Rom path with a radius profile. Caps taper to a point unless `open`. */
export function sweep(pts: V3[], radius: (s: number) => number, opts: { radial?: number; segs?: number; s0?: number; s1?: number; open?: boolean } = {}): THREE.BufferGeometry {
  const radial = opts.radial ?? 22
  const segs = opts.segs ?? 44
  const s0 = opts.s0 ?? 0
  const s1 = opts.s1 ?? 1
  const open = opts.open ?? false
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal')
  const rows = segs + 1 + (open ? 0 : 2)
  const cols = radial + 1
  const pos = new Float32Array(rows * cols * 3)
  const uv = new Float32Array(rows * cols * 2)
  const T = new THREE.Vector3()
  const N = new THREE.Vector3()
  const B = new THREE.Vector3()
  const P = new THREE.Vector3()
  curve.getTangentAt(s0, T)
  N.set(0, 0, 1)
  if (Math.abs(T.z) > 0.9) N.set(1, 0, 0)
  for (let r = 0; r < rows; r++) {
    let s: number
    let rad: number
    let ext = 0
    if (open) {
      s = s0 + (s1 - s0) * (r / segs)
      rad = radius(s)
    } else if (r === 0) {
      s = s0
      rad = 0
      ext = -0.004
    } else if (r === rows - 1) {
      s = s1
      rad = 0
      ext = 0.004
    } else {
      s = s0 + (s1 - s0) * ((r - 1) / segs)
      rad = radius(s)
    }
    curve.getPointAt(Math.min(Math.max(s, 0), 1), P)
    curve.getTangentAt(Math.min(Math.max(s, 0), 1), T)
    N.addScaledVector(T, -N.dot(T)).normalize()
    B.crossVectors(T, N)
    for (let j = 0; j < cols; j++) {
      const a = (j / radial) * Math.PI * 2
      const i3 = (r * cols + j) * 3
      pos[i3] = P.x + T.x * ext + (N.x * Math.cos(a) + B.x * Math.sin(a)) * rad
      pos[i3 + 1] = P.y + T.y * ext + (N.y * Math.cos(a) + B.y * Math.sin(a)) * rad
      pos[i3 + 2] = P.z + T.z * ext + (N.z * Math.cos(a) + B.z * Math.sin(a)) * rad
      uv[(r * cols + j) * 2] = j / radial
      uv[(r * cols + j) * 2 + 1] = r / (rows - 1)
    }
  }
  return finish(pos, uv, rows, cols)
}

export function buildTorso(p: Pose): THREE.BufferGeometry {
  const rows = 64
  const radial = 44
  const cols = radial + 1
  const pos = new Float32Array(rows * cols * 3)
  const uv = new Float32Array(rows * cols * 2)
  for (let i = 0; i < rows; i++) {
    const y = -0.14 + (0.92 + 0.14) * (i / (rows - 1))
    const [cx, cz0] = centerAt(p, y)
    const cz = cz0 + (y > 0.78 ? 0.022 * smooth(0.78, 0.94, y) : 0) // neck leans slightly forward
    const rx = sample(TORSO_RX, y)
    const rz = sample(TORSO_RZ, y)
    for (let j = 0; j < cols; j++) {
      const a = (j / radial) * Math.PI * 2
      const i3 = (i * cols + j) * 3
      pos[i3] = cx + Math.cos(a) * rx
      pos[i3 + 1] = y
      pos[i3 + 2] = cz + Math.sin(a) * rz
      uv[(i * cols + j) * 2] = j / radial
      uv[(i * cols + j) * 2 + 1] = i / (rows - 1)
    }
  }
  return finish(pos, uv, rows, cols)
}

export const buildLeg = (pts: V3[]) => sweep(pts, (s) => sample(LEG_R, s), { radial: 24, segs: 56 })
export const buildArm = (pts: V3[]) => sweep(pts, armRadius, { radial: 20, segs: 48 })

/** Abstract egg-shaped mannequin head (no facial features). */
export function buildHead(): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = []
  const n = 40
  for (let i = 0; i <= n; i++) {
    const phi = -Math.PI / 2 + (i / n) * Math.PI
    const sy = Math.sin(phi)
    const taper = 0.8 + 0.2 * smooth(-1, 0.25, sy)
    pts.push(new THREE.Vector2(Math.max(Math.cos(phi) * 0.088 * taper * (1 + 0.08 * sy), 0.0005), sy * 0.122))
  }
  return new THREE.LatheGeometry(pts, 48)
}
