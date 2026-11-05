import { Sparkles } from 'lucide-react'
import type { Card } from '../../types'

/** Stats strip above the cards archive: totals, playtest count, ready progress. */
export function CardsOverview({
  cards,
  setCount,
  workbookCount,
}: {
  cards: Card[]
  setCount: number
  workbookCount: number
}) {
  const readyCount = cards.filter((card) => card.status === 'Ready').length
  const progress = cards.length ? Math.round((readyCount / cards.length) * 100) : 0
  return (
    <section className="overview-strip">
      <div className="overview-cell total-cell">
        <span className="metric-label">CARTE NEL SET</span>
        <div className="metric-line">
          <strong>{String(cards.length).padStart(2, '0')}</strong>
          <span>carte</span>
        </div>
      </div>
      <div className="overview-cell">
        <span className="metric-label">IN PLAYTEST</span>
        <div className="metric-line">
          <strong>{String(cards.filter((card) => card.status === 'Playtest').length).padStart(2, '0')}</strong>
          <span>carte</span>
        </div>
      </div>
      <div className="overview-cell">
        <span className="metric-label">PRONTE</span>
        <div className="progress-line">
          <div className="progress-track">
            <span style={{ width: `${progress}%` }} />
          </div>
          <strong>{progress}%</strong>
        </div>
        <span className="metric-foot">
          {readyCount} di {cards.length} carte complete
        </span>
      </div>
      <div className="overview-note">
        <Sparkles size={17} />
        <span>
          {setCount} set nel progetto
          <br />
          {workbookCount} file Excel rilevati
        </span>
      </div>
    </section>
  )
}
