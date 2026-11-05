import { useState, useEffect } from 'react'
import { suggestedGitHubRepoName } from '../../lib/format'
import type { GitHubPageProps } from './types'

/** Form state for creating a GitHub repository for the current project. Resets when project or account changes. */
export function useRepositoryCreation(
  projectName: string,
  login: string | undefined,
  onCreateRepository: GitHubPageProps['onCreateRepository'],
) {
  const [repoName, setRepoName] = useState(() => suggestedGitHubRepoName(projectName))
  const [repoPrivate, setRepoPrivate] = useState(true)
  const [repoFormOpen, setRepoFormOpen] = useState(false)
  const [repoBusy, setRepoBusy] = useState(false)
  const [repoFeedback, setRepoFeedback] = useState('')
  const [repoFeedbackError, setRepoFeedbackError] = useState(false)
  const [repoUrl, setRepoUrl] = useState('')
  useEffect(() => {
    setRepoName(suggestedGitHubRepoName(projectName))
    setRepoUrl('')
    setRepoFormOpen(false)
    setRepoFeedback('')
    setRepoFeedbackError(false)
  }, [projectName, login])
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
  return {
    repoName,
    setRepoName,
    repoPrivate,
    setRepoPrivate,
    repoFormOpen,
    setRepoFormOpen,
    repoBusy,
    repoFeedback,
    setRepoFeedback,
    repoFeedbackError,
    repoUrl,
    createRepository,
  }
}

export type RepositoryCreationState = ReturnType<typeof useRepositoryCreation>
