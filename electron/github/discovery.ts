import { app, dialog, shell } from 'electron'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { GitHubProjectRepository, ProjectSnapshot } from '../../src/types'
import { state } from '../state'
import { runGitAt, githubWebUrl } from '../git'
import type { GitHubApiRepository } from './api'
import { githubApiRequest, GitHubApiError, githubInstalledRepositories } from './api'
import { getFreshGithubCredential } from './auth'
import { listProjects, openProject } from '../project'

const githubProjectTypeCache = new Map<
  number,
  { updatedAt: string; type: GitHubProjectRepository['projectType'] | null }
>()

function githubProjectTypeFromPaths(paths: string[]): GitHubProjectRepository['projectType'] | null {
  const files = paths.map((file) => file.toLocaleLowerCase())
  if (files.some((file) => /^\.tabletop-card-studio\/(?:sets\.json|sets\/index\.json|cards\.json)$/.test(file)))
    return 'Card Studio'
  if (files.some((file) => /^data\/(?:sets|blueprints)\/[^/]+\.json$/.test(file) || file === 'data/variables.json'))
    return 'Tabletop Creator'
  if (
    files.some(
      (file) =>
        !file.includes('/') && /\.xlsx$/i.test(file) && !file.startsWith('~$') && !/-cms-export\.xlsx$/i.test(file),
    )
  )
    return 'Foglio Excel'
  return null
}

async function githubRepositoryProjectType(
  repository: GitHubApiRepository,
  accessToken: string,
): Promise<GitHubProjectRepository['projectType'] | null> {
  const cached = githubProjectTypeCache.get(repository.id)
  if (cached?.updatedAt === repository.updated_at) return cached.type
  if (!repository.owner?.login || !repository.default_branch) return null
  try {
    const owner = encodeURIComponent(repository.owner.login)
    const name = encodeURIComponent(repository.name)
    const branch = encodeURIComponent(repository.default_branch)
    const response = await githubApiRequest(
      `https://api.github.com/repos/${owner}/${name}/git/trees/${branch}?recursive=1`,
      accessToken,
    )
    const payload = (await response.json()) as { tree?: Array<{ path?: string; type?: string }> }
    const type = githubProjectTypeFromPaths(
      (payload.tree ?? [])
        .filter((item) => item.type === 'blob' && typeof item.path === 'string')
        .map((item) => item.path!),
    )
    githubProjectTypeCache.set(repository.id, { updatedAt: repository.updated_at, type })
    return type
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) {
      githubProjectTypeCache.set(repository.id, { updatedAt: repository.updated_at, type: null })
      return null
    }
    throw error
  }
}

async function localGitHubRepositoryUrls(): Promise<Set<string>> {
  const urls = new Set<string>()
  const projects = await listProjects()
  const remotes = await Promise.all(
    projects.map(async (project) => {
      try {
        return (await runGitAt(project.path, ['config', '--get', 'remote.origin.url'], undefined, 8_000)).stdout
      } catch {
        return ''
      }
    }),
  )
  for (const remote of remotes) {
    const url = githubWebUrl(remote)
    if (url) urls.add(url.toLocaleLowerCase())
  }
  return urls
}

