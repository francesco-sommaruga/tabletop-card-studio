import { Github } from 'lucide-react'
import type { ProjectSnapshot } from '../../types'
import { useGithubAuth, errorMessage } from './useGithubAuth'
import { useGithubRepositories } from './useGithubRepositories'
import { GithubAuthBar } from './GithubAuthBar'
import { GithubRepositoryPicker } from './GithubRepositoryPicker'

/** "Progetti da GitHub" section: sign-in and repository download. */
export function GithubProjectSection({ onOpenSnapshot }: { onOpenSnapshot: (snapshot: ProjectSnapshot) => void }) {
  const github = useGithubAuth()
  const repos = useGithubRepositories(github.auth, onOpenSnapshot)
  const { auth, setAuth, setAuthError, authError } = github
  const logout = () =>
    void window.cardCms
      .githubLogout()
      .then((status) => {
        setAuth(status)
        repos.setRepositories([])
      })
      .catch((error) => setAuthError(errorMessage(error, 'Impossibile uscire da GitHub.')))
  return (
    <section className="github-project-library">
      <div className="github-project-heading">
        <div>
          <span className="metric-label">PROGETTI DA GITHUB</span>
          <h2>Continua da una repository.</h2>
          <p>Card Studio trova i progetti autorizzati che non hai ancora aggiunto a questo computer.</p>
        </div>
        <Github size={21} />
      </div>
      <GithubAuthBar
        auth={auth}
        deviceLogin={github.deviceLogin}
        authBusy={github.authBusy}
        onInstallApp={() => void github.installGithubApp()}
        onLogout={logout}
        onStartLogin={() => void github.startGithubLogin()}
        onCancelLogin={() => void github.cancelGithubLogin()}
      />
      {authError && (
        <p className="github-project-error" role="alert">
          {authError}
        </p>
      )}
      {auth?.authenticated && (
        <GithubRepositoryPicker
          repositories={repos.repositories}
          filteredRepositories={repos.filteredRepositories}
          selectedRepo={repos.selectedRepo}
          selectedRepository={repos.selectedRepository}
          query={repos.query}
          repoError={repos.repoError}
          repoLoading={repos.repoLoading}
          downloading={repos.downloading}
          onQueryChange={repos.setQuery}
          onSelect={repos.setSelectedRepo}
          onRefresh={() => void repos.refreshRepositories()}
          onDownload={() => void repos.downloadRepository()}
        />
      )}
    </section>
  )
}
