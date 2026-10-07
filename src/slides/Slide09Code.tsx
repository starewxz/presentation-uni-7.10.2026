import { R, Words, Label, Refs, useScene } from '../components/ui'
import type { SlideProps } from '../types'

const TERMS = [
  ['Одяг', 'форма й матеріал'],
  ['Контекст', 'час, місце, ситуація'],
  ['Символи', 'візерунки, кольори, деталі'],
  ['Ідентичність', 'хто ми і як себе показуємо'],
]

export default function Slide09Code({ go }: SlideProps) {
  useScene({ visible: 0, orbit: 1, fabric: 0.25, w: [0, 1, 0, 0, 0], garment: '#7C1F2B' }, [])
  return (
    <div className="s9">
      <div className="s9-head">
        <Label>Культурний код</Label>
        <h2 className="hd"><Words text="Мода як *культурний код*" i={1} /></h2>
      </div>
      <div className="formula">
        {TERMS.map(([t, d], k) => (
          <div className="ft" key={t}>
            <div className="ft-row">
              <span className="ft-w"><Words text={t.toUpperCase()} i={5 + k * 3} /></span>
              {k < 3 && <R i={7 + k * 3} className="plus">+</R>}
            </div>
            <R i={8 + k * 3} as="p">{d}</R>
          </div>
        ))}
      </div>
      <R i={19} className="eq-line"><i /></R>
      <div className="eq">
        <Words text="КУЛЬТУРНЕ *ПОВІДОМЛЕННЯ*" i={20} />
      </div>
      <Refs items={[1, 3]} go={go} />
    </div>
  )
}
