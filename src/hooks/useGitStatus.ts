import { useState } from 'react'
import type { GitHubAuthStatus, GitStatus } from '../types'

/** Git repository status and GitHub authentication of the open project. */
export function useGitStatus(setToast: (message: string) => void) {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [githubAuth, setGithubAuth] = useState<GitHubAuthStatus | null>(null)
  const refreshGit = async () => {
    const [status, auth] = await Promise.all([window.cardCms.gitStatus(), window.cardCms.githubAuthStatus()])
    setGitStatus(status)
    setGithubAuth(auth)
    return status
  }
  const createGithubRepository = async (name: string, isPrivate: boolean) => {
    const result = await window.cardCms.githubCreateRepository(name, isPrivate)
    setGitStatus(result.status)
    setGithubAuth(await window.cardCms.githubAuthStatus())
    setToast(
      result.warning ? `Repository creato: ${result.warning}` : `Repository ${result.name} creato e progetto caricato`,
    )
    return result
  }
  const runGitAction = async (action: () => Promise<GitStatus>) => {
    const status = await action()
    setGitStatus(status)
    setToast(status.error ? status.error : 'Stato Git aggiornato')
  }
  return { gitStatus, githubAuth, setGithubAuth, refreshGit, createGithubRepository, runGitAction }
}

export type GitState = ReturnType<typeof useGitStatus>
