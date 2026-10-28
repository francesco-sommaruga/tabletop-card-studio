import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } from 'electron'
import { execFile } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import ExcelJS from 'exceljs'
import type { Card, ColumnDefinition, GitCommitSummary, GitFileStatus, GitStatus, ImportPlan, ProjectAsset, ProjectSet, ProjectSnapshot, ProjectSummary, ProjectVariable, WorkbookInfo } from '../src/types'

let win: BrowserWindow | null = null
let activeProject = ''
let projectName = ''
let sets: ProjectSet[] = []
let activeSetId: string | null = null
let workbooks: WorkbookInfo[] = []
let assets: ProjectAsset[] = []
let variables: ProjectVariable[] = []
const dataDirName = '.tabletop-card-studio'
const defaultColumns: ColumnDefinition[] = [
  { id: 'column_title', header: 'title', fieldId: 'meta_title', type: 'text' },
  { id: 'column_quantity', header: '[Item Amount]', fieldId: 'meta_quantity', type: 'number' },
]

function fieldIdFor(header: string) {
  return `field_${header.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unnamed'}`
}

function activeSet() { return sets.find((set) => set.id === activeSetId) ?? null }

function snapshot(): ProjectSnapshot {
  const current = activeSet()
  return {
    projectPath: activeProject,
    projectName,
    cards: current?.cards ?? [],
    columns: current?.columns ?? [],
    sets: sets.map(({ id, name, sourceFile, cards }) => ({ id, name, sourceFile, cardCount: cards.length })),
    activeSetId,
    workbooks,
    assets,
    variables,
  }
}

async function persistSets() {
  if (!activeProject) return
  const dir = path.join(activeProject, dataDirName)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'sets.json'), JSON.stringify(sets, null, 2))
}

function simpleCellText(value: ExcelJS.CellValue | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object' && 'text' in value) return String(value.text ?? '')
  if (typeof value === 'object' && 'richText' in value) return value.richText.map((part) => part.text).join('')
  if (typeof value === 'object' && 'result' in value) return String(value.result ?? '')
  return String(value)
}

async function workbookInfo(filePath: string): Promise<WorkbookInfo> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  const sheet = workbook.worksheets[0]
  const headers: string[] = []
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => { if (cell.text.trim()) headers.push(cell.text.trim()) })
  let rowCount = 0
  for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
    let hasContent = false
    sheet.getRow(rowIndex).eachCell((cell) => { if (cell.text.trim()) hasContent = true })
    if (hasContent) rowCount += 1
  }
  return { file: path.basename(filePath), rowCount, headers }
}

async function scanWorkbooks(): Promise<WorkbookInfo[]> {
  const entries = await fs.readdir(activeProject, { withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile() && /\.xlsx$/i.test(entry.name) && !entry.name.startsWith('~$') && !entry.name.startsWith('.~') && !/-cms-export\.xlsx$/i.test(entry.name))
    .map((entry) => path.join(activeProject, entry.name))
  const results = await Promise.all(files.map(async (file) => {
    try { return await workbookInfo(file) } catch { return null }
  }))
  return results.filter((item): item is WorkbookInfo => item !== null).sort((a, b) => a.file.localeCompare(b.file, 'it'))
}

function guessFieldType(header: string): ColumnDefinition['type'] {
  return /amount|quantit|costo|cost|speed|potenza|numero|count/i.test(header) ? 'number' : /text|effetto|description|descrizione|regole/i.test(header) ? 'longtext' : 'text'
}

async function readPlannedWorkbook(filePath: string, plan: ImportPlan): Promise<ProjectSet> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  const sheet = workbook.worksheets[0]
  const headerEntries: Array<{ header: string; index: number }> = []
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, index) => {
    const header = cell.text.trim()
    if (header && plan.fields.some((field) => field.header === header)) headerEntries.push({ header, index })
  })
  const titleHeader = headerEntries.find(({ header }) => ['title', 'titolo', 'name', 'nome'].includes(header.toLowerCase()))?.header
  const quantityHeader = headerEntries.find(({ header }) => ['[item amount]', 'amount', 'quantità', 'quantita'].includes(header.toLowerCase()))?.header
  const columns: ColumnDefinition[] = headerEntries.map(({ header }) => {
    const field = plan.fields.find((item) => item.header === header)!
    return {
      id: `column_${fieldIdFor(header)}`,
      header,
      fieldId: header === titleHeader ? 'meta_title' : header === quantityHeader ? 'meta_quantity' : fieldIdFor(header),
      type: field.type ?? guessFieldType(header),
      options: field.options,
    }
  })
  const cards: Card[] = []
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber)
    const values: Record<string, string> = {}
    for (const entry of headerEntries) values[fieldIdFor(entry.header)] = simpleCellText(row.getCell(entry.index).value)
    if (!Object.values(values).some((value) => value.trim())) continue
    const quantity = Number(quantityHeader ? values[fieldIdFor(quantityHeader)] : 1)
    cards.push({
      id: `card_${crypto.randomUUID()}`,
      title: titleHeader ? values[fieldIdFor(titleHeader)] || `Carta ${cards.length + 1}` : `Carta ${cards.length + 1}`,
      status: 'Idea',
      tags: [],
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      values,
      updatedAt: new Date().toISOString(),
    })
  }
  return { id: `set_${crypto.randomUUID()}`, name: plan.name.trim() || path.parse(plan.file).name, sourceFile: path.basename(plan.file), cards, columns }
}

