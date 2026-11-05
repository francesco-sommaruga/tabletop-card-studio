import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { ProjectSet } from '../src/types'
import { state } from './state'
import { dataDirName } from './constants'
import { sha256 } from './hash'
import { syncLinkedNativeFiles } from './native/files'

type SetStoreIndex = { version: 1; sets: Array<{ id: string; file: string }> }

function setStoreFile(id: string) {
  return `set-${sha256(id).slice(0, 20)}.json`
}

export async function writeFileAtomically(filePath: string, contents: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.card-studio-${crypto.randomUUID()}.tmp`
  await fs.writeFile(tempPath, contents, 'utf8')
  await fs.rename(tempPath, filePath)
}

export async function readSplitSetStore(storeDir: string): Promise<ProjectSet[] | null> {
  const indexPath = path.join(storeDir, 'sets', 'index.json')
  if (!existsSync(indexPath)) return null
  const index = JSON.parse(await fs.readFile(indexPath, 'utf8')) as SetStoreIndex
  if (index.version !== 1 || !Array.isArray(index.sets)) throw new Error('Indice dei set Card Studio non valido.')
  const loaded = await Promise.all(
    index.sets.map(async ({ id, file }) => {
      if (path.basename(file) !== file || !file.endsWith('.json'))
        throw new Error(`File set non valido nell'indice: ${file}`)
      const set = JSON.parse(await fs.readFile(path.join(storeDir, 'sets', file), 'utf8')) as ProjectSet
      if (set.id !== id) throw new Error(`L'identificativo del set non corrisponde: ${file}`)
      return set
    }),
  )
  return loaded
}

export async function writeSplitSetStore(storeDir: string, projectSets: ProjectSet[]) {
  const setsDir = path.join(storeDir, 'sets')
  await fs.mkdir(setsDir, { recursive: true })
  const previousIndexPath = path.join(setsDir, 'index.json')
  let previousIndex: SetStoreIndex | null = null
  try {
    previousIndex = JSON.parse(await fs.readFile(previousIndexPath, 'utf8')) as SetStoreIndex
  } catch {
    /* first write or legacy migration */
  }

  const entries = projectSets.map((set) => ({ id: set.id, file: setStoreFile(set.id) }))
  for (const set of projectSets) {
    const filePath = path.join(setsDir, setStoreFile(set.id))
    const content = JSON.stringify(set, null, 2)
    let current = ''
    try {
      current = await fs.readFile(filePath, 'utf8')
    } catch {
      /* new set */
    }
    if (current !== content) await writeFileAtomically(filePath, content)
  }

  const index: SetStoreIndex = { version: 1, sets: entries }
  await writeFileAtomically(previousIndexPath, JSON.stringify(index, null, 2))

  const retained = new Set(entries.map((entry) => entry.file))
  for (const entry of previousIndex?.sets ?? []) {
    if (!retained.has(entry.file) && path.basename(entry.file) === entry.file)
      await fs.rm(path.join(setsDir, entry.file), { force: true })
  }

  // Keep the old monolithic file as a dated recovery copy after the split store is durable.
  const legacyPath = path.join(storeDir, 'sets.json')
  if (existsSync(legacyPath)) {
    const backupDir = path.join(storeDir, 'migration-backups')
    await fs.mkdir(backupDir, { recursive: true })
    const backupPath = path.join(backupDir, `sets-legacy-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    await fs.rename(legacyPath, backupPath)
  }
}

export async function persistSets(syncNative = true) {
  if (!state.activeProject) return
  const dir = path.join(state.activeProject, dataDirName)
  await fs.mkdir(dir, { recursive: true })
  if (syncNative) await syncLinkedNativeFiles()
  await writeSplitSetStore(dir, state.sets)
}

export async function persistProjectList() {
  const listPath = path.join(app.getPath('userData'), 'projects.json')
  let list: Array<{ path: string; lastOpened: string }> = []
  try {
    list = JSON.parse(await fs.readFile(listPath, 'utf8'))
  } catch {
    /* first project */
  }
  list = [
    { path: state.activeProject, lastOpened: new Date().toISOString() },
    ...list.filter((entry) => entry.path !== state.activeProject),
  ]
  await fs.writeFile(listPath, JSON.stringify(list, null, 2))
}
