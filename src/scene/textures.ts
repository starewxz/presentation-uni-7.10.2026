import * as THREE from 'three'

/** Embroidery bands (hem, waist, yoke) — white on transparent, tinted by material colour. u wraps around, v runs hem → neck. */
export function makeOrnamentTexture(): THREE.CanvasTexture {
  const W = 256
  const H = 1024
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.strokeStyle = '#fff'
  g.fillStyle = '#fff'
  const dia = (cx: number, cy: number, rx: number, ry: number, fill = false) => {
    g.beginPath()
    g.moveTo(cx, cy - ry)
    g.lineTo(cx + rx, cy)
    g.lineTo(cx, cy + ry)
    g.lineTo(cx - rx, cy)
    g.closePath()
    fill ? g.fill() : g.stroke()
  }
  const band = (v0: number, v1: number, k: number) => {
    const y0 = (1 - v1) * H
    const y1 = (1 - v0) * H
    const cy = (y0 + y1) / 2
    const h = (y1 - y0) / 2
    g.lineWidth = 3 * k
    g.fillRect(0, y0, W, 3 * k)
    g.fillRect(0, y1 - 3 * k, W, 3 * k)
    g.lineWidth = 3.5 * k
    dia(W / 2, cy, W * 0.4, h * 0.82)
    dia(W / 2, cy, W * 0.22, h * 0.45)
    dia(W / 2, cy, W * 0.06, h * 0.13, true)
    dia(0, cy, W * 0.1, h * 0.3, true)
    dia(W, cy, W * 0.1, h * 0.3, true)
  }
  band(0.03, 0.19, 1)
  band(0.34, 0.4, 0.7)
  band(0.66, 0.72, 0.7)
  band(0.88, 0.96, 0.8)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.repeat.set(12, 1)
  tex.anisotropy = 8
  return tex
}

/** Single narrow ornament band for belt / collar. */
export function makeBandTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 64
  const g = c.getContext('2d')!
  g.strokeStyle = '#fff'
  g.fillStyle = '#fff'
  g.lineWidth = 3
  g.fillRect(0, 2, 128, 3)
  g.fillRect(0, 59, 128, 3)
  const d = (cx: number, cy: number, rx: number, ry: number, fill = false) => {
    g.beginPath()
    g.moveTo(cx, cy - ry)
    g.lineTo(cx + rx, cy)
    g.lineTo(cx, cy + ry)
    g.lineTo(cx - rx, cy)
    g.closePath()
    fill ? g.fill() : g.stroke()
  }
  d(64, 32, 50, 22)
  d(64, 32, 24, 11)
  d(64, 32, 6, 4, true)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.repeat.set(10, 1)
  tex.anisotropy = 8
  return tex
}

export function makeShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62)
  gr.addColorStop(0, 'rgba(0,0,0,0.38)')
  gr.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}
