import { FileSpreadsheet, ArrowDownToLine, FolderPlus } from 'lucide-react'
import type { ProjectSnapshot } from '../types'
import type { SetSummary } from '../hooks/useProjectSession'

export function TopBar({
  snapshot,
  activeSet,
  fieldsDirty,
  onSwitchProject,
  onShowCards,
  onImport,
  onExport,
  onAddProject,
}: {
  snapshot: ProjectSnapshot | null
  activeSet: SetSummary | undefined
  fieldsDirty: boolean
  onSwitchProject: () => void
  onShowCards: () => void
  onImport: () => void
  onExport: () => void
  onAddProject: () => void
}) {
  return (
    <header className="topbar">
      <div className="breadcrumbs">
        <span className={snapshot ? 'crumb-action' : ''} onClick={() => snapshot && onSwitchProject()}>
          Progetti
        </span>
        {snapshot && (
          <>
            <span className="crumb-slash">/</span>
            <strong>{snapshot.projectName}</strong>
            {activeSet && (
              <>
                <span className="crumb-slash">/</span>
                <button className="crumb-current-set" onClick={onShowCards}>
                  {activeSet.name}
                </button>
              </>
            )}
          </>
        )}
      </div>
      <div className="top-actions">
        {snapshot ? (
          <>
            <button className="button button-quiet" onClick={onImport}>
              <FileSpreadsheet size={16} />
              Importa Excel <span className="button-count">{snapshot.workbooks.length}</span>
            </button>
            {activeSet && (
              <button
                className="button button-primary"
                onClick={onExport}
                disabled={fieldsDirty}
                title={fieldsDirty ? 'Salva i campi prima di esportare' : 'Esporta set'}
              >
                <ArrowDownToLine size={16} />
                Esporta set
              </button>
            )}
          </>
        ) : (
          <button className="button button-primary" onClick={onAddProject}>
            <FolderPlus size={16} />
            Aggiungi progetto
          </button>
        )}
      </div>
    </header>
  )
}
