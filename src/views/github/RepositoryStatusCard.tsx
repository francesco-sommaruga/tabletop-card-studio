import { Github, GitBranch, ExternalLink } from 'lucide-react'
import type { GitStatus } from '../../types'

/** Top card: "connect this project" when not a repo, otherwise local repo summary. */
export function RepositoryStatusCard({
  status,
  changed,
  busy,
  onInit,
  onOpenGitHub,
}: {
  status: GitStatus
  changed: number
  busy: boolean
  onInit: () => void
  onOpenGitHub: () => void
}) {
  if (!status.isRepo) {
    return (
      <section className="git-connect-card">
        <div className="git-connect-mark">
          <Github size={22} />
        </div>
        <div className="git-connect-copy">
          <h2>Collega questo progetto a GitHub</h2>
          <p>
            Accedi al tuo account e crea un repository per il progetto corrente, oppure inizializza Git e collega un
            repository esistente.
          </p>
        </div>
        <button className="button button-quiet" onClick={onInit} disabled={busy}>
          <GitBranch size={15} />
          Inizializza Git
        </button>
      </section>
    )
  }
  return (
    <section className="git-repo-card">
      <div className="git-repo-mark">
        <Github size={21} />
      </div>
      <div className="git-repo-details">
        <span className="metric-label">REPOSITORY LOCALE</span>
        <strong>{status.branch || 'HEAD scollegato'}</strong>
        <small>{status.remoteUrl || 'Nessun remote configurato'}</small>
      </div>
      <div className="git-repo-indicator">
        <span className={`live-dot ${changed ? 'git-dirty-dot' : ''}`} />
        {changed ? `${changed} modifiche locali` : 'Cartella pulita'}
      </div>
      {status.githubUrl && (
        <button className="button button-quiet github-open" onClick={onOpenGitHub}>
          <ExternalLink size={14} />
          Apri su GitHub
        </button>
      )}
    </section>
  )
}
