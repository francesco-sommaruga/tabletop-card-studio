import { CircleAlert } from 'lucide-react'
import type { WorkbookMergePreview } from '../../../types'

/** Legacy-baseline / duplicate-key notices and the summary counters. */
export function MergeOverview({ current }: { current: WorkbookMergePreview }) {
  return (
    <>
      {current.legacyBaseline && (
        <div className="merge-notice">
          <CircleAlert size={15} />
          <span>
            Questo set non ha uno storico di sincronizzazione. Le differenze trovate vengono trattate come conflitti,
            così puoi scegliere cosa mantenere.
          </span>
        </div>
      )}
      {current.duplicateKeys.length > 0 && (
        <div className="merge-error">
          <CircleAlert size={15} />
          <span>
            Il campo scelto non è univoco:{' '}
            {current.duplicateKeys
              .slice(0, 4)
              .map((key) => key || 'valore vuoto')
              .join(', ')}
            . Scegli un’altra colonna per confrontare le carte.
          </span>
        </div>
      )}
      <div className="merge-summary">
        <div>
          <strong>{current.matchedRows}</strong>
          <span>corrispondenze</span>
        </div>
        <div>
          <strong>{current.automaticChanges.length}</strong>
          <span>aggiornamenti Excel</span>
        </div>
        <div>
          <strong>{current.newTitles.length}</strong>
          <span>nuove carte</span>
        </div>
        <div className={current.conflicts.length ? 'has-conflicts' : ''}>
          <strong>{current.conflicts.length}</strong>
          <span>conflitti da scegliere</span>
        </div>
      </div>
    </>
  )
}
