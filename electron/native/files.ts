import path from 'node:path'
import fs from 'node:fs/promises'
import type { NativeSetInfo, ProjectSet } from '../../src/types'
import { state } from '../state'
import { writeDiagnostic } from '../diagnostics'
import { nativeDocumentHash } from '../hash'
import { requestSnapshotPush } from '../snapshot'
import { nativeItemFromCard } from './items'
import {
  backupNativeFileByHash,
  errorMessage,
  linkedNativeGroups,
  nativeSetsDirectory,
  readNativeFile,
  serializeNativeDocument,
  storedHashes,
  writeNativeFile,
  type NativeFile,
} from './io'
import { decideNativeSyncAction } from './policy'

/** True when the native file may be written: it holds what Card Studio expects or wrote itself. */
export function isNativeFileUnchanged(file: string, group: ProjectSet[], native: NativeFile) {
  const action = decideNativeSyncAction({
    expectedHashes: storedHashes(group),
    currentHash: native.hash,
    lastWrittenHash: state.nativeLastWrittenHashes.get(file),
    isPending: group.some((set) => set.nativeSyncPending),
  })
  return action === 'none'
}

/**
 * Writes the linked sets that changed in this operation (and any pending ones) to their native files.
 * A file changed outside Card Studio is never overwritten: its changed sets become pending (conflict).
 */
export async function syncLinkedNativeFiles(changedSetIds: Set<string>) {
  for (const [file, group] of linkedNativeGroups()) {
    const changed = group.filter((set) => changedSetIds.has(set.id))
    if (!changed.length && !group.some((set) => set.nativeSyncPending)) continue
    try {
      const native = await readNativeFile(file)
      state.nativeSyncErrors.delete(file)
      if (isNativeFileUnchanged(file, group, native)) {
        await writeLinkedNativeSets(file, group, native)
        continue
      }
      for (const set of changed) set.nativeSyncPending = true
      await writeDiagnostic('info', 'native-set.sync-conflict', {
        file,
        setNames: group.map((set) => set.name),
        currentHash: native.hash,
        expectedHashes: storedHashes(group),
      })
    } catch (error) {
      for (const set of changed) set.nativeSyncPending = true
      state.nativeSyncErrors.set(file, errorMessage(error))
      await writeDiagnostic('error', 'native-set.sync-failed', { file, error: errorMessage(error) })
    }
    requestSnapshotPush()
  }
}

export async function scanNativeSets(): Promise<NativeSetInfo[]> {
  const directory = nativeSetsDirectory()
  let files: string[]
  try {
    files = (await fs.readdir(directory)).filter((file) => file.toLowerCase().endsWith('.json')).sort()
  } catch {
    return []
  }
  const result: NativeSetInfo[] = []
  for (const file of files) {
    try {
      const document = JSON.parse(await fs.readFile(path.join(directory, file), 'utf8'))
      if (!Array.isArray(document.sets)) continue
      document.sets.forEach((set: Record<string, unknown>, index: number) => {
        if (typeof set.name !== 'string' || !Array.isArray(set.items)) return
        result.push({
          file,
          index,
          name: set.name,
          blueprintName: typeof set.blueprint_name === 'string' ? set.blueprint_name : '',
          itemCount: set.items.length,
        })
      })
    } catch {
      /* ignore malformed or incomplete JSON files */
    }
  }
  return result
}

/**
 * Replaces the items of the given sets in `native` (as read from `file`) with their CMS cards and
 * writes the file when the content changed. Clears pending state; the caller checks for conflicts.
 */
export async function writeLinkedNativeSets(file: string, linkedSets: ProjectSet[], native: NativeFile) {
  const document = native.document
  for (const set of linkedSets) {
    if (set.nativeSetIndex === undefined) continue
    const nativeSet = document.sets?.[set.nativeSetIndex]
    if (!nativeSet || !Array.isArray(nativeSet.items))
      throw new Error(`Il set ${file} non ha più la struttura prevista.`)
    nativeSet.items = set.cards.map((card) => nativeItemFromCard(card, set.columns))
  }
  const serialized = serializeNativeDocument(document)
  let nextHash = nativeDocumentHash(serialized)
  if (nextHash !== native.hash) {
    await backupNativeFileByHash(file, native.hash)
    nextHash = await writeNativeFile(file, serialized)
  }
  for (const set of linkedSets) {
    const items = set.nativeSetIndex === undefined ? undefined : document.sets[set.nativeSetIndex].items
    if (items) set.cards.forEach((card, index) => (card.nativeItem = JSON.parse(JSON.stringify(items[index]))))
    set.nativeSetHash = nextHash
    set.nativeSyncPending = undefined
  }
  state.nativeSyncErrors.delete(file)
}

export async function writeLinkedNativeSetName(target: ProjectSet) {
  if (!target.nativeSetFile || target.nativeSetIndex === undefined) return
  const file = path.basename(target.nativeSetFile)
  try {
    const native = await readNativeFile(file)
    const linked = linkedNativeGroups().get(file) ?? [target]
    if (!isNativeFileUnchanged(file, linked, native)) {
      await writeDiagnostic('error', 'native-set.rename-skipped-hash-mismatch', { file, setName: target.name })
      return
    }
    const nativeSet = native.document.sets?.[target.nativeSetIndex]
    if (!nativeSet || !Array.isArray(nativeSet.items)) {
      await writeDiagnostic('error', 'native-set.rename-skipped-missing-set', {
        file,
        setName: target.name,
        index: target.nativeSetIndex,
      })
      return
    }
    if (nativeSet.name === target.name) return
    nativeSet.name = target.name
    await backupNativeFileByHash(file, native.hash)
    const nextHash = await writeNativeFile(file, serializeNativeDocument(native.document))
    for (const set of linked) set.nativeSetHash = nextHash
    state.nativeSets = await scanNativeSets()
  } catch (error) {
    await writeDiagnostic('error', 'native-set.rename-sync-failed', {
      file,
      setName: target.name,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    })
  }
}
