import type { GitHubRepositoryResult } from '../../src/types'
import { state } from '../state'
import { runGit, readGitStatus, githubWebUrl } from '../git'
import { getFreshGithubCredential, githubAuthStatus } from './auth'

export async function createGitHubRepository(name: string, isPrivate: boolean): Promise<GitHubRepositoryResult> {
  if (!state.activeProject) throw new Error('Apri un progetto prima di creare un repository GitHub.')
  const repoName = String(name ?? '').trim()
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(repoName) || repoName === '.' || repoName === '..')
    throw new Error('Usa un nome repository di massimo 100 caratteri: lettere, numeri, punti, trattini o underscore.')
  if (typeof isPrivate !== 'boolean') throw new Error('Scegli se il repository deve essere privato.')
  const credential = await getFreshGithubCredential()
  if (!credential) throw new Error('Accedi a GitHub dall’app prima di creare il repository.')

  let localRepoExists = false
  try {
    await runGit(['rev-parse', '--is-inside-work-tree'])
    localRepoExists = true
  } catch {
    /* repository locale non inizializzato */
  }
  if (localRepoExists) {
    const existingRemote = await runGit(['config', '--get', 'remote.origin.url']).catch(() => ({
      stdout: '',
      stderr: '',
    }))
    if (existingRemote.stdout)
      throw new Error('Questo progetto ha già un remote origin. Rimuovilo o usa la funzione di collegamento esistente.')
  }

  const response = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${credential.accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Tabletop Card Studio',
    },
    body: JSON.stringify({ name: repoName, private: isPrivate, auto_init: false }),
  })
  const payload = (await response.json()) as {
    name?: string
    html_url?: string
    clone_url?: string
    private?: boolean
    message?: string
    errors?: Array<{ message?: string }>
  }
  if (!response.ok || !payload.clone_url || !payload.html_url || !payload.name) {
    const detail =
      payload.errors
        ?.map((error) => error.message)
        .filter(Boolean)
        .join(' ') || payload.message
    throw new Error(detail || 'GitHub non è riuscito a creare il repository.')
  }

  let pushed = false
  let warning = ''
  try {
    if (!localRepoExists) {
      try {
        await runGit(['init', '--initial-branch=main'])
      } catch {
        await runGit(['init'])
        await runGit(['symbolic-ref', 'HEAD', 'refs/heads/main'])
      }
    }
    await runGit(['remote', 'add', 'origin', payload.clone_url])
    let hasCommit = false
    try {
      await runGit(['rev-parse', '--verify', 'HEAD'])
      hasCommit = true
    } catch {
      /* primo commit da creare */
    }
    let branch = (await runGit(['branch', '--show-current'])).stdout
    if (!branch) {
      if (hasCommit) await runGit(['switch', '-c', 'main'])
      else await runGit(['symbolic-ref', 'HEAD', 'refs/heads/main'])
      branch = 'main'
    }
    const ensureLocalGitAuthor = async () => {
      try {
        await runGit(['config', '--get', 'user.name'])
      } catch {
        await runGit(['config', '--local', 'user.name', credential.login])
      }
      try {
        await runGit(['config', '--get', 'user.email'])
      } catch {
        await runGit([
          'config',
          '--local',
          'user.email',
          `${credential.userId}+${credential.login}@users.noreply.github.com`,
        ])
      }
    }
    if (!hasCommit) {
      const changes = await runGit(['status', '--porcelain=v1'])
      if (changes.stdout) {
        await ensureLocalGitAuthor()
        await runGit(['add', '-A'])
        await runGit(['commit', '-m', 'Primo commit da Tabletop Card Studio'])
        hasCommit = true
      }
    } else {
      const changes = await runGit(['status', '--porcelain=v1'])
      if (changes.stdout) {
        await ensureLocalGitAuthor()
        await runGit(['add', '-A'])
        await runGit(['commit', '-m', 'Aggiornamento progetto da Tabletop Card Studio'])
      }
    }
    if (hasCommit) {
      await runGithubAuthenticatedGit(['push', '--set-upstream', 'origin', branch])
      pushed = true
    } else warning = 'Repository creato e collegato, ma la cartella non contiene file da caricare.'
  } catch (error) {
    warning = error instanceof Error ? error.message : String(error)
  }
  return {
    name: payload.name,
    htmlUrl: payload.html_url,
    isPrivate: payload.private ?? isPrivate,
    pushed,
    warning,
    status: await readGitStatus(),
  }
}

async function runGithubAuthenticatedGit(args: string[]) {
  const remote = (await runGit(['config', '--get', 'remote.origin.url'])).stdout
  if (/^http:\/\//i.test(remote))
    throw new Error('Per sincronizzare con GitHub, imposta il remote origin in HTTPS sicuro o SSH.')
  if (!githubWebUrl(remote))
    throw new Error('Per usare l’accesso dell’app, origin deve puntare a github.com tramite HTTPS o SSH.')
  const auth = await githubAuthStatus()
  if (!auth.authenticated) throw new Error(auth.error || 'Accedi a GitHub dall’app prima di usare Pull o Push.')
  if (auth.error) throw new Error(auth.error)
  if (!auth.appInstalled)
    throw new Error('Installa Tabletop Card Studio sul tuo account GitHub e concedigli accesso a questo repository.')
  const credential = await getFreshGithubCredential()
  if (!credential) throw new Error('Accedi a GitHub dall’app prima di usare Pull o Push.')
  const authHeader = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${credential.accessToken}`, 'utf8').toString('base64')}`
  const config: Array<[string, string]> = [
    ['credential.helper', ''],
    ['credential.interactive', 'never'],
    ['http.https://github.com/.extraheader', authHeader],
    ['url.https://github.com/.insteadOf', 'git@github.com:'],
    ['url.https://github.com/.insteadOf', 'ssh://git@github.com/'],
  ]
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_CONFIG_COUNT: String(config.length), GIT_TERMINAL_PROMPT: '0' }
  config.forEach(([key, value], index) => {
    env[`GIT_CONFIG_KEY_${index}`] = key
    env[`GIT_CONFIG_VALUE_${index}`] = value
  })
  return runGit(args, env)
}

export async function pullFromGitHub() {
  await runGithubAuthenticatedGit(['pull', '--ff-only'])
}

export async function pushToGitHub() {
  const branch = (await runGit(['branch', '--show-current'])).stdout
  if (!branch) throw new Error('Seleziona un branch prima di inviare le modifiche.')
  await runGithubAuthenticatedGit(['push', '--set-upstream', 'origin', branch])
}
