import { useState } from 'react'
import { X } from 'lucide-react'
import type { WorkbookMergePreview } from '../../types'
import { useMergePreview, type MergePreviewLoader } from './merge/useMergePreview'
import { MergeFieldSelection } from './merge/MergeFieldSelection'
import { MergeOverview } from './merge/MergeOverview'
import { MergeConflicts } from './merge/MergeConflicts'
import { MergeChanges } from './merge/MergeChanges'
import { MergeFooter } from './merge/MergeFooter'

export function MergeWizard({
  preview,
  onPreview,
  onClose,
  onApply,
}: {
  preview: WorkbookMergePreview
  onPreview: MergePreviewLoader
  onClose: () => void
  onApply: (token: string, resolutions: Record<string, 'excel' | 'set'>) => void
}) {
  const merge = useMergePreview(preview, onPreview)
  const { current, loading, hasWork, canApplyFields, unresolvedCount } = merge
  const [expandedChanges, setExpandedChanges] = useState(false)
  return (
    <>
      <button className="scrim" aria-label="Chiudi confronto Excel" onClick={onClose} />
      <section className="merge-panel" role="dialog" aria-modal="true" aria-labelledby="merge-title">
        <div className="editor-head">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />
              RICONCILIAZIONE EXCEL
            </div>
            <h2 id="merge-title">Unisci gli aggiornamenti.</h2>
          </div>
          <button className="icon-button close-editor" onClick={onClose} aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>
        <div className="merge-intro">
          <div>
            <strong>{current.file}</strong>
            <span>→</span>
            <b>{current.setName}</b>
          </div>
          <p>
            Le carte non presenti nel foglio restano nel set. Scegli cosa fare solo dove entrambi hanno modificato lo
            stesso campo.
          </p>
        </div>
        <div className="merge-body">
          <MergeFieldSelection
            current={current}
            selectedFields={merge.selectedFields}
            restoredFields={merge.restoredFields}
            loading={loading}
            actions={merge}
          />
          <MergeOverview current={current} />
          {current.conflicts.length > 0 && (
            <MergeConflicts
              conflicts={current.conflicts}
              resolutions={merge.resolutions}
              onChooseAll={merge.chooseAll}
              onResolve={merge.resolve}
            />
          )}
          <MergeChanges
            current={current}
            hasWork={hasWork}
            expanded={expandedChanges}
            onToggleExpanded={() => setExpandedChanges(!expandedChanges)}
          />
        </div>
        <MergeFooter
          unresolvedCount={unresolvedCount}
          hasDuplicateKeys={current.duplicateKeys.length > 0}
          canApplyFields={canApplyFields}
          canApply={
            !(loading || !hasWork || !canApplyFields || current.duplicateKeys.length > 0 || unresolvedCount > 0)
          }
          onClose={onClose}
          onApply={() => onApply(current.token, merge.resolutions)}
        />
      </section>
    </>
  )
}
