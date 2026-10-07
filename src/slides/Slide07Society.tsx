import { R, Words, Label, Refs, useStepper, useScene } from '../components/ui'
import type { SlideProps } from '../types'

const ERAS = [
  { t: 'Традиція', d: 'одяг показує приналежність до громади' },
  { t: 'Індустріалізація', d: 'одяг стає виробом, а не лише ремеслом' },
  { t: 'Масова культура', d: 'стиль стає доступним для багатьох' },
  { t: 'Глобалізація', d: 'образи й тренди швидко мандрують світом' },
  { t: 'Digital / соцмережі', d: 'образ існує в стрічці, а не лише на вулиці' },
]
const SCENES = [
  { w: [1, 0, 0, 0, 0], pattern: 0.3, trim: 0.8, wire: 0, garment: '#D8CFBD', pose: 0 },
  { w: [0.45, 0.55, 0, 0, 0], pattern: 0, trim: 0.3, wire: 0, garment: '#2a2623', pose: 0 },
  { w: [0, 1, 0, 0, 0], pattern: 0, trim: 0, wire: 0, garment: '#151311', pose: 1 },
  { w: [0, 0.4, 0.6, 0, 0], pattern: 0, trim: 0, wire: 0, garment: '#6b1a27', pose: 2 },
  { w: [0, 0, 0, 1, 0], pattern: 0, trim: 0, wire: 0.5, garment: '#8e8a85', pose: 2 },
]

export default function Slide07Society({ go }: SlideProps) {
  const [step, pick] = useStepper(5)
  const sc = SCENES[step]
  useScene({ visible: 1, x: 0, y: 0.08, scale: 0.88, spin: 0.35, w: sc.w, pattern: sc.pattern, trim: sc.trim, wire: sc.wire, pose: sc.pose, garment: sc.garment, fabric: 0.25 }, [step])
  return (
    <div className="s7">
      <div className="s7-head">
        <Label>Суспільство</Label>
        <h2 className="hd">
          <Words text="Мода показує, яким є *суспільство*" i={1} />
        </h2>
      </div>
      <div className="s7-desc" key={step}>
        <span className="k">Етап 0{step + 1}</span>
        <p>{ERAS[step].d}</p>
        <small>умовна схема, не хронологія силуетів</small>
      </div>
      <div className="tl">
        <div className="tl-line"><i style={{ transform: `scaleX(${step / 4})` }} /></div>
        {ERAS.map((e, k) => (
          <R i={5 + k} key={e.t} className={'tl-n' + (k === step ? ' on' : k < step ? ' past' : '')}>
            <button onClick={() => pick(k)}>
              <span className="dot" />
              <span className="n">0{k + 1}</span>
              <b>{e.t}</b>
            </button>
          </R>
        ))}
      </div>
      <Refs items={[5, 2]} go={go} />
    </div>
  )
}
