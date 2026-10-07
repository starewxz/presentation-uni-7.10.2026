import type { ReactNode } from 'react'

const SECTIONS = ['Вступ', 'Питання', 'Мова', 'Ідентичність', 'Україна', 'Позиція', 'Суспільство', 'Цифрова доба', 'Код', 'Фінал', 'Джерела']

export default function Slide({ n, children }: { n: number; children: ReactNode }) {
  return (
    <section className="slide" data-slide={n}>
      {/* editorial furniture: ghost folio + running vertical title */}
      {n > 1 && n !== 3 && <span className="ghost" aria-hidden="true">{String(n).padStart(2, '0')}</span>}
      <span className="running" aria-hidden="true">Мода як мова · {SECTIONS[n - 1]}</span>
      {children}
    </section>
  )
}
