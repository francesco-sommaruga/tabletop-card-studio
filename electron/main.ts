import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { state } from './state'
import { writeDiagnostic } from './diagnostics'
import { registerIpcHandlers } from './ipc'

async function createWindow() {
  await writeDiagnostic('info', 'window.create', {
    appVersion: app.getVersion(),
    packaged: app.isPackaged,
    platform: process.platform,
  })
  const iconPath = path.join(
    __dirname,
    app.isPackaged ? '../../renderer-dist/tabletop-card-studio.png' : '../../public/tabletop-card-studio.png',
  )
  state.win = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#f4f0e8',
    title: 'Tabletop Card Studio',
    icon: iconPath,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  })
  if (process.env.VITE_DEV_SERVER_URL) await state.win.loadURL(process.env.VITE_DEV_SERVER_URL)
  else await state.win.loadFile(path.join(__dirname, '../../renderer-dist/index.html'))
}

app.whenReady().then(() => {
  void writeDiagnostic('info', 'app.ready', {
    appVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
  })
  registerIpcHandlers()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
