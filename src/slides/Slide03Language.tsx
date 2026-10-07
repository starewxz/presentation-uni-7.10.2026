import { ArrowDown } from 'lucide-react'
import { R, Words, Refs, useScene } from '../components/ui'
import type { SlideProps } from '../types'

const Chain = ({ top, a, b, i }: { top: string; a: string; b: string; i: number }) => (
  <div className="chain">
    <R i={i} className="chain-top">{top}</R>
    <R i={i + 2} className="chain-s">{a}</R>
    <R i={i + 3} className="chain-ar"><ArrowDown size={22} strokeWidth={1.2} /></R>
    <R i={i + 4} className="chain-s v">{b}</R>
  </div>
)

export default function Slide03Language({ go }: SlideProps) {
  useScene({ visible: 1, x: 0, y: 0.16, scale: 0.92, spin: 0.35, w: [0, 1, 0, 0, 0], trim: 0.7, pose: 0, garment: '#B7A58A', fabric: 0 }, [])
  return (
    <div className="s3">
      <div className="half left" />
      <div className="half right" />
      <div className="s3-grid">
        <div className="col a"><Chain top="МОВА" a="слова" b="значення" i={2} /></div>
        <div className="col mid" />
        <div className="col b"><Chain top="МОДА" a="одяг" b="значення" i={5} /></div>
      </div>
      <blockquote className="s3-q">
        <Words text="Якщо мова передає думки словами, то мода може передавати їх через *образ.*" i={12} />
      </blockquote>
      <div className="s3-refs"><Refs items={[1]} go={go} /></div>
    </div>
  )
}
