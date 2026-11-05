import { shell } from 'electron'
import { execFile } from 'node:child_process'
import type { GitCommitFile, GitCommitSummary, GitFileStatus, GitStatus } from '../src/types'
import { state } from './state'

export function runGit(args: string[], env?: NodeJS.ProcessEnv): Promise<{ stdout: string; stderr: string }> {
  return runGitAt(state.activeProject, args, env)
}

export function runGitAt(
  cwd: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
  timeout = 45_000,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      args,
      { cwd, env: env ?? process.env, timeout, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const detail = stderr.trim() || stdout.trim() || error.message
          reject(new Error(detail))
        } else resolve({ stdout: stdout.trim(), stderr: stderr.trim() })
      },
    )
  })
}

export function githubWebUrl(remote: string) {
  const https = remote.match(/^https?:\/\/github\.com\/([^\s]+?)(?:\.git)?\/?$/i)
  if (https) return `https://github.com/${https[1].replace(/\.git$/i, '')}`
  const ssh = remote.match(/^git@github\.com:([^\s]+?)(?:\.git)?$/i)
  if (ssh) return `https://github.com/${ssh[1].replace(/\.git$/i, '')}`
  const sshProtocol = remote.match(/^ssh:\/\/git@github\.com\/([^\s]+?)(?:\.git)?\/?$/i)
  if (sshProtocol) return `https://github.com/${sshProtocol[1].replace(/\.git$/i, '')}`
  return ''
}

export async function readGitStatus(): Promise<GitStatus> {
  const empty: GitStatus = {
    isRepo: false,
    branch: '',
    remoteUrl: '',
    githubUrl: '',
    changedFiles: [],
    ahead: 0,
    behind: 0,
    commits: [],
    branches: [],
    error: '',
  }
  if (!state.activeProject) return empty
  try {
    await runGit(['rev-parse', '--is-inside-work-tree'])
  } catch {
    return empty
  }
  try {
    const [branchResult, statusResult, remoteResult, logResult, branchesResult] = await Promise.all([
      runGit(['branch', '--show-current']).catch(() => ({ stdout: '(detached HEAD)', stderr: '' })),
      runGit(['status', '--porcelain=v1']),
      runGit(['remote', 'get-url', 'origin']).catch(() => ({ stdout: '', stderr: '' })),
      runGit(['log', '-5', '--no-merges', '--format=%h%x09%s%x09%cr']).catch(() => ({ stdout: '', stderr: '' })),
      runGit(['branch', '--format=%(refname:short)']).catch(() => ({ stdout: '', stderr: '' })),
    ])
    const changedFiles: GitFileStatus[] = statusResult.stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => ({ status: line.slice(0, 2).trim() || 'M', path: line.slice(3) }))
    let ahead = 0
    let behind = 0
    try {
      const counts = await runGit(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'])
      const [left, right] = counts.stdout.split(/\s+/).map(Number)
      ahead = left || 0
      behind = right || 0
    } catch {
      /* no upstream configured yet */
    }
    const commits: GitCommitSummary[] = logResult.stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash = '', subject = '', age = ''] = line.split('\t')
        return { hash, subject, age }
      })
    const remoteUrl = remoteResult.stdout
    return {
      isRepo: true,
      branch: branchResult.stdout,
      remoteUrl,
      githubUrl: githubWebUrl(remoteUrl),
      changedFiles,
      ahead,
      behind,
      commits,
      branches: branchesResult.stdout.split('\n').filter(Boolean),
      error: '',
    }
  } catch (error) {
    return { ...empty, isRepo: true, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function gitAction(action: () => Promise<void>): Promise<GitStatus> {
  try {
    await action()
    return await readGitStatus()
  } catch (error) {
    const current = await readGitStatus()
    return { ...current, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function initGitRepository() {
  await runGit(['init'])
}

export async function connectGitRemote(remoteUrl: string) {
  const trimmed = remoteUrl.trim()
  const valid =
    /^(https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?|git@github\.com:[\w.-]+\/[\w.-]+(?:\.git)?)$/i.test(trimmed)
  if (!valid) throw new Error('Inserisci un URL GitHub valido, in formato HTTPS o SSH.')
  try {
    await runGit(['rev-parse', '--is-inside-work-tree'])
  } catch {
    await runGit(['init'])
  }
  try {
    await runGit(['remote', 'get-url', 'origin'])
    await runGit(['remote', 'set-url', 'origin', trimmed])
  } catch {
    await runGit(['remote', 'add', 'origin', trimmed])
  }
}

export async function commitAllChanges(message: string) {
  if (!message.trim()) throw new Error('Scrivi un messaggio per il commit.')
  await runGit(['add', '-A'])
  await runGit(['commit', '-m', message.trim()])
}

async function assertCleanGitTree() {
  const dirty = await runGit(['status', '--porcelain=v1'])
  if (dirty.stdout) throw new Error('Registra o metti da parte le modifiche locali prima di cambiare branch.')
}

export async function switchGitBranch(name: string) {
  if (!name || name.includes('..') || name.startsWith('-')) throw new Error('Il nome del branch non è valido.')
  await assertCleanGitTree()
  await runGit(['switch', name])
}

export async function createGitBranch(name: string, commit?: string) {
  const trimmed = String(name ?? '').trim()
  if (!trimmed || trimmed.startsWith('-')) throw new Error('Inserisci un nome branch valido.')
  await runGit(['check-ref-format', '--branch', trimmed])
  await assertCleanGitTree()
  if (commit) {
    if (!/^[a-f\d]{7,40}$/i.test(commit)) throw new Error('Il commit selezionato non è valido.')
    await runGit(['cat-file', '-e', `${commit}^{commit}`])
    await runGit(['switch', '-c', trimmed, commit])
  } else await runGit(['switch', '-c', trimmed])
}

export async function deleteGitBranch(name: string) {
  if (!name || name.includes('..') || name.startsWith('-')) throw new Error('Il nome del branch non è valido.')
  if ((await runGit(['branch', '--show-current'])).stdout === name)
    throw new Error('Non puoi eliminare il branch attivo.')
  await runGit(['branch', '-d', name])
}

export async function listGitCommitFiles(hash: string) {
  if (!/^[a-f\d]{7,40}$/i.test(hash)) throw new Error('Il riferimento del commit non è valido.')
  await runGit(['cat-file', '-e', `${hash}^{commit}`])
  return (await runGit(['ls-tree', '-r', '--name-only', hash])).stdout.split('\n').filter(Boolean)
}

export async function readGitCommitFile(hash: string, file: string): Promise<GitCommitFile> {
  if (!/^[a-f\d]{7,40}$/i.test(hash) || !file || file.startsWith('/') || file.split(/[\\/]/).includes('..'))
    throw new Error('Commit o percorso file non valido.')
  const result = await runGit(['show', `${hash}:${file}`])
  if (result.stdout.includes('\u0000')) return { path: file, binary: true }
  if (result.stdout.length > 500_000)
    return {
      path: file,
      binary: false,
      content: `${result.stdout.slice(0, 500_000)}\n\n…contenuto troncato (oltre 500 KB)…`,
    }
  return { path: file, binary: false, content: result.stdout }
}

export async function openGitHubRemotePage() {
  const status = await readGitStatus()
  if (status.githubUrl) await shell.openExternal(status.githubUrl)
}
