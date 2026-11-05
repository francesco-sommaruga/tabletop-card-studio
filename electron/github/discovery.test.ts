import { describe, expect, it, vi } from 'vitest'
import type { GitHubApiRepository } from './api'

vi.mock('electron', () => ({ app: {}, dialog: {}, shell: {} }))
vi.mock('../state', () => ({ state: {} }))
vi.mock('../project', () => ({ listProjects: async () => [], openProject: async () => null }))
vi.mock('./auth', () => ({ getFreshGithubCredential: async () => ({ accessToken: 'token' }) }))
vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return {
    ...actual,
    githubInstalledRepositories: async () => [repository(1, 'empty-repo'), repository(2, 'creator-project')],
    githubApiRequest: async (url: string) => {
      if (url.includes('/empty-repo/')) throw new actual.GitHubApiError('Git Repository is empty.', 409)
      return new Response(JSON.stringify({ tree: [{ type: 'blob', path: 'data/variables.json' }] }))
    },
  }
})

function repository(id: number, name: string): GitHubApiRepository {
  return {
    id,
    name,
    full_name: `owner/${name}`,
    clone_url: `https://github.com/owner/${name}.git`,
    html_url: `https://github.com/owner/${name}`,
    private: true,
    updated_at: '2026-11-05T00:00:00Z',
    default_branch: 'main',
    owner: { login: 'owner' },
  }
}

describe('listGitHubProjectRepositories', () => {
  it('skips empty repositories instead of failing the whole list', async () => {
    const { listGitHubProjectRepositories } = await import('./discovery')
    const projects = await listGitHubProjectRepositories()
    expect(projects.map((project) => [project.name, project.projectType])).toEqual([
      ['creator-project', 'Tabletop Creator'],
    ])
  })
})
