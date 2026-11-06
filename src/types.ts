export type CardStatus = 'Idea' | 'Design' | 'Playtest' | 'Ready'

export interface Card {
  id: string
  title: string
  status: CardStatus
  tags: string[]
  quantity: number
  values: Record<string, string>
  updatedAt: string
  nativeItem?: Record<string, unknown>
}

export interface ImportBaselineRow {
  cardId: string
  values: Record<string, string>
}

export type RuleOperator = 'is_set' | 'is_empty' | 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than'

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
  type?: 'text' | 'number' | 'select' | 'image' | 'longtext' | 'variable' | 'color' | 'id'
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
  nativeSetFile?: string
  nativeSetIndex?: number
  nativeSetHash?: string
  /** True when CMS changes of this linked set could not be written to the native file yet. */
  nativeSyncPending?: boolean
  blueprintName?: string
}

export type NativeSyncStatus = 'synced' | 'conflict' | 'error'

export interface NativeSetInfo {
  file: string
  index: number
  name: string
  blueprintName: string
  itemCount: number
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

export interface BlueprintFieldOption {
  header: string
  type: NonNullable<ColumnDefinition['type']>
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

export interface GitCommitFile {
  path: string
  binary: boolean
  content?: string
}

export interface MarkdownDocument {
  path: string
  content: string
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
  branches: string[]
  error: string
}

export interface GitHubAuthStatus {
  configured: boolean
  authenticated: boolean
  login: string
  avatarUrl: string
  appInstalled: boolean
  error?: string
}

export interface GitHubDeviceLogin {
  userCode: string
  verificationUri: string
  intervalSeconds: number
  expiresAt: number
}

export type GitHubLoginPollResult =
  | { status: 'pending'; intervalSeconds?: number }
  | { status: 'complete'; auth: GitHubAuthStatus }
  | { status: 'expired' }

export interface GitHubRepositoryResult {
  name: string
  htmlUrl: string
  isPrivate: boolean
  pushed: boolean
  warning: string
  status: GitStatus
}

export interface GitHubProjectRepository {
  id: number
  name: string
  fullName: string
  description: string
  htmlUrl: string
  isPrivate: boolean
  updatedAt: string
  avatarUrl: string
  projectType: 'Tabletop Creator' | 'Card Studio' | 'Foglio Excel'
}

export interface ProjectSnapshot {
  projectPath: string
  projectName: string
  cards: Card[]
  columns: ColumnDefinition[]
  sets: Array<
    Pick<ProjectSet, 'id' | 'name' | 'sourceFile' | 'nativeSetFile' | 'nativeSetIndex' | 'blueprintName'> & {
      cardCount: number
    }
  >
  activeSetId: string | null
  workbooks: WorkbookInfo[]
  assets: ProjectAsset[]
  variables: ProjectVariable[]
  blueprints: TabletopBlueprint[]
  nativeSets: NativeSetInfo[]
  /** Sync state of every set linked to a Tabletop Creator file, keyed by set id. */
  nativeSync: Record<string, NativeSyncStatus>
}

/** A newer release: `ready` is downloaded and installs on restart; `available` (macOS) links to the download. */
export type UpdateStatus = { kind: 'ready'; version: string } | { kind: 'available'; version: string; url: string }

export interface CardCmsApi {
  onNotice: (callback: (message: string) => void) => () => void
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void
  getUpdateStatus: () => Promise<UpdateStatus | null>
  applyUpdate: () => Promise<void>
  onSnapshot: (callback: (snapshot: ProjectSnapshot) => void) => () => void
  openDiagnosticLog: () => Promise<string>
  writeDiagnostic: (event: string, details?: Record<string, string | number | boolean | undefined>) => Promise<void>
  openProject: () => Promise<ProjectSnapshot | null>
  openProjectPath: (path: string) => Promise<ProjectSnapshot | null>
  loadRecent: () => Promise<ProjectSnapshot | null>
  listProjects: () => Promise<ProjectSummary[]>
  saveCards: (cards: Card[]) => Promise<void>
  saveColumns: (columns: ColumnDefinition[]) => Promise<void>
  saveVariables: (variables: ProjectVariable[]) => Promise<ProjectSnapshot>
  resolveIcon: (reference: string) => Promise<string | null>
  searchIcons: (
    query: string,
    library: 'all' | 'tabletop' | 'project',
  ) => Promise<{ items: ProjectIconReference[]; total: number }>
  selectSet: (id: string) => Promise<ProjectSnapshot>
  renameSet: (id: string, name: string) => Promise<ProjectSnapshot>
  deleteSet: (id: string) => Promise<ProjectSnapshot>
  importWorkbooks: (plans: ImportPlan[]) => Promise<ProjectSnapshot>
  previewWorkbookMerge: (
    file: string,
    setId: string,
    matchFieldId?: string,
    fieldIds?: string[],
    restoreFieldIds?: string[],
  ) => Promise<WorkbookMergePreview>
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
  gitSwitchBranch: (name: string) => Promise<GitStatus>
  gitCreateBranch: (name: string, commit?: string) => Promise<GitStatus>
  gitDeleteBranch: (name: string) => Promise<GitStatus>
  githubAuthStatus: () => Promise<GitHubAuthStatus>
  githubStartLogin: () => Promise<GitHubDeviceLogin>
  githubPollLogin: () => Promise<GitHubLoginPollResult>
  githubCancelLogin: () => Promise<void>
  githubLogout: () => Promise<GitHubAuthStatus>
  githubCreateRepository: (name: string, isPrivate: boolean) => Promise<GitHubRepositoryResult>
  githubListProjectRepositories: () => Promise<GitHubProjectRepository[]>
  githubCloneProjectRepository: (fullName: string) => Promise<ProjectSnapshot | null>
  openGitHubDeviceLogin: () => Promise<void>
  openGitHubAppInstall: () => Promise<void>
  openGitHubRepository: (url: string) => Promise<void>
  gitCommitFiles: (hash: string) => Promise<string[]>
  gitCommitFile: (hash: string, file: string) => Promise<GitCommitFile>
  markdownList: () => Promise<string[]>
  markdownRead: (file: string) => Promise<MarkdownDocument>
  markdownSave: (file: string, content: string) => Promise<MarkdownDocument>
  markdownCreate: (file: string) => Promise<MarkdownDocument>
  markdownRename: (file: string, newName: string) => Promise<MarkdownDocument>
  markdownDelete: (file: string) => Promise<void>
  reloadBlueprints: () => Promise<ProjectSnapshot>
  openGitHub: () => Promise<void>
  exportExcel: (cardIds?: string[]) => Promise<{ path: string; count: number } | null>
  linkNativeSet: (setId: string, file: string, index: number) => Promise<ProjectSnapshot>
  createNativeSet: (setId: string, name: string, blueprintName: string) => Promise<ProjectSnapshot>
  resolveNativeSetNameConflict: (setId: string, resolution: 'card-studio' | 'tabletop') => Promise<ProjectSnapshot>
  resolveNativeConflict: (setId: string, resolution: 'reload' | 'overwrite') => Promise<ProjectSnapshot>
  unlinkNativeSet: (setId: string) => Promise<ProjectSnapshot>
  saveBlueprintAssignments: (assignments: Record<string, string>) => Promise<ProjectSnapshot>
  duplicateSet: (setId: string) => Promise<ProjectSnapshot>
  moveCard: (cardId: string, targetSetId: string, draft?: Card) => Promise<ProjectSnapshot>
}

declare global {
  interface Window {
    cardCms: CardCmsApi
  }
}
