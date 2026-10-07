import * as THREE from 'three'
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { TORSO_RX, TORSO_RZ, POSES, armRadius, centerAt, sample, type Key, type V3 } from './anatomy'

/**
 * Body measurements the garments are tailored to: per-height centre / half-widths of torso + legs,
 * and the centre-lines (with radii) of both arms. Measured from the mannequin GLB at load time
 * (or taken from the analytic fallback body), so dresses always sit on the real mannequin.
 */
export interface BodyFit {
  y0: number
  y1: number
  n: number
  cx: Float32Array
  cz: Float32Array
  rx: Float32Array
  rz: Float32Array
  arm: [V3[], V3[]] // A = +x side, B = −x side
  armR: [number[], number[]]
  /** radial extent of the real body (arms excluded) per height bin × angle bin, measured from (cx, cz); absent for the analytic fallback */
  pol?: Float32Array
  A: number
  /** footprint of both feet (world units, mirror-aware): a plain low plinth is drawn under it */
  plinth: { cx: number; cz: number; rx: number; rz: number }
}

const TAU = Math.PI * 2

/** Real distance from the body centre-line to the body surface at height y, direction θ (x = cos θ, z = sin θ). */
export function fitPolar(f: BodyFit, y: number, th: number): number {
  const pol = f.pol
  if (!pol) return 0
  const A = f.A
  const t = Math.min(Math.max((y - f.y0) / (f.y1 - f.y0), 0), 1) * (f.n - 1)
  const i = Math.floor(t)
  const fy = t - i
  const i2 = Math.min(i + 1, f.n - 1)
  let a = th % TAU
  if (a < 0) a += TAU
  const pos = (a / TAU) * A - 0.5
  const j0 = Math.floor(pos)
  const fx = pos - j0
  const k0 = ((j0 % A) + A) % A
  const k1 = (k0 + 1) % A
  const top = pol[i * A + k0] * (1 - fx) + pol[i * A + k1] * fx
  const bot = pol[i2 * A + k0] * (1 - fx) + pol[i2 * A + k1] * fx
  return top * (1 - fy) + bot * fy
}

const lerpAt = (a: Float32Array, y0: number, y1: number, y: number) => {
  const t = Math.min(Math.max((y - y0) / (y1 - y0), 0), 1) * (a.length - 1)
  const i = Math.floor(t)
  const f = t - i
  return a[i] + (a[Math.min(i + 1, a.length - 1)] - a[i]) * f
}
export const fitRx = (f: BodyFit, y: number) => lerpAt(f.rx, f.y0, f.y1, y)
export const fitRz = (f: BodyFit, y: number) => lerpAt(f.rz, f.y0, f.y1, y)
export const fitCenter = (f: BodyFit, y: number): [number, number] => [lerpAt(f.cx, f.y0, f.y1, y), lerpAt(f.cz, f.y0, f.y1, y)]
export function fitArmRadius(f: BodyFit, side: 0 | 1, s: number) {
  const r = f.armR[side]
  const t = Math.min(Math.max(s, 0), 1) * (r.length - 1)
  const i = Math.floor(t)
  return r[i] + (r[Math.min(i + 1, r.length - 1)] - r[i]) * (t - i)
}

/** Scale that maps the GLB (1.78 m, feet at y = 0) onto our scene: waist / bust / shoulders land on the garment landmarks. */
export const MODEL_SCALE = 1.22
export const MODEL_Y = -1.0

const N = 96
const Y0 = -1.0
const Y1 = 1.2

interface Part { box: THREE.Box3; n: number }
interface Welded {
  mesh: THREE.Mesh
  tri: number
  ids: Int32Array
  pts: THREE.Vector3[]
  find: (a: number) => number
  parts: Map<number, Part>
}

