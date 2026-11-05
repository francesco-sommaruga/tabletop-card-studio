import { app, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { Card, ColumnDefinition, ProjectSet, ProjectSnapshot, ProjectSummary } from '../src/types'
import { state } from './state'
import { scanAssets } from './assets'
import { loadBlueprints, normalizeBlueprintFieldSets } from './blueprints'
import { dataDirName, defaultColumns } from './constants'
import { writeDiagnostic } from './diagnostics'
import { ensureSetGeneratedIds } from './fields'
import { upgradeNativeSetHashes, logLinkedNativeHashDrifts } from './native/drift'
import { scanNativeSets } from './native/files'
import { snapshot } from './snapshot'
import { readSplitSetStore, writeSplitSetStore, persistSets, persistProjectList } from './store'
import { loadVariables } from './variables'
import { scanWorkbooks } from './workbooks/import'

export async function openProject(folder: string): Promise<ProjectSnapshot> {
  state.activeProject = folder
  for (const key of state.notifiedNativeSyncSkips)
    if (key.startsWith(`${folder}:`)) state.notifiedNativeSyncSkips.delete(key)
  state.projectName = path.basename(folder)
  const storeDir = path.join(folder, dataDirName)
  const setsFile = path.join(storeDir, 'sets.json')
  const splitSets = await readSplitSetStore(storeDir)
  if (splitSets) {
    state.sets = splitSets
  } else if (existsSync(setsFile)) {
    state.sets = JSON.parse(await fs.readFile(setsFile, 'utf8'))
    await writeSplitSetStore(storeDir, state.sets)
    await writeDiagnostic('info', 'sets.store-migrated', { setCount: state.sets.length })
  } else {
    const legacyCards = path.join(storeDir, 'cards.json')
    const legacyColumns = path.join(storeDir, 'columns.json')
    if (existsSync(legacyCards)) {
      const cards: Card[] = JSON.parse(await fs.readFile(legacyCards, 'utf8'))
      const columns: ColumnDefinition[] = existsSync(legacyColumns)
        ? JSON.parse(await fs.readFile(legacyColumns, 'utf8'))
        : defaultColumns
      state.sets = [
        {
          id: `set_${crypto.randomUUID()}`,
          name: 'Set principale',
          sourceFile: existsSync(path.join(folder, 'cards.xlsx')) ? 'cards.xlsx' : undefined,
          cards,
          columns,
        },
      ]
      await persistSets(false)
    } else {
      state.sets = []
    }
  }
  state.activeSetId = state.sets[0]?.id ?? null
  state.workbooks = await scanWorkbooks()
  state.assets = await scanAssets()
  state.variables = await loadVariables()
  state.blueprints = await loadBlueprints()
  state.nativeSets = await scanNativeSets()
  await fs.mkdir(storeDir, { recursive: true })
  await upgradeNativeSetHashes()
  const blueprintsNormalized = normalizeBlueprintFieldSets()
  const idsNormalized = state.sets.reduce((changed, set) => ensureSetGeneratedIds(set) || changed, false)
  if (blueprintsNormalized || idsNormalized) await persistSets(false)
  await logLinkedNativeHashDrifts()
  await persistProjectList()
  return snapshot()
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const listPath = path.join(app.getPath('userData'), 'projects.json')
  let entries: Array<{ path: string; lastOpened?: string }> = []
  try {
    entries = JSON.parse(await fs.readFile(listPath, 'utf8'))
  } catch {
    try {
      const recent = JSON.parse(await fs.readFile(path.join(app.getPath('userData'), 'recent-project.json'), 'utf8'))
      if (existsSync(recent.folder)) entries = [{ path: recent.folder }]
    } catch {
      /* no projects saved */
    }
  }
  const result: ProjectSummary[] = []
  for (const entry of entries) {
    if (!existsSync(entry.path)) continue
    const dataDir = path.join(entry.path, dataDirName)
    let projectSets: ProjectSet[] = []
    try {
      projectSets = (await readSplitSetStore(dataDir)) ?? []
    } catch {
      /* try legacy store */
    }
    if (!projectSets.length)
      try {
        projectSets = JSON.parse(await fs.readFile(path.join(dataDir, 'sets.json'), 'utf8'))
      } catch {
        try {
          const cards: Card[] = JSON.parse(await fs.readFile(path.join(dataDir, 'cards.json'), 'utf8'))
          projectSets = [{ id: 'legacy', name: 'Set principale', cards, columns: [] }]
        } catch {
          /* new project */
        }
      }
    const files = await fs.readdir(entry.path, { withFileTypes: true })
    const fileCount = files.filter(
      (file) =>
        file.isFile() &&
        /\.xlsx$/i.test(file.name) &&
        !file.name.startsWith('~$') &&
        !/-cms-export\.xlsx$/i.test(file.name),
    ).length
    result.push({
      path: entry.path,
      name: path.basename(entry.path),
      setCount: projectSets.length,
      cardCount: projectSets.reduce((sum, set) => sum + set.cards.length, 0),
      fileCount,
      lastOpened: entry.lastOpened,
    })
  }
  return result
}

export async function openProjectFromDialog() {
  const result = await dialog.showOpenDialog(state.win!, {
    title: 'Aggiungi cartella progetto',
    properties: ['openDirectory'],
  })
  return result.canceled ? null : openProject(result.filePaths[0])
}
