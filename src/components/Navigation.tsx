import { ChevronLeft, ChevronRight, Maximize2, Minimize2, StickyNote } from 'lucide-react'

interface Props {
  current: number
  total: number
  full: boolean
  notesOpen: boolean
  onPrev: () => void
  onNext: () => void
  toggleFull: () => void
  toggleNotes: () => void
}

const pad = (n: number) => String(n).padStart(2, '0')

export default function Navigation({ current, total, full, notesOpen, onPrev, onNext, toggleFull, toggleNotes }: Props) {
  return (
    <footer className="hud">
      <div className="counter" aria-live="polite">
        <b>{pad(current + 1)}</b>
        <span> / {pad(total)}</span>
      </div>
      <div className="controls">
        <button onClick={toggleNotes} aria-label="Нотатки доповідача (N)" aria-pressed={notesOpen} className={notesOpen ? 'active' : ''} title="Нотатки (N)">
          <StickyNote size={18} strokeWidth={1.6} />
        </button>
        <button onClick={onPrev} disabled={current === 0} aria-label="Попередній слайд (←)" title="Назад (←)">
          <ChevronLeft size={20} strokeWidth={1.6} />
        </button>
        <button onClick={onNext} disabled={current === total - 1} aria-label="Наступний слайд (→ / Space / клік)" title="Далі (→ / Space / клік)">
          <ChevronRight size={20} strokeWidth={1.6} />
        </button>
        <button onClick={toggleFull} aria-label="Повноекранний режим (F)" title="Повний екран (F)">
          {full ? <Minimize2 size={18} strokeWidth={1.6} /> : <Maximize2 size={18} strokeWidth={1.6} />}
        </button>
      </div>
    </footer>
  )
}