/** The GLB is a vertex soup: weld coincident vertices and union-find them into separate parts (head, face plate, neck, torso, arms, legs, feet). */
function weld(root: THREE.Object3D, mirror: boolean): Welded {
  root.updateMatrixWorld(true)
  let mesh: THREE.Mesh | null = null
  let best = 0
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh && m.geometry.attributes.position.count > best) {
      best = m.geometry.attributes.position.count
      mesh = m
    }
  })
  const m = mesh as THREE.Mesh | null
  if (!m) throw new Error('mannequin mesh not found')
  const pos = m.geometry.attributes.position
  const idx = m.geometry.index
  const tri = idx ? idx.count : pos.count
  const v = new THREE.Vector3()
  const map = new Map<string, number>()
  const pts: THREE.Vector3[] = []
  const ids = new Int32Array(tri)
  for (let i = 0; i < tri; i++) {
    const src = idx ? idx.getX(i) : i
    v.fromBufferAttribute(pos, src).applyMatrix4(m.matrixWorld)
    v.x *= mirror ? -1 : 1
    const k = `${Math.round(v.x * 2000)},${Math.round(v.y * 2000)},${Math.round(v.z * 2000)}`
    let id = map.get(k)
    if (id === undefined) {
      id = pts.length
      map.set(k, id)
      pts.push(v.clone())
    }
    ids[i] = id
  }
  const par = Array.from({ length: pts.length }, (_, i) => i)
  const find = (a: number): number => {
    while (par[a] !== a) {
      par[a] = par[par[a]]
      a = par[a]
    }
    return a
  }
  for (let i = 0; i < tri; i += 3) {
    const a = find(ids[i])
    par[find(ids[i + 1])] = a
    par[find(ids[i + 2])] = a
  }
  const parts = new Map<number, Part>()
  pts.forEach((p, i) => {
    const r = find(i)
    let c = parts.get(r)
    if (!c) parts.set(r, (c = { box: new THREE.Box3(), n: 0 }))
    c.box.expandByPoint(p)
    c.n++
  })
  return { mesh: m, tri, ids, pts, find, parts }
}

/**
 * The GLB head is a 13-sided egg. Rebuild it as a smooth surface of revolution that follows the very same profile
 * (ring radii measured from the model), so the silhouette stays identical but loses its facets.
 */
function smoothHead(headPts: THREE.Vector3[], toLocal: THREE.Matrix4): THREE.BufferGeometry {
  const box = new THREE.Box3().setFromPoints(headPts)
  const cx = (box.min.x + box.max.x) / 2
  const cz = (box.min.z + box.max.z) / 2
  const hx = (box.max.x - box.min.x) / 2
  const hz = (box.max.z - box.min.z) / 2
  const rings = new Map<number, number[]>()
  for (const p of headPts) {
    const k = Math.round(p.y * 400)
    let a = rings.get(k)
    if (!a) rings.set(k, (a = []))
    a.push(Math.hypot((p.x - cx) / hx, (p.z - cz) / hz))
  }
  const keys: Key[] = [...rings.entries()].sort((a, b) => a[0] - b[0]).map(([k, rs]) => [k / 400, rs.reduce((a, b) => a + b, 0) / rs.length])
  keys[keys.length - 1][1] = 0 // the apex is a point
  const y0 = keys[0][0]
  const y1 = keys[keys.length - 1][0]
  const pts: THREE.Vector2[] = [new THREE.Vector2(0.0005, y0 - 0.002)]
  const n = 40
  for (let i = 0; i <= n; i++) {
    const y = y0 + ((y1 - y0) * i) / n
    pts.push(new THREE.Vector2(Math.max(sample(keys, y) * hz, 0.0005), y))
  }
  const g = new THREE.LatheGeometry(pts, 40)
  g.applyMatrix4(toLocal.clone().multiply(new THREE.Matrix4().makeTranslation(cx, 0, cz)).multiply(new THREE.Matrix4().makeScale(hx / hz, 1, 1)))
  return g.toNonIndexed()
}

/**
 * The GLB feet are faceted wedges with a tall ankle block. Rebuild every foot as a smooth shoe:
 * slice the original foot across its length axis (exact section boxes), smooth the profile, and loft rounded
 * sections through it. The sole gets a darker tone through vertex colours.
 */
