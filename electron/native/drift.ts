import path from 'node:path'
import fs from 'node:fs/promises'
import { state } from '../state'
import { dataDirName } from '../constants'
import { writeDiagnostic } from '../diagnostics'
import { nativeDocumentHash, sha256 } from '../hash'
import { persistSets } from '../store'
import { linkedNativeGroups } from './io'

export async function upgradeNativeSetHashes() {
  let changed = false
  for (const [file, group] of linkedNativeGroups()) {
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