async function scanAssets(): Promise<ProjectAsset[]> {
  const assetRoot = path.join(activeProject, 'assets')
  const found: string[] = []
  const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif'])
  async function walk(dir: string) {
    if (found.length >= 300) return
    let entries
    try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(entryPath)
      else if (entry.isFile() && allowed.has(path.extname(entry.name).toLowerCase())) found.push(entryPath)
      if (found.length >= 300) break
    }
  }
  await walk(assetRoot)
  const mimeFor: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.avif': 'image/avif' }
  return Promise.all(found.map(async (file) => {
    const relative = path.relative(activeProject, file).split(path.sep).join('/')
    const ext = path.extname(file).toLowerCase()
    let previewUrl = ''
    try {
      const image = nativeImage.createFromPath(file)
      if (!image.isEmpty()) previewUrl = image.resize({ width: 180, height: 180, quality: 'good' }).toDataURL()
      else if (ext === '.svg') previewUrl = `data:image/svg+xml;base64,${(await fs.readFile(file)).toString('base64')}`
    } catch { /* an asset without a preview remains assignable by name */ }
    return { path: relative, name: path.basename(file), mime: mimeFor[ext] ?? 'application/octet-stream', previewUrl }
  }))
}

async function loadVariables(): Promise<ProjectVariable[]> {
  try {
    const json = JSON.parse(await fs.readFile(path.join(activeProject, 'data', 'variables.json'), 'utf8'))
    const source: ProjectVariable[] = Array.isArray(json.variables) ? json.variables.filter((item: unknown): item is ProjectVariable => typeof item === 'object' && item !== null && 'code' in item && typeof (item as Record<string, unknown>).code === 'string') : []
    let tagMap: Record<string, string[]> = {}
    try {
      const metadata = JSON.parse(await fs.readFile(path.join(activeProject, dataDirName, 'variable-tags.json'), 'utf8'))
      if (metadata && typeof metadata === 'object' && metadata.variables && typeof metadata.variables === 'object') tagMap = metadata.variables
    } catch { /* no CMS tag metadata yet */ }
    return source.map((variable) => ({ ...variable, studioTags: tagMap[variable.code.toLocaleLowerCase()] ?? variable.studioTags ?? [] }))
  } catch { return [] }
}

async function persistProjectList() {
  const listPath = path.join(app.getPath('userData'), 'projects.json')
  let list: Array<{ path: string; lastOpened: string }> = []
  try { list = JSON.parse(await fs.readFile(listPath, 'utf8')) } catch { /* first project */ }
  list = [{ path: activeProject, lastOpened: new Date().toISOString() }, ...list.filter((entry) => entry.path !== activeProject)]
  await fs.writeFile(listPath, JSON.stringify(list, null, 2))
}