function smoothShoe(tris: THREE.Vector3[][], toLocal: THREE.Matrix4): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = []
  for (const t of tris) pts.push(...t)
  let mx = 0
  let mz = 0
  for (const p of pts) {
    mx += p.x
    mz += p.z
  }
  mx /= pts.length
  mz /= pts.length
  let sxx = 0
  let szz = 0
  let sxz = 0
  for (const p of pts) {
    const dx = p.x - mx
    const dz = p.z - mz
    sxx += dx * dx
    szz += dz * dz
    sxz += dx * dz
  }
  const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz)
  let ux = Math.cos(ang)
  let uz = Math.sin(ang)
  const proj = (p: THREE.Vector3) => (p.x - mx) * ux + (p.z - mz) * uz
  let tmin = Infinity
  let tmax = -Infinity
  for (const p of pts) {
    const t = proj(p)
    tmin = Math.min(tmin, t)
    tmax = Math.max(tmax, t)
  }
  // the heel end carries the tall ankle block: u must run heel → toe
  let hLo = 0
  let hHi = 0
  for (const p of pts) {
    const t = proj(p)
    if (t < tmin + 0.25 * (tmax - tmin)) hLo = Math.max(hLo, p.y)
    if (t > tmax - 0.25 * (tmax - tmin)) hHi = Math.max(hHi, p.y)
  }
  if (hHi > hLo) {
    ux = -ux
    uz = -uz
  }
  tmin = Infinity
  tmax = -Infinity
  for (const p of pts) {
    const t = proj(p)
    tmin = Math.min(tmin, t)
    tmax = Math.max(tmax, t)
  }
  const L = tmax - tmin
  const K = 34
  const vOf = (x: number, z: number) => -(x - mx) * uz + (z - mz) * ux

  // exact section boxes at K stations
  const vlo = new Array<number>(K).fill(NaN)
  const vhi = new Array<number>(K).fill(NaN)
  const ylo = new Array<number>(K).fill(NaN)
  const yhi = new Array<number>(K).fill(NaN)
  for (let k = 1; k < K - 1; k++) {
    const t = tmin + (L * k) / (K - 1)
    let a = Infinity
    let b = -Infinity
    let c = Infinity
    let d = -Infinity
    for (const tr of tris)
      for (let e = 0; e < 3; e++) {
        const p = tr[e]
        const q = tr[(e + 1) % 3]
        const pr = proj(p) - t
        const qr = proj(q) - t
        if (pr * qr > 0 || pr === qr) continue
        const f = pr / (pr - qr)
        const x = p.x + (q.x - p.x) * f
        const y = p.y + (q.y - p.y) * f
        const z = p.z + (q.z - p.z) * f
        const v = vOf(x, z)
        a = Math.min(a, v)
        b = Math.max(b, v)
        c = Math.min(c, y)
        d = Math.max(d, y)
      }
    if (a <= b) {
      vlo[k] = a
      vhi[k] = b
      ylo[k] = c
      yhi[k] = d
    }
  }
  // fill gaps / ends from the nearest valid stations
  const fill = (arr: number[]) => {
    for (let k = 0; k < K; k++) {
      if (!Number.isNaN(arr[k])) continue
      let l = k - 1
      while (l >= 0 && Number.isNaN(arr[l])) l--
      let r = k + 1
      while (r < K && Number.isNaN(arr[r])) r++
      arr[k] = l < 0 ? arr[r] : r >= K ? arr[l] : arr[l] + ((arr[r] - arr[l]) * (k - l)) / (r - l)
    }
  }
  ;[vlo, vhi, ylo, yhi].forEach(fill)
  const vc = vlo.map((v, k) => (v + vhi[k]) / 2)
  const hv = vlo.map((v, k) => (vhi[k] - v) / 2)
  const yc = ylo.map((v, k) => (v + yhi[k]) / 2)
  const hy = ylo.map((v, k) => (yhi[k] - v) / 2)
  for (let pass = 0; pass < 2; pass++)
    for (const arr of [vc, hv, yc, hy]) {
      const c0 = arr.slice()
      for (let k = 1; k < K - 1; k++) arr[k] = (c0[k - 1] + 2 * c0[k] + c0[k + 1]) / 4
    }
  const y0 = Math.min(...ylo.slice(1, K - 1))

  // rounded loft
  const R = 28
  const cols = R + 1
  const pos = new Float32Array(K * cols * 3)
  const col = new Float32Array(K * cols * 3)
  const sole = 0.011
  for (let k = 0; k < K; k++) {
    const s = k / (K - 1)
    const dEnd = Math.min(s, 1 - s)
    const edge = 0.1
    const cap = dEnd >= edge ? 1 : Math.sqrt(Math.max(0, 1 - ((edge - dEnd) / edge) ** 2))
    const t = tmin + L * s
    for (let j = 0; j < cols; j++) {
      const phi = (j / R) * Math.PI * 2
      const c = Math.cos(phi)
      const sn = Math.sin(phi)
      const ex = Math.sign(c) * Math.abs(c) ** (2 / 2.6)
      const ey = Math.sign(sn) * Math.abs(sn) ** (2 / 2.6)
      const v = vc[k] + hv[k] * cap * ex
      const y = yc[k] + hy[k] * cap * ey
      const i3 = (k * cols + j) * 3
      pos[i3] = mx + ux * t - uz * v
      pos[i3 + 1] = y
      pos[i3 + 2] = mz + uz * t + ux * v
      const u01 = Math.min(Math.max((y - y0 - sole) / 0.006, 0), 1)
      const shade = 0.28 + 0.72 * (u01 * u01 * (3 - 2 * u01))
      col[i3] = col[i3 + 1] = col[i3 + 2] = shade
    }
  }
  const index: number[] = []
  for (let k = 0; k < K - 1; k++)
    for (let j = 0; j < R; j++) {
      const a = k * cols + j
      const b = a + 1
      const c2 = a + cols
      const d2 = c2 + 1
      index.push(a, c2, b, b, c2, d2)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  // make sure the surface faces outwards (top of a mid section must point up)
  const nrm = g.attributes.normal as THREE.BufferAttribute
  const topJ = Math.round(R / 4)
  if (nrm.getY((Math.floor(K / 2)) * cols + topJ) < 0) {
    for (let i = 0; i < index.length; i += 3) {
      const tmp = index[i + 1]
      index[i + 1] = index[i + 2]
      index[i + 2] = tmp
    }
    g.setIndex(index)
    g.computeVertexNormals()
  }
  g.applyMatrix4(toLocal)
  return g
}

