import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: {}, shell: {} }))
vi.mock('electron-updater', () => ({ autoUpdater: {} }))
vi.mock('./diagnostics', () => ({ writeDiagnostic: vi.fn() }))

const { isNewerVersion } = await import('./updater')

describe('isNewerVersion', () => {
  it('detects a newer patch, minor and major release', () => {
    expect(isNewerVersion('v0.2.60', '0.2.59')).toBe(true)
    expect(isNewerVersion('0.3.0', '0.2.59')).toBe(true)
    expect(isNewerVersion('1.0.0', '0.9.99')).toBe(true)
  })

  it('rejects equal and older releases', () => {
    expect(isNewerVersion('v0.2.59', '0.2.59')).toBe(false)
    expect(isNewerVersion('0.2.9', '0.2.59')).toBe(false)
  })
})
