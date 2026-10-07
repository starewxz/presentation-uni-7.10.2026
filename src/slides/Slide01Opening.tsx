import { useEffect } from 'react'
import { R, Words, P } from '../components/ui'
import { setScene, patchScene } from '../scene/store'
import type { SlideProps } from '../types'

/** Cinematic opening: empty space → mannequin → silk → typography. */
export default function Slide01Opening(_: SlideProps) {
  useEffect(() => {
    setScene({ visible: 0, x: 0.3, scale: 1.18, spin: 0.2, w: [0, 1, 0, 0, 0], trim: 0.9, pose: 0, garment: '#EDE8DE', fabric: 0 })
    const a = setTimeout(() => patchScene({ visible: 1 }), 900)
    const b = setTimeout(() => patchScene({ fabric: 0.8 }), 2400)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [])
  return (
    <div className="s1">
      <R i={26} className="s1-top">
        <span>Культурний архів</span>
        <span>Одяг · Ідентичність · Мова</span>
      </R>
      <P depth={-12} className="s1-main">
        <h1 className="hero">
          <Words text="МОДА —" i={30} />
          <br />
          <Words text="ЦЕ *МОВА.*" i={34} />
        </h1>
      </P>
      <R i={40} className="s1-sub">
        <span className="rule" />
        <p>Як одяг перетворюється на форму культурного самовираження</p>
      </R>
    </div>
  )
}
