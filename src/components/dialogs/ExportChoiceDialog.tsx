import { X, Search, ArrowRight, FileSpreadsheet } from 'lucide-react'

export function ExportChoiceDialog({
  filteredCount,
  totalCount,
  exporting,
  onClose,
  onExportView,
  onExportAll,
}: {
  filteredCount: number
  totalCount: number
  exporting: boolean
  onClose: () => void
  onExportView: () => void
  onExportAll: () => void
}) {
  return (
    <>
      <button className="scrim" aria-label="Chiudi esportazione" onClick={onClose} disabled={exporting} />
      <section className="export-choice-panel" role="dialog" aria-modal="true" aria-labelledby="export-choice-title">
        <div className="editor-head">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />
              ESPORTAZIONE EXCEL
            </div>
            <h2 id="export-choice-title">Quali carte esportare?</h2>
            <p>La vista filtrata include ricerca, stato, tag, campi e ordinamento attivi.</p>
          </div>
          <button className="icon-button close-editor" onClick={onClose} aria-label="Chiudi" disabled={exporting}>
            <X size={18} />
          </button>
        </div>
        <div className="export-choice-options">
          <button
            type="button"
            className="export-choice-option"
            onClick={onExportView}
            disabled={exporting || filteredCount === 0}
          >
            <span className="export-choice-icon">
              <Search size={17} />
            </span>
            <span>
              <strong>Vista filtrata</strong>
              <small>
                {filteredCount} {filteredCount === 1 ? 'carta' : 'carte'} · mantiene l’ordine della tabella
              </small>
            </span>
            <ArrowRight size={16} />
          </button>
          <button type="button" className="export-choice-option" onClick={onExportAll} disabled={exporting}>
            <span className="export-choice-icon">
              <FileSpreadsheet size={17} />
            </span>
            <span>
              <strong>Tutto il set</strong>
              <small>
                {totalCount} {totalCount === 1 ? 'carta' : 'carte'} · ignora i filtri attivi
              </small>
            </span>
            <ArrowRight size={16} />
          </button>
        </div>
        {exporting && (
          <div className="export-choice-progress">
            <span className="live-dot" />
            Preparazione del file Excel…
          </div>
        )}
        <div className="export-choice-footer">
          <button className="button button-quiet" onClick={onClose} disabled={exporting}>
            Annulla
          </button>
        </div>
      </section>
    </>
  )
}
