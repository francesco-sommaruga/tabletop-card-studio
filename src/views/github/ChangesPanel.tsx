import { Check } from 'lucide-react'
import type { GitStatus } from '../../types'

function fileStatusClass(status: string) {
  return `git-file-status status-${status === '??' ? 'new' : status.replace(/[^A-Z]/g, '').toLowerCase() || 'm'}`
}

/** Local changes list with the commit form. */
export function ChangesPanel({
  status,
  changed,
  busy,
  message,
  onMessageChange,
  onCommit,
}: {
  status: GitStatus
  changed: number
  busy: boolean
  message: string
  onMessageChange: (message: string) => void
  onCommit: () => void
}) {
  return (
    <section className="git-changes">
      <div className="git-section-heading">
        <div>
          <h2>Modifiche locali</h2>
          <span>{changed} file nel repository</span>
        </div>
        <span className={`changes-count ${changed ? 'changed' : ''}`}>{String(changed).padStart(2, '0')}</span>
      </div>
      {changed ? (
        <>
          <div className="git-file-list">
            {status.changedFiles.map((file) => (
              <div className="git-file-row" key={`${file.status}:${file.path}`}>
                <span className={fileStatusClass(file.status)}>{file.status}</span>
                <span>{file.path}</span>
              </div>
            ))}
          </div>
          <div className="git-commit-form">
            <label htmlFor="commit-message">MESSAGGIO DEL COMMIT</label>
            <div>
              <input
                id="commit-message"
                value={message}
                onChange={(event) => onMessageChange(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && message.trim() && onCommit()}
                placeholder="es. Aggiorna carte del set base"
              />
              <button className="button button-dark" onClick={onCommit} disabled={busy || !message.trim()}>
                <Check size={15} />
                Commit
              </button>
            </div>
            <small>Il commit include tutte le modifiche presenti nella cartella del progetto.</small>
          </div>
        </>
      ) : (
        <div className="git-clean-state">
          <Check size={17} />
          <span>Non ci sono modifiche da registrare.</span>
        </div>
      )}
    </section>
  )
}
