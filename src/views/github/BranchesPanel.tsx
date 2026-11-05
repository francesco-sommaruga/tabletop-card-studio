import { GitBranch, ChevronDown, Plus, Trash2 } from 'lucide-react'
import type { GitStatus } from '../../types'

/** Collapsible local-branch tools: create from current branch, switch, delete. */
export function BranchesPanel({
  status,
  changed,
  busy,
  isOpen,
  onToggle,
  branchName,
  onBranchNameChange,
  onCreateBranch,
  onSwitchBranch,
  onDeleteBranch,
}: {
  status: GitStatus
  changed: number
  busy: boolean
  isOpen: boolean
  onToggle: () => void
  branchName: string
  onBranchNameChange: (name: string) => void
  onCreateBranch: () => void
  onSwitchBranch: (branch: string) => void
  onDeleteBranch: (branch: string) => void
}) {
  return (
    <section className="git-branches">
      <button type="button" className="git-branches-toggle" onClick={onToggle}>
        <span>
          <GitBranch size={15} />
          <strong>Branch</strong>
          <small>
            {status.branch || 'HEAD scollegato'} · {status.branches.length} locali
          </small>
        </span>
        <ChevronDown size={15} className={isOpen ? 'is-open' : ''} />
      </button>
      {isOpen && (
        <div className="git-branch-tools">
          <div className="git-branch-create">
            <input
              value={branchName}
              onChange={(event) => onBranchNameChange(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && onCreateBranch()}
              placeholder="es. prova-nuova-regola"
              aria-label="Nome nuovo branch"
            />
            <button
              type="button"
              className="button button-dark"
              disabled={busy || !branchName.trim() || Boolean(changed)}
              onClick={onCreateBranch}
            >
              <Plus size={14} />
              Crea dal branch corrente
            </button>
            <small>
              {changed
                ? 'Registra o metti da parte le modifiche locali per gestire i branch.'
                : 'I branch sono locali; inviali con Push quando vuoi pubblicarli.'}
            </small>
          </div>
          <div className="git-branch-list">
            {status.branches.map((branch) => (
              <div key={branch} className={branch === status.branch ? 'active' : ''}>
                <span>
                  <i />
                  {branch}
                </span>
                <div>
                  {branch !== status.branch && (
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy || Boolean(changed)}
                      onClick={() => onSwitchBranch(branch)}
                    >
                      Apri
                    </button>
                  )}
                  {branch !== status.branch && (
                    <button
                      type="button"
                      className="branch-delete"
                      disabled={busy || Boolean(changed)}
                      title="Elimina branch locale"
                      onClick={() =>
                        window.confirm(`Eliminare il branch locale “${branch}”?`) && onDeleteBranch(branch)
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
