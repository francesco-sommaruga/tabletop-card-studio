import { app, ipcMain, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { state } from './state'

let diagnosticQueue: Promise<void> = Promise.resolve()

function diagnosticFilePath() {
  return path.join(app.getPath('userData'), 'logs', 'tabletop-card-studio.log')
}

export function writeDiagnostic(level: 'info' | 'error', event: string, details: Record<string, unknown> = {}) {
  const record =
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      event,
      projectPath: state.activeProject || undefined,
      ...details,
    }) + '\n'
  diagnosticQueue = diagnosticQueue
    .then(async () => {
      const file = diagnosticFilePath()
      await fs.mkdir(path.dirname(file), { recursive: true })
      await fs.appendFile(file, record, 'utf8')
    })
    .catch((error) => {
      console.error('Card Studio diagnostic log failed:', error)
    })
  return diagnosticQueue
}

function summarizeDiagnosticArgs(channel: string, args: unknown[]) {
  if (channel === 'cards:save') return { cardCount: Array.isArray(args[0]) ? args[0].length : undefined }
  if (channel === 'columns:save') return { columnCount: Array.isArray(args[0]) ? args[0].length : undefined }
  if (channel === 'cards:move') return { cardId: args[0], targetSetId: args[1] }
  if (channel === 'blueprints:assignments-save')
    return { setIds: args[0] && typeof args[0] === 'object' ? Object.keys(args[0] as object) : [] }
  if (channel === 'sets:link-native') return { setId: args[0], file: args[1], index: args[2] }
  if (channel === 'sets:create-native') return { setId: args[0], name: args[1], blueprintName: args[2] }
  if (channel === 'sets:resolve-name-conflict') return { setId: args[0], resolution: args[1] }
  if (channel === 'sets:rename') return { setId: args[0], name: args[1] }
  if (channel === 'sets:create') return { name: args[0] }
  if (
    channel === 'sets:select' ||
    channel === 'sets:unlink-native' ||
    channel === 'sets:duplicate' ||
    channel === 'sets:delete'
  )
    return { setId: args[0] }
  return {}
}

export function registerLoggedHandler(channel: string, handler: (...args: any[]) => unknown) {
  ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
    const operationId = crypto.randomUUID()
    const details = summarizeDiagnosticArgs(channel, args)
    const startedAt = Date.now()
    const transactional =
      channel.startsWith('sets:') ||
      channel === 'cards:save' ||
      channel === 'columns:save' ||
      channel === 'cards:move' ||
      channel === 'blueprints:assignments-save'
    const previousSets = transactional ? structuredClone(state.sets) : null
    const previousActiveSetId = state.activeSetId
    const previousNativeSets = transactional ? structuredClone(state.nativeSets) : null
    await writeDiagnostic('info', 'operation.started', { operationId, channel, details })
    try {
      const result = await handler(...args)
      await writeDiagnostic('info', 'operation.succeeded', { operationId, channel, durationMs: Date.now() - startedAt })
      return result
    } catch (error) {
      if (previousSets) state.sets = previousSets
      if (transactional) {
        state.activeSetId = previousActiveSetId
        state.nativeSets = previousNativeSets ?? state.nativeSets
      }
      await writeDiagnostic('error', 'operation.failed', {
        operationId,
        channel,
        durationMs: Date.now() - startedAt,
        details,
        error:
          error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
      })
      throw error
    }
  })
}

export async function openDiagnosticLog() {
  const file = diagnosticFilePath()
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.appendFile(file, '')
  await writeDiagnostic('info', 'diagnostic-log.opened')
  const openError = await shell.openPath(file)
  if (openError) throw new Error(`Impossibile aprire il log: ${openError}`)
  return file
}

export async function writeRendererDiagnostic(
  event: string,
  details?: Record<string, string | number | boolean | undefined>,
) {
  const safeDetails = Object.fromEntries(
    Object.entries(details ?? {})
      .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
      .map(([key, value]) => [key.slice(0, 80), typeof value === 'string' ? value.slice(0, 2000) : value]),
  )
  await writeDiagnostic('error', `renderer.${String(event).slice(0, 100)}`, safeDetails)
}
