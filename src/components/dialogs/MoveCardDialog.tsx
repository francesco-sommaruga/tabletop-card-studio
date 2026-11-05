import { useState } from 'react'
import { X, ArrowRightLeft } from 'lucide-react'
import type { Card, ProjectSnapshot } from '../../types'

export function MoveCardDialog({
  card,
  sets,
  activeSetId,
  onClose,
  onMove,
}: {
  card: Card
  sets: ProjectSnapshot['sets']
  activeSetId?: string | null
  onClose: () => void
  onMove: (targetSetId: string) => Promise<void>
}) {
  const destinations = sets.filter((set) => set.id !== activeSetId)
  const [targetSetId, setTargetSetId] = useState(destinations[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const target = destinations.find((set) => set.id === targetSetId)
  return (
    <>
      <button
        className="scrim move-card-scrim"
        aria-label="Chiudi spostamento carta"
        onClick={onClose}
        disabled={busy}
      />
      <section
        className="rename-set-panel move-card-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-card-title"
      >
        <div className="editor-head">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />
              ORGANIZZAZIONE CARTE
            </div>
            <h2 id="move-card-title">Sposta carta.</h2>
          </div>
          <button className="icon-button close-editor" onClick={onClose} aria-label="Chiudi" disabled={busy}>
            <X size={18} />
          </button>
        </div>
        <div className="move-card-content">
          <div className="move-card-summary">
            <span className="move-card-icon">
              <ArrowRightLeft size={16} />
            </span>
            <span>
              <strong>{card.title || 'Carta senza titolo'}</strong>
              <small>{card.tags.length ? card.tags.join(' · ') : 'Tag e quantità saranno mantenuti'}</small>
            </span>
          </div>
          <label htmlFor="move-card-target">SET DI DESTINAZIONE</label>
          <select id="move-card-target" value={targetSetId} onChange={(event) => setTargetSetId(event.target.value)}>
            {destinations.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name} · {set.cardCount} carte
              </option>
            ))}
          </select>
          <p>
            I campi con lo stesso nome verranno trasferiti. Gli altri dati della carta restano associati alla carta.
          </p>
        </div>
        <footer className="move-card-footer">
          <button type="button" className="button button-quiet" onClick={onClose} disabled={busy}>
            Annulla
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={!target || busy}
            onClick={() => {
              if (!target) return
              setBusy(true)
              void onMove(target.id).finally(() => setBusy(false))
            }}
          >
            <ArrowRightLeft size={14} />
            {busy ? 'Spostamento…' : 'Sposta nel set'}
          </button>
        </footer>
      </section>
    </>
  )
}
