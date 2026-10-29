export type CardStatus = 'Idea' | 'Design' | 'Playtest' | 'Ready'

export interface Card {
  id: string
  title: string
  status: CardStatus
  tags: string[]
  quantity: number
  values: Record<string, string>
  updatedAt: string
}

export interface ImportBaselineRow {
  cardId: string
  values: Record<string, string>
}

export type RuleOperator = 'is_set' | 'is_empty' | 'equals' | 'not_equals' | 'contains'

export interface ConditionalValueRule {
  sourceFieldId: string
  operator: RuleOperator
  matchValue?: string
  value: string
}

export interface ColumnDefinition {
  id: string
  header: string
  fieldLabel?: string
  fieldId: string
  type?: 'text' | 'number' | 'select' | 'image' | 'longtext' | 'variable' | 'color'
  defaultValue?: string
  options?: string[]
  variableTags?: string[]
  hidden?: boolean
  rules?: ConditionalValueRule[]
}

export interface ProjectSet {
  id: string
  name: string
  sourceFile?: string
  cards: Card[]
  columns: ColumnDefinition[]
  importBaseline?: ImportBaselineRow[]
  importMatchFieldId?: string
}

export interface WorkbookInfo {
  file: string
  rowCount: number
  headers: string[]
}

export interface ProjectAsset {
  path: string
  name: string
  mime: string
  previewUrl: string
}

export interface ProjectIconReference {
  reference: string
  name: string
  category: string
  library: 'tabletop' | 'project'
}

export interface ProjectVariable {
  code: string
  replacement: string
  force_tint?: string
  color?: string
  studioTags?: string[]
  studioType?: 'text' | 'color' | 'icon'
  [key: string]: unknown
}

export interface TabletopBlueprintPanel {
  name: string
  data: Record<string, string>
}

export interface TabletopBlueprintGroup {
  name: string
  panels: TabletopBlueprintPanel[]
}

export interface TabletopBlueprint {
  name: string
  type?: string
  layout_size_mm?: string
  shape_settings?: Record<string, string>
  front_groups?: TabletopBlueprintGroup[]
  back_groups?: TabletopBlueprintGroup[]
  front_layers?: TabletopBlueprintGroup[]
  back_layers?: TabletopBlueprintGroup[]
}

export interface ProjectSummary {
  path: string
  name: string
  setCount: number
  cardCount: number
  fileCount: number
  lastOpened?: string
}

export interface ImportPlan {
  file: string
  name: string
  fields: Array<{ header: string; type: ColumnDefinition['type']; options?: string[] }>
}

export interface MergeFieldConflict {
  conflictId: string
  cardId: string
  cardTitle: string
  fieldId: string
  header: string
  currentValue: string
  incomingValue: string
}

export interface MergeFieldChange extends Omit<MergeFieldConflict, 'conflictId'> {
  source: 'excel' | 'set'
}

export interface MergeRestoreField {
  id: string
  header: string
  type: NonNullable<ColumnDefinition['type']>
}

export interface WorkbookMergePreview {
  token: string
  setId: string
  setName: string
  file: string
  matchFieldId: string
  matchFields: Array<{ id: string; label: string }>
  importFields: Array<{ id: string; label: string }>
  selectedFieldIds: string[]
  restoreFields: MergeRestoreField[]
  restoredFieldIds: string[]
  matchedRows: number
  unchangedRows: number
  newTitles: string[]
  missingTitles: string[]
  automaticChanges: MergeFieldChange[]
  preservedLocalChanges: MergeFieldChange[]
  conflicts: MergeFieldConflict[]
  duplicateKeys: string[]
  legacyBaseline: boolean
}

export interface GitFileStatus {
  path: string
  status: string
}

export interface GitCommitSummary {
  hash: string
  subject: string
  age: string
}

export interface GitStatus {
  isRepo: boolean
  branch: string
  remoteUrl: string
  githubUrl: string
  changedFiles: GitFileStatus[]
  ahead: number
  behind: number
  commits: GitCommitSummary[]
  error: string
}

export interface ProjectSnapshot {
  projectPath: string
  projectName: string
  cards: Card[]
  columns: ColumnDefinition[]
  sets: Array<Pick<ProjectSet, 'id' | 'name' | 'sourceFile'> & { cardCount: number }>
  activeSetId: string | null
  workbooks: WorkbookInfo[]
  assets: ProjectAsset[]
  variables: ProjectVariable[]
  blueprints: TabletopBlueprint[]
}

export interface CardCmsApi {
  openProject: () => Promise<ProjectSnapshot | null>
  openProjectPath: (path: string) => Promise<ProjectSnapshot | null>
  loadRecent: () => Promise<ProjectSnapshot | null>
  listProjects: () => Promise<ProjectSummary[]>
  saveCards: (cards: Card[]) => Promise<void>
  saveColumns: (columns: ColumnDefinition[]) => Promise<void>
  saveVariables: (variables: ProjectVariable[]) => Promise<ProjectSnapshot>
  resolveIcon: (reference: string) => Promise<string | null>
  searchIcons: (query: string, library: 'all' | 'tabletop' | 'project') => Promise<{ items: ProjectIconReference[]; total: number }>
  selectSet: (id: string) => Promise<ProjectSnapshot>
  renameSet: (id: string, name: string) => Promise<ProjectSnapshot>
  deleteSet: (id: string) => Promise<ProjectSnapshot>
  importWorkbooks: (plans: ImportPlan[]) => Promise<ProjectSnapshot>
  previewWorkbookMerge: (file: string, setId: string, matchFieldId?: string, fieldIds?: string[], restoreFieldIds?: string[]) => Promise<WorkbookMergePreview>
  applyWorkbookMerge: (token: string, resolutions: Record<string, 'excel' | 'set'>) => Promise<ProjectSnapshot>
  createSet: (name: string) => Promise<ProjectSnapshot>
  scanWorkbooks: () => Promise<WorkbookInfo[]>
  importAssets: () => Promise<ProjectAsset[]>
  gitStatus: () => Promise<GitStatus>
  gitInit: () => Promise<GitStatus>
  gitConnect: (remoteUrl: string) => Promise<GitStatus>
  gitCommit: (message: string) => Promise<GitStatus>
  gitPull: () => Promise<GitStatus>
  gitPush: () => Promise<GitStatus>
  gitRevert: (hash: string) => Promise<GitStatus>
  openGitHub: () => Promise<void>
  exportExcel: (cardIds?: string[]) => Promise<{ path: string; count: number } | null>
}

declare global {
  interface Window { cardCms: CardCmsApi }
}
