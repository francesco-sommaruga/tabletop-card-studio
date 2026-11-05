import { useState, useEffect } from 'react'
import {
  RefreshCw,
  Github,
  GitBranch,
  ExternalLink,
  CircleAlert,
  Check,
  ChevronDown,
  Plus,
  Trash2,
  Upload,
  Download,
  Eye,
  CircleHelp,
  X,
  FileCode2,
} from 'lucide-react'
import type { GitStatus, GitHubAuthStatus, GitHubRepositoryResult, GitCommitFile, GitHubDeviceLogin } from '../types'
import { suggestedGitHubRepoName } from '../lib/format'

export function GitHubPage({
  projectName,
  status,
  auth,
  onAuthChange,
  onRefresh,
  onCreateRepository,
  onInit,
  onConnect,
  onCommit,
  onPull,
  onPush,
  onBranchSwitch,
  onBranchCreate,
  onBranchDelete,
  onCommitFiles,
  onCommitFile,
  onOpenGitHub,
  onGithubLoginStart,
  onGithubLoginPoll,
  onGithubLoginCancel,
  onGithubLogout,
  onOpenGithubLogin,
  onOpenGithubInstall,
  onOpenGithubRepository,
}: {
  projectName: string
  status: GitStatus | null
  auth: GitHubAuthStatus | null
  onAuthChange: (auth: GitHubAuthStatus) => void
  onRefresh: () => Promise<void>
  onCreateRepository: (name: string, isPrivate: boolean) => Promise<GitHubRepositoryResult>
  onInit: () => Promise<void>
  onConnect: (url: string) => Promise<void>
  onCommit: (message: string) => Promise<void>
  onPull: () => Promise<void>
  onPush: () => Promise<void>
  onBranchSwitch: (name: string) => Promise<void>
  onBranchCreate: (name: string, commit?: string) => Promise<void>
  onBranchDelete: (name: string) => Promise<void>
  onCommitFiles: (hash: string) => Promise<string[]>
  onCommitFile: (hash: string, file: string) => Promise<GitCommitFile>
  onOpenGitHub: () => void
  onGithubLoginStart: () => Promise<GitHubDeviceLogin>
  onGithubLoginPoll: () => ReturnType<typeof window.cardCms.githubPollLogin>
  onGithubLoginCancel: () => Promise<void>
  onGithubLogout: () => Promise<GitHubAuthStatus>
  onOpenGithubLogin: () => Promise<void>
  onOpenGithubInstall: () => Promise<void>
  onOpenGithubRepository: (url: string) => Promise<void>
}) {
  const [remote, setRemote] = useState(status?.remoteUrl ?? '')
  const [message, setMessage] = useState('')
  const [branchName, setBranchName] = useState('')
  const [branchToolsOpen, setBranchToolsOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [previewCommit, setPreviewCommit] = useState<string | null>(null)
  const [previewFiles, setPreviewFiles] = useState<string[]>([])
  const [previewFile, setPreviewFile] = useState<GitCommitFile | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [deviceLogin, setDeviceLogin] = useState<GitHubDeviceLogin | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [repoName, setRepoName] = useState(() => suggestedGitHubRepoName(projectName))
  const [repoPrivate, setRepoPrivate] = useState(true)
  const [repoFormOpen, setRepoFormOpen] = useState(false)
  const [repoBusy, setRepoBusy] = useState(false)
  const [repoFeedback, setRepoFeedback] = useState('')
  const [repoFeedbackError, setRepoFeedbackError] = useState(false)
  const [repoUrl, setRepoUrl] = useState('')
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
  const openCommit = async (hash: string) => {
    setPreviewCommit(hash)
    setPreviewBusy(true)
    setPreviewFile(null)
    try {
      const files = await onCommitFiles(hash)
      setPreviewFiles(files)
      if (files[0]) setPreviewFile(await onCommitFile(hash, files[0]))
    } finally {
      setPreviewBusy(false)
    }
  }
  const selectSnapshotFile = async (file: string) => {
    if (!previewCommit) return
    setPreviewBusy(true)
    try {
      setPreviewFile(await onCommitFile(previewCommit, file))
    } finally {
      setPreviewBusy(false)
    }
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
  useEffect(() => {
    if (!deviceLogin) return
    let active = true
    let timer = 0
    let intervalSeconds = deviceLogin.intervalSeconds
    const poll = async () => {
      try {
        const result = await onGithubLoginPoll()
        if (!active) return
        if (result.status === 'complete') {
          setDeviceLogin(null)
          onAuthChange(result.auth)
          setAuthNotice(`Accesso effettuato come @${result.auth.login}.`)
          setAuthError('')
        } else if (result.status === 'expired') {
          setDeviceLogin(null)
          setAuthError('Codice scaduto o accesso annullato. Avvia un nuovo accesso.')
        } else {
          intervalSeconds = result.intervalSeconds ?? intervalSeconds
          timer = window.setTimeout(() => void poll(), intervalSeconds * 1000)
        }
      } catch (error) {
        if (active) {
          void onGithubLoginCancel().catch(() => undefined)
          setDeviceLogin(null)
          setAuthError(error instanceof Error ? error.message : 'Impossibile completare l’accesso GitHub.')
        }
      }
    }
    timer = window.setTimeout(() => void poll(), deviceLogin.intervalSeconds * 1000)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [deviceLogin])
  useEffect(() => {
    setRepoName(suggestedGitHubRepoName(projectName))
    setRepoUrl('')
    setRepoFormOpen(false)
    setRepoFeedback('')
    setRepoFeedbackError(false)
  }, [projectName, auth?.login])
  useEffect(() => {
    if (!auth?.authenticated || auth.appInstalled) return
    let timer = 0
    const refreshAfterGithub = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void onRefresh(), 800)
    }
    window.addEventListener('focus', refreshAfterGithub)
    return () => {
      window.removeEventListener('focus', refreshAfterGithub)
      window.clearTimeout(timer)
    }
  }, [auth?.authenticated, auth?.appInstalled, onRefresh])
  const startGithubLogin = async () => {
    setAuthBusy(true)
    setAuthError('')
    setAuthNotice('')
    try {
      setDeviceLogin(await onGithubLoginStart())
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Impossibile avviare l’accesso GitHub.')
    } finally {
      setAuthBusy(false)
    }
  }
  const openGithubLogin = async () => {
    try {
      await onOpenGithubLogin()
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Impossibile aprire GitHub nel browser.')
    }
  }
  const openGithubInstall = async () => {
    try {
      await onOpenGithubInstall()
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Impossibile aprire la pagina di installazione GitHub.')
    }
  }
  const cancelGithubLogin = async () => {
    setAuthBusy(true)
    try {
      await onGithubLoginCancel()
      setDeviceLogin(null)
      setAuthNotice('Accesso annullato.')
      setAuthError('')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Impossibile annullare l’accesso.')
    } finally {
      setAuthBusy(false)
    }
  }
  const logoutGithub = async () => {
    setAuthBusy(true)
    setAuthError('')
    setAuthNotice('')
    try {
      onAuthChange(await onGithubLogout())
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Impossibile uscire da GitHub.')
    } finally {
      setAuthBusy(false)
    }
  }
  const createRepository = async () => {
    setRepoBusy(true)
    setRepoFeedback('')
    setRepoFeedbackError(false)
    try {
      const result = await onCreateRepository(repoName, repoPrivate)
      setRepoName(result.name)
      setRepoUrl(result.htmlUrl)
      setRepoFormOpen(false)
      setRepoFeedback(
        result.warning || (result.pushed ? 'Repository creato e progetto caricato.' : 'Repository creato e collegato.'),
      )
      setRepoFeedbackError(Boolean(result.warning))
    } catch (error) {
      setRepoFeedback(error instanceof Error ? error.message : 'Impossibile creare il repository GitHub.')
      setRepoFeedbackError(true)
    } finally {
      setRepoBusy(false)
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
          {!status.isRepo && (
            <section className="git-connect-card">
              <div className="git-connect-mark">
                <Github size={22} />
              </div>
              <div className="git-connect-copy">
                <h2>Collega questo progetto a GitHub</h2>
                <p>
                  Accedi al tuo account e crea un repository per il progetto corrente, oppure inizializza Git e collega
                  un repository esistente.
                </p>
              </div>
              <button className="button button-quiet" onClick={() => void perform(onInit)} disabled={busy}>
                <GitBranch size={15} />
                Inizializza Git
              </button>
            </section>
          )}
          {status.isRepo && (
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
          )}
          <section className={`git-auth-panel ${auth?.authenticated ? 'is-connected' : ''}`}>
            <div className="git-auth-mark">
              <Github size={18} />
            </div>
            <div className="git-auth-copy">
              <span className="metric-label">ACCOUNT GITHUB</span>
              <strong>
                {auth?.authenticated
                  ? `@${auth.login}`
                  : auth === null
                    ? 'Controllo accesso…'
                    : auth.configured
                      ? 'Accedi per sincronizzare'
                      : 'Accesso da configurare'}
              </strong>
              <p>
                {auth?.authenticated
                  ? auth.appInstalled
                    ? 'Account collegato. Pull e push useranno il token custodito dall’app.'
                    : 'Account collegato. Installa Card Studio per creare e caricare una repository; per repository già esistenti, selezionale durante l’installazione.'
                  : auth === null
                    ? 'Controllo se Card Studio è già collegata a GitHub.'
                    : auth.configured
                      ? 'Accedi a GitHub, poi installa Card Studio sull’account per autorizzare la creazione e il caricamento della repository. Le credenziali Git del computer non verranno usate.'
                      : 'Imposta il Client ID e lo slug della GitHub App in electron/github-config.ts per abilitare l’accesso.'}
              </p>
            </div>
            {auth?.authenticated ? (
              <div className="git-auth-actions">
                {auth.avatarUrl && <img className="git-auth-avatar" src={auth.avatarUrl} alt="" />}
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => void openGithubInstall()}
                  disabled={authBusy}
                >
                  {auth.appInstalled ? 'Gestisci installazione' : 'Installa app'}
                </button>
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => void logoutGithub()}
                  disabled={authBusy}
                  title="Rimuove l’accesso salvato su questo computer"
                >
                  Esci
                </button>
              </div>
            ) : auth === null ? (
              <span className="git-auth-unavailable">Controllo…</span>
            ) : !auth.configured ? (
              <span className="git-auth-unavailable">Non configurato</span>
            ) : deviceLogin ? (
              <div className="git-device-code">
                <span>INSERISCI IL CODICE</span>
                <code>{deviceLogin.userCode}</code>
                <button type="button" className="button button-dark" onClick={() => void openGithubLogin()}>
                  <ExternalLink size={13} />
                  Apri GitHub
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => void cancelGithubLogin()}
                  disabled={authBusy}
                >
                  Annulla
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="button button-dark"
                onClick={() => void startGithubLogin()}
                disabled={authBusy}
              >
                <Github size={15} />
                {authBusy ? 'Avvio…' : 'Accedi a GitHub'}
              </button>
            )}
          </section>
          {deviceLogin && (
            <div className="git-auth-pending">
              <RefreshCw size={13} className="spin-icon" />
              In attesa che confermi il codice su GitHub…
            </div>
          )}
          {(authError || auth?.error) && (
            <div className="git-error">
              <CircleAlert size={15} />
              <span>{authError || auth?.error}</span>
            </div>
          )}
          {authNotice && (
            <div className="git-auth-success">
              <Check size={14} />
              <span>{authNotice}</span>
            </div>
          )}
          {auth?.authenticated && !status.remoteUrl && (
            <section className="git-create-repo-card">
              <div className="git-create-repo-heading">
                <div>
                  <span className="metric-label">NUOVO REPOSITORY</span>
                  <h2>Crea una repo per questo progetto</h2>
                  <p>
                    Card Studio la crea sul tuo account e carica i file della cartella corrente. Per impostazione
                    iniziale resta privata.
                  </p>
                </div>
                <Github size={20} />
              </div>
              {!auth.appInstalled ? (
                <div className="git-create-repo-form">
                  <p>
                    Installa Card Studio sull’account GitHub per autorizzare la creazione e il caricamento della
                    repository.
                  </p>
                  <div>
                    <button
                      type="button"
                      className="button button-dark"
                      onClick={() => void openGithubInstall()}
                      disabled={authBusy}
                    >
                      Installa Card Studio
                    </button>
                    <button
                      type="button"
                      className="button button-quiet"
                      onClick={() => void perform(onRefresh)}
                      disabled={busy}
                    >
                      <RefreshCw size={14} />
                      Ho installato · aggiorna
                    </button>
                  </div>
                </div>
              ) : !repoFormOpen && !repoUrl ? (
                <button
                  type="button"
                  className="button button-dark"
                  onClick={() => {
                    setRepoFormOpen(true)
                    setRepoFeedback('')
                  }}
                  disabled={repoBusy}
                >
                  <Github size={15} />
                  Crea repository GitHub
                </button>
              ) : repoUrl ? null : (
                <div className="git-create-repo-form">
                  <label>
                    Nome repository
                    <input
                      value={repoName}
                      onChange={(event) => setRepoName(event.target.value)}
                      maxLength={100}
                      placeholder="nome-progetto"
                    />
                  </label>
                  <label className="git-repo-visibility">
                    <input
                      type="checkbox"
                      checked={repoPrivate}
                      onChange={(event) => setRepoPrivate(event.target.checked)}
                    />
                    <span>
                      <strong>Repository privato</strong>
                      <small>Solo tu e i collaboratori autorizzati potranno vederlo.</small>
                    </span>
                  </label>
                  <p className="git-create-repo-confirm">
                    Carica i file presenti nella cartella, includendo le modifiche locali non ancora registrate.
                  </p>
                  <div>
                    <button
                      type="button"
                      className="button button-quiet"
                      onClick={() => setRepoFormOpen(false)}
                      disabled={repoBusy}
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      className="button button-dark"
                      onClick={() => void createRepository()}
                      disabled={repoBusy || !repoName.trim()}
                    >
                      <Github size={14} />
                      {repoBusy
                        ? 'Creo e carico…'
                        : repoPrivate
                          ? 'Crea repo privata e carica'
                          : 'Crea repo pubblica e carica'}
                    </button>
                  </div>
                </div>
              )}
              {repoFeedback && (
                <div className={repoFeedbackError ? 'git-error' : 'git-auth-success'}>
                  {repoFeedbackError ? <CircleAlert size={14} /> : <Check size={14} />}
                  <span>
                    {repoFeedback}
                    {repoUrl && (
                      <>
                        {' '}
                        ·{' '}
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => void onOpenGithubRepository(repoUrl)}
                        >
                          Apri repository
                        </button>
                      </>
                    )}
                  </span>
                </div>
              )}
            </section>
          )}
          {status.isRepo && (
            <>
              <section className="git-branches">
                <button
                  type="button"
                  className="git-branches-toggle"
                  onClick={() => setBranchToolsOpen(!branchToolsOpen)}
                >
                  <span>
                    <GitBranch size={15} />
                    <strong>Branch</strong>
                    <small>
                      {status.branch || 'HEAD scollegato'} · {status.branches.length} locali
                    </small>
                  </span>
                  <ChevronDown size={15} className={branchToolsOpen ? 'is-open' : ''} />
                </button>
                {branchToolsOpen && (
                  <div className="git-branch-tools">
                    <div className="git-branch-create">
                      <input
                        value={branchName}
                        onChange={(event) => setBranchName(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && void createBranch()}
                        placeholder="es. prova-nuova-regola"
                        aria-label="Nome nuovo branch"
                      />
                      <button
                        type="button"
                        className="button button-dark"
                        disabled={busy || !branchName.trim() || Boolean(changed)}
                        onClick={() => void createBranch()}
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
                                onClick={() => void perform(() => onBranchSwitch(branch))}
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
                                  window.confirm(`Eliminare il branch locale “${branch}”?`) &&
                                  void perform(() => onBranchDelete(branch))
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
              {!status.remoteUrl && (
                <section className="git-remote-form">
                  <div>
                    <strong>Aggiungi repository remoto</strong>
                    <p>Incolla l’indirizzo HTTPS o SSH del repository GitHub.</p>
                  </div>
                  <div className="remote-input-row">
                    <input
                      value={remote}
                      onChange={(event) => setRemote(event.target.value)}
                      placeholder="https://github.com/utente/progetto.git"
                    />
                    <button
                      className="button button-dark"
                      onClick={() => void perform(() => onConnect(remote))}
                      disabled={busy || !remote.trim()}
                    >
                      <Github size={15} />
                      Collega GitHub
                    </button>
                  </div>
                </section>
              )}
              {status.remoteUrl && (
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
                      onClick={() => void perform(onPull)}
                      disabled={busy || !auth?.authenticated || !auth.appInstalled}
                      title={
                        !auth?.authenticated
                          ? 'Accedi a GitHub per sincronizzare'
                          : !auth.appInstalled
                            ? 'Installa Card Studio e concedi accesso al repository'
                            : 'Scarica le modifiche da GitHub'
                      }
                    >
                      <Download size={14} />
                      Pull
                    </button>
                    <button
                      className="button button-primary"
                      onClick={() => void perform(onPush)}
                      disabled={busy || !auth?.authenticated || !auth.appInstalled}
                      title={
                        !auth?.authenticated
                          ? 'Accedi a GitHub per sincronizzare'
                          : !auth.appInstalled
                            ? 'Installa Card Studio e concedi accesso al repository'
                            : 'Invia le modifiche a GitHub'
                      }
                    >
                      <Upload size={14} />
                      Push
                    </button>
                  </div>
                </section>
              )}
              {status.error && (
                <div className="git-error">
                  <CircleAlert size={15} />
                  <span>{status.error}</span>
                </div>
              )}
              <div className="git-workspace-grid">
                <section className="git-changes">
                  <div className="git-section-heading">
                    <div>
                      <h2>Modifiche locali</h2>
                      <span>{changed} file nel repository</span>
                    </div>
                    <span className={`changes-count ${changed ? 'changed' : ''}`}>
                      {String(changed).padStart(2, '0')}
                    </span>
                  </div>
                  {changed ? (
                    <>
                      <div className="git-file-list">
                        {status.changedFiles.map((file) => (
                          <div className="git-file-row" key={`${file.status}:${file.path}`}>
                            <span
                              className={`git-file-status status-${file.status === '??' ? 'new' : file.status.replace(/[^A-Z]/g, '').toLowerCase() || 'm'}`}
                            >
                              {file.status}
                            </span>
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
                            onChange={(event) => setMessage(event.target.value)}
                            onKeyDown={(event) => event.key === 'Enter' && message.trim() && void commit()}
                            placeholder="es. Aggiorna carte del set base"
                          />
                          <button
                            className="button button-dark"
                            onClick={() => void commit()}
                            disabled={busy || !message.trim()}
                          >
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
                            onClick={() => void openCommit(item.hash)}
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
      {previewCommit && (
        <div className="commit-preview-scrim" role="presentation" onClick={() => setPreviewCommit(null)}>
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
              <button type="button" className="icon-button" onClick={() => setPreviewCommit(null)} aria-label="Chiudi">
                <X size={17} />
              </button>
            </header>
            <div className="commit-preview-actions">
              <input
                value={branchName}
                onChange={(event) => setBranchName(event.target.value)}
                placeholder="nome nuovo branch"
                aria-label="Nome branch dal commit"
              />
              <button
                type="button"
                className="button button-primary"
                disabled={busy || !branchName.trim() || Boolean(changed)}
                onClick={() => void createBranch(previewCommit)}
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
                    onClick={() => void selectSnapshotFile(file)}
                  >
                    <FileCode2 size={13} />
                    {file}
                  </button>
                ))}
              </nav>
              <article>
                {previewBusy ? (
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
                )}
              </article>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
