// Pure decisions for keeping Card Studio and Tabletop Creator's native set files in sync.

export type NativeSyncAction = 'none' | 'reload' | 'conflict'

export interface NativeSyncInput {
  /** Hashes stored on the linked sets of one native file (empty for legacy links without a hash). */
  expectedHashes: string[]
  /** Canonical hash of the file as it is on disk now. */
  currentHash: string
  /** Hash of the last content Card Studio wrote to this file in the current session. */
  lastWrittenHash?: string
  /** True when a linked set of this file has CMS changes that could not be written yet. */
  isPending: boolean
}

/**
 * 'none': the file holds what Card Studio expects (or wrote itself), so it can be written freely.
 * 'reload': the file changed outside Card Studio and there is nothing to lose: take the native version.
 * 'conflict': both sides changed; never write until the user picks a side.
 */
export function decideNativeSyncAction(input: NativeSyncInput): NativeSyncAction {
  const { expectedHashes, currentHash, lastWrittenHash, isPending } = input
  if (!expectedHashes.length || expectedHashes.every((hash) => hash === currentHash)) return 'none'
  if (lastWrittenHash && lastWrittenHash === currentHash) return 'none'
  return isPending ? 'conflict' : 'reload'
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

/** `<file>.<YYYY-MM-DD_HH-MM-SS>.json` in local time, used before overwriting a native file. */
export function nativeBackupFileName(file: string, date: Date) {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const time = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  return `${file}.${day}_${time}.json`
}