/**
 * Tidy the mannequin for display (works on a clone, the original stays pristine for measuring):
 *  - the little “face plate” that pokes out of the egg-shaped head is dropped (smooth, faceless head),
 *  - the feet become a separate mesh so they can be styled as shoes,
 *  - the GLB's own rod + disc are removed (we draw a clean plinth under both feet instead).
 */
export function splitMannequin(root: THREE.Object3D): void {
  const w = weld(root, false)
  const { mesh, tri, ids, find, parts } = w
  const feet = new Set<number>()
  const face = new Set<number>()
  parts.forEach((c, r) => {
    if (c.box.max.y < 0.16) feet.add(r)
  })
  parts.forEach((c, r) => {
    if (c.box.min.y < 1.4) return // only decoration high up on the head
    parts.forEach((o, r2) => {
      if (r2 !== r && o.box.containsBox(c.box)) face.add(r)
    })
  })
  // the head: the biggest part up in the head region
  let headRoot = -1
  let headVol = 0
  parts.forEach((c, r) => {
    if (c.box.min.y < 1.4 || face.has(r)) return
    const sz = c.box.getSize(new THREE.Vector3())
    const vol = sz.x * sz.y * sz.z
    if (vol > headVol) {
      headVol = vol
      headRoot = r
    }
  })
  const geo = mesh.geometry
  const posA = geo.attributes.position
  const norA = geo.attributes.normal
  const idx = geo.index
  const bodyV: number[] = []
  const shoeV: number[] = []
  for (let t = 0; t < tri; t += 3) {
    const r = find(ids[t])
    if (face.has(r) || r === headRoot) continue
    const dst = feet.has(r) ? shoeV : bodyV
    for (let k = 0; k < 3; k++) dst.push(idx ? idx.getX(t + k) : t + k)
  }
  const make = (vs: number[]) => {
    const g = new THREE.BufferGeometry()
    const p = new Float32Array(vs.length * 3)
    vs.forEach((vi, j) => {
      p[j * 3] = posA.getX(vi)
      p[j * 3 + 1] = posA.getY(vi)
      p[j * 3 + 2] = posA.getZ(vi)
    })
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    if (norA) {
      const n = new Float32Array(vs.length * 3)
      vs.forEach((vi, j) => {
        n[j * 3] = norA.getX(vi)
        n[j * 3 + 1] = norA.getY(vi)
        n[j * 3 + 2] = norA.getZ(vi)
      })
      g.setAttribute('normal', new THREE.BufferAttribute(n, 3))
    } else g.computeVertexNormals()
    return g
  }
  const crease = Math.PI / 3 // smooth shading on the low-poly limbs, but keep the sharp edges
  // the feet become smooth two-tone shoes (the old faceted feet are only a fallback)
  const toLocal = mesh.matrixWorld.clone().invert()
  let shoeGeo: THREE.BufferGeometry | null = null
  try {
    const perFoot = new Map<number, THREE.Vector3[][]>()
    for (let t = 0; t < tri; t += 3) {
      const r = find(ids[t])
      if (!feet.has(r)) continue
      let list = perFoot.get(r)
      if (!list) perFoot.set(r, (list = []))
      list.push([w.pts[ids[t]], w.pts[ids[t + 1]], w.pts[ids[t + 2]]])
    }
    const geos = [...perFoot.values()].map((tr) => smoothShoe(tr, toLocal))
    shoeGeo = geos.length ? mergeGeometries(geos) : null
  } catch (e) {
    console.warn('[mannequin] smooth shoes failed, keeping the original feet', e)
  }
  if (!shoeGeo) {
    shoeGeo = toCreasedNormals(make(shoeV), crease)
    shoeGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(shoeGeo.attributes.position.count * 3).fill(1), 3))
  }
  const shoe = new THREE.Mesh(shoeGeo)
  shoe.userData.shoe = true
  shoe.position.copy(mesh.position)
  shoe.quaternion.copy(mesh.quaternion)
  shoe.scale.copy(mesh.scale)
  const parent = mesh.parent ?? root
  parent.add(shoe)
  const bodyGeo = toCreasedNormals(make(bodyV), crease)
  if (headRoot >= 0) {
    const headPts = w.pts.filter((_, i) => find(i) === headRoot)
    const head = smoothHead(headPts, mesh.matrixWorld.clone().invert())
    head.deleteAttribute('uv') // same attribute set as the body (position + normal) so the two can be merged
    mesh.geometry = mergeGeometries([bodyGeo, head]) ?? bodyGeo
  } else mesh.geometry = bodyGeo
  const others: THREE.Mesh[] = []
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh && m !== mesh && m !== shoe) others.push(m)
  })
  others.forEach((m) => m.parent?.remove(m))
}