export async function listGitHubProjectRepositories(): Promise<GitHubProjectRepository[]> {
  const credential = await getFreshGithubCredential()
  if (!credential) throw new Error('Accedi a GitHub dall’app per trovare i tuoi progetti.')
  const repositories = await githubInstalledRepositories(credential.accessToken)
  const localUrls = await localGitHubRepositoryUrls()
  const candidates = repositories.filter((repository) => {
    const url = githubWebUrl(repository.html_url)
    return url && !localUrls.has(url.toLocaleLowerCase())
  })
  const classified: Array<{ repository: GitHubApiRepository; type: GitHubProjectRepository['projectType'] | null }> = []
  for (let offset = 0; offset < candidates.length; offset += 4) {
    const batch = await Promise.all(
      candidates.slice(offset, offset + 4).map(async (repository) => ({
        repository,
        type: await githubRepositoryProjectType(repository, credential.accessToken),
      })),
    )
    classified.push(...batch)
  }
  return classified
    .filter(
      (item): item is { repository: GitHubApiRepository; type: GitHubProjectRepository['projectType'] } =>
        item.type !== null,
    )
    .map(({ repository, type }) => ({
      id: repository.id,
      name: repository.name,
      fullName: repository.full_name,
      description: repository.description ?? '',
      htmlUrl: repository.html_url,
      isPrivate: repository.private,
      updatedAt: repository.updated_at,
      avatarUrl: repository.owner?.avatar_url ?? '',
      projectType: type,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function openGitHubRepository(url: string) {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Indirizzo repository GitHub non valido.')
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== 'github.com' ||
    parsed.port ||
    parsed.username ||
    parsed.password ||
    !/^\/[\w.-]+\/[\w.-]+\/?$/.test(parsed.pathname)
  ) {
    throw new Error('Indirizzo repository GitHub non valido.')
  }
  await shell.openExternal(parsed.toString())
}

export async function cloneGitHubProjectRepository(fullName: string): Promise<ProjectSnapshot | null> {
  if (typeof fullName !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(fullName))
    throw new Error('Repository GitHub non valido.')
  const credential = await getFreshGithubCredential()
  if (!credential) throw new Error('Accedi a GitHub dall’app prima di scaricare un progetto.')
  const repositories = await githubInstalledRepositories(credential.accessToken)
  const repository = repositories.find((item) => item.full_name.toLocaleLowerCase() === fullName.toLocaleLowerCase())
  if (!repository)
    throw new Error(
      'La repository non è più accessibile a Card Studio. Aggiorna l’elenco e verifica l’installazione dell’app.',
    )
  const projectType = await githubRepositoryProjectType(repository, credential.accessToken)
  if (!projectType)
    throw new Error(
      'La repository non contiene un progetto Tabletop Creator, dati Card Studio o un foglio Excel supportato.',
    )
  const cloneUrl = new URL(repository.clone_url)
  if (cloneUrl.protocol !== 'https:' || cloneUrl.hostname !== 'github.com' || cloneUrl.username || cloneUrl.password)
    throw new Error('GitHub ha restituito un indirizzo di clone non valido.')

  const picked = await dialog.showOpenDialog(state.win!, {
    title: `Scegli dove scaricare ${repository.full_name}`,
    defaultPath: app.getPath('documents'),
    properties: ['openDirectory', 'createDirectory'],
  })
  if (picked.canceled || !picked.filePaths[0]) return null
  const parent = path.resolve(picked.filePaths[0])
  const parentStat = await fs.stat(parent).catch(() => null)
  if (!parentStat?.isDirectory()) throw new Error('La cartella scelta non è disponibile.')
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(repository.name) || repository.name === '.' || repository.name === '..')
    throw new Error('Il nome della repository non è valido come cartella locale.')
  const destination = path.join(parent, repository.name)
  if (existsSync(destination))
    throw new Error(
      `Esiste già una cartella chiamata “${repository.name}” nella posizione scelta. Scegli un’altra cartella.`,
    )
  const temporaryDestination = path.join(parent, `.${repository.name}.card-studio-${randomUUID()}.tmp`)

  const authHeader = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${credential.accessToken}`, 'utf8').toString('base64')}`
  const config: Array<[string, string]> = [
    ['credential.helper', ''],
    ['credential.interactive', 'never'],
    ['http.https://github.com/.extraheader', authHeader],
  ]
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_CONFIG_COUNT: String(config.length), GIT_TERMINAL_PROMPT: '0' }
  config.forEach(([key, value], index) => {
    env[`GIT_CONFIG_KEY_${index}`] = key
    env[`GIT_CONFIG_VALUE_${index}`] = value
  })
  try {
    await runGitAt(parent, ['clone', '--quiet', '--', repository.clone_url, temporaryDestination], env, 30 * 60_000)
  } catch (error) {
    await fs.rm(temporaryDestination, { recursive: true, force: true }).catch(() => undefined)
    throw new Error(
      error instanceof Error ? `Download non riuscito: ${error.message}` : 'Download della repository non riuscito.',
    )
  }
  if (existsSync(destination)) {
    await fs.rm(temporaryDestination, { recursive: true, force: true })
    throw new Error(
      `Nel frattempo è stata creata una cartella chiamata “${repository.name}”. Scegli un’altra cartella.`,
    )
  }
  try {
    await fs.rename(temporaryDestination, destination)
  } catch (error) {
    await fs.rm(temporaryDestination, { recursive: true, force: true }).catch(() => undefined)
    throw new Error(
      error instanceof Error
        ? `Impossibile completare il download: ${error.message}`
        : 'Impossibile completare il download.',
    )
  }
  return openProject(destination)
}
