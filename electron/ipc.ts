import { ipcMain, shell } from 'electron'
import { existsSync } from 'node:fs'
import type { Card, ColumnDefinition, ImportPlan, ProjectVariable } from '../src/types'
import { importAssets } from './assets'
import { reloadBlueprints } from './blueprints'
import { openDiagnosticLog, writeRendererDiagnostic, registerLoggedHandler } from './diagnostics'
import { runExclusive } from './exclusive'
import {
  readGitStatus,
  gitAction,
  initGitRepository,
  connectGitRemote,
  commitAllChanges,
  switchGitBranch,
  createGitBranch,
  deleteGitBranch,
  listGitCommitFiles,
  readGitCommitFile,
  openGitHubRemotePage,
} from './git'
import {
  githubAuthStatus,
  startGithubLogin,
  pollGithubLogin,
  cancelGithubLogin,
  logoutGithub,
  openGitHubAppInstall,
} from './github/auth'
import { listGitHubProjectRepositories, cloneGitHubProjectRepository, openGitHubRepository } from './github/discovery'
import { createGitHubRepository, pullFromGitHub, pushToGitHub } from './github/repository'
import { resolveProjectIcon, searchAvailableIcons } from './icons'
import {
  listMarkdownFiles,
  readMarkdownFile,
  saveMarkdownFile,
  createMarkdownFile,
  renameMarkdownFile,
  deleteMarkdownFile,
} from './markdown'
import { connectNativeSet, createNativeSet, disconnectNativeSet, resolveNativeSetNameConflict } from './native/link'
import { resolveNativeConflict } from './native/sync'
import { openProjectFromDialog, openProject, listProjects } from './project'
import {
  saveActiveCards,
  saveActiveColumns,
  saveBlueprintAssignments,
  selectSet,
  duplicateProjectSet,
  moveCardBetweenSets,
  renameSet,
  deleteSet,
  createSet,
} from './sets'
import { applyUpdate, getUpdateStatus } from './updater'
import { saveVariables } from './variables'
import { exportActiveSet } from './workbooks/export'
import { rescanWorkbooks, importWorkbooks } from './workbooks/import'
import { previewWorkbookMerge, applyWorkbookMerge } from './workbooks/merge'

