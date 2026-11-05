import { RefreshCw, Github, CircleAlert, Check } from 'lucide-react'
import type { GitHubAuthStatus } from '../../types'
import type { RepositoryCreationState } from './useRepositoryCreation'

function RepositoryForm({ repo }: { repo: RepositoryCreationState }) {
  const { repoName, setRepoName, repoPrivate, setRepoPrivate, setRepoFormOpen, repoBusy, createRepository } = repo
  return (
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
        <input type="checkbox" checked={repoPrivate} onChange={(event) => setRepoPrivate(event.target.checked)} />
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
          {repoBusy ? 'Creo e carico…' : repoPrivate ? 'Crea repo privata e carica' : 'Crea repo pubblica e carica'}
        </button>
      </div>
    </div>
  )
}

/** "New repository" card shown when signed in and the project has no remote. */
export function CreateRepositoryCard({
  auth,
  repo,
  busy,
  authBusy,
  onRefresh,
  onOpenGithubInstall,
  onOpenGithubRepository,
}: {
  auth: GitHubAuthStatus
  repo: RepositoryCreationState
  busy: boolean
  authBusy: boolean
  onRefresh: () => void
  onOpenGithubInstall: () => void
  onOpenGithubRepository: (url: string) => void
}) {
  const { repoFormOpen, setRepoFormOpen, repoBusy, repoFeedback, setRepoFeedback, repoFeedbackError, repoUrl } = repo
  return (
    <section className="git-create-repo-card">
      <div className="git-create-repo-heading">
        <div>
          <span className="metric-label">NUOVO REPOSITORY</span>
          <h2>Crea una repo per questo progetto</h2>
          <p>
            Card Studio la crea sul tuo account e carica i file della cartella corrente. Per impostazione iniziale resta
            privata.
          </p>
        </div>
        <Github size={20} />
      </div>
      {!auth.appInstalled ? (
        <div className="git-create-repo-form">
          <p>
            Installa Card Studio sull’account GitHub per autorizzare la creazione e il caricamento della repository.
          </p>
          <div>
            <button type="button" className="button button-dark" onClick={onOpenGithubInstall} disabled={authBusy}>
              Installa Card Studio
            </button>
            <button type="button" className="button button-quiet" onClick={onRefresh} disabled={busy}>
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
        <RepositoryForm repo={repo} />
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
                <button type="button" className="text-button" onClick={() => onOpenGithubRepository(repoUrl)}>
                  Apri repository
                </button>
              </>
            )}
          </span>
        </div>
      )}
    </section>
  )
}
