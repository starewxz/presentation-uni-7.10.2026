import { R, Words, Label, StepList, useStepper, useScene } from '../components/ui'
import type { SlideProps } from '../types'

const ITEMS = [
  { title: 'Традиційний одяг', text: 'форми, що передавалися поколіннями' },
  { title: 'Орнамент', text: 'символи й візерунки як візуальна пам’ять' },
  { title: 'Сучасний дизайн', text: 'той самий мотив, але інший крій' },
  { title: 'Нова ідентичність', text: 'традиція як усвідомлений вибір' },
]
const SCENES = [
  { w: [1, 0, 0, 0, 0], pattern: 0, trim: 0, garment: '#EDE8DE', cam: 0, pose: 0 },
  { w: [1, 0, 0, 0, 0], pattern: 1, trim: 1, garment: '#EDE8DE', cam: 1, pose: 0 },
  { w: [0, 1, 0, 0, 0], pattern: 0.25, trim: 1, garment: '#EDE8DE', cam: 2, pose: 0 },
  { w: [0, 1, 0, 0, 0], pattern: 0.2, trim: 1, garment: '#7C1F2B', cam: 0, pose: 2 },
]

export default function Slide05Ukraine(_: SlideProps) {
  const [step, pick, auto] = useStepper(4)
  const sc = SCENES[step]
  useScene({ visible: 1, x: 0.54, scale: 1.2, spin: 0.3, w: sc.w, pattern: sc.pattern, trim: sc.trim, cam: sc.cam, pose: sc.pose, garment: sc.garment, fabric: 0 }, [step])
  return (
    <div className="s5">
      <div className="vitrine dark" />
      <div className="s5-l">
        <Label>Україна</Label>
        <h2 className="hd">
          <Words text="Українська мода: між *традицією* та *сучасністю*" i={1} />
        </h2>
        <StepList items={ITEMS} step={step} onPick={pick} auto={auto} />
      </div>
      <R i={9} className="museum-label">
        <b>Експонат 0{step + 1}</b>
        <span>{ITEMS[step].title}</span>
      </R>
    </div>
  )
}
