import { describe, expect, it } from 'vitest'
import { describeGitError, gitConfigEnv, gitProcessEnv, lfsFilterConfig } from './git-env'

describe('gitProcessEnv', () => {
  it('appends common tool folders missing from a GUI-launched PATH', () => {
    const env = gitProcessEnv({ PATH: '/usr/bin:/bin' }, 'linux', '/home/user')
    const entries = env.PATH!.split(':')
    expect(entries.slice(0, 2)).toEqual(['/usr/bin', '/bin'])
    expect(entries).toContain('/home/user/.local/bin')
    expect(entries).toContain('/usr/local/bin')
  })

  it('does not duplicate folders already on PATH', () => {
    const env = gitProcessEnv({ PATH: '/home/user/.local/bin:/usr/bin' }, 'linux', '/home/user')
    expect(env.PATH!.split(':').filter((entry) => entry === '/home/user/.local/bin')).toHaveLength(1)
  })

  it('adds the bundled git-lfs folder last, so a system install wins', () => {
    const env = gitProcessEnv({ PATH: '/usr/bin' }, 'linux', '/home/user', '/opt/app/resources/git-lfs')
    expect(env.PATH!.split(':').at(-1)).toBe('/opt/app/resources/git-lfs')
  })

  it('keeps other variables and leaves Windows untouched', () => {
    const base = { PATH: 'C:\\Windows', GIT_TERMINAL_PROMPT: '0' }
    expect(gitProcessEnv(base, 'win32', 'C:\\Users\\user')).toEqual(base)
    expect(gitProcessEnv({ ...base, PATH: '/usr/bin' }, 'linux', '/home/user').GIT_TERMINAL_PROMPT).toBe('0')
  })
})

describe('gitConfigEnv', () => {
  it('exposes config pairs through GIT_CONFIG_* variables', () => {
    const env = gitConfigEnv({ HOME: '/home/user' }, [
      ['credential.helper', ''],
      ['filter.lfs.required', 'true'],
    ])
    expect(env).toEqual({
      HOME: '/home/user',
      GIT_CONFIG_COUNT: '2',
      GIT_CONFIG_KEY_0: 'credential.helper',
      GIT_CONFIG_VALUE_0: '',
      GIT_CONFIG_KEY_1: 'filter.lfs.required',
      GIT_CONFIG_VALUE_1: 'true',
    })
  })

  it('appends after pairs that are already set', () => {
    const base = gitConfigEnv({}, [['a.b', '1']])
    const env = gitConfigEnv(base, [['c.d', '2']])
    expect(env.GIT_CONFIG_COUNT).toBe('2')
    expect([env.GIT_CONFIG_KEY_0, env.GIT_CONFIG_KEY_1]).toEqual(['a.b', 'c.d'])
  })

  it('defines a complete LFS filter', () => {
    const keys = lfsFilterConfig.map(([key]) => key)
    expect(keys).toEqual(['filter.lfs.process', 'filter.lfs.smudge', 'filter.lfs.clean', 'filter.lfs.required'])
  })
})

describe('describeGitError', () => {
  it.each([
    'git-lfs filter-process: 1: git-lfs: not found\nfatal: the remote end hung up unexpectedly',
    "git: 'lfs' is not a git command. See 'git --help'.",
    'git-lfs: command not found',
  ])('explains a missing git-lfs: %s', (detail) => {
    expect(describeGitError(detail)).toMatch(/Git LFS/)
  })

  it('passes other errors through unchanged', () => {
    expect(describeGitError('fatal: not a git repository')).toBe('fatal: not a git repository')
  })
})
