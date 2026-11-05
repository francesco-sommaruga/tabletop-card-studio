import { useState } from 'react'
import { RefreshCw, CircleAlert, CircleHelp } from 'lucide-react'
import type { GitHubPageProps } from './types'
import { useGitHubAuth, useRefreshAfterGithubInstall } from './useGitHubAuth'
import { useRepositoryCreation } from './useRepositoryCreation'
import { useCommitPreview } from './useCommitPreview'
import { RepositoryStatusCard } from './RepositoryStatusCard'
import { AuthPanel } from './AuthPanel'
import { CreateRepositoryCard } from './CreateRepositoryCard'
import { BranchesPanel } from './BranchesPanel'
import { RemoteForm, SyncStrip } from './RemotePanel'
import { ChangesPanel } from './ChangesPanel'
import { HistoryPanel } from './HistoryPanel'
import { CommitPreviewDialog } from './CommitPreviewDialog'

export function GitHubPage(props: GitHubPageProps) {
  const { projectName, status, auth, onRefresh, onInit, onConnect, onCommit, onPull, onPush } = props
  const { onBranchSwitch, onBranchCreate, onBranchDelete, onOpenGitHub, onOpenGithubRepository } = props
  const [remote, setRemote] = useState(status?.remoteUrl ?? '')
  const [message, setMessage] = useState('')
  const [branchName, setBranchName] = useState('')
  const [branchToolsOpen, setBranchToolsOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const preview = useCommitPreview(props.onCommitFiles, props.onCommitFile)
  const authState = useGitHubAuth(props)
  const repo = useRepositoryCreation(projectName, auth?.login, props.onCreateRepository)
  useRefreshAfterGithubInstall(auth, onRefresh)
  const perform = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
    } finally {
      setBusy(false)
    }
  }
  const commit = async () => {
    await perform(() => onCommit(message))
    if (!status?.error) setMessage('')
  }
  const createBranch = async (fromCommit?: string) => {
    const name = branchName.trim()
    if (!name) return
    await perform(() => onBranchCreate(name, fromCommit))
    if (!status?.error) {
      setBranchName('')
      setBranchToolsOpen(true)
    }
  }
  const changed = status?.changedFiles.length ?? 0
  return (
    <div className="page-content github-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            VERSIONE E SINCRONIZZAZIONE
          </div>
          <h1>
            GitHub<span className="heading-period">.</span>
          </h1>
          <p>Collega la cartella del progetto al repository e gestisci le modifiche da qui.</p>
        </div>
        <div className="github-heading-actions">
          <button className="button button-quiet" onClick={() => void perform(onRefresh)} disabled={busy}>
            <RefreshCw size={15} className={busy ? 'spin-icon' : ''} />
            Aggiorna stato
          </button>
        </div>
      </div>
      {!status ? (
        <div className="github-loading">
          <RefreshCw size={17} className="spin-icon" />
          Controllo il repository Git locale…
        </div>
      ) : (
        <>
          <RepositoryStatusCard
            status={status}
            changed={changed}
            busy={busy}
            onInit={() => void perform(onInit)}
            onOpenGitHub={onOpenGitHub}
          />
          <AuthPanel auth={auth} authState={authState} />
          {auth?.authenticated && !status.remoteUrl && (
            <CreateRepositoryCard
              auth={auth}
              repo={repo}
              busy={busy}
              authBusy={authState.authBusy}
              onRefresh={() => void perform(onRefresh)}
              onOpenGithubInstall={() => void authState.openGithubInstall()}
              onOpenGithubRepository={(url) => void onOpenGithubRepository(url)}
            />
          )}
          {status.isRepo && (
            <>
              <BranchesPanel
                status={status}
                changed={changed}
                busy={busy}
                isOpen={branchToolsOpen}
                onToggle={() => setBranchToolsOpen(!branchToolsOpen)}
                branchName={branchName}
                onBranchNameChange={setBranchName}
                onCreateBranch={() => void createBranch()}
                onSwitchBranch={(branch) => void perform(() => onBranchSwitch(branch))}
                onDeleteBranch={(branch) => void perform(() => onBranchDelete(branch))}
              />
              {!status.remoteUrl && (
                <RemoteForm
                  remote={remote}
                  onRemoteChange={setRemote}
                  busy={busy}
                  onConnect={() => void perform(() => onConnect(remote))}
                />
              )}
              {status.remoteUrl && (
                <SyncStrip
                  status={status}
                  auth={auth}
                  busy={busy}
                  onPull={() => void perform(onPull)}
                  onPush={() => void perform(onPush)}
                />
              )}
              {status.error && (
                <div className="git-error">
                  <CircleAlert size={15} />
                  <span>{status.error}</span>
                </div>
              )}
              <div className="git-workspace-grid">
                <ChangesPanel
                  status={status}
                  changed={changed}
                  busy={busy}
                  message={message}
                  onMessageChange={setMessage}
                  onCommit={() => void commit()}
                />
                <HistoryPanel status={status} busy={busy} onOpenCommit={(hash) => void preview.openCommit(hash)} />
              </div>
            </>
          )}
          <div className="git-auth-note">
            <CircleHelp size={14} />
            <span>
              Il token resta nel portachiavi dell’app e non entra nella configurazione Git globale né nella cartella del
              progetto. Esci elimina la copia locale; per revocare l’autorizzazione, rimuovi Card Studio dalle
              applicazioni GitHub autorizzate.
            </span>
          </div>
        </>
      )}
      {preview.previewCommit && (
        <CommitPreviewDialog
          previewCommit={preview.previewCommit}
          previewFiles={preview.previewFiles}
          previewFile={preview.previewFile}
          previewBusy={preview.previewBusy}
          busy={busy}
          changed={changed}
          branchName={branchName}
          onBranchNameChange={setBranchName}
          onCreateBranch={() => void createBranch(preview.previewCommit ?? undefined)}
          onSelectFile={(file) => void preview.selectSnapshotFile(file)}
          onClose={preview.closePreview}
        />
      )}
    </div>
  )
}
