import path from 'node:path'
import fs from 'node:fs/promises'
import type { ProjectSet } from '../../src/types'
import { state } from '../state'
import { dataDirName } from '../constants'
import { writeDiagnostic } from '../diagnostics'
import { nativeDocumentHash, sha256 } from '../hash'
import { persistSets } from '../store'

export async function logLinkedNativeHashDrifts() {
  const groups = new Map<string, ProjectSet[]>()
  for (const set of state.sets)
    if (set.nativeSetFile) {
      const file = path.basename(set.nativeSetFile)
      groups.set(file, [...(groups.get(file) ?? []), set])
    }
  for (const [file, group] of groups) {
    try {
      const currentHash = nativeDocumentHash(await fs.readFile(path.join(state.activeProject, 'data', 'sets', file)))
      const expectedHashes = [
        ...new Set(group.map((set) => set.nativeSetHash).filter((hash): hash is string => Boolean(hash))),
      ]
      if (expectedHashes.some((hash) => hash !== currentHash))
        await writeDiagnostic('error', 'native-set.hash-mismatch.on-open', {
          file,
          setNames: group.map((set) => set.name),
          nameMismatches: group.flatMap((set) => {
            const native = state.nativeSets.find((item) => item.file === file && item.index === set.nativeSetIndex)
            return native && native.name !== set.name
              ? [{ cardStudioName: set.name, tabletopCreatorName: native.name, index: native.index }]
              : []
          }),
          currentHash,
          expectedHashes,
        })
    } catch (error) {
      await writeDiagnostic('error', 'native-set.file-check-failed', {
        file,
        error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
      })
    }
  }
}

export async function upgradeNativeSetHashes() {
  const groups = new Map<string, ProjectSet[]>()
  for (const set of state.sets)
    if (set.nativeSetFile) {
      const file = path.basename(set.nativeSetFile)
      groups.set(file, [...(groups.get(file) ?? []), set])
    }
  let changed = false
  for (const [file, group] of groups) {
    let raw: Buffer
    try {
      raw = await fs.readFile(path.join(state.activeProject, 'data', 'sets', file))
    } catch {
      continue
    }
    const currentCanonical = nativeDocumentHash(raw)
    const currentRaw = sha256(raw)
    for (const set of group) {
      if (!set.nativeSetHash || set.nativeSetHash === currentCanonical) continue
      let backupMatches = false
      const backupPath = path.join(
        state.activeProject,
        dataDirName,
        'native-backups',
        `${file}.${set.nativeSetHash.slice(0, 16)}.json`,
      )
      try {
        backupMatches = nativeDocumentHash(await fs.readFile(backupPath)) === currentCanonical
      } catch {
        /* no prior backup */
      }
      if (set.nativeSetHash === currentRaw || backupMatches) {
        set.nativeSetHash = currentCanonical
        changed = true
        await writeDiagnostic('info', 'native-set.hash-format-upgraded', {
          file,
          setName: set.name,
          currentHash: currentCanonical,
          matchedBackup: backupMatches,
        })
      }
    }
  }
  if (changed) await persistSets(false)
}
