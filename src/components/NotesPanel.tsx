import { X } from 'lucide-react'
import { notes } from '../data/notes'

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function NotesPanel({ current, onClose }: { current: number; onClose: () => void }) {
  const note = notes[current]
  const elapsed = notes.slice(0, current + 1).reduce((s, n) => s + n.seconds, 0)
  return (
    <aside className="notes" aria-label="Нотатки доповідача">
      <header>
        <div>
          <span className="notes-k">Що сказати · слайд {current + 1}</span>
          <span className="notes-t">≈ {note.seconds} с · разом до {fmt(elapsed)}</span>
        </div>
        <button onClick={onClose} aria-label="Закрити нотатки"><X size={18} /></button>
      </header>
      <div className="notes-body" key={current}>
        {note.text.map((p, k) => (
          <p key={k}>{p}</p>
        ))}
      </div>
    </aside>
  )
}
