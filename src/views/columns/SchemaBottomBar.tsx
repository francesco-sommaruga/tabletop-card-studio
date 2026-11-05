import { Check, FileSpreadsheet, ArrowRight } from 'lucide-react'

export function SchemaBottomBar({
  dirty,
  onDiscard,
  onSave,
  onExport,
}: {
  dirty: boolean
  onDiscard: () => void
  onSave: () => void
  onExport: () => void
}) {
  return (
    <div className="schema-bottom">
      <div className={dirty ? 'unsaved-note' : ''}>
        <span className="tiny-check">
          <Check size={11} />
        </span>
        {dirty ? 'Modifiche non salvate' : 'Struttura salvata nel progetto'}
      </div>
      <div className="column-draft-actions">
        <button className="text-button" onClick={onDiscard} disabled={!dirty}>
          Annulla
        </button>
        <button className="button button-primary" onClick={onSave} disabled={!dirty}>
          <Check size={14} />
          Salva modifiche
        </button>
        <button className="text-button" onClick={onExport} disabled={dirty}>
          <FileSpreadsheet size={15} />
          Esporta questo set
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}
