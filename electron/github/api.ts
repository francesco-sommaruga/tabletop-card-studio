import { GITHUB_APP_SLUG } from '../github-config'

interface GitHubApiInstallation {
  id: number
  app_slug?: string
}

export interface GitHubApiRepository {
  id: number
  name: string
  full_name: string
  clone_url: string
  html_url: string
  private: boolean
  description?: string | null
  updated_at: string
  default_branch: string
  owner?: { login?: string; avatar_url?: string }
}

export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export async function githubApiRequest(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'Tabletop Card Studio',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!response.ok) {
    let message = ''
    try {
      message = String(((await response.json()) as { message?: unknown }).message ?? '')
    } catch {
      /* response may not be JSON */
    }
    throw new GitHubApiError(message || `GitHub ha restituito HTTP ${response.status}.`, response.status)
  }
  return response
}

async function githubApiCollection<T>(url: string, accessToken: string, collectionKey: string): Promise<T[]> {
  const items: T[] = []
  let nextUrl: string | undefined = url
  while (nextUrl) {
    const response = await githubApiRequest(nextUrl, accessToken)
    const payload = (await response.json()) as Record<string, unknown>
    const page = payload[collectionKey]
    if (!Array.isArray(page)) throw new Error(`La risposta di GitHub non contiene l'elenco ${collectionKey}.`)
    items.push(...(page as T[]))
    nextUrl = response.headers
      .get('link')
      ?.split(',')
      .map((entry) => entry.trim())
      .find((entry) => /rel="next"/.test(entry))
      ?.match(/<([^>]+)>/)?.[1]
  }
  return items
}

export async function githubInstalledRepositories(accessToken: string): Promise<GitHubApiRepository[]> {
  const installations = await githubApiCollection<GitHubApiInstallation>(
    'https://api.github.com/user/installations?per_page=100',
    accessToken,
    'installations',
  )
  const appInstallations = installations.filter(
    (installation) =>
      installation.app_slug?.toLocaleLowerCase() === GITHUB_APP_SLUG.toLocaleLowerCase() &&
      Number.isInteger(installation.id),
  )
  const repositoryPages = await Promise.all(
    appInstallations.map((installation) =>
      githubApiCollection<GitHubApiRepository>(
        `https://api.github.com/user/installations/${installation.id}/repositories?per_page=100`,
        accessToken,
        'repositories',
      ),
    ),
  )
  const repositories = new Map<number, GitHubApiRepository>()
  for (const page of repositoryPages) for (const repository of page) repositories.set(repository.id, repository)
  return [...repositories.values()]
}
