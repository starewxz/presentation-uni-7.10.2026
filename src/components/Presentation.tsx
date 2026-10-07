import { useState, useEffect, useCallback, useRef, useSyncExternalStore, lazy, Suspense, type CSSProperties, type MouseEvent, type TouchEvent } from 'react'
import slides, { TONES } from '../slides'
import Slide from './Slide'
import ProgressBar from './ProgressBar'
import Navigation from './Navigation'
import NotesPanel from './NotesPanel'
import { store, subscribe, getVersion } from '../scene/store'

// The WebGL scene is a separate chunk, fetched right after the first paint. Slides never wait for it.
const loadScene = () => import('../scene/Scene')
const Scene = lazy(loadScene)

/** How long the old slide takes to dissolve before the next one appears. */
const LEAVE_MS = 280

/** Slides with a two-tone background: only there the HUD uses difference blending to stay readable. */
const SPLIT = new Set([2, 4, 5])

/** Lightweight stand-in shown for a moment while the mannequin is being loaded. */
function ScenePlaceholder() {
  useSyncExternalStore(subscribe, getVersion)
  const t = store.target
  if (store.ready || t.visible <= 0) return null
  return (
    <div className="ph" style={{ left: `${50 + 50 * t.x}%`, '--s': t.scale } as CSSProperties} aria-hidden="true">
      <svg viewBox="0 0 120 340">
        <ellipse cx="60" cy="26" rx="15" ry="21" />
        <path d="M52 46 H68 V56 L90 66 L98 150 L92 152 L84 100 L96 330 H24 L36 100 L28 152 L22 150 L30 66 L52 56 Z" />
      </svg>
    </div>
  )
}

export default function Presentation() {
  const total = slides.length
  const [i, setI] = useState(() => {
    const n = parseInt(window.location.hash.slice(1), 10)
    return n >= 1 && n <= total ? n - 1 : 0
  })
  const [leaving, setLeaving] = useState(false)
  const [full, setFull] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [sceneOn, setSceneOn] = useState(false)
  const cur = useRef(i)
  const timer = useRef<number | undefined>(undefined)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const app = useRef<HTMLDivElement>(null)

  /** The old slide dissolves, then the next one flows in. `cur` keeps rapid presses correct while that happens. */
  const go = useCallback(
    (n: number) => {
      const t = Math.max(0, Math.min(total - 1, n))
      if (t === cur.current) return
      cur.current = t
      setLeaving(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(
        () => {
          setI(cur.current)
          setLeaving(false)
        },
        store.reduced ? 0 : LEAVE_MS
      )
    },
    [total]
  )

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.().catch(() => {})
  }, [])

  useEffect(() => {
    window.history.replaceState(null, '', `#${i + 1}`)
  }, [i])

  // fetch the 3D chunk right after the first paint
  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadScene()
      setSceneOn(true)
    }, 30)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key
      if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') {
        e.preventDefault()
        ;(document.activeElement as HTMLElement | null)?.blur?.()
        if (!e.repeat) go(cur.current + 1)
      } else if (k === 'ArrowLeft' || k === 'PageUp') {
        e.preventDefault()
        if (!e.repeat) go(cur.current - 1)
      } else if (k === 'Home') {
        e.preventDefault()
        go(0)
      } else if (k === 'End') {
        e.preventDefault()
        go(total - 1)
      } else if (k === 'ArrowDown' || k === 'ArrowUp') {
        // steps / looks inside a slide (never changes the slide)
        e.preventDefault()
        if (!e.repeat) window.dispatchEvent(new CustomEvent('deck:step', { detail: k === 'ArrowDown' ? 1 : -1 }))
      } else if (k >= '1' && k <= '9') {
        window.dispatchEvent(new CustomEvent('deck:pick', { detail: Number(k) - 1 }))
      } else if (k === 'f' || k === 'F' || k === 'а' || k === 'А') toggleFull()
      else if (k === 'n' || k === 'N' || k === 'т' || k === 'Т') setNotesOpen((o) => !o)
      else if (k === 'Escape') setNotesOpen(false) // leaving fullscreen with Esc is handled by the browser itself
    }
    let raf = 0
    const onMove = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1
      const y = (e.clientY / window.innerHeight) * 2 - 1
      store.ptr.x = x
      store.ptr.y = y
      if (raf || store.reduced) return
      raf = requestAnimationFrame(() => {
        raf = 0
        app.current?.style.setProperty('--mx', String(x))
        app.current?.style.setProperty('--my', String(y))
      })
    }
    const onFs = () => setFull(!!document.fullscreenElement)
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('fullscreenchange', onFs)
      cancelAnimationFrame(raf)
    }
  }, [go, toggleFull, total])

  /** A click on an empty part of the slide = next slide (buttons and controls keep their own action). */
  const onStageClick = (e: MouseEvent) => {
    if (e.button !== 0) return
    const t = e.target as HTMLElement
    if (t.closest('button, a, input, textarea, select, [role="tab"], [role="radio"]')) return
    if (window.getSelection()?.toString()) return
    go(cur.current + 1)
  }
  const onTouchStart = (e: TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: TouchEvent) => {
    if (!touch.current) return
    const dx = e.changedTouches[0].clientX - touch.current.x
    const dy = e.changedTouches[0].clientY - touch.current.y
    touch.current = null
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(cur.current + (dx < 0 ? 1 : -1))
  }

  const Current = slides[i]

  return (
    <div ref={app} className={'app' + (notesOpen ? ' with-notes' : '')} data-tone={TONES[i]} data-split={SPLIT.has(i) ? '1' : undefined}>
      <ProgressBar total={total} current={i} go={go} />
      <main className={'stage' + (leaving ? ' leaving' : '')} onClick={onStageClick} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <Slide key={i} n={i + 1}>
          <Current go={go} />
        </Slide>
      </main>
      <ScenePlaceholder />
      {sceneOn && (
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      )}
      {notesOpen && <NotesPanel current={i} onClose={() => setNotesOpen(false)} />}
      <Navigation
        current={i}
        total={total}
        full={full}
        notesOpen={notesOpen}
        onPrev={() => go(cur.current - 1)}
        onNext={() => go(cur.current + 1)}
        toggleFull={toggleFull}
        toggleNotes={() => setNotesOpen((o) => !o)}
      />
    </div>
  )
}
