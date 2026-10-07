import { useCallback, useEffect, useRef, useState, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode } from 'react'
import { setScene, patchScene, type SceneTarget } from '../scene/store'

type RProps = HTMLAttributes<HTMLElement> & {
  i?: number
  as?: ElementType
  children?: ReactNode
  tabIndex?: number
}

/** Cinematic reveal: blur → sharp, slide-up, subtle scale, staggered by `i`. */
export const R = ({ i = 0, as: Tag = 'div', className = '', children, ...rest }: RProps) => (
  <Tag className={'r ' + className} style={{ '--i': i } as CSSProperties} {...rest}>
    {children}
  </Tag>
)

/** Mask-reveal typography. Wrap words in *asterisks* for burgundy italic emphasis. */
export function Words({ text, i = 0, className = '' }: { text: string; i?: number; className?: string }) {
  let em = false
  return (
    <span className={'wds ' + className} style={{ '--i': i } as CSSProperties} aria-label={text.replace(/\*/g, '')}>
      {text.split(' ').map((tok, k) => {
        if (tok.startsWith('*')) em = true
        const clean = tok.replace(/\*/g, '')
        const isEm = em
        if (tok.endsWith('*')) em = false
        return (
          <span key={k} aria-hidden="true">
            <span className="mw">
              <span className={isEm ? 'em' : ''} style={{ '--k': k } as CSSProperties}>
                {clean}
              </span>
            </span>{' '}
          </span>
        )
      })}
    </span>
  )
}

/** Cursor parallax layer. depth in px of max travel (negative = opposite direction). */
export const P = ({ depth = 10, className = '', children, style }: { depth?: number; className?: string; children?: ReactNode; style?: CSSProperties }) => (
  <div className={'px ' + className} style={{ '--d': depth, ...style } as CSSProperties}>
    {children}
  </div>
)

export const Label = ({ children, i = 0 }: { children: ReactNode; i?: number }) => (
  <R i={i} className="label">
    {children}
  </R>
)

export const Refs = ({ items, go }: { items: number[]; go?: (n: number) => void }) => (
  <R i={14} className="refs">
    Опора:{' '}
    {items.map((n) => (
      <button key={n} className="ref" onClick={() => go?.(10)} title="До списку джерел">
        [{n}]
      </button>
    ))}
  </R>
)