export function registerIpcHandlers() {
  ipcMain.handle('diagnostics:open', openDiagnosticLog)
  ipcMain.handle(
    'diagnostics:renderer',
    (_event, event: string, details?: Record<string, string | number | boolean | undefined>) =>
      writeRendererDiagnostic(event, details),
  )
  ipcMain.handle('update:status', getUpdateStatus)
  ipcMain.handle('update:apply', applyUpdate)
  ipcMain.handle('project:open', () => openProjectFromDialog())
  ipcMain.handle('project:open-path', async (_event, folder: string) =>
    existsSync(folder) ? openProject(folder) : null,
  )
  ipcMain.handle('project:recent', async () => null)
  ipcMain.handle('projects:list', listProjects)
  ipcMain.handle('blueprints:reload', () => reloadBlueprints())
  ipcMain.handle('git:status', readGitStatus)
  ipcMain.handle('github:auth-status', githubAuthStatus)
  ipcMain.handle('github:login-start', () => startGithubLogin())
  ipcMain.handle('github:login-poll', () => pollGithubLogin())
  ipcMain.handle('github:login-cancel', () => cancelGithubLogin())
  ipcMain.handle('github:logout', () => logoutGithub())
  ipcMain.handle('github:repo-create', (_event, name: string, isPrivate: boolean) =>
    createGitHubRepository(name, isPrivate),
  )
  ipcMain.handle('github:project-repos-list', listGitHubProjectRepositories)
  ipcMain.handle('github:project-repo-clone', (_event, fullName: string) => cloneGitHubProjectRepository(fullName))
  ipcMain.handle('github:login-open', () => shell.openExternal('https://github.com/login/device'))
  ipcMain.handle('github:install-open', openGitHubAppInstall)
  ipcMain.handle('github:repository-open', (_event, url: string) => openGitHubRepository(url))
  ipcMain.handle('git:init', () => gitAction(() => initGitRepository()))
  ipcMain.handle('git:connect', (_event, remoteUrl: string) => gitAction(() => connectGitRemote(remoteUrl)))
  ipcMain.handle('git:commit', (_event, message: string) => gitAction(() => commitAllChanges(message)))
  ipcMain.handle('git:pull', () => gitAction(() => pullFromGitHub()))
  ipcMain.handle('git:push', () => gitAction(() => pushToGitHub()))
  ipcMain.handle('git:branch-switch', (_event, name: string) => gitAction(() => switchGitBranch(name)))
  ipcMain.handle('git:branch-create', (_event, name: string, commit?: string) =>
    gitAction(() => createGitBranch(name, commit)),
  )
  ipcMain.handle('git:branch-delete', (_event, name: string) => gitAction(() => deleteGitBranch(name)))
  ipcMain.handle('git:commit-files', (_event, hash: string) => listGitCommitFiles(hash))
  ipcMain.handle('git:commit-file', (_event, hash: string, file: string) => readGitCommitFile(hash, file))
  ipcMain.handle('markdown:list', () => listMarkdownFiles())
  ipcMain.handle('markdown:read', (_event, file: string) => readMarkdownFile(file))
  ipcMain.handle('markdown:save', (_event, file: string, content: string) => saveMarkdownFile(file, content))
  ipcMain.handle('markdown:create', (_event, fileName: string) => createMarkdownFile(fileName))
  ipcMain.handle('markdown:rename', (_event, file: string, newName: string) => renameMarkdownFile(file, newName))
  ipcMain.handle('markdown:delete', (_event, file: string) => deleteMarkdownFile(file))
  ipcMain.handle('github:open', () => openGitHubRemotePage())
  registerLoggedHandler('cards:save', async (nextCards: Card[]) => saveActiveCards(nextCards))
  registerLoggedHandler('columns:save', async (nextColumns: ColumnDefinition[]) => saveActiveColumns(nextColumns))
  registerLoggedHandler('blueprints:assignments-save', async (assignments: Record<string, string>) =>
    saveBlueprintAssignments(assignments),
  )
  ipcMain.handle('variables:save', (_event, nextVariables: ProjectVariable[]) => saveVariables(nextVariables))
  registerLoggedHandler('sets:select', async (id: string) => selectSet(id))
  registerLoggedHandler('sets:link-native', async (setId: string, file: string, index: number) =>
    connectNativeSet(setId, file, index),
  )
  registerLoggedHandler('sets:create-native', async (setId: string, name: string, blueprintName: string) =>
    createNativeSet(setId, name, blueprintName),
  )
  registerLoggedHandler('sets:unlink-native', async (setId: string) => disconnectNativeSet(setId))
  registerLoggedHandler('sets:resolve-name-conflict', async (setId: string, resolution: 'card-studio' | 'tabletop') =>
    resolveNativeSetNameConflict(setId, resolution),
  )
  registerLoggedHandler('sets:resolve-native-conflict', async (setId: string, resolution: 'reload' | 'overwrite') =>
    resolveNativeConflict(setId, resolution),
  )
  registerLoggedHandler('sets:duplicate', async (setId: string) => duplicateProjectSet(setId))
  registerLoggedHandler('cards:move', async (cardId: string, targetSetId: string, draft?: Card) =>
    moveCardBetweenSets(cardId, targetSetId, draft),
  )
  registerLoggedHandler('sets:rename', async (id: string, name: string) => renameSet(id, name))
  registerLoggedHandler('sets:delete', async (id: string) => deleteSet(id))
  registerLoggedHandler('sets:create', async (name: string) => createSet(name))
  ipcMain.handle('workbooks:scan', () => rescanWorkbooks())
  ipcMain.handle('workbooks:import', (_event, plans: ImportPlan[]) => runExclusive(() => importWorkbooks(plans)))
  ipcMain.handle(
    'workbooks:merge-preview',
    async (
      _event,
      file: string,
      setId: string,
      matchFieldId?: string,
      fieldIds?: string[],
      restoreFieldIds?: string[],
    ) => previewWorkbookMerge(file, setId, matchFieldId, fieldIds, restoreFieldIds),
  )
  ipcMain.handle('workbooks:merge-apply', async (_event, token: string, resolutions: Record<string, 'excel' | 'set'>) =>
    runExclusive(() => applyWorkbookMerge(token, resolutions)),
  )
  ipcMain.handle('assets:import', () => importAssets())
  ipcMain.handle('icons:resolve', (_event, reference: string) => resolveProjectIcon(reference))
  ipcMain.handle('icons:search', (_event, query: string, library: 'all' | 'tabletop' | 'project') =>
    searchAvailableIcons(query, library),
  )
  ipcMain.handle('project:export', (_event, cardIds?: string[]) => exportActiveSet(cardIds))
}
