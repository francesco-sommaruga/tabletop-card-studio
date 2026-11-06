import { app, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '../src/types'
import { writeDiagnostic } from './diagnostics'
import { state } from './state'

const RELEASES_API = 'https://api.github.com/repos/francesco-sommaruga/tabletop-card-studio/releases/latest'
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

// Last known update, kept so a renderer that (re)loads after the event still gets it.
let currentStatus: UpdateStatus | null = null

function publishStatus(status: UpdateStatus) {
  currentStatus = status
  state.win?.webContents.send('update:status', status)
}

/** Compares dotted numeric versions ("v0.2.60" vs "0.2.59"); true when `candidate` is newer. */
export function isNewerVersion(candidate: string, current: string) {
  const parse = (version: string) => version.replace(/^v/, '').split('.').map(Number)
  const [a, b] = [parse(candidate), parse(current)]
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff > 0
  }
  return false
}

// Unsigned macOS builds cannot self-install, so only announce the release and link to it.
async function checkMacRelease() {
  const response = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } })
  if (!response.ok) throw new Error(`GitHub releases API responded ${response.status}`)
  const release = (await response.json()) as { tag_name: string; html_url: string }
  if (isNewerVersion(release.tag_name, app.getVersion())) {
    publishStatus({ kind: 'available', version: release.tag_name.replace(/^v/, ''), url: release.html_url })
  }
}

function startAutoUpdater() {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.on('update-downloaded', (info) => publishStatus({ kind: 'ready', version: info.version }))
  autoUpdater.on('error', (error) => void writeDiagnostic('error', 'update.failed', { message: error.message }))
}

async function checkForUpdates() {
  try {
    if (process.platform === 'darwin') await checkMacRelease()
    else await autoUpdater.checkForUpdates()
  } catch (error) {
    void writeDiagnostic('error', 'update.check-failed', { message: (error as Error).message })
  }
}

/** Checks GitHub releases at startup and every few hours; packaged builds only. */
export function initUpdater() {
  if (!app.isPackaged) return
  if (process.platform !== 'darwin') startAutoUpdater()
  void checkForUpdates()
  setInterval(() => void checkForUpdates(), CHECK_INTERVAL_MS)
}

export function getUpdateStatus() {
  return currentStatus
}

/** Restarts into the downloaded update (Windows/Linux) or opens the release page (macOS). */
export async function applyUpdate() {
  if (currentStatus?.kind === 'ready') autoUpdater.quitAndInstall()
  else if (currentStatus?.kind === 'available') await shell.openExternal(currentStatus.url)
}