/** Measure the mannequin: weld the vertex soup into parts, drop the arms from the torso envelope, trace the arms, find the feet footprint. */
export function fitFromModel(root: THREE.Object3D, mirror: boolean): BodyFit {
  const { tri, ids, pts, find, parts } = weld(root, mirror)
  const armParts = new Set<number>()
  parts.forEach((c, r) => {
    const cx = (c.box.min.x + c.box.max.x) / 2
    if (Math.abs(cx) > 0.12 && c.box.max.y - c.box.min.y > 0.5 && c.box.min.y > 0.4) armParts.add(r)
  })

  const S = MODEL_SCALE
  const T = (p: THREE.Vector3): V3 => [p.x * S, p.y * S + MODEL_Y, p.z * S]

  // envelope of torso + legs + neck + head (arms excluded) by walking every triangle edge through the height bins
  const lo = { x: new Float32Array(N).fill(1e9), z: new Float32Array(N).fill(1e9) }
  const hi = { x: new Float32Array(N).fill(-1e9), z: new Float32Array(N).fill(-1e9) }
  const hit = new Uint8Array(N)
  const add = (i: number, x: number, z: number) => {
    if (i < 0 || i >= N) return
    hit[i] = 1
    lo.x[i] = Math.min(lo.x[i], x)
    hi.x[i] = Math.max(hi.x[i], x)
    lo.z[i] = Math.min(lo.z[i], z)
    hi.z[i] = Math.max(hi.z[i], z)
  }
  const bin = (y: number) => ((y - Y0) / (Y1 - Y0)) * (N - 1)
  for (let i = 0; i < tri; i += 3) {
    if (armParts.has(find(ids[i]))) continue
    for (let e = 0; e < 3; e++) {
      const a = T(pts[ids[i + e]])
      const b = T(pts[ids[i + ((e + 1) % 3)]])
      const ba = bin(a[1])
      const bb = bin(b[1])
      const from = Math.ceil(Math.min(ba, bb))
      const to = Math.floor(Math.max(ba, bb))
      add(Math.round(ba), a[0], a[2])
      add(Math.round(bb), b[0], b[2])
      for (let k = from; k <= to; k++) {
        const t = ba === bb ? 0 : (k - ba) / (bb - ba)
        add(k, a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t)
      }
    }
  }
  const cx = new Float32Array(N)
  const cz = new Float32Array(N)
  const rx = new Float32Array(N)
  const rz = new Float32Array(N)
  // fill gaps, then light smoothing
  for (let i = 0; i < N; i++) {
    if (hit[i]) {
      cx[i] = (lo.x[i] + hi.x[i]) / 2
      cz[i] = (lo.z[i] + hi.z[i]) / 2
      rx[i] = (hi.x[i] - lo.x[i]) / 2
      rz[i] = (hi.z[i] - lo.z[i]) / 2
    }
  }
  const firstHit = hit.indexOf(1)
  for (let i = 0; i < N; i++) {
    if (hit[i]) continue
    let a = i - 1
    while (a >= 0 && !hit[a]) a--
    let b = i + 1
    while (b < N && !hit[b]) b++
    const src = a < 0 ? b : b >= N ? a : null
    for (const arr of [cx, cz, rx, rz]) {
      if (src !== null) arr[i] = i < firstHit ? 0 : arr[src]
      else arr[i] = arr[a] + ((arr[b] - arr[a]) * (i - a)) / (b - a)
    }
  }
  for (let pass = 0; pass < 2; pass++)
    for (const arr of [cx, cz, rx, rz]) {
      const c = Float32Array.from(arr)
      for (let i = 1; i < N - 1; i++) arr[i] = (c[i - 1] + 2 * c[i] + c[i + 1]) / 4
    }

  // polar profile of the real body: every triangle ∩ height plane gives a short segment; keep the farthest point per angle
  const A = 36
  const pol = new Float32Array(N * A)
  const putPolar = (bi: number, x: number, z: number) => {
    if (bi < 0 || bi >= N) return
    const dx = x - cx[bi]
    const dz = z - cz[bi]
    const rr = Math.hypot(dx, dz)
    let a = Math.atan2(dz, dx)
    if (a < 0) a += TAU
    const k = bi * A + Math.min(A - 1, Math.floor((a / TAU) * A))
    if (rr > pol[k]) pol[k] = rr
  }
  for (let i = 0; i < tri; i += 3) {
    if (armParts.has(find(ids[i]))) continue
    const P = [T(pts[ids[i]]), T(pts[ids[i + 1]]), T(pts[ids[i + 2]])]
    for (const p of P) putPolar(Math.round(bin(p[1])), p[0], p[2]) // vertices go to the nearest bin (conservative)
    const b0 = Math.ceil(Math.min(bin(P[0][1]), bin(P[1][1]), bin(P[2][1])))
    const b1 = Math.floor(Math.max(bin(P[0][1]), bin(P[1][1]), bin(P[2][1])))
    for (let k = b0; k <= b1; k++) {
      const y = Y0 + (k * (Y1 - Y0)) / (N - 1)
      const cross: [number, number][] = []
      for (let e = 0; e < 3; e++) {
        const a = P[e]
        const b = P[(e + 1) % 3]
        if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) {
          const t = (y - a[1]) / (b[1] - a[1])
          cross.push([a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t])
        }
      }
      if (cross.length >= 2) for (let s2 = 0; s2 <= 4; s2++) putPolar(k, cross[0][0] + ((cross[1][0] - cross[0][0]) * s2) / 4, cross[0][1] + ((cross[1][1] - cross[0][1]) * s2) / 4)
    }
  }
  // fill empty angle bins (circular interpolation), then empty rows (nearest row), then a small safety dilation
  const rowHas = new Uint8Array(N)
  for (let i = 0; i < N; i++) {
    let any = -1
    for (let k = 0; k < A; k++) if (pol[i * A + k] > 0) any = k
    if (any < 0) continue
    rowHas[i] = 1
    for (let k = 0; k < A; k++) {
      if (pol[i * A + k] > 0) continue
      let l = 1
      while (pol[i * A + ((k - l + A) % A)] <= 0) l++
      let r = 1
      while (pol[i * A + ((k + r) % A)] <= 0) r++
      const lv = pol[i * A + ((k - l + A) % A)]
      const rv = pol[i * A + ((k + r) % A)]
      pol[i * A + k] = (lv * r + rv * l) / (l + r)
    }
  }
  for (let i = 0; i < N; i++) {
    if (rowHas[i]) continue
    let d = 1
    while (i - d >= 0 && !rowHas[i - d] && i + d < N && !rowHas[i + d]) d++
    const src = i - d >= 0 && rowHas[i - d] ? i - d : i + d < N && rowHas[i + d] ? i + d : -1
    if (src >= 0 && Math.abs(src - i) <= 3) for (let k = 0; k < A; k++) pol[i * A + k] = pol[src * A + k]
  }
  const dil = Float32Array.from(pol)
  for (let i = 0; i < N; i++)
    for (let k = 0; k < A; k++) {
      let m = dil[i * A + k]
      m = Math.max(m, 0.97 * dil[i * A + ((k + 1) % A)], 0.97 * dil[i * A + ((k - 1 + A) % A)])
      if (i > 0) m = Math.max(m, 0.97 * dil[(i - 1) * A + k])
      if (i < N - 1) m = Math.max(m, 0.97 * dil[(i + 1) * A + k])
      pol[i * A + k] = m
    }

  // arm centre-lines: rings of each arm part, top → bottom
  const arms: [V3[], V3[]] = [[], []]
  const armR: [number[], number[]] = [[], []]
  const armParts2 = [...armParts].map((r) => {
    const c = parts.get(r)!
    return { r, side: (c.box.min.x + c.box.max.x) / 2 > 0 ? 0 : 1 }
  })
  for (const { r, side } of armParts2) {
    const mine = pts.filter((_, i) => find(i) === r).map(T)
    const yTop = Math.max(...mine.map((p) => p[1]))
    const yBot = Math.min(...mine.map((p) => p[1]))
    const rings = 9
    for (let k = 0; k < rings; k++) {
      const yc = yTop - ((yTop - yBot) * (k + 0.5)) / rings
      const h = (yTop - yBot) / rings
      const s = mine.filter((p) => Math.abs(p[1] - yc) <= h * 0.75)
      if (!s.length) continue
      const mx = s.reduce((a, p) => a + p[0], 0) / s.length
      const mz = s.reduce((a, p) => a + p[2], 0) / s.length
      const my = s.reduce((a, p) => a + p[1], 0) / s.length
      const rad = Math.max(...s.map((p) => Math.hypot(p[0] - mx, p[2] - mz)))
      arms[side].push([mx, my, mz])
      armR[side].push(rad)
    }
    // reach the shoulder joint and the fingertips
    const first = arms[side][0]
    arms[side].unshift([first[0] * 0.92, yTop + 0.01, first[2]])
    armR[side].unshift(armR[side][0] * 1.1)
  }
  if (!arms[0].length || !arms[1].length) throw new Error('arms not found in mannequin mesh')

  // footprint of both feet → plinth
  let fx0 = 1e9, fx1 = -1e9, fz0 = 1e9, fz1 = -1e9
  parts.forEach((c, r) => {
    if (c.box.max.y >= 0.16) return
    pts.forEach((p, i) => {
      if (find(i) !== r) return
      const q = T(p)
      fx0 = Math.min(fx0, q[0])
      fx1 = Math.max(fx1, q[0])
      fz0 = Math.min(fz0, q[2])
      fz1 = Math.max(fz1, q[2])
    })
  })
  const plinth = { cx: (fx0 + fx1) / 2, cz: (fz0 + fz1) / 2, rx: Math.max((fx1 - fx0) / 2 + 0.08, 0.26), rz: Math.max((fz1 - fz0) / 2 + 0.08, 0.26) }
  return { y0: Y0, y1: Y1, n: N, cx, cz, rx, rz, arm: arms, armR, pol, A, plinth }
}

/** Analytic body (used only if the GLB cannot be loaded). */
export function fitFromAnatomy(): BodyFit {
  const pose = POSES[0]
  const cx = new Float32Array(N)
  const cz = new Float32Array(N)
  const rx = new Float32Array(N)
  const rz = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const y = Y0 + ((Y1 - Y0) * i) / (N - 1)
    const [x, z] = centerAt(pose, Math.max(y, -0.1))
    cx[i] = x
    cz[i] = z
    rx[i] = y < -0.1 ? 0.14 : sample(TORSO_RX, y)
    rz[i] = y < -0.1 ? 0.1 : sample(TORSO_RZ, y)
  }
  const mk = (p: V3[]) => p
  return { y0: Y0, y1: Y1, n: N, A: 36, plinth: { cx: 0, cz: 0.04, rx: 0.44, rz: 0.44 }, cx, cz, rx, rz, arm: [mk(pose.armA), mk(pose.armB)], armR: [[0.047, 0.04, 0.031, 0.034, 0.021], [0.047, 0.04, 0.031, 0.034, 0.021]].map((r) => r.map((x, i) => armRadius(i / 4) || x)) as [number[], number[]] }
}
