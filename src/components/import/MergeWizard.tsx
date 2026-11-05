import { useState, useEffect } from 'react'
import { X, Check, CircleAlert, ArrowRight } from 'lucide-react'
import type { WorkbookMergePreview } from '../../types'

export function MergeWizard({
  preview,
  onPreview,
  onClose,
  onApply,
}: {
  preview: WorkbookMergePreview
  onPreview: (
    file: string,
    setId: string,
    matchFieldId: string,
    fieldIds: string[],
    restoreFieldIds: string[],
  ) => Promise<WorkbookMergePreview>
  onClose: () => void
  onApply: (token: string, resolutions: Record<string, 'excel' | 'set'>) => void
}) {
  const [current, setCurrent] = useState(preview)
  const [selectedFields, setSelectedFields] = useState<Set<string>>(() => new Set(preview.selectedFieldIds))
  const [restoredFields, setRestoredFields] = useState<Set<string>>(() => new Set(preview.restoredFieldIds))
  const [resolutions, setResolutions] = useState<Record<string, 'excel' | 'set'>>(() =>
    Object.fromEntries(preview.conflicts.map((conflict) => [conflict.conflictId, 'set'])),
  )
  const [loading, setLoading] = useState(false)
  const [expandedChanges, setExpandedChanges] = useState(false)
  useEffect(() => {
    setCurrent(preview)
    setSelectedFields(new Set(preview.selectedFieldIds))
    setRestoredFields(new Set(preview.restoredFieldIds))
    setResolutions(Object.fromEntries(preview.conflicts.map((conflict) => [conflict.conflictId, 'set'])))
  }, [preview.token])
  const refreshPreview = async (
    matchFieldId: string,
    fieldIds: Set<string>,
    restoreFieldIds: Set<string> = restoredFields,
  ) => {
    setLoading(true)
    try {
      const next = await onPreview(current.file, current.setId, matchFieldId, [...fieldIds], [...restoreFieldIds])
      setCurrent(next)
      setSelectedFields(new Set(next.selectedFieldIds))
      setRestoredFields(new Set(next.restoredFieldIds))
      setResolutions(Object.fromEntries(next.conflicts.map((conflict) => [conflict.conflictId, 'set'])))
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Impossibile aggiornare il confronto')
    } finally {
      setLoading(false)
    }
  }
  const selectMatchField = (matchFieldId: string) => {
    void refreshPreview(matchFieldId, new Set(selectedFields))
  }
  const toggleImportField = (fieldId: string, checked: boolean) => {
    const next = new Set(selectedFields)
    checked ? next.add(fieldId) : next.delete(fieldId)
    void refreshPreview(current.matchFieldId, next)
  }
  const toggleRestoreField = (fieldId: string, checked: boolean) => {
    const nextRestored = new Set(restoredFields)
    checked ? nextRestored.add(fieldId) : nextRestored.delete(fieldId)
    const nextSelected = new Set(selectedFields)
    checked ? nextSelected.add(fieldId) : nextSelected.delete(fieldId)
    void refreshPreview(current.matchFieldId, nextSelected, nextRestored)
  }
  const selectAllFields = () =>
    void refreshPreview(
      current.matchFieldId,
      new Set([...current.importFields.map((field) => field.id), ...restoredFields]),
    )
  const selectOnlyMatchField = () =>
    void refreshPreview(current.matchFieldId, new Set([...restoredFields, current.matchFieldId]))
  const chooseAll = (resolution: 'excel' | 'set') =>
    setResolutions(Object.fromEntries(current.conflicts.map((conflict) => [conflict.conflictId, resolution])))
  const unresolvedCount = current.conflicts.filter((conflict) => !resolutions[conflict.conflictId]).length
  const hasWork =
    current.newTitles.length +
      current.automaticChanges.length +
      current.preservedLocalChanges.length +
      current.conflicts.length >
    0
  const canApplyFields = selectedFields.size > 0
  const valueText = (value: string) => value.trim() || '— vuoto —'
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
          <div className="merge-key-row">
            <label>
              <span>ABBINA LE CARTE TRAMITE</span>
              <select
                value={current.matchFieldId}
                disabled={loading}
                onChange={(event) => selectMatchField(event.target.value)}
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
                      onChange={(event) => toggleRestoreField(field.id, event.target.checked)}
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
          <section className="merge-field-selection">
            <div className="merge-section-heading">
              <div>
                <h3>Campi da importare</h3>
                <span>
                  {selectedFields.size} di {current.importFields.length} inclusi nel merge.
                </span>
              </div>
              <div>
                <button type="button" className="text-button" disabled={loading} onClick={selectOnlyMatchField}>
                  Solo chiave
                </button>
                <button type="button" className="text-button" disabled={loading} onClick={selectAllFields}>
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
                      onChange={(event) => toggleImportField(field.id, event.target.checked)}
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
              La chiave serve per abbinare le carte. Se la escludi, non aggiorna quelle esistenti, ma viene conservata
              sulle nuove per i prossimi reimport. Gli altri campi esclusi non vengono modificati.
            </p>
          </section>
          {current.legacyBaseline && (
            <div className="merge-notice">
              <CircleAlert size={15} />
              <span>
                Questo set non ha uno storico di sincronizzazione. Le differenze trovate vengono trattate come
                conflitti, così puoi scegliere cosa mantenere.
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
          {current.conflicts.length > 0 && (
            <section className="merge-conflicts">
              <div className="merge-section-heading">
                <div>
                  <h3>Conflitti</h3>
                  <span>Per impostazione iniziale mantiene il valore del set.</span>
                </div>
                <div>
                  <button className="text-button" onClick={() => chooseAll('set')}>
                    Mantieni tutti
                  </button>
                  <button className="text-button" onClick={() => chooseAll('excel')}>
                    Usa tutti da Excel
                  </button>
                </div>
              </div>
              <div className="merge-conflict-list">
                {current.conflicts.map((conflict) => (
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
                        onClick={() => setResolutions((existing) => ({ ...existing, [conflict.conflictId]: 'set' }))}
                      >
                        <small>VALORE NEL SET</small>
                        <span>{valueText(conflict.currentValue)}</span>
                      </button>
                      <button
                        type="button"
                        className={`merge-option ${resolutions[conflict.conflictId] === 'excel' ? 'selected' : ''}`}
                        aria-pressed={resolutions[conflict.conflictId] === 'excel'}
                        onClick={() => setResolutions((existing) => ({ ...existing, [conflict.conflictId]: 'excel' }))}
                      >
                        <small>VALORE NEL FOGLIO</small>
                        <span>{valueText(conflict.incomingValue)}</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
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
          {current.automaticChanges.length + current.preservedLocalChanges.length > 0 && (
            <details className="merge-detail">
              <summary onClick={() => setExpandedChanges(!expandedChanges)}>
                {current.automaticChanges.length} valori aggiornati dal foglio · {current.preservedLocalChanges.length}{' '}
                modifiche locali preservate<span>{expandedChanges ? 'Nascondi dettagli' : 'Mostra dettagli'}</span>
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
                {current.automaticChanges.length + current.preservedLocalChanges.length > 80 && (
                  <small className="merge-truncated">Mostrate le prime 80 differenze.</small>
                )}
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
        </div>
        <footer className="merge-footer">
          <span>
            {unresolvedCount
              ? `${unresolvedCount} conflitti da risolvere`
              : current.duplicateKeys.length
                ? 'Scegli una chiave univoca per continuare'
                : !canApplyFields
                  ? 'Seleziona almeno un campo da importare'
                  : 'Le carte non presenti in Excel non verranno eliminate'}
          </span>
          <div>
            <button className="button button-quiet" onClick={onClose}>
              Annulla
            </button>
            <button
              className="button button-primary"
              disabled={
                loading || !hasWork || !canApplyFields || current.duplicateKeys.length > 0 || unresolvedCount > 0
              }
              onClick={() => onApply(current.token, resolutions)}
            >
              <Check size={15} />
              Applica merge
            </button>
          </div>
        </footer>
      </section>
    </>
  )
}
