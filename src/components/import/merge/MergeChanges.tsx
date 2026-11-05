import { Check, ArrowRight } from 'lucide-react'
import type { WorkbookMergePreview } from '../../../types'
import { valueText } from './valueText'

/** "No conflicts" banner, automatic/preserved change details and new/missing card notes. */
export function MergeChanges({
  current,
  hasWork,
  expanded,
  onToggleExpanded,
}: {
  current: WorkbookMergePreview
  hasWork: boolean
  expanded: boolean
  onToggleExpanded: () => void
}) {
  const changeCount = current.automaticChanges.length + current.preservedLocalChanges.length
  return (
    <>
      {!current.conflicts.length && current.duplicateKeys.length === 0 && (
        <div className="merge-clear">
          <Check size={17} />
          <span>
            {hasWork
              ? 'Nessun conflitto: gli aggiornamenti compatibili possono essere uniti.'
              : 'Il set è già allineato al foglio.'}
          </span>
        </div>
      )}
      {changeCount > 0 && (
        <details className="merge-detail">
          <summary onClick={onToggleExpanded}>
            {current.automaticChanges.length} valori aggiornati dal foglio · {current.preservedLocalChanges.length}{' '}
            modifiche locali preservate<span>{expanded ? 'Nascondi dettagli' : 'Mostra dettagli'}</span>
          </summary>
          <div className="merge-change-list">
            {[...current.automaticChanges, ...current.preservedLocalChanges].slice(0, 80).map((change, index) => (
              <div className="merge-change-row" key={`${change.cardId}-${change.fieldId}-${index}`}>
                <span>{change.cardTitle}</span>
                <b>{change.header}</b>
                <span>{valueText(change.currentValue)}</span>
                <ArrowRight size={12} />
                <span>{valueText(change.incomingValue)}</span>
                <small>{change.source === 'excel' ? 'Excel' : 'Set'}</small>
              </div>
            ))}
            {changeCount > 80 && <small className="merge-truncated">Mostrate le prime 80 differenze.</small>}
          </div>
        </details>
      )}
      {(current.newTitles.length > 0 || current.missingTitles.length > 0) && (
        <div className="merge-row-notes">
          {current.newTitles.length > 0 && (
            <div>
              <strong>{current.newTitles.length} nuove carte</strong>
              <span>
                {current.newTitles.slice(0, 5).join(' · ')}
                {current.newTitles.length > 5 ? ' · …' : ''}
              </span>
            </div>
          )}
          {current.missingTitles.length > 0 && (
            <div>
              <strong>{current.missingTitles.length} carte non nel foglio</strong>
              <span>Resteranno nel set, senza modifiche.</span>
            </div>
          )}
        </div>
      )}
    </>
  )
}
