import { useState, useEffect } from 'react'
import type { GitHubAuthStatus, GitHubProjectRepository, ProjectSnapshot } from '../../types'
import { errorMessage } from './useGithubAuth'

const listError = 'Impossibile leggere i repository GitHub.'

/** Repositories available to the signed-in account: listing, filtering, selection and download. */
export function useGithubRepositories(
  auth: GitHubAuthStatus | null,
  onOpenSnapshot: (snapshot: ProjectSnapshot) => void,
) {
  const [repositories, setRepositories] = useState<GitHubProjectRepository[]>([])
  const [selectedRepo, setSelectedRepo] = useState('')
  const [query, setQuery] = useState('')
  const [repoError, setRepoError] = useState('')
  const [repoLoading, setRepoLoading] = useState(false)
  const [downloading, setDownloading] = useState('')

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
        if (active) setRepoError(errorMessage(error, listError))
      })
      .finally(() => {
        if (active) setRepoLoading(false)
      })
    return () => {
      active = false
    }
  }, [auth?.authenticated, auth?.login])
  useEffect(() => {
    if (!auth?.authenticated) return
    const refreshOnFocus = () => {
      setRepoLoading(true)
      setRepoError('')
      void window.cardCms
        .githubListProjectRepositories()
        .then(setRepositories)
        .catch((error) => setRepoError(errorMessage(error, listError)))
        .finally(() => setRepoLoading(false))
    }
    window.addEventListener('focus', refreshOnFocus)
    return () => window.removeEventListener('focus', refreshOnFocus)
  }, [auth?.authenticated])

  const refreshRepositories = async () => {
    setRepoLoading(true)
    setRepoError('')
    try {
      setRepositories(await window.cardCms.githubListProjectRepositories())
      setSelectedRepo('')
    } catch (error) {
      setRepoError(errorMessage(error, listError))
    } finally {
      setRepoLoading(false)
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
      setRepoError(errorMessage(error, 'Impossibile scaricare il repository.'))
    } finally {
      setDownloading('')
    }
  }
  const filteredRepositories = repositories.filter((repository) =>
    `${repository.fullName} ${repository.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  )
  const selectedRepository = repositories.find((repository) => repository.fullName === selectedRepo)
  return {
    repositories,
    setRepositories,
    filteredRepositories,
    selectedRepo,
    setSelectedRepo,
    selectedRepository,
    query,
    setQuery,
    repoError,
    repoLoading,
    downloading,
    refreshRepositories,
    downloadRepository,
  }
}
