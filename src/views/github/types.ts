import type { GitStatus, GitHubAuthStatus, GitHubRepositoryResult, GitCommitFile, GitHubDeviceLogin } from '../../types'

export type GitHubPageProps = {
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
}

/** Runs an async action while flagging the page as busy. */
export type PerformAction = (action: () => Promise<void>) => Promise<void>
