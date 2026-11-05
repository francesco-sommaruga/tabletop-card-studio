// Detects changes made to linked native files outside Card Studio and applies the sync policy:
// reload automatically when nothing is pending, otherwise keep the conflict for the user to resolve.
import path from 'node:path'
import type { ProjectSet, ProjectSnapshot } from '../../src/types'
import { state } from '../state'
import { synchronizeBlueprintFields } from '../blueprints'
import { writeDiagnostic } from '../diagnostics'
import { ensureSetGeneratedIds } from '../fields'
import { snapshot } from '../snapshot'
import { persistSets } from '../store'
import { scanNativeSets, writeLinkedNativeSets } from './files'
import {
  backupNativeFileWithTimestamp,
  errorMessage,
  linkedNativeGroups,
  readNativeFile,
  storedHashes,
  type NativeFile,
} from './io'
import { decideNativeSyncAction } from './policy'
import { nativeSetItems, reloadSetFromNative } from './reload'

/** Replaces cards and native fields of `group` with the content of `native`, keeping CMS metadata. */
export function reloadNativeGroup(file: string, group: ProjectSet[], native: NativeFile) {
  const linked = group.filter((set) => set.nativeSetIndex !== undefined)
  const nativeSets = linked.map((set) => native.document.sets?.[set.nativeSetIndex!])
  if (nativeSets.some((nativeSet) => !nativeSet || !Array.isArray(nativeSet.items)))
    throw new Error(`Il set ${file} non ha più la struttura prevista.`)
  linked.forEach((set, index) => {
    const { cards, columns } = reloadSetFromNative(set, nativeSetItems(nativeSets[index]))
    set.cards = cards
    set.columns = columns
    ensureSetGeneratedIds(set)
    if (set.blueprintName) synchronizeBlueprintFields(set.blueprintName, set.columns)
  })
  for (const set of group) {
    set.nativeSetHash = native.hash
    set.nativeSyncPending = undefined
  }
  state.nativeSyncErrors.delete(file)
}

type FileOutcome = 'unchanged' | 'reloaded' | 'flushed' | 'conflict' | 'error'

async function evaluateNativeFile(file: string, group: ProjectSet[]): Promise<FileOutcome> {
  try {
    const native = await readNativeFile(file)
    state.nativeSyncErrors.delete(file)
    const isPending = group.some((set) => set.nativeSyncPending)
    const action = decideNativeSyncAction({
      expectedHashes: storedHashes(group),
      currentHash: native.hash,
      lastWrittenHash: state.nativeLastWrittenHashes.get(file),
      isPending,
    })
    if (action === 'reload') {
      reloadNativeGroup(file, group, native)
      await writeDiagnostic('info', 'native-set.reloaded', { file, setNames: group.map((set) => set.name) })
      return 'reloaded'
    }
    if (action === 'conflict') {
      await writeDiagnostic('info', 'native-set.conflict', { file, setNames: group.map((set) => set.name) })
      return 'conflict'
    }
    if (!isPending) return 'unchanged'
    // Pending CMS changes and the file was not touched by anyone else: write them now.
    await writeLinkedNativeSets(file, group, native)
    return 'flushed'
  } catch (error) {
    state.nativeSyncErrors.set(file, errorMessage(error))
    await writeDiagnostic('error', 'native-set.check-failed', { file, error: errorMessage(error) })
    return 'error'
  }
}

/**
 * Compares every linked native file with what Card Studio expects (project open, file watcher).
 * Returns the names of the sets reloaded from Tabletop Creator.
 */
export async function evaluateNativeSync(): Promise<string[]> {
  const reloaded: string[] = []
  let isStoreDirty = false
  for (const [file, group] of linkedNativeGroups()) {
    const outcome = await evaluateNativeFile(file, group)
    if (outcome === 'reloaded') reloaded.push(...group.map((set) => set.name))
    if (outcome === 'reloaded' || outcome === 'flushed') isStoreDirty = true
  }
  if (isStoreDirty) await persistSets(false)
  return reloaded
}

/**
 * 'reload' discards pending CMS changes and takes the native file. 'overwrite' backs the native file
 * up with a timestamp, then writes the CMS version (sets of the file without pending changes take
 * the native version first, so only actual CMS changes win).
 */
export async function resolveNativeConflict(
  setId: string,
  resolution: 'reload' | 'overwrite',
): Promise<ProjectSnapshot> {
  const target = state.sets.find((set) => set.id === setId)
  if (!target?.nativeSetFile || target.nativeSetIndex === undefined)
    throw new Error('Il set non è collegato a Tabletop Creator.')
  const file = path.basename(target.nativeSetFile)
  const group = linkedNativeGroups().get(file) ?? [target]
  const native = await readNativeFile(file)
  if (resolution === 'reload') reloadNativeGroup(file, group, native)
  else {
    const backupPath = await backupNativeFileWithTimestamp(file)
    const untouched = group.filter((set) => !set.nativeSyncPending)
    if (untouched.length) reloadNativeGroup(file, untouched, native)
    await writeLinkedNativeSets(file, group, native)
    await writeDiagnostic('info', 'native-set.conflict-overwritten', { file, backupPath })
  }
  await writeDiagnostic('info', 'native-set.conflict-resolved', { file, resolution })
  state.nativeSets = await scanNativeSets()
  await persistSets(false)
  return snapshot()
}
