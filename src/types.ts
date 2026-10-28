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

export interface ColumnDefinition {
  id: string
  header: string
  fieldId: string
  type?: 'text' | 'number' | 'select' | 'image' | 'longtext' | 'variable'
  options?: string[]
  variableTags?: string[]
}

export interface ProjectSet {
  id: string
  name: string
  sourceFile?: string
  cards: Card[]
  columns: ColumnDefinition[]
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

export interface ProjectVariable {
  code: string
  replacement: string
  force_tint?: string
  color?: string
  studioTags?: string[]
  [key: string]: unknown
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
}

export interface CardCmsApi {
  openProject: () => Promise<ProjectSnapshot | null>
  openProjectPath: (path: string) => Promise<ProjectSnapshot | null>
  loadRecent: () => Promise<ProjectSnapshot | null>
  listProjects: () => Promise<ProjectSummary[]>
  saveCards: (cards: Card[]) => Promise<void>
  saveColumns: (columns: ColumnDefinition[]) => Promise<void>
  saveVariables: (variables: ProjectVariable[]) => Promise<ProjectSnapshot>
  selectSet: (id: string) => Promise<ProjectSnapshot>
  importWorkbooks: (plans: ImportPlan[]) => Promise<ProjectSnapshot>
  createSet: (name: string) => Promise<ProjectSnapshot>
  scanWorkbooks: () => Promise<WorkbookInfo[]>
  importAssets: () => Promise<ProjectAsset[]>
  gitStatus: () => Promise<GitStatus>
  gitInit: () => Promise<GitStatus>
  gitConnect: (remoteUrl: string) => Promise<GitStatus>
  gitCommit: (message: string) => Promise<GitStatus>
  gitPull: () => Promise<GitStatus>
  gitPush: () => Promise<GitStatus>
  openGitHub: () => Promise<void>
  exportExcel: () => Promise<{ path: string; count: number } | null>
}

declare global {
  interface Window { cardCms: CardCmsApi }
}
