import { Github, Upload, Download } from 'lucide-react'
import type { GitStatus, GitHubAuthStatus } from '../../types'

function syncTitle(auth: GitHubAuthStatus | null, readyTitle: string) {
  return !auth?.authenticated
    ? 'Accedi a GitHub per sincronizzare'
    : !auth.appInstalled
      ? 'Installa Card Studio e concedi accesso al repository'
      : readyTitle
}

/** Add-remote form when the repo has no origin. */
export function RemoteForm({
  remote,
  onRemoteChange,
  busy,
  onConnect,
}: {
  remote: string
  onRemoteChange: (remote: string) => void
  busy: boolean
  onConnect: () => void
}) {
  return (
    <section className="git-remote-form">
      <div>
        <strong>Aggiungi repository remoto</strong>
        <p>Incolla l’indirizzo HTTPS o SSH del repository GitHub.</p>
      </div>
      <div className="remote-input-row">
        <input
          value={remote}
          onChange={(event) => onRemoteChange(event.target.value)}
          placeholder="https://github.com/utente/progetto.git"
        />
        <button className="button button-dark" onClick={onConnect} disabled={busy || !remote.trim()}>
          <Github size={15} />
          Collega GitHub
        </button>
      </div>
    </section>
  )
}

/** Origin summary with ahead/behind counts and Pull/Push actions. */
export function SyncStrip({
  status,
  auth,
  busy,
  onPull,
  onPush,
}: {
  status: GitStatus
  auth: GitHubAuthStatus | null
  busy: boolean
  onPull: () => void
  onPush: () => void
}) {
  const isSyncBlocked = busy || !auth?.authenticated || !auth.appInstalled
  return (
    <section className="git-sync-strip">
      <div className="sync-remote">
        <span className="metric-label">REMOTE · ORIGIN</span>
        <strong>{status.remoteUrl}</strong>
      </div>
      <div className="sync-count">
        <Upload size={15} />
        <b>{status.ahead}</b>
        <span>da inviare</span>
      </div>
      <div className="sync-count">
        <Download size={15} />
        <b>{status.behind}</b>
        <span>da ricevere</span>
      </div>
      <div className="sync-actions">
        <button
          className="button button-quiet"
          onClick={onPull}
          disabled={isSyncBlocked}
          title={syncTitle(auth, 'Scarica le modifiche da GitHub')}
        >
          <Download size={14} />
          Pull
        </button>
        <button
          className="button button-primary"
          onClick={onPush}
          disabled={isSyncBlocked}
          title={syncTitle(auth, 'Invia le modifiche a GitHub')}
        >
          <Upload size={14} />
          Push
        </button>
      </div>
    </section>
  )
}