/** Declare what the shared 3D scene should show while this slide is mounted. */
export function useScene(target: Partial<SceneTarget>, deps: unknown[] = []) {
  useEffect(() => {
    setScene(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/**
 * ↑ / ↓ move between the steps of a slide, 1…5 jump to a step (handy with a keyboard only).
 * Presentation dispatches these events; ← → / Space / click always change the slide.
 */
function useDeckKeys(n: number, current: number, apply: (k: number) => void) {
  const now = useRef(current)
  now.current = current
  useEffect(() => {
    const onStep = (e: Event) => apply(Math.min(n - 1, Math.max(0, now.current + (e as CustomEvent<number>).detail)))
    const onPick = (e: Event) => {
      const k = (e as CustomEvent<number>).detail
      if (k >= 0 && k < n) apply(k)
    }
    window.addEventListener('deck:step', onStep)
    window.addEventListener('deck:pick', onPick)
    return () => {
      window.removeEventListener('deck:step', onStep)
      window.removeEventListener('deck:pick', onPick)
    }
  }, [n, apply])
}

/**
 * Auto-advancing stepper: the steps play by themselves, and as soon as the presenter clicks a step
 * (or presses ↑ ↓ / 1…5) the slide stops advancing and waits for them.
 */
/** Steps inside a slide change only by hand: ↓/↑, number keys or a click. */
export function useStepper(n: number) {
  const [s, setS] = useState(0)
  const pick = useCallback((k: number) => setS(k), [])
  useDeckKeys(n, s, pick)
  return [s, pick, false] as const
}

export interface StepItem {
  title: string
  text: string
}

/** The active step expands; a thin line shows when the next step will play. */
export function StepList({ items, step, onPick, auto = false }: { items: StepItem[]; step: number; onPick: (k: number) => void; auto?: boolean }) {
  return (
    <ol className="steps">
      {items.map((it, k) => (
        <R i={4 + k} as="li" key={it.title}>
          <button className={'stp' + (k === step ? ' on' : k < step ? ' past' : '')} onClick={() => onPick(k)} aria-current={k === step}>
            <span className="stp-n">0{k + 1}</span>
            <span className="stp-b">
              <span className="stp-t">{it.title}</span>
              <span className="stp-d">{it.text}</span>
            </span>
            <span className="stp-bar">{auto && k === step && <i key={step} />}</span>
          </button>
        </R>
      ))}
    </ol>
  )
}

/** Shared SVG ornament pattern (rhombus motif) for silhouettes and strips. */
export const OrnamentDefs = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
    <defs>
      <pattern id="orn" width="14" height="14" patternUnits="userSpaceOnUse">
        <path d="M7 1.5 L12.5 7 L7 12.5 L1.5 7Z" fill="none" stroke="currentColor" strokeWidth="0.9" />
        <path d="M7 4.6 L9.4 7 L7 9.4 L4.6 7Z" fill="currentColor" />
        <circle cx="0" cy="0" r="1" fill="currentColor" />
        <circle cx="14" cy="0" r="1" fill="currentColor" />
        <circle cx="0" cy="14" r="1" fill="currentColor" />
        <circle cx="14" cy="14" r="1" fill="currentColor" />
      </pattern>
      <pattern id="orn-s" width="8" height="8" patternUnits="userSpaceOnUse">
        <path d="M4 .8 L7.2 4 L4 7.2 L.8 4Z" fill="none" stroke="currentColor" strokeWidth="0.7" />
      </pattern>
    </defs>
  </svg>
)

/** Exhibition-style LOOK switcher: changes the garment, material, pose and plays a short camera move. */
const LOOKS: { n: string; name: string; patch: Partial<SceneTarget> }[] = [
  { n: '01', name: 'Tradition × Modern', patch: { w: [0, 1, 0, 0, 0], garment: '#D8CFBD', pattern: 0, trim: 1, wire: 0, pose: 0 } },
  { n: '02', name: 'Contemporary Couture', patch: { w: [0, 0, 1, 0, 0], garment: '#6b1a27', pattern: 0, trim: 0, wire: 0, pose: 2 } },
  { n: '03', name: 'Digital Identity', patch: { w: [0, 0, 0, 1, 0], garment: '#9a958e', pattern: 0, trim: 0, wire: 0.3, pose: 2 } },
]

export function LookPicker({ initial = 0, light = false }: { initial?: number; light?: boolean }) {
  const [k, setK] = useState(initial)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])
  const pick = useCallback((i: number) => {
    setK(i)
    timers.current.forEach(window.clearTimeout)
    // full body → fabric detail → bust close-up → full look
    patchScene({ ...LOOKS[i].patch, cam: 2 })
    timers.current = [window.setTimeout(() => patchScene({ cam: 3 }), 1700), window.setTimeout(() => patchScene({ cam: 0 }), 3400)]
  }, [])
  useDeckKeys(LOOKS.length, k, pick)
  return (
    <R i={18} className={'looks' + (light ? ' light' : '')}>
      <div className="looks-btns" role="tablist" aria-label="Образи">
        {LOOKS.map((l, i) => (
          <button key={l.n} role="tab" aria-selected={i === k} className={i === k ? 'on' : ''} onClick={() => pick(i)}>
            {l.n}
          </button>
        ))}
      </div>
      <div className="looks-name" key={k}>
        <b>LOOK {LOOKS[k].n}</b>
        <span>{LOOKS[k].name}</span>
      </div>
    </R>
  )
}
