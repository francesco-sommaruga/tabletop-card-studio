import { FileSpreadsheet, Plus } from 'lucide-react'
import type { ProjectSnapshot } from '../../types'

export function ImportLanding({
  snapshot,
  onImport,
  onCreate,
}: {
  snapshot: ProjectSnapshot
  onImport: () => void
  onCreate: () => void
}) {
  return (
    <div className="page-content import-landing">
      <div className="eyebrow">
        <span className="eyebrow-line" />
        PROGETTO · {snapshot.projectName.toLocaleUpperCase()}
      </div>
      <h1>
        Organizza i tuoi set<span className="heading-period">.</span>
      </h1>
      <p>
        Abbiamo trovato <strong>{snapshot.workbooks.length} file Excel</strong> nella cartella. Scegli i fogli e i campi
        da importare; ogni file diventerà un set indipendente.
      </p>
      <div className="detected-files">
        <div className="detected-count">
          <FileSpreadsheet size={20} />
          <strong>{snapshot.workbooks.length}</strong>
          <span>file Excel rilevati</span>
        </div>
        {snapshot.workbooks.slice(0, 6).map((book) => (
          <div className="detected-file" key={book.file}>
            <span>{book.file}</span>
            <small>
              {book.rowCount} righe · {book.headers.length} colonne
            </small>
          </div>
        ))}
      </div>
      <div className="empty-actions">
        <button className="button button-primary" onClick={onImport}>
          <FileSpreadsheet size={16} />
          Scegli campi e importa
        </button>
        <button className="button button-quiet" onClick={onCreate}>
          <Plus size={16} />
          Crea set vuoto
        </button>
      </div>
    </div>
  )
}