async function openProject(folder: string): Promise<ProjectSnapshot> {
  activeProject = folder
  projectName = path.basename(folder)
  const storeDir = path.join(folder, dataDirName)
  const setsFile = path.join(storeDir, 'sets.json')
  if (existsSync(setsFile)) {
    sets = JSON.parse(await fs.readFile(setsFile, 'utf8'))
  } else {
    const legacyCards = path.join(storeDir, 'cards.json')
    const legacyColumns = path.join(storeDir, 'columns.json')
    if (existsSync(legacyCards)) {
      const cards: Card[] = JSON.parse(await fs.readFile(legacyCards, 'utf8'))
      const columns: ColumnDefinition[] = existsSync(legacyColumns) ? JSON.parse(await fs.readFile(legacyColumns, 'utf8')) : defaultColumns
      sets = [{ id: `set_${crypto.randomUUID()}`, name: 'Set principale', sourceFile: existsSync(path.join(folder, 'cards.xlsx')) ? 'cards.xlsx' : undefined, cards, columns }]
      await persistSets()
    } else {
      sets = []
    }
  }
  activeSetId = sets[0]?.id ?? null
  workbooks = await scanWorkbooks()
  assets = await scanAssets()
  variables = await loadVariables()
  await fs.mkdir(storeDir, { recursive: true })
  await persistProjectList()
  return snapshot()
}

async function listProjects(): Promise<ProjectSummary[]> {
  const listPath = path.join(app.getPath('userData'), 'projects.json')
  let entries: Array<{ path: string; lastOpened?: string }> = []
  try { entries = JSON.parse(await fs.readFile(listPath, 'utf8')) } catch {
    try {
      const recent = JSON.parse(await fs.readFile(path.join(app.getPath('userData'), 'recent-project.json'), 'utf8'))
      if (existsSync(recent.folder)) entries = [{ path: recent.folder }]
    } catch { /* no projects saved */ }
  }
  const result: ProjectSummary[] = []
  for (const entry of entries) {
    if (!existsSync(entry.path)) continue
    const dataDir = path.join(entry.path, dataDirName)
    let projectSets: ProjectSet[] = []
    try { projectSets = JSON.parse(await fs.readFile(path.join(dataDir, 'sets.json'), 'utf8')) } catch {
      try {
        const cards: Card[] = JSON.parse(await fs.readFile(path.join(dataDir, 'cards.json'), 'utf8'))
        projectSets = [{ id: 'legacy', name: 'Set principale', cards, columns: [] }]
      } catch { /* new project */ }
    }
    const files = await fs.readdir(entry.path, { withFileTypes: true })
    const fileCount = files.filter((file) => file.isFile() && /\.xlsx$/i.test(file.name) && !file.name.startsWith('~$') && !/-cms-export\.xlsx$/i.test(file.name)).length
    result.push({ path: entry.path, name: path.basename(entry.path), setCount: projectSets.length, cardCount: projectSets.reduce((sum, set) => sum + set.cards.length, 0), fileCount, lastOpened: entry.lastOpened })
  }
  return result
}

function runGit(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: activeProject, timeout: 45_000, maxBuffer: 2 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const detail = stderr.trim() || stdout.trim() || error.message
        reject(new Error(detail))
      } else resolve({ stdout: stdout.trim(), stderr: stderr.trim() })
    })
  })
}

function githubWebUrl(remote: string) {
  const https = remote.match(/^https?:\/\/github\.com\/([^\s]+?)(?:\.git)?\/?$/i)
  if (https) return `https://github.com/${https[1].replace(/\.git$/i, '')}`
  const ssh = remote.match(/^git@github\.com:([^\s]+?)(?:\.git)?$/i)
  if (ssh) return `https://github.com/${ssh[1].replace(/\.git$/i, '')}`
  return ''
}

