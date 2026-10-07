import { useState } from 'react'
import { R, Words, LookPicker, useScene } from '../components/ui'
import type { SlideProps } from '../types'

const OPTS = [
  ['про мої цінності', 'Цінності видно у виборі: що ми купуємо, що зберігаємо і від чого відмовляємося.'],
  ['про мою спільноту', 'Одяг — спосіб упізнати «своїх» і показати, до кого ми належимо.'],
  ['про мій настрій', 'Образ змінюється разом із нами — і теж є повідомленням.'],
]

export default function Slide10Finale(_: SlideProps) {
  const [pick, setPick] = useState<number | null>(null)
  useScene({ visible: 1, x: 0.5, scale: 1.2, spin: 0.22, w: [0, 1, 0, 0, 0], trim: 1, pattern: 0.2, pose: 1, garment: '#EDE8DE', fabric: 0.4 }, [])
  return (
    <>
      <LookPicker />
    <div className="s10">
      <h2 className="finale">
        <Words text="Ми не просто носимо одяг." i={1} />
        <br />
        <Words text="Ми носимо *історії.*" i={7} />
      </h2>
      <R i={14} as="p" className="fin-sub">Мода — це спосіб сказати, хто ми, звідки ми і якими ми хочемо бути.</R>
      <R i={20} className="fin-thanks">Дякую за увагу.</R>
      <R i={24} className="fin-q">
        <h3>А що ваш одяг говорить про вас?</h3>
        <div className="opts">
          {OPTS.map(([o], k) => (
            <button key={o} className={'opt' + (pick === k ? ' on' : '')} onClick={() => setPick(k)} aria-pressed={pick === k}>
              {o}
            </button>
          ))}
        </div>
        <p className="fb" key={pick}>{pick === null ? ' ' : OPTS[pick][1]}</p>
      </R>
    </div>
    </>
  )
}
