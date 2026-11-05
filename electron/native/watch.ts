// Watches `<project>/data/sets/` while a project is open. The directory (not single files) is watched
// so editors that save through a temporary file and a rename are detected too.
import { existsSync, watch, type FSWatcher } from 'node:fs'
import { state } from '../state'
import { writeDiagnostic } from '../diagnostics'
import { runExclusive } from '../exclusive'
import { pushSnapshot, sendNotice } from '../snapshot'
import { scanNativeSets } from './files'
import { errorMessage, nativeSetsDirectory, nativeSyncStatuses } from './io'
import { evaluateNativeSync } from './sync'

const debounceMs = 300

let watcher: FSWatcher | null = null
let watchedDirectory = ''
let debounceTimer: NodeJS.Timeout | null = null

export function reloadedNotice(setNames: string[]) {
  return `Aggiornato da Tabletop Creator: ${setNames.join(', ')}`
}

async function handleNativeChange(project: string) {
  if (state.activeProject !== project) return
  const before = JSON.stringify([nativeSyncStatuses(), state.nativeSets])
  const reloaded = await evaluateNativeSync()
  state.nativeSets = await scanNativeSets()
  const isChanged = before !== JSON.stringify([nativeSyncStatuses(), state.nativeSets])
  if (reloaded.length || isChanged) pushSnapshot()
  if (reloaded.length) sendNotice(reloadedNotice(reloaded))
}

function scheduleCheck(project: string) {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    runExclusive(() => handleNativeChange(project)).catch((error) =>
      writeDiagnostic('error', 'native-set.watch-check-failed', { error: errorMessage(error) }),
    )
  }, debounceMs)
}

/** Starts watching the open project's native sets (no-op when already watching that directory). */
export function startNativeWatcher() {
  const directory = nativeSetsDirectory()
  if (watcher && watchedDirectory === directory) return
  stopNativeWatcher()
  if (!state.activeProject || !existsSync(directory)) return
  const project = state.activeProject
  try {
    watcher = watch(directory, (_event, filename) => {
      // Temporary files of atomic writes end in .tmp; a missing name (platform-dependent) checks all.
      if (!filename || filename.toLowerCase().endsWith('.json')) scheduleCheck(project)
    })
    watchedDirectory = directory
    watcher.on('error', (error) => {
      void writeDiagnostic('error', 'native-set.watch-failed', { error: errorMessage(error) })
      stopNativeWatcher()
    })
  } catch (error) {
    void writeDiagnostic('error', 'native-set.watch-failed', { error: errorMessage(error) })
  }
}

export function stopNativeWatcher() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = null
  watcher?.close()
  watcher = null
  watchedDirectory = ''
}