async function readGitStatus(): Promise<GitStatus> {
  const empty: GitStatus = { isRepo: false, branch: '', remoteUrl: '', githubUrl: '', changedFiles: [], ahead: 0, behind: 0, commits: [], error: '' }
  if (!activeProject) return empty
  try { await runGit(['rev-parse', '--is-inside-work-tree']) } catch { return empty }
  try {
    const [branchResult, statusResult, remoteResult, logResult] = await Promise.all([
      runGit(['branch', '--show-current']).catch(() => ({ stdout: '(detached HEAD)', stderr: '' })),
      runGit(['status', '--porcelain=v1']),
      runGit(['remote', 'get-url', 'origin']).catch(() => ({ stdout: '', stderr: '' })),
      runGit(['log', '-5', '--format=%h%x09%s%x09%cr']).catch(() => ({ stdout: '', stderr: '' })),
    ])
    const changedFiles: GitFileStatus[] = statusResult.stdout.split('\n').filter(Boolean).map((line) => ({ status: line.slice(0, 2).trim() || 'M', path: line.slice(3) }))
    let ahead = 0
    let behind = 0
    try {
      const counts = await runGit(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'])
      const [left, right] = counts.stdout.split(/\s+/).map(Number)
      ahead = left || 0
      behind = right || 0
    } catch { /* no upstream configured yet */ }
    const commits: GitCommitSummary[] = logResult.stdout.split('\n').filter(Boolean).map((line) => {
      const [hash = '', subject = '', age = ''] = line.split('\t')
      return { hash, subject, age }
    })
    const remoteUrl = remoteResult.stdout
    return { isRepo: true, branch: branchResult.stdout, remoteUrl, githubUrl: githubWebUrl(remoteUrl), changedFiles, ahead, behind, commits, error: '' }
  } catch (error) {
    return { ...empty, isRepo: true, error: error instanceof Error ? error.message : String(error) }
  }
}

async function gitAction(action: () => Promise<void>): Promise<GitStatus> {
  try { await action(); return await readGitStatus() }
  catch (error) {
    const current = await readGitStatus()
    return { ...current, error: error instanceof Error ? error.message : String(error) }
  }
}

async function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 940, minWidth: 1080, minHeight: 700,
    backgroundColor: '#f4f0e8', title: 'Tabletop Card Studio',
    icon: path.join(__dirname, '../../renderer-dist/tabletop-card-studio.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  })
  if (process.env.VITE_DEV_SERVER_URL) await win.loadURL(process.env.VITE_DEV_SERVER_URL)
  else await win.loadFile(path.join(__dirname, '../../renderer-dist/index.html'))
}

app.whenReady().then(() => {
  ipcMain.handle('project:open', async () => {
    const result = await dialog.showOpenDialog(win!, { title: 'Aggiungi cartella progetto', properties: ['openDirectory'] })
    return result.canceled ? null : openProject(result.filePaths[0])
  })
  ipcMain.handle('project:open-path', async (_event, folder: string) => existsSync(folder) ? openProject(folder) : null)
  ipcMain.handle('project:recent', async () => null)
  ipcMain.handle('projects:list', listProjects)
  ipcMain.handle('git:status', readGitStatus)
  ipcMain.handle('git:init', () => gitAction(async () => { await runGit(['init']) }))
  ipcMain.handle('git:connect', (_event, remoteUrl: string) => gitAction(async () => {
    const trimmed = remoteUrl.trim()
    const valid = /^(https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?|git@github\.com:[\w.-]+\/[\w.-]+(?:\.git)?)$/i.test(trimmed)
    if (!valid) throw new Error('Inserisci un URL GitHub valido, in formato HTTPS o SSH.')
    try { await runGit(['rev-parse', '--is-inside-work-tree']) } catch { await runGit(['init']) }
    try { await runGit(['remote', 'get-url', 'origin']); await runGit(['remote', 'set-url', 'origin', trimmed]) }
    catch { await runGit(['remote', 'add', 'origin', trimmed]) }
  }))
  ipcMain.handle('git:commit', (_event, message: string) => gitAction(async () => {
    if (!message.trim()) throw new Error('Scrivi un messaggio per il commit.')
    await runGit(['add', '-A'])
    await runGit(['commit', '-m', message.trim()])
  }))
  ipcMain.handle('git:pull', () => gitAction(async () => { await runGit(['pull', '--ff-only']) }))
  ipcMain.handle('git:push', () => gitAction(async () => {
    const branch = (await runGit(['branch', '--show-current'])).stdout
    if (!branch) throw new Error('Seleziona un branch prima di inviare le modifiche.')
    await runGit(['push', '--set-upstream', 'origin', branch])
  }))
  ipcMain.handle('github:open', async () => {
    const status = await readGitStatus()
    if (status.githubUrl) await shell.openExternal(status.githubUrl)
  })
  ipcMain.handle('cards:save', async (_event, nextCards: Card[]) => {
    const current = activeSet()
    if (!current) return
    current.cards = nextCards
    await persistSets()
  })
  ipcMain.handle('columns:save', async (_event, nextColumns: ColumnDefinition[]) => {
    const current = activeSet()
    if (!current) return
    current.columns = nextColumns
    await persistSets()
  })
  ipcMain.handle('variables:save', async (_event, nextVariables: ProjectVariable[]) => {
    if (!activeProject) throw new Error('Apri prima un progetto Tabletop Creator.')
    const filePath = path.join(activeProject, 'data', 'variables.json')
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    let document: Record<string, unknown> = { json_version: 5, variables: [] }
    try {
      const existing = JSON.parse(await fs.readFile(filePath, 'utf8'))
      if (existing && typeof existing === 'object' && !Array.isArray(existing)) document = existing
    } catch { /* create the variables file when it does not exist yet */ }
    document.variables = nextVariables.map(({ studioTags: _studioTags, ...variable }) => variable)
    await fs.writeFile(filePath, JSON.stringify(document, null, 2))
    const tagMap = Object.fromEntries(nextVariables
      .filter((variable) => variable.studioTags?.length)
      .map((variable) => [variable.code.toLocaleLowerCase(), [...new Set(variable.studioTags!.map((tag) => tag.trim()).filter(Boolean))]]))
    const metadataPath = path.join(activeProject, dataDirName, 'variable-tags.json')
    await fs.mkdir(path.dirname(metadataPath), { recursive: true })
    await fs.writeFile(metadataPath, JSON.stringify({ variables: tagMap }, null, 2))
    variables = nextVariables
    return snapshot()
  })
  ipcMain.handle('sets:select', async (_event, id: string) => { if (sets.some((set) => set.id === id)) activeSetId = id; return snapshot() })
  ipcMain.handle('sets:create', async (_event, name: string) => {
    const set: ProjectSet = { id: `set_${crypto.randomUUID()}`, name: name.trim() || 'Nuovo set', cards: [], columns: structuredClone(defaultColumns) }
    sets.push(set)
    activeSetId = set.id
    await persistSets()
    return snapshot()
  })
  ipcMain.handle('workbooks:scan', async () => { workbooks = await scanWorkbooks(); return workbooks })
  ipcMain.handle('workbooks:import', async (_event, plans: ImportPlan[]) => {
    const imported: ProjectSet[] = []
    for (const plan of plans) {
      if (sets.some((set) => set.sourceFile === path.basename(plan.file))) continue
      const importedSet = await readPlannedWorkbook(path.join(activeProject, path.basename(plan.file)), plan)
      sets.push(importedSet)
      imported.push(importedSet)
    }
    activeSetId = imported[0]?.id ?? activeSetId
    await persistSets()
    workbooks = await scanWorkbooks()
    return snapshot()
  })
  ipcMain.handle('assets:import', async () => {
    const result = await dialog.showOpenDialog(win!, { title: 'Aggiungi asset al progetto', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Immagini', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif'] }] })
    if (!result.canceled) {
      const targetDir = path.join(activeProject, 'assets', 'card-studio')
      await fs.mkdir(targetDir, { recursive: true })
      for (const source of result.filePaths) {
        const ext = path.extname(source)
        const stem = path.basename(source, ext)
        let target = path.join(targetDir, path.basename(source))
        let suffix = 2
        while (existsSync(target)) target = path.join(targetDir, `${stem}-${suffix++}${ext}`)
        await fs.copyFile(source, target)
      }
      assets = await scanAssets()
    }
    return assets
  })
  ipcMain.handle('project:export', async () => {
    const current = activeSet()
    if (!activeProject || !current) return null
    const slug = current.name.trim().replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'set'
    const file = path.join(activeProject, `${slug}-cms-export.xlsx`)
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Cards')
    worksheet.addRow(current.columns.map((column) => column.header))
    for (const card of current.cards) {
      worksheet.addRow(current.columns.map((column) => {
        const value = column.fieldId === 'meta_title' ? card.title : column.fieldId === 'meta_quantity' ? card.quantity : column.fieldId === 'meta_status' ? card.status : column.fieldId === 'meta_tags' ? card.tags.join(', ') : (card.values[column.fieldId] ?? '')
        const imageValue = String(value)
        const isWindowsPath = /^[a-z]:[\\/]/i.test(imageValue)
        return column.type === 'image' && value && !path.isAbsolute(imageValue) && !isWindowsPath ? path.resolve(activeProject, imageValue) : value
      }))
    }
    await workbook.xlsx.writeFile(file)
    return { path: file, count: current.cards.length }
  })
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
