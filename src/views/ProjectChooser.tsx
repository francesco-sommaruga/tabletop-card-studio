import { useState, useEffect } from 'react'
import { FolderPlus, Archive, ArrowRight, Github, RefreshCw, ExternalLink, Search, Download } from 'lucide-react'
import type {
  ProjectSummary,
  ProjectSnapshot,
  GitHubAuthStatus,
  GitHubProjectRepository,
  GitHubDeviceLogin,
} from '../types'

export function ProjectChooser({
  projects,
  onOpen,
  onAdd,
  onOpenSnapshot,
}: {
  projects: ProjectSummary[]
  onOpen: (path: string) => void
  onAdd: () => void
  onOpenSnapshot: (snapshot: ProjectSnapshot) => void
}) {
  const [auth, setAuth] = useState<GitHubAuthStatus | null>(null)
  const [repositories, setRepositories] = useState<GitHubProjectRepository[]>([])
  const [selectedRepo, setSelectedRepo] = useState('')
  const [query, setQuery] = useState('')
  const [deviceLogin, setDeviceLogin] = useState<GitHubDeviceLogin | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [repoError, setRepoError] = useState('')
  const [repoLoading, setRepoLoading] = useState(false)
  const [downloading, setDownloading] = useState('')

  useEffect(() => {
    let active = true
    void window.cardCms
      .githubAuthStatus()
      .then((status) => {
        if (active) setAuth(status)
      })
      .catch((error) => {
        if (active) setAuthError(error instanceof Error ? error.message : 'Impossibile controllare l’accesso GitHub.')
      })
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    if (!auth?.authenticated) {
      setRepositories([])
      setSelectedRepo('')
      return
    }
    let active = true
    setRepoLoading(true)
    setRepoError('')
    void window.cardCms
      .githubListProjectRepositories()
      .then((items) => {
        if (active) setRepositories(items)
      })
      .catch((error) => {
        if (active) setRepoError(error instanceof Error ? error.message : 'Impossibile leggere i repository GitHub.')
      })
      .finally(() => {
        if (active) setRepoLoading(false)
      })
    return () => {
      active = false
    }
  }, [auth?.authenticated, auth?.login])
  useEffect(() => {
    if (!deviceLogin) return
    let active = true
    let timer = 0
    let intervalSeconds = deviceLogin.intervalSeconds
    const poll = async () => {
      try {
        const result = await window.cardCms.githubPollLogin()
        if (!active) return
        if (result.status === 'complete') {
          setDeviceLogin(null)
          setAuth(result.auth)
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
          void window.cardCms.githubCancelLogin().catch(() => undefined)
          setDeviceLogin(null)
          setAuthError(error instanceof Error ? error.message : 'Impossibile completare l’accesso GitHub.')
        }
      }
    }
    timer = window.setTimeout(() => void poll(), intervalSeconds * 1000)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [deviceLogin])
  useEffect(() => {
    if (!auth?.authenticated) return
    const refreshOnFocus = () => {
      setRepoLoading(true)
      setRepoError('')
      void window.cardCms
        .githubListProjectRepositories()
        .then(setRepositories)
        .catch((error) =>
          setRepoError(error instanceof Error ? error.message : 'Impossibile leggere i repository GitHub.'),
        )
        .finally(() => setRepoLoading(false))
    }
    window.addEventListener('focus', refreshOnFocus)
    return () => window.removeEventListener('focus', refreshOnFocus)
  }, [auth?.authenticated])

  const startGithubLogin = async () => {
    setAuthBusy(true)
    setAuthError('')
    try {
      setDeviceLogin(await window.cardCms.githubStartLogin())
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Impossibile avviare l’accesso GitHub.')
    } finally {
      setAuthBusy(false)
    }
  }
  const cancelGithubLogin = async () => {
    setAuthBusy(true)
    try {
      await window.cardCms.githubCancelLogin()
      setDeviceLogin(null)
      setAuthError('')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Impossibile annullare l’accesso.')
    } finally {
      setAuthBusy(false)
    }
  }
  const refreshRepositories = async () => {
    setRepoLoading(true)
    setRepoError('')
    try {
      setRepositories(await window.cardCms.githubListProjectRepositories())
      setSelectedRepo('')
    } catch (error) {
      setRepoError(error instanceof Error ? error.message : 'Impossibile leggere i repository GitHub.')
    } finally {
      setRepoLoading(false)
    }
  }
  const installGithubApp = async () => {
    try {
      await window.cardCms.openGitHubAppInstall()
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Impossibile aprire la pagina della GitHub App.')
    }
  }
  const downloadRepository = async () => {
    if (!selectedRepo) return
    setDownloading(selectedRepo)
    setRepoError('')
    try {
      const project = await window.cardCms.githubCloneProjectRepository(selectedRepo)
      if (project) onOpenSnapshot(project)
    } catch (error) {
      setRepoError(error instanceof Error ? error.message : 'Impossibile scaricare il repository.')
    } finally {
      setDownloading('')
    }
  }
  const filteredRepositories = repositories.filter((repository) =>
    `${repository.fullName} ${repository.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  )
  const selectedRepository = repositories.find((repository) => repository.fullName === selectedRepo)
  return (
    <div className="chooser-page">
      <div className="chooser-header">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            TABLETOP CARD STUDIO
          </div>
          <h1>
            {projects.length ? (
              <>
                Scegli il tuo
                <br />
                <em>tavolo di lavoro.</em>
              </>
            ) : (
              <>
                Le idee migliori
                <br />
                meritano <em>ordine.</em>
              </>
            )}
          </h1>
          <p>
            {projects.length
              ? 'Riprendi un progetto salvato o aggiungine un altro dal computer o da GitHub.'
              : 'Apri una cartella Tabletop Creator o scarica un progetto GitHub per iniziare.'}
          </p>
          <button className="button button-primary welcome-button" onClick={onAdd}>
            <FolderPlus size={17} />
            Aggiungi cartella locale
          </button>
        </div>
        <div className="chooser-art">
          <div className="chooser-sun" />
          <div className="chooser-card chooser-card-back" />
          <div className="chooser-card chooser-card-front">
            <img src="./tabletop-mark.svg" alt="" />
            <span>
              IL PROSSIMO SET
              <br />
              COMINCIA QUI
            </span>
          </div>
        </div>
      </div>
      {projects.length > 0 && (
        <section className="project-library">
          <div className="project-library-heading">
            <h2>Progetti recenti</h2>
            <span>{projects.length} NELLA LIBRERIA</span>
          </div>
          {projects.map((project, index) => (
            <button className="project-library-row" key={project.path} onClick={() => onOpen(project.path)}>
              <span className={`project-file-icon project-tone-${index % 3}`}>
                <Archive size={18} />
              </span>
              <span className="project-library-copy">
                <strong>{project.name}</strong>
                <small>{project.path}</small>
              </span>
              <span className="project-library-stats">
                <b>{project.setCount}</b> set <i>·</i> <b>{project.cardCount}</b> carte <i>·</i>{' '}
                <b>{project.fileCount}</b> file Excel
              </span>
              <ArrowRight size={17} />
            </button>
          ))}
        </section>
      )}
      <section className="github-project-library">
        <div className="github-project-heading">
          <div>
            <span className="metric-label">PROGETTI DA GITHUB</span>
            <h2>Continua da una repository.</h2>
            <p>Card Studio trova i progetti autorizzati che non hai ancora aggiunto a questo computer.</p>
          </div>
          <Github size={21} />
        </div>
        <div className="github-project-auth">
          {auth?.authenticated ? (
            <>
              <span className="github-project-avatar">
                {auth.avatarUrl ? <img src={auth.avatarUrl} alt="" /> : <Github size={16} />}
              </span>
              <span className="github-project-account">
                <small>ACCOUNT COLLEGATO</small>
                <strong>@{auth.login}</strong>
              </span>
              <button type="button" className="button button-quiet" onClick={() => void installGithubApp()}>
                Installa o gestisci app
              </button>
              <button
                type="button"
                className="button button-quiet"
                onClick={() =>
                  void window.cardCms
                    .githubLogout()
                    .then((status) => {
                      setAuth(status)
                      setRepositories([])
                    })
                    .catch((error) =>
                      setAuthError(error instanceof Error ? error.message : 'Impossibile uscire da GitHub.'),
                    )
                }
              >
                Esci
              </button>
            </>
          ) : auth === null ? (
            <span className="github-project-pending">
              <RefreshCw size={14} className="spin-icon" />
              Controllo accesso GitHub…
            </span>
          ) : !auth.configured ? (
            <span className="github-project-pending">L’accesso GitHub non è configurato in questa versione.</span>
          ) : deviceLogin ? (
            <>
              <span className="github-project-device">
                <small>INSERISCI IL CODICE SU GITHUB</small>
                <code>{deviceLogin.userCode}</code>
              </span>
              <button
                type="button"
                className="button button-dark"
                onClick={() => void window.cardCms.openGitHubDeviceLogin()}
              >
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
            </>
          ) : (
            <>
              <span className="github-project-pending">Accedi per trovare repository accessibili a Card Studio.</span>
              <button
                type="button"
                className="button button-dark"
                onClick={() => void startGithubLogin()}
                disabled={authBusy}
              >
                <Github size={14} />
                {authBusy ? 'Avvio…' : 'Accedi a GitHub'}
              </button>
            </>
          )}
        </div>
        {authError && (
          <p className="github-project-error" role="alert">
            {authError}
          </p>
        )}
        {auth?.authenticated && (
          <>
            <label className="github-project-search">
              <Search size={15} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cerca repository o progetto…"
              />
              <span>{repoLoading ? '…' : repositories.length}</span>
            </label>
            {repoError && (
              <p className="github-project-error" role="alert">
                {repoError}
              </p>
            )}
            {repoLoading && !repositories.length ? (
              <div className="github-project-empty">
                <RefreshCw size={16} className="spin-icon" />
                Cerco progetti compatibili e non ancora presenti in locale…
              </div>
            ) : filteredRepositories.length ? (
              <div className="github-project-results" role="radiogroup" aria-label="Repository GitHub disponibili">
                {filteredRepositories.map((repository) => (
                  <button
                    type="button"
                    key={repository.id}
                    className={`github-project-option ${selectedRepo === repository.fullName ? 'selected' : ''}`}
                    role="radio"
                    aria-checked={selectedRepo === repository.fullName}
                    onClick={() => setSelectedRepo(repository.fullName)}
                  >
                    <span className="github-project-avatar">
                      {repository.avatarUrl ? <img src={repository.avatarUrl} alt="" /> : <Github size={16} />}
                    </span>
                    <span className="github-project-copy">
                      <strong>{repository.fullName}</strong>
                      <small>{repository.description || 'Progetto senza descrizione'}</small>
                    </span>
                    <span className="github-project-tags">
                      <small>{repository.projectType}</small>
                      <small>{repository.isPrivate ? 'Privata' : 'Pubblica'}</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              !repoLoading && (
                <div className="github-project-empty">
                  {query
                    ? 'Nessuna repository corrisponde alla ricerca.'
                    : 'Non ho trovato progetti Tabletop Creator, dati Card Studio o fogli Excel accessibili e non ancora presenti in locale.'}
                </div>
              )
            )}
            <div className="github-project-footer">
              <button
                type="button"
                className="button button-quiet"
                onClick={() => void refreshRepositories()}
                disabled={repoLoading || Boolean(downloading)}
              >
                <RefreshCw size={14} className={repoLoading ? 'spin-icon' : ''} />
                Aggiorna elenco
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => void downloadRepository()}
                disabled={!selectedRepository || repoLoading || Boolean(downloading)}
              >
                <Download size={14} />
                {downloading
                  ? 'Scaricamento…'
                  : selectedRepository
                    ? `Scarica ${selectedRepository.name} e apri`
                    : 'Seleziona una repository'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
