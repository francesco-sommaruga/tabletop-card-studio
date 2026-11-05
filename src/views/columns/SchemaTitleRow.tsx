import { RefreshCw, Download } from 'lucide-react'

export function SchemaTitleRow({
  dirty,
  blueprintName,
  missingBlueprintFieldCount,
  fieldCount,
  onReloadBlueprints,
  onImportBlueprintFields,
}: {
  dirty: boolean
  blueprintName?: string
  missingBlueprintFieldCount: number
  fieldCount: number
  onReloadBlueprints: () => Promise<void>
  onImportBlueprintFields: () => void
}) {
  return (
    <div className="schema-title-row">
      <div>
        <h2>Campi disponibili</h2>
        <span>
          Trascina la presa per riordinare · Alt + ↑/↓ da tastiera ·{' '}
          {dirty ? 'modifiche non salvate' : 'struttura salvata'}
        </span>
      </div>
      <div className="schema-title-actions">
        <button
          type="button"
          className="button button-quiet"
          onClick={() => void onReloadBlueprints()}
          disabled={dirty}
          title="Rileggi i blueprint da data/blueprints"
        >
          <RefreshCw size={14} />
          Ricarica blueprint
        </button>
        <button
          type="button"
          className="button button-primary blueprint-import-action"
          onClick={onImportBlueprintFields}
          title={
            !blueprintName
              ? 'Assegna un blueprint nelle Impostazioni progetto'
              : missingBlueprintFieldCount
                ? `Importa ${missingBlueprintFieldCount} campi mancanti`
                : 'Tutti i campi blueprint sono già presenti'
          }
        >
          <Download size={14} />
          Importa campi dal blueprint
        </button>
        <span className="schema-index">{String(fieldCount).padStart(2, '0')} CAMPI</span>
      </div>
    </div>
  )
}
