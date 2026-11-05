import { GitBranch, Eye } from 'lucide-react'
import type { GitStatus } from '../../types'

/** Recent commits on the current branch, each openable in the snapshot browser. */
export function HistoryPanel({
  status,
  busy,
  onOpenCommit,
}: {
  status: GitStatus
  busy: boolean
  onOpenCommit: (hash: string) => void
}) {
  return (
    <section className="git-history">
      <div className="git-section-heading">
        <div>
          <h2>Commit recenti</h2>
          <span>{status.branch || 'Branch corrente'} · esplora lo snapshot o crea un branch</span>
        </div>
        <GitBranch size={16} />
      </div>
      {status.commits.length ? (
        <div className="commit-list">
          {status.commits.map((item) => (
            <div className="commit-row" key={item.hash}>
              <code>{item.hash}</code>
              <span title={item.subject}>{item.subject}</span>
              <small>{item.age}</small>
              <button
                type="button"
                className="commit-view"
                onClick={() => onOpenCommit(item.hash)}
                disabled={busy}
                title={`Esplora lo snapshot ${item.hash}`}
              >
                <Eye size={13} />
                <span>Esplora</span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="git-clean-state">Nessun commit in questo repository.</div>
      )}
    </section>
  )
}
