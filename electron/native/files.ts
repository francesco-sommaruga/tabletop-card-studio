import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { NativeSetInfo, ProjectSet } from '../../src/types'
import { state } from '../state'
import { dataDirName } from '../constants'
import { writeDiagnostic } from '../diagnostics'
import { nativeDocumentHash } from '../hash'
import { nativeItemFromCard } from './items'

export async function syncLinkedNativeFiles() {
  const nativeGroups = new Map<string, ProjectSet[]>()
  for (const set of state.sets)
    if (set.nativeSetFile) {
      const file = path.basename(set.nativeSetFile)
      nativeGroups.set(file, [...(nativeGroups.get(file) ?? []), set])
    }
  for (const [file, group] of nativeGroups) {
    const filePath = path.join(state.activeProject, 'data', 'sets', file)
    const expected = [...new Set(group.map((set) => set.nativeSetHash).filter((hash): hash is string => Boolean(hash)))]
    try {
      const currentHash = nativeDocumentHash(await fs.readFile(filePath))
      if (expected.some((hash) => hash !== currentHash)) {
        await writeDiagnostic('info', 'native-set.sync-skipped-hash-mismatch', {
          file,
          setNames: group.map((set) => set.name),
          nameMismatches: group.flatMap((set) => {
            const native = state.nativeSets.find((item) => item.file === file && item.index === set.nativeSetIndex)
            return native && native.name !== set.name
              ? [{ cardStudioName: set.name, tabletopCreatorName: native.name, index: native.index }]
              : []
          }),
          currentHash,
          expectedHashes: expected,
        })
        const notificationKey = `${state.activeProject}:${file}`
        if (!state.notifiedNativeSyncSkips.has(notificationKey)) {
          state.notifiedNativeSyncSkips.add(notificationKey)
          state.win?.webContents.send(
            'app:notice',
            `Salvato in Card Studio, ma “${group.map((set) => set.name).join(', ')}” non è stato sincronizzato in Tabletop Creator: il file nativo è cambiato. Consulta i log o ricollega il set.`,
          )
        }
        continue
      }
      await writeLinkedNativeSets(group)
    } catch (error) {
      await writeDiagnostic('error', 'native-set.sync-skipped-error', {
        file,
        error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
      })
    }
  }
}

export async function scanNativeSets(): Promise<NativeSetInfo[]> {
  const directory = path.join(state.activeProject, 'data', 'sets')
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

async function writeLinkedNativeSets(linkedSets: ProjectSet[]) {
  if (!linkedSets.length) return
  const file = path.basename(linkedSets[0].nativeSetFile ?? '')
  const filePath = path.join(state.activeProject, 'data', 'sets', file)
  const original = await fs.readFile(filePath)
  const actualHash = nativeDocumentHash(original)
  if (linkedSets.some((set) => set.nativeSetHash && actualHash !== set.nativeSetHash))
    throw new Error(
      `Il set nativo ${file} è cambiato fuori da Card Studio. Ricollega o ricarica il set prima di salvare.`,
    )
  const backupDirectory = path.join(state.activeProject, dataDirName, 'native-backups')
  await fs.mkdir(backupDirectory, { recursive: true })
  const backupPath = path.join(backupDirectory, `${file}.${actualHash.slice(0, 16)}.json`)
  if (!existsSync(backupPath)) await fs.copyFile(filePath, backupPath)
  const document = JSON.parse(original.toString('utf8'))
  for (const set of linkedSets) {
    if (set.nativeSetIndex === undefined) continue
    const nativeSet = document.sets?.[set.nativeSetIndex]
    if (!nativeSet || !Array.isArray(nativeSet.items))
      throw new Error(`Il set ${file} non ha più la struttura prevista.`)
    nativeSet.items = set.cards.map((card) => nativeItemFromCard(card, set.columns))
    for (let index = 0; index < set.cards.length; index += 1)
      set.cards[index].nativeItem = JSON.parse(JSON.stringify(nativeSet.items[index]))
  }
  const serialized = JSON.stringify(document, null, 2)
  const temporary = `${filePath}.card-studio-${crypto.randomUUID()}.tmp`
  await fs.writeFile(temporary, serialized)
  await fs.rename(temporary, filePath)
  const nextHash = nativeDocumentHash(serialized)
  for (const set of linkedSets) set.nativeSetHash = nextHash
}

export async function writeLinkedNativeSetName(target: ProjectSet) {
  if (!target.nativeSetFile || target.nativeSetIndex === undefined) return
  const file = path.basename(target.nativeSetFile)
  try {
    const filePath = path.join(state.activeProject, 'data', 'sets', file)
    const original = await fs.readFile(filePath)
    const actualHash = nativeDocumentHash(original)
    const linked = state.sets.filter((set) => set.nativeSetFile && path.basename(set.nativeSetFile) === file)
    if (linked.some((set) => set.nativeSetHash && set.nativeSetHash !== actualHash)) {
      await writeDiagnostic('error', 'native-set.rename-skipped-hash-mismatch', { file, setName: target.name })
      return
    }
    const document = JSON.parse(original.toString('utf8'))
    const nativeSet = document.sets?.[target.nativeSetIndex]
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
    const backupDirectory = path.join(state.activeProject, dataDirName, 'native-backups')
    await fs.mkdir(backupDirectory, { recursive: true })
    const backupPath = path.join(backupDirectory, `${file}.${actualHash.slice(0, 16)}.json`)
    if (!existsSync(backupPath)) await fs.copyFile(filePath, backupPath)
    const serialized = JSON.stringify(document, null, 2)
    const temporary = `${filePath}.card-studio-${crypto.randomUUID()}.tmp`
    await fs.writeFile(temporary, serialized)
    await fs.rename(temporary, filePath)
    const nextHash = nativeDocumentHash(serialized)
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
