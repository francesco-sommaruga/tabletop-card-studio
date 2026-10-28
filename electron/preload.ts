import { contextBridge, ipcRenderer } from 'electron'
import type { Card, ColumnDefinition, GitStatus, ImportPlan, ProjectSnapshot, ProjectAsset, ProjectSummary, ProjectVariable, WorkbookInfo } from '../src/types'

contextBridge.exposeInMainWorld('cardCms', {
  openProject: () => ipcRenderer.invoke('project:open') as Promise<ProjectSnapshot | null>,
  openProjectPath: (projectPath: string) => ipcRenderer.invoke('project:open-path', projectPath) as Promise<ProjectSnapshot | null>,
  loadRecent: () => ipcRenderer.invoke('project:recent') as Promise<ProjectSnapshot | null>,
  listProjects: () => ipcRenderer.invoke('projects:list') as Promise<ProjectSummary[]>,
  saveCards: (cards: Card[]) => ipcRenderer.invoke('cards:save', cards) as Promise<void>,
  saveColumns: (columns: ColumnDefinition[]) => ipcRenderer.invoke('columns:save', columns) as Promise<void>,
  saveVariables: (variables: ProjectVariable[]) => ipcRenderer.invoke('variables:save', variables) as Promise<ProjectSnapshot>,
  selectSet: (id: string) => ipcRenderer.invoke('sets:select', id) as Promise<ProjectSnapshot>,
  importWorkbooks: (plans: ImportPlan[]) => ipcRenderer.invoke('workbooks:import', plans) as Promise<ProjectSnapshot>,
  createSet: (name: string) => ipcRenderer.invoke('sets:create', name) as Promise<ProjectSnapshot>,
  scanWorkbooks: () => ipcRenderer.invoke('workbooks:scan') as Promise<WorkbookInfo[]>,
  importAssets: () => ipcRenderer.invoke('assets:import') as Promise<ProjectAsset[]>,
  gitStatus: () => ipcRenderer.invoke('git:status') as Promise<GitStatus>,
  gitInit: () => ipcRenderer.invoke('git:init') as Promise<GitStatus>,
  gitConnect: (remoteUrl: string) => ipcRenderer.invoke('git:connect', remoteUrl) as Promise<GitStatus>,
  gitCommit: (message: string) => ipcRenderer.invoke('git:commit', message) as Promise<GitStatus>,
  gitPull: () => ipcRenderer.invoke('git:pull') as Promise<GitStatus>,
  gitPush: () => ipcRenderer.invoke('git:push') as Promise<GitStatus>,
  openGitHub: () => ipcRenderer.invoke('github:open') as Promise<void>,
  exportExcel: () => ipcRenderer.invoke('project:export') as Promise<{ path: string; count: number } | null>,
})
