import path from 'node:path'

// Apps launched from a desktop menu don't read shell profiles (.zshrc, .bashrc),
// so tools installed in user folders (git-lfs in ~/.local/bin, Homebrew…) are invisible to git.
function extraToolFolders(home: string) {
  return [
    path.posix.join(home, '.local/bin'),
    path.posix.join(home, 'bin'),
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/home/linuxbrew/.linuxbrew/bin',
  ]
}

// The bundled git-lfs folder goes last, so a git-lfs installed on the system always wins.
export function gitProcessEnv(
  baseEnv: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  home: string,
  bundledFolder?: string,
): NodeJS.ProcessEnv {
  if (platform === 'win32') return baseEnv
  const current = (baseEnv.PATH ?? '').split(':').filter(Boolean)
  const wanted = bundledFolder ? [...extraToolFolders(home), bundledFolder] : extraToolFolders(home)
  const missing = wanted.filter((folder) => !current.includes(folder))
  return { ...baseEnv, PATH: [...current, ...missing].join(':') }
}

export type GitConfigPair = [key: string, value: string]

// Passes one-off git config through the environment, keeping any pairs already set there.
export function gitConfigEnv(baseEnv: NodeJS.ProcessEnv, pairs: GitConfigPair[]): NodeJS.ProcessEnv {
  const start = Number(baseEnv.GIT_CONFIG_COUNT) || 0
  const env: NodeJS.ProcessEnv = { ...baseEnv, GIT_CONFIG_COUNT: String(start + pairs.length) }
  pairs.forEach(([key, value], index) => {
    env[`GIT_CONFIG_KEY_${start + index}`] = key
    env[`GIT_CONFIG_VALUE_${start + index}`] = value
  })
  return env
}

// Same filter `git lfs install` writes, for users who never ran it.
export const lfsFilterConfig: GitConfigPair[] = [
  ['filter.lfs.process', 'git-lfs filter-process'],
  ['filter.lfs.smudge', 'git-lfs smudge -- %f'],
  ['filter.lfs.clean', 'git-lfs clean -- %f'],
  ['filter.lfs.required', 'true'],
]

const missingGitLfsPattern = /git-lfs: (?:command )?not found|'lfs' is not a git command|git-lfs[^\n]*: No such file/i

export function describeGitError(detail: string) {
  if (!missingGitLfsPattern.test(detail)) return detail
  return (
    'Questa repository usa Git LFS, ma il programma git-lfs non è installato o non è raggiungibile. ' +
    'Installalo (https://git-lfs.com, oppure “sudo apt install git-lfs” su Ubuntu/Debian) e riprova.'
  )
}
