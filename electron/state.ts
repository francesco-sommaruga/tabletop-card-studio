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
  // Native file name -> canonical hash of the content Card Studio last wrote there (this session).
  nativeLastWrittenHashes: new Map<string, string>(),
  // Native file name -> message of the last failed read/write; its linked sets show 'error'.
  nativeSyncErrors: new Map<string, string>(),
}
