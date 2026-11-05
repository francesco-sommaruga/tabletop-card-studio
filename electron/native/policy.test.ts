import { describe, expect, it } from 'vitest'
import { decideNativeSyncAction, nativeBackupFileName } from './policy'

describe('decideNativeSyncAction', () => {
  const base = { expectedHashes: ['a'], currentHash: 'a', isPending: false }

  it('does nothing when the file still has the expected hash', () => {
    expect(decideNativeSyncAction(base)).toBe('none')
    expect(decideNativeSyncAction({ ...base, isPending: true })).toBe('none')
  })

  it('does nothing for legacy links without a stored hash', () => {
    expect(decideNativeSyncAction({ ...base, expectedHashes: [], currentHash: 'b' })).toBe('none')
  })

  it('ignores a file that holds the content Card Studio wrote last', () => {
    expect(decideNativeSyncAction({ ...base, currentHash: 'b', lastWrittenHash: 'b' })).toBe('none')
    expect(decideNativeSyncAction({ ...base, currentHash: 'b', lastWrittenHash: 'b', isPending: true })).toBe('none')
  })

  it('reloads an externally changed file when nothing is pending', () => {
    expect(decideNativeSyncAction({ ...base, currentHash: 'b' })).toBe('reload')
    expect(decideNativeSyncAction({ ...base, currentHash: 'b', lastWrittenHash: 'c' })).toBe('reload')
  })

  it('reports a conflict when the file changed and CMS changes are pending', () => {
    expect(decideNativeSyncAction({ ...base, currentHash: 'b', isPending: true })).toBe('conflict')
  })

  it('treats disagreeing stored hashes as an external change', () => {
    expect(decideNativeSyncAction({ ...base, expectedHashes: ['a', 'x'] })).toBe('reload')
  })
})

describe('nativeBackupFileName', () => {
  it('appends a sortable local timestamp to the native file name', () => {
    const date = new Date(2026, 10, 5, 9, 7, 3)
    expect(nativeBackupFileName('set.json', date)).toBe('set.json.2026-11-05_09-07-03.json')
  })
})
