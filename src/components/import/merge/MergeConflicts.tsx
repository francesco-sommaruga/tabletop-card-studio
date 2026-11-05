import type { WorkbookMergePreview } from '../../../types'
import type { Resolution } from './useMergePreview'
import { valueText } from './valueText'

/** Per-field conflicts where both the set and the sheet changed; each needs a resolution. */
export function MergeConflicts({
  conflicts,
  resolutions,
  onChooseAll,
  onResolve,
}: {
  conflicts: WorkbookMergePreview['conflicts']
  resolutions: Record<string, Resolution>
  onChooseAll: (resolution: Resolution) => void
  onResolve: (conflictId: string, resolution: Resolution) => void
}) {
  return (
    <section className="merge-conflicts">
      <div className="merge-section-heading">
        <div>
          <h3>Conflitti</h3>
          <span>Per impostazione iniziale mantiene il valore del set.</span>
        </div>
        <div>
          <button className="text-button" onClick={() => onChooseAll('set')}>
            Mantieni tutti
          </button>
          <button className="text-button" onClick={() => onChooseAll('excel')}>
            Usa tutti da Excel
          </button>
        </div>
      </div>
      <div className="merge-conflict-list">
        {conflicts.map((conflict) => (
          <article className="merge-conflict" key={conflict.conflictId}>
            <div className="merge-conflict-heading">
              <strong>{conflict.cardTitle || 'Carta senza titolo'}</strong>
              <span>{conflict.header}</span>
            </div>
            <div className="merge-options">
              <button
                type="button"
                className={`merge-option ${resolutions[conflict.conflictId] === 'set' ? 'selected' : ''}`}
                aria-pressed={resolutions[conflict.conflictId] === 'set'}
                onClick={() => onResolve(conflict.conflictId, 'set')}
              >
                <small>VALORE NEL SET</small>
                <span>{valueText(conflict.currentValue)}</span>
              </button>
              <button
                type="button"
                className={`merge-option ${resolutions[conflict.conflictId] === 'excel' ? 'selected' : ''}`}
                aria-pressed={resolutions[conflict.conflictId] === 'excel'}
                onClick={() => onResolve(conflict.conflictId, 'excel')}
              >
                <small>VALORE NEL FOGLIO</small>
                <span>{valueText(conflict.incomingValue)}</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
