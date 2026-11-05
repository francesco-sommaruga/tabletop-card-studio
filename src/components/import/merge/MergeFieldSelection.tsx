import { Check } from 'lucide-react'
import type { WorkbookMergePreview } from '../../../types'
import type { FieldSelectionActions } from './useMergePreview'

/** Match-key picker, restorable Excel fields and the list of fields to import. */
export function MergeFieldSelection({
  current,
  selectedFields,
  restoredFields,
  loading,
  actions,
}: {
  current: WorkbookMergePreview
  selectedFields: Set<string>
  restoredFields: Set<string>
  loading: boolean
  actions: FieldSelectionActions
}) {
  return (
    <>
      <div className="merge-key-row">
        <label>
          <span>ABBINA LE CARTE TRAMITE</span>
          <select
            value={current.matchFieldId}
            disabled={loading}
            onChange={(event) => actions.selectMatchField(event.target.value)}
          >
            {current.matchFields.map((field) => (
              <option key={field.id} value={field.id}>
                {field.label}
              </option>
            ))}
          </select>
        </label>
        <small>Scegli un valore stabile e univoco nel foglio, di solito il titolo della carta.</small>
      </div>
      {current.restoreFields.length > 0 && (
        <section className="merge-restore-section">
          <div className="merge-section-heading">
            <div>
              <h3>Campi Excel non presenti nel set</h3>
              <span>Puoi ripristinare le colonne rimosse e importarne i valori.</span>
            </div>
            <span className="merge-restore-count">{restoredFields.size} ripristinati</span>
          </div>
          <div className="merge-restore-list">
            {current.restoreFields.map((field) => (
              <label key={field.id} className={restoredFields.has(field.id) ? 'selected' : ''}>
                <input
                  type="checkbox"
                  checked={restoredFields.has(field.id)}
                  disabled={loading}
                  onChange={(event) => actions.toggleRestoreField(field.id, event.target.checked)}
                />
                <span className="merge-field-check">
                  <Check size={11} />
                </span>
                <strong>{field.header}</strong>
                <small>{field.type}</small>
              </label>
            ))}
          </div>
        </section>
      )}
      <ImportFieldList
        current={current}
        selectedFields={selectedFields}
        restoredFields={restoredFields}
        loading={loading}
        actions={actions}
      />
    </>
  )
}

function ImportFieldList({
  current,
  selectedFields,
  restoredFields,
  loading,
  actions,
}: {
  current: WorkbookMergePreview
  selectedFields: Set<string>
  restoredFields: Set<string>
  loading: boolean
  actions: FieldSelectionActions
}) {
  return (
    <section className="merge-field-selection">
      <div className="merge-section-heading">
        <div>
          <h3>Campi da importare</h3>
          <span>
            {selectedFields.size} di {current.importFields.length} inclusi nel merge.
          </span>
        </div>
        <div>
          <button type="button" className="text-button" disabled={loading} onClick={actions.selectOnlyMatchField}>
            Solo chiave
          </button>
          <button type="button" className="text-button" disabled={loading} onClick={actions.selectAllFields}>
            Seleziona tutti
          </button>
        </div>
      </div>
      <div className="merge-field-list">
        {current.importFields.map((field) => {
          const restored = restoredFields.has(field.id)
          return (
            <label
              key={field.id}
              className={field.id === current.matchFieldId ? 'is-match-key' : restored ? 'is-restored' : ''}
            >
              <input
                type="checkbox"
                checked={selectedFields.has(field.id)}
                disabled={loading || restored}
                onChange={(event) => actions.toggleImportField(field.id, event.target.checked)}
              />
              <span className="merge-field-check">
                <Check size={11} />
              </span>
              <strong>{field.label}</strong>
              {field.id === current.matchFieldId && <small>CHIAVE</small>}
              {restored && <small>RIPRISTINATO</small>}
            </label>
          )
        })}
      </div>
      <p>
        La chiave serve per abbinare le carte. Se la escludi, non aggiorna quelle esistenti, ma viene conservata sulle
        nuove per i prossimi reimport. Gli altri campi esclusi non vengono modificati.
      </p>
    </section>
  )
}
