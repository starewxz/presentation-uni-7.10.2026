import { R, Words, Label, Refs, StepList, useStepper, useScene } from '../components/ui'
import type { SlideProps } from '../types'

const ITEMS = [
  { title: 'Одяг', text: 'щоденний вибір, який бачать усі' },
  { title: 'Порушення норми', text: 'форма, колір чи спосіб носити не за правилами' },
  { title: 'Реакція суспільства', text: 'подив, осуд або підтримка' },
  { title: 'Культурна зміна', text: 'норма розширюється або переписується' },
]
const SCENES = [
  { w: [0, 1, 0, 0, 0], garment: '#151311', pose: 0 },
  { w: [0, 0.5, 0, 0, 0.5], garment: '#151311', pose: 1 },
  { w: [0, 0, 0, 0, 1], garment: '#151311', pose: 2 },
  { w: [0, 0.3, 0.3, 0, 0.4], garment: '#EDE8DE', pose: 2 },
]

export default function Slide06Protest({ go }: SlideProps) {
  const [step, pick, auto] = useStepper(4)
  const sc = SCENES[step]
  useScene({ visible: 1, x: 0.54, scale: 1.2, spin: step === 2 ? 0.5 : 0.3, w: sc.w, pose: sc.pose, garment: sc.garment, fabric: 0 }, [step])
  return (
    <div className="s6">
      <div className="vitrine burgundy" />
      <div className="s5-l">
        <Label>Позиція</Label>
        <h2 className="hd">
          <Words text="Коли одяг стає *заявою*" i={1} />
        </h2>
        <StepList items={ITEMS} step={step} onPick={pick} auto={auto} />
        <R i={10} as="blockquote" className="thesis sm">
          Порушити правило в одязі — іноді означає поставити під питання саме правило.
        </R>
        <Refs items={[4]} go={go} />
      </div>
    </div>
  )
}
