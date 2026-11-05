import type { BrowserWindow } from 'electron'
import type {
  NativeSetInfo,
  ProjectAsset,
  ProjectSet,
  ProjectVariable,
  TabletopBlueprint,
  WorkbookInfo,
} from '../src/types'

// Shared main-process state of the open project. Modules read and reassign it through this single
// object (never through local copies) so every module always sees the current value.
export const state = {
  win: null as BrowserWindow | null,
  activeProject: '',
  projectName: '',
  sets: [] as ProjectSet[],
  activeSetId: null as string | null,
  workbooks: [] as WorkbookInfo[],
  assets: [] as ProjectAsset[],
  variables: [] as ProjectVariable[],
  blueprints: [] as TabletopBlueprint[],
  nativeSets: [] as NativeSetInfo[],
  // "<projectPath>:<native file>" keys already notified about a skipped native sync in this session.
  notifiedNativeSyncSkips: new Set<string>(),
}
