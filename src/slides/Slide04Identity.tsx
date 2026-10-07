import { R, Words, Label, Refs, P, OrnamentDefs, useScene } from '../components/ui'
import type { SlideProps } from '../types'

const FIGURES = [
  { t: 'Традиція', d: 'спадок форм і символів', fill: '#111', orn: '#B7A58A', body: 'M40 28 L60 28 L72 36 L82 82 L76 84 L68 58 L72 122 L90 214 L10 214 L28 122 L32 58 L24 84 L18 82 L28 36 Z' },
  { t: 'Сучасність', d: 'ті самі мотиви в новому крої', fill: '#7C1F2B', orn: '#F4F1EB', body: 'M40 28 L60 28 L70 36 L72 72 L66 74 L64 46 L66 150 L64 214 L36 214 L34 150 L36 46 L34 74 L28 72 L30 36 Z' },
  { t: 'Регіон', d: 'місцеві візерунки та кольори', fill: '#111', orn: '#B7A58A', body: 'M40 28 L60 28 L70 36 L74 78 L68 78 L66 52 L68 100 L78 164 L22 164 L32 100 L34 52 L32 78 L26 78 L30 36 Z M42 164 H48 V214 H42Z M52 164 H58 V214 H52Z' },
  { t: 'Спільнота', d: 'спільний код, який впізнають свої', fill: '#77736C', orn: '#F4F1EB', body: 'M36 28 L64 28 L80 38 L85 104 L79 176 L21 176 L15 104 L20 38 Z M41 176 H48 V214 H41Z M52 176 H59 V214 H52Z' },
  { t: 'Покоління', d: 'кожне читає код по-своєму', fill: '#111', orn: '#B7A58A', body: 'M40 28 L60 28 L68 36 L66 82 L34 82 L32 36 Z M34 82 L66 82 L78 214 L55 214 L50 112 L45 214 L22 214 Z' },
]

export default function Slide04Identity({ go }: SlideProps) {
  useScene({ visible: 0, x: 0, fabric: 0, w: [1, 0, 0, 0, 0], body: '#cfc6b6', garment: '#7C1F2B' }, [])
  return (
    <div className="s4">
      <OrnamentDefs />
      <div className="s4-head">
        <Label>Ідентичність</Label>
        <h2 className="hd">
          <Words text="Одяг може сказати: «Я — це *ми»*" i={1} />
        </h2>
      </div>
      <div className="figs">
        {FIGURES.map((f, k) => (
          <R i={5 + k} key={f.t} className="fig">
            <P depth={(k - 2) * -5}>
              <svg viewBox="0 0 100 220" className="sil" style={{ color: f.orn }}>
                <circle cx="50" cy="13" r="8.5" fill={f.fill} />
                <path d={f.body} fill={f.fill} />
                <path d={f.body} fill="url(#orn)" opacity={k === 1 ? 0.55 : 0.4} />
              </svg>
            </P>
            <h3>{f.t}</h3>
            <p>{f.d}</p>
          </R>
        ))}
      </div>
      <R i={11} className="strip" aria-hidden="true">
        <svg width="100%" height="28" style={{ color: '#7C1F2B' }}><rect width="100%" height="28" fill="url(#orn-s)" /></svg>
      </R>
      <Refs items={[3, 2]} go={go} />
    </div>
  )
}
