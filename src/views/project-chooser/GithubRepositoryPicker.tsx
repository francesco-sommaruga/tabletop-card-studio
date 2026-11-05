import { Github, RefreshCw, Search, Download } from 'lucide-react'
import type { GitHubProjectRepository } from '../../types'

/** Search, list and download of repositories for the signed-in account. */
export function GithubRepositoryPicker({
  repositories,
  filteredRepositories,
  selectedRepo,
  selectedRepository,
  query,
  repoError,
  repoLoading,
  downloading,
  onQueryChange,
  onSelect,
  onRefresh,
  onDownload,
}: {
  repositories: GitHubProjectRepository[]
  filteredRepositories: GitHubProjectRepository[]
  selectedRepo: string
  selectedRepository?: GitHubProjectRepository
  query: string
  repoError: string
  repoLoading: boolean
  downloading: string
  onQueryChange: (query: string) => void
  onSelect: (fullName: string) => void
  onRefresh: () => void
  onDownload: () => void
}) {
  return (
    <>
      <label className="github-project-search">
        <Search size={15} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
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
            <RepositoryOption
              key={repository.id}
              repository={repository}
              isSelected={selectedRepo === repository.fullName}
              onSelect={() => onSelect(repository.fullName)}
            />
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
          onClick={onRefresh}
          disabled={repoLoading || Boolean(downloading)}
        >
          <RefreshCw size={14} className={repoLoading ? 'spin-icon' : ''} />
          Aggiorna elenco
        </button>
        <button
          type="button"
          className="button button-primary"
          onClick={onDownload}
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
  )
}

function RepositoryOption({
  repository,
  isSelected,
  onSelect,
}: {
  repository: GitHubProjectRepository
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={`github-project-option ${isSelected ? 'selected' : ''}`}
      role="radio"
      aria-checked={isSelected}
      onClick={onSelect}
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
  )
}
