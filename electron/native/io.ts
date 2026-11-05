// Reading and writing Tabletop Creator set files (`<project>/data/sets/*.json`) and the per-file
// bookkeeping (last written hash, errors) used to tell Card Studio's own writes from external ones.
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { NativeSyncStatus, ProjectSet } from '../../src/types'
import { state } from '../state'
import { dataDirName } from '../constants'
import { writeFileAtomically } from '../fsutil'
import { nativeDocumentHash } from '../hash'
import { nativeBackupFileName } from './policy'

export interface NativeFile {
  hash: string
  // Parsed native document, shaped `{ sets: [{ name, items, ... }] }`; mutate freely, it is a fresh copy.
  document: any
}

export function nativeSetsDirectory() {
  return path.join(state.activeProject, 'data', 'sets')
}

function nativeFilePath(file: string) {
  return path.join(nativeSetsDirectory(), path.basename(file))
}

function backupDirectory() {
  return path.join(state.activeProject, dataDirName, 'native-backups')
}

/** Linked sets grouped by native file name. */
export function linkedNativeGroups() {
  const groups = new Map<string, ProjectSet[]>()
  for (const set of state.sets)
    if (set.nativeSetFile) {
      const file = path.basename(set.nativeSetFile)
      groups.set(file, [...(groups.get(file) ?? []), set])
    }
  return groups
}

export function storedHashes(group: ProjectSet[]) {
  return [...new Set(group.map((set) => set.nativeSetHash).filter((hash): hash is string => Boolean(hash)))]
}

export async function readNativeFile(file: string): Promise<NativeFile> {
  const raw = await fs.readFile(nativeFilePath(file))
  return { hash: nativeDocumentHash(raw), document: JSON.parse(raw.toString('utf8')) }
}

export function serializeNativeDocument(document: unknown) {
  return JSON.stringify(document, null, 2)
}

/** Atomically replaces a native file and remembers its hash as Card Studio's own write. */
export async function writeNativeFile(file: string, serialized: string) {
  await writeFileAtomically(nativeFilePath(file), serialized)
  const hash = nativeDocumentHash(serialized)
  state.nativeLastWrittenHashes.set(path.basename(file), hash)
  return hash
}

/** Creates a new native file, failing if it already exists. */
export async function createNativeFile(file: string, serialized: string) {
  await fs.mkdir(nativeSetsDirectory(), { recursive: true })
  await fs.writeFile(nativeFilePath(file), serialized, { flag: 'wx' })
  const hash = nativeDocumentHash(serialized)
  state.nativeLastWrittenHashes.set(path.basename(file), hash)
  return hash
}

/** Recovery copy named after the content hash, taken once before Card Studio modifies a file. */
export async function backupNativeFileByHash(file: string, hash: string) {
  await fs.mkdir(backupDirectory(), { recursive: true })
  const backupPath = path.join(backupDirectory(), `${path.basename(file)}.${hash.slice(0, 16)}.json`)
  if (!existsSync(backupPath)) await fs.copyFile(nativeFilePath(file), backupPath)
}

/** Dated copy taken before overwriting Tabletop Creator's changes. Returns the backup path. */
export async function backupNativeFileWithTimestamp(file: string) {
  await fs.mkdir(backupDirectory(), { recursive: true })
  const backupPath = path.join(backupDirectory(), nativeBackupFileName(path.basename(file), new Date()))
  await fs.copyFile(nativeFilePath(file), backupPath)
  return backupPath
}

/**
 * After an operation is rolled back in memory, the native files it already wrote keep the new
 * content. Point the restored sets at that content and mark them pending, so the next sync writes
 * the restored CMS state instead of mistaking Card Studio's own write for an external change.
 */
export function reconcileRolledBackNativeWrites(writtenBefore: Map<string, string>) {
  const groups = linkedNativeGroups()
  for (const [file, hash] of state.nativeLastWrittenHashes) {
    if (writtenBefore.get(file) === hash) continue
    for (const set of groups.get(file) ?? []) {
      set.nativeSetHash = hash
      set.nativeSyncPending = true
    }
  }
}

export function nativeSyncStatuses(): Record<string, NativeSyncStatus> {
  const statuses: Record<string, NativeSyncStatus> = {}
  for (const [file, group] of linkedNativeGroups()) {
    const status = state.nativeSyncErrors.has(file)
      ? 'error'
      : group.some((set) => set.nativeSyncPending)
        ? 'conflict'
        : 'synced'
    for (const set of group) statuses[set.id] = status
  }
  return statuses
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
