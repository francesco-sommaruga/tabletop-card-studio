import type { ProjectSnapshot } from '../src/types'
import { state } from './state'
import { runExclusive } from './exclusive'
import { nativeSyncStatuses } from './native/io'

export function activeSet() {
  return state.sets.find((set) => set.id === state.activeSetId) ?? null
}

export function snapshot(): ProjectSnapshot {
  const current = activeSet()
  return {
    projectPath: state.activeProject,
    projectName: state.projectName,
    cards: current?.cards ?? [],
    columns: current?.columns ?? [],
    sets: state.sets.map(({ id, name, sourceFile, nativeSetFile, nativeSetIndex, blueprintName, cards }) => ({
      id,
      name,
      sourceFile,
      nativeSetFile,
      nativeSetIndex,
      blueprintName,
      cardCount: cards.length,
    })),
    activeSetId: state.activeSetId,
    workbooks: state.workbooks,
    assets: state.assets,
    variables: state.variables,
    blueprints: state.blueprints,
    nativeSets: state.nativeSets,
    nativeSync: nativeSyncStatuses(),
  }
}

/** Sends the current snapshot to the renderer (preload `onSnapshot`). */
export function pushSnapshot() {
  if (state.activeProject) state.win?.webContents.send('project:snapshot', snapshot())
}

let isPushQueued = false

/** Pushes the snapshot once the running operation (and a possible rollback) has finished. */
export function requestSnapshotPush() {
  if (isPushQueued) return
  isPushQueued = true
  void runExclusive(async () => {
    isPushQueued = false
    pushSnapshot()
  })
}

export function sendNotice(message: string) {
  state.win?.webContents.send('app:notice', message)
}
