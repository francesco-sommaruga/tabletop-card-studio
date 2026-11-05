import { GitBranch, X, FileCode2 } from 'lucide-react'
import type { GitCommitFile } from '../../types'

function SnapshotFileView({ previewBusy, previewFile }: { previewBusy: boolean; previewFile: GitCommitFile | null }) {
  return previewBusy ? (
    <p>Carico lo snapshot…</p>
  ) : !previewFile ? (
    <p>Questo commit non contiene file.</p>
  ) : previewFile.binary ? (
    <p>File binario · anteprima testuale non disponibile.</p>
  ) : (
    <>
      <strong>{previewFile.path}</strong>
      <pre>{previewFile.content}</pre>
    </>
  )
}

/** Read-only modal browser of a commit snapshot, with "create branch here". */
export function CommitPreviewDialog({
  previewCommit,
  previewFiles,
  previewFile,
  previewBusy,
  busy,
  changed,
  branchName,
  onBranchNameChange,
  onCreateBranch,
  onSelectFile,
  onClose,
}: {
  previewCommit: string
  previewFiles: string[]
  previewFile: GitCommitFile | null
  previewBusy: boolean
  busy: boolean
  changed: number
  branchName: string
  onBranchNameChange: (name: string) => void
  onCreateBranch: () => void
  onSelectFile: (file: string) => void
  onClose: () => void
}) {
  return (
    <div className="commit-preview-scrim" role="presentation" onClick={onClose}>
      <section
        className="commit-preview"
        role="dialog"
        aria-modal="true"
        aria-label="Esplora commit"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="metric-label">SNAPSHOT · {previewCommit}</span>
            <h2>Contenuto del commit</h2>
            <small>Vista di sola lettura: il branch corrente non cambia.</small>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Chiudi">
            <X size={17} />
          </button>
        </header>
        <div className="commit-preview-actions">
          <input
            value={branchName}
            onChange={(event) => onBranchNameChange(event.target.value)}
            placeholder="nome nuovo branch"
            aria-label="Nome branch dal commit"
          />
          <button
            type="button"
            className="button button-primary"
            disabled={busy || !branchName.trim() || Boolean(changed)}
            onClick={onCreateBranch}
          >
            <GitBranch size={14} />
            Crea branch qui
          </button>
        </div>
        <div className="commit-browser">
          <nav>
            {previewFiles.map((file) => (
              <button
                type="button"
                className={previewFile?.path === file ? 'selected' : ''}
                key={file}
                onClick={() => onSelectFile(file)}
              >
                <FileCode2 size={13} />
                {file}
              </button>
            ))}
          </nav>
          <article>
            <SnapshotFileView previewBusy={previewBusy} previewFile={previewFile} />
          </article>
        </div>
      </section>
    </div>
  )
}
