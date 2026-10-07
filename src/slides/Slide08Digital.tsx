import { R, Words, Label, StepList, useStepper, useScene } from '../components/ui'
import type { SlideProps } from '../types'

const ITEMS = [
  { title: 'Реальний одяг', text: 'тканина, крій, тіло' },
  { title: 'Цифровий аватар', text: 'той самий образ у 3D-просторі' },
  { title: 'Соцмережі', text: 'образ бачать, оцінюють, копіюють' },
  { title: 'Віртуальна ідентичність', text: 'присутність, що існує без тканини' },
]
const SCENES = [
  { wire: 0, w: [0, 1, 0, 0, 0], garment: '#EDE8DE', cam: 0 },
  { wire: 0.45, w: [0, 0.35, 0, 0.65, 0], garment: '#9a958e', cam: 0 },
  { wire: 0.7, w: [0, 0, 0, 1, 0], garment: '#9a958e', cam: 2 },
  { wire: 0.9, w: [0, 0, 0, 1, 0], garment: '#7C1F2B', cam: 0 },
]
const CHIPS = ['@ти', '♡', '# мій_образ', 'AR-примірка', '↗ поділитися', 'шар 01 · цифровий одяг']

export default function Slide08Digital(_: SlideProps) {
  const [step, pick, auto] = useStepper(4)
  const sc = SCENES[step]
  useScene({ visible: 1, x: 0.42, scale: 1.12, spin: 0.35, w: sc.w, wire: sc.wire, cam: sc.cam, pose: 2, garment: sc.garment, fabric: 0 }, [step])
  return (
    <div className="s8">
      <div className="s5-l">
        <Label>Цифрова доба</Label>
        <h2 className="hd sm">
          <Words text="Що відбувається, коли мода переходить у *цифровий простір?*" i={1} />
        </h2>
        <StepList items={ITEMS} step={step} onPick={pick} auto={auto} />
        <R i={11} as="blockquote" className="thesis dk">
          Сьогодні людина може створювати свій образ не лише через те, що носить у реальному світі, а й через цифрову присутність.
        </R>
      </div>
      <div className="chips" aria-hidden="true">
        {CHIPS.map((c, k) => (
          <span key={c} className={'chip c' + k + (step >= (k < 2 ? 1 : 2) ? ' on' : '')}>{c}</span>
        ))}
      </div>
    </div>
  )
}
