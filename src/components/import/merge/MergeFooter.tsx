import { Check } from 'lucide-react'

export function MergeFooter({
  unresolvedCount,
  hasDuplicateKeys,
  canApplyFields,
  canApply,
  onClose,
  onApply,
}: {
  unresolvedCount: number
  hasDuplicateKeys: boolean
  canApplyFields: boolean
  canApply: boolean
  onClose: () => void
  onApply: () => void
}) {
  return (
    <footer className="merge-footer">
      <span>
        {unresolvedCount
          ? `${unresolvedCount} conflitti da risolvere`
          : hasDuplicateKeys
            ? 'Scegli una chiave univoca per continuare'
            : !canApplyFields
              ? 'Seleziona almeno un campo da importare'
              : 'Le carte non presenti in Excel non verranno eliminate'}
      </span>
      <div>
        <button className="button button-quiet" onClick={onClose}>
          Annulla
        </button>
        <button className="button button-primary" disabled={!canApply} onClick={onApply}>
          <Check size={15} />
          Applica merge
        </button>
      </div>
    </footer>
  )
}
