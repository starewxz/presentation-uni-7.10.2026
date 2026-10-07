import { R, Words, Label, Refs, LookPicker, useScene } from '../components/ui'
import type { SlideProps } from '../types'

const LEFT = [['Ідентичність', 36], ['Статус', 54], ['Історія', 72]] as const
const RIGHT = [['Культура', 42], ['Протест', 60], ['Спільнота', 78]] as const

export default function Slide02Question({ go }: SlideProps) {
  useScene({ visible: 1, x: 0, y: 0.14, scale: 1.02, spin: 0.28, w: [0, 1, 0, 0, 0], trim: 1, pose: 0, garment: '#D8CFBD', fabric: 0.3 }, [])
  return (
    <div className="s2">
      <div className="s2-head">
        <Label>Питання</Label>
        <h2 className="hd">
          <Words text="Що ми насправді бачимо, коли дивимося на *одяг?*" i={1} />
        </h2>
      </div>
      {LEFT.map(([w, y], k) => (
        <R i={7 + k * 2} key={w} className="call l" style={{ top: `${y}%`, '--i': 7 + k * 2 } as React.CSSProperties}>
          <span className="call-w">{w}</span>
          <span className="call-line"><i /></span>
        </R>
      ))}
      {RIGHT.map(([w, y], k) => (
        <R i={8 + k * 2} key={w} className="call r2" style={{ top: `${y}%`, '--i': 8 + k * 2 } as React.CSSProperties}>
          <span className="call-line"><i /></span>
          <span className="call-w">{w}</span>
        </R>
      ))}
      <R i={16} as="blockquote" className="thesis">
        Одяг може повідомляти про людину ще до того, як вона заговорить.
      </R>
      <LookPicker />
      <Refs items={[1, 3]} go={go} />
    </div>
  )
}
