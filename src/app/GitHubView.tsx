import type { ProjectSnapshot } from '../types'
import type { GitState } from '../hooks/useGitStatus'
import { GitHubPage } from '../views/GitHubPage'

/** Wires the GitHub page to the Git/GitHub IPC API. */
export function GitHubView({ snapshot, git }: { snapshot: ProjectSnapshot; git: GitState }) {
  const { runGitAction } = git
  return (
    <GitHubPage
      key={snapshot.projectPath}
      projectName={snapshot.projectName}
      status={git.gitStatus}
      auth={git.githubAuth}
      onAuthChange={git.setGithubAuth}
      onRefresh={async () => {
        await git.refreshGit()
      }}
      onCreateRepository={git.createGithubRepository}
      onInit={() => runGitAction(window.cardCms.gitInit)}
      onConnect={(url) => runGitAction(() => window.cardCms.gitConnect(url))}
      onCommit={(message) => runGitAction(() => window.cardCms.gitCommit(message))}
      onPull={() => runGitAction(window.cardCms.gitPull)}
      onPush={() => runGitAction(() => window.cardCms.gitPush())}
      onBranchSwitch={(name) => runGitAction(() => window.cardCms.gitSwitchBranch(name))}
      onBranchCreate={(name, commit) => runGitAction(() => window.cardCms.gitCreateBranch(name, commit))}
      onBranchDelete={(name) => runGitAction(() => window.cardCms.gitDeleteBranch(name))}
      onCommitFiles={(hash) => window.cardCms.gitCommitFiles(hash)}
      onCommitFile={(hash, file) => window.cardCms.gitCommitFile(hash, file)}
      onOpenGitHub={() => void window.cardCms.openGitHub()}
      onGithubLoginStart={() => window.cardCms.githubStartLogin()}
      onGithubLoginPoll={() => window.cardCms.githubPollLogin()}
      onGithubLoginCancel={() => window.cardCms.githubCancelLogin()}
      onGithubLogout={() => window.cardCms.githubLogout()}
      onOpenGithubLogin={() => window.cardCms.openGitHubDeviceLogin()}
      onOpenGithubInstall={() => window.cardCms.openGitHubAppInstall()}
      onOpenGithubRepository={(url) => window.cardCms.openGitHubRepository(url)}
    />
  )
}
