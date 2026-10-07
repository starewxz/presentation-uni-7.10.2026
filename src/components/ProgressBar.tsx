export default function ProgressBar({ total, current, go }: { total: number; current: number; go: (n: number) => void }) {
  return (
    <div className="progress" role="tablist" aria-label="Слайди">
      {Array.from({ length: total }, (_, n) => (
        <button
          key={n}
          className={'seg' + (n < current ? ' done' : n === current ? ' on' : '')}
          onClick={() => go(n)}
          aria-label={`Слайд ${n + 1}`}
        >
          <span />
        </button>
      ))}
    </div>
  )
}
