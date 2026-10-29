import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } from 'electron'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import ExcelJS from 'exceljs'
import type { Card, ColumnDefinition, GitCommitSummary, GitFileStatus, GitStatus, ImportPlan, MergeFieldChange, MergeFieldConflict, NativeSetInfo, ProjectAsset, ProjectIconReference, ProjectSet, ProjectSnapshot, ProjectSummary, ProjectVariable, TabletopBlueprint, WorkbookInfo, WorkbookMergePreview } from '../src/types'
import { resolveConditionalValues } from '../src/conditional'

let win: BrowserWindow | null = null
let activeProject = ''
let projectName = ''
let sets: ProjectSet[] = []
let activeSetId: string | null = null
let workbooks: WorkbookInfo[] = []
let assets: ProjectAsset[] = []
let variables: ProjectVariable[] = []
let blueprints: TabletopBlueprint[] = []
let nativeSets: NativeSetInfo[] = []
let iconCatalogCache: { projectPath: string; roots: string; icons: ProjectIconReference[] } | null = null
const pendingMerges = new Map<string, { setId: string; matchFieldId: string; incoming: Card[]; selectedFieldIds: string[]; baselineFieldIds: string[]; restoreColumns: ColumnDefinition[] }>()
const dataDirName = '.tabletop-card-studio'
const defaultColumns: ColumnDefinition[] = [
  { id: 'column_title', header: 'title', fieldId: 'meta_title', type: 'text' },
  { id: 'column_quantity', header: '[Item Amount]', fieldId: 'meta_quantity', type: 'number' },
]

function fieldIdFor(header: string) {
  return `field_${header.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unnamed'}`
}

function importedFieldIdFor(header: string) {
  const lower = header.toLocaleLowerCase()
  if (['title', 'titolo', 'name', 'nome'].includes(lower)) return 'meta_title'
  if (['[item amount]', 'amount', 'quantità', 'quantita'].includes(lower)) return 'meta_quantity'
  return fieldIdFor(header)
}

function activeSet() { return sets.find((set) => set.id === activeSetId) ?? null }

function snapshot(): ProjectSnapshot {
  const current = activeSet()
  return {
    projectPath: activeProject,
    projectName,
    cards: current?.cards ?? [],
    columns: current?.columns ?? [],
    sets: sets.map(({ id, name, sourceFile, nativeSetFile, nativeSetIndex, cards }) => ({ id, name, sourceFile, nativeSetFile, nativeSetIndex, cardCount: cards.length })),
    activeSetId,
    workbooks,
    assets,
    variables,
    blueprints,
    nativeSets,
  }
}

async function persistSets(syncNative = true) {
  if (!activeProject) return
  const dir = path.join(activeProject, dataDirName)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'sets.json'), JSON.stringify(sets, null, 2))
  if (syncNative) {
    const nativeGroups = new Map<string, ProjectSet[]>()
    for (const set of sets) if (set.nativeSetFile) {
      const file = path.basename(set.nativeSetFile)
      nativeGroups.set(file, [...(nativeGroups.get(file) ?? []), set])
    }
    for (const group of nativeGroups.values()) await writeLinkedNativeSets(group)
    await fs.writeFile(path.join(dir, 'sets.json'), JSON.stringify(sets, null, 2))
  }
}

function simpleCellText(value: ExcelJS.CellValue | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object' && 'text' in value) return String(value.text ?? '')
  if (typeof value === 'object' && 'richText' in value) return value.richText.map((part) => part.text).join('')
  if (typeof value === 'object' && 'result' in value) return String(value.result ?? '')
  return String(value)
}

function cardFieldValue(card: Card, fieldId: string): string {
  if (fieldId === 'meta_title') return card.title
  if (fieldId === 'meta_quantity') return String(card.quantity)
  if (fieldId === 'meta_status') return card.status
  if (fieldId === 'meta_tags') return card.tags.join(', ')
  return card.values[fieldId] ?? ''
}

function mergeKey(value: string): string { return value.trim().toLocaleLowerCase() }

function tabletopAssetReference(value: string): string {
  const normalized = value.trim().replace(/\\/g, '/')
  if (!normalized) return ''
  const lower = normalized.toLocaleLowerCase()
  const assetsMarker = lower.lastIndexOf('/assets/')
  const tabletopReference = (reference: string) => reference.startsWith('images/card-studio/') ? reference.slice('images/'.length) : reference
  if (assetsMarker >= 0) return tabletopReference(normalized.slice(assetsMarker + '/assets/'.length))
  if (lower.startsWith('assets/')) return tabletopReference(normalized.slice('assets/'.length))
  if (normalized.startsWith('/') || /^[a-z]:\//i.test(normalized)) return path.posix.basename(normalized)
  return tabletopReference(normalized.replace(/^\.\//, '').replace(/^\/+/, ''))
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
  return /color|colour|colore/i.test(header) ? 'color' : /image|immagine|illustrazione|artwork/i.test(header) ? 'image' : /amount|quantit|costo|cost|speed|potenza|numero|count/i.test(header) ? 'number' : /text|effetto|description|descrizione|regole/i.test(header) ? 'longtext' : 'text'
}

async function workbookRestoreFields(filePath: string, set: ProjectSet) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  const sheet = workbook.worksheets[0]
  const currentHeaders = new Set(set.columns.map((column) => column.header.trim().toLocaleLowerCase()))
  const currentIds = new Set(set.columns.map((column) => column.fieldId))
  const restoreFields: Array<{ id: string; header: string; type: NonNullable<ColumnDefinition['type']> }> = []
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
    const header = cell.text.trim()
    if (!header || currentHeaders.has(header.toLocaleLowerCase())) return
    const id = importedFieldIdFor(header)
    if (currentIds.has(id) || restoreFields.some((field) => field.id === id)) return
    restoreFields.push({ id, header, type: guessFieldType(header) ?? 'text' })
  })
  return restoreFields
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
  const importMatchFieldId = titleHeader ? 'meta_title' : columns[0]?.fieldId
  const importBaseline = cards.map((card) => ({ cardId: card.id, values: Object.fromEntries(columns.map((column) => [column.fieldId, cardFieldValue(card, column.fieldId)])) }))
  return { id: `set_${crypto.randomUUID()}`, name: plan.name.trim() || path.parse(plan.file).name, sourceFile: path.basename(plan.file), cards, columns, importBaseline, importMatchFieldId }
}

async function readWorkbookRowsForSet(filePath: string, set: ProjectSet): Promise<{ cards: Card[]; importedFieldIds: string[] }> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  const sheet = workbook.worksheets[0]
  const byHeader = new Map(set.columns.map((column) => [column.header.trim().toLocaleLowerCase(), column]))
  const entries: Array<{ index: number; column: ColumnDefinition }> = []
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, index) => {
    const column = byHeader.get(cell.text.trim().toLocaleLowerCase())
    if (column && !entries.some((entry) => entry.column.fieldId === column.fieldId)) entries.push({ index, column })
  })
  const importedFieldIds = [...new Set(entries.map(({ column }) => column.fieldId))]
  if (!entries.length) throw new Error('Il foglio non contiene intestazioni riconosciute dal set.')
  const cards: Card[] = []
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber)
    const values: Record<string, string> = {}
    for (const { index, column } of entries) values[column.fieldId] = simpleCellText(row.getCell(index).value)
    if (!Object.values(values).some((value) => value.trim())) continue
    const title = values.meta_title?.trim() || `Carta ${cards.length + 1}`
    const parsedQuantity = Number(values.meta_quantity ?? 1)
    cards.push({
      id: `incoming_${crypto.randomUUID()}`,
      title,
      status: 'Idea',
      tags: [],
      quantity: Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1,
      values,
      updatedAt: new Date().toISOString(),
    })
  }
  return { cards, importedFieldIds }
}

async function previewWorkbookMerge(file: string, setId: string, requestedMatchFieldId?: string, requestedFieldIds?: string[], requestedRestoreFieldIds?: string[]): Promise<WorkbookMergePreview> {
  const set = sets.find((item) => item.id === setId)
  if (!set) throw new Error('Il set da aggiornare non esiste più.')
  if (set.sourceFile !== path.basename(file)) throw new Error('Questo foglio non è collegato al set selezionato.')
  const filePath = path.join(activeProject, path.basename(file))
  const restoreFields = await workbookRestoreFields(filePath, set)
  const restoredFieldIds = restoreFields.filter((field) => requestedRestoreFieldIds?.includes(field.id)).map((field) => field.id)
  const restoreColumns: ColumnDefinition[] = restoreFields.filter((field) => restoredFieldIds.includes(field.id)).map((field) => ({ id: `column_${field.id}`, header: field.header, fieldId: field.id, type: field.type }))
  const effectiveSet = restoreColumns.length ? { ...set, columns: [...set.columns, ...restoreColumns] } : set
  const { cards: incoming, importedFieldIds } = await readWorkbookRowsForSet(filePath, effectiveSet)
  const matchFields = set.columns.filter((column, index, all) => importedFieldIds.includes(column.fieldId) && all.findIndex((candidate) => candidate.fieldId === column.fieldId) === index).map((column) => ({ id: column.fieldId, label: column.header }))
  if (!matchFields.length) throw new Error('Non trovo colonne del foglio corrispondenti ai campi del set.')
  const matchFieldId = matchFields.some((field) => field.id === requestedMatchFieldId)
    ? requestedMatchFieldId!
    : matchFields.some((field) => field.id === set.importMatchFieldId)
      ? set.importMatchFieldId!
      : matchFields.find((field) => field.id === 'meta_title')?.id ?? matchFields[0].id
  const selectedIds = new Set(requestedFieldIds ?? importedFieldIds)
  const selectedFieldIds = importedFieldIds.filter((fieldId) => selectedIds.has(fieldId))
  const baselineFieldIds = [...new Set([...selectedFieldIds, matchFieldId])]

  const baselineByCardId = new Map((set.importBaseline ?? []).map((row) => [row.cardId, row.values]))
  const legacyBaseline = !set.importBaseline?.length
  const existingByKey = new Map<string, Card>()
  const existingKeyCounts = new Map<string, number>()
  for (const card of set.cards) {
    const baseline = baselineByCardId.get(card.id)
    const keyValue = baseline && Object.prototype.hasOwnProperty.call(baseline, matchFieldId) ? baseline[matchFieldId] : cardFieldValue(card, matchFieldId)
    const key = mergeKey(keyValue)
    if (!key) continue
    existingKeyCounts.set(key, (existingKeyCounts.get(key) ?? 0) + 1)
    existingByKey.set(key, card)
  }
  const incomingKeyCounts = new Map<string, number>()
  for (const card of incoming) {
    const key = mergeKey(cardFieldValue(card, matchFieldId))
    incomingKeyCounts.set(key, (incomingKeyCounts.get(key) ?? 0) + 1)
  }
  const duplicateKeys = [...new Set([
    ...[...existingKeyCounts].filter(([, count]) => count > 1).map(([key]) => key),
    ...[...incomingKeyCounts].filter(([, count]) => count > 1).map(([key]) => key),
    ...[...incomingKeyCounts.keys()].filter((key) => !key),
  ])]
  const duplicateSet = new Set(duplicateKeys)
  const conflicts: MergeFieldConflict[] = []
  const automaticChanges: MergeFieldChange[] = []
  const preservedLocalChanges: MergeFieldChange[] = []
  const newTitles: string[] = []
  const seenCards = new Set<string>()
  let matchedRows = 0
  let unchangedRows = 0

  for (const incomingCard of incoming) {
    const key = mergeKey(cardFieldValue(incomingCard, matchFieldId))
    if (!key || duplicateSet.has(key)) continue
    const current = existingByKey.get(key)
    if (!current) { newTitles.push(incomingCard.title); continue }
    matchedRows += 1
    seenCards.add(current.id)
    const baseline = baselineByCardId.get(current.id)
    let changed = false
    for (const fieldId of selectedFieldIds) {
      const currentValue = cardFieldValue(current, fieldId)
      const incomingValue = cardFieldValue(incomingCard, fieldId)
      const header = set.columns.find((column) => column.fieldId === fieldId)?.header ?? fieldId
      if (currentValue === incomingValue) continue
      changed = true
      const hasBaselineValue = baseline && Object.prototype.hasOwnProperty.call(baseline, fieldId)
      const baselineValue = hasBaselineValue ? baseline[fieldId] : currentValue
      if (legacyBaseline || !hasBaselineValue) {
        conflicts.push({ conflictId: `${current.id}::${fieldId}`, cardId: current.id, cardTitle: current.title, fieldId, header, currentValue, incomingValue })
        continue
      }
      const currentChanged = currentValue !== baselineValue
      const incomingChanged = incomingValue !== baselineValue
      if (currentChanged && incomingChanged) conflicts.push({ conflictId: `${current.id}::${fieldId}`, cardId: current.id, cardTitle: current.title, fieldId, header, currentValue, incomingValue })
      else if (incomingChanged) automaticChanges.push({ cardId: current.id, cardTitle: current.title, fieldId, header, currentValue, incomingValue, source: 'excel' })
      else preservedLocalChanges.push({ cardId: current.id, cardTitle: current.title, fieldId, header, currentValue, incomingValue, source: 'set' })
    }
    if (!changed) unchangedRows += 1
  }
  const missingTitles = set.cards.filter((card) => !seenCards.has(card.id)).map((card) => card.title)
  const token = crypto.randomUUID()
  pendingMerges.clear()
  pendingMerges.set(token, { setId, matchFieldId, incoming, selectedFieldIds, baselineFieldIds, restoreColumns })
  const importFields = effectiveSet.columns.filter((column, index, all) => importedFieldIds.includes(column.fieldId) && all.findIndex((candidate) => candidate.fieldId === column.fieldId) === index).map((column) => ({ id: column.fieldId, label: column.header }))
  return { token, setId, setName: set.name, file: path.basename(file), matchFieldId, matchFields, importFields, selectedFieldIds, restoreFields, restoredFieldIds, matchedRows, unchangedRows, newTitles, missingTitles, automaticChanges, preservedLocalChanges, conflicts, duplicateKeys, legacyBaseline }
}

async function applyWorkbookMerge(token: string, resolutions: Record<string, 'excel' | 'set'>): Promise<ProjectSnapshot> {
  const pending = pendingMerges.get(token)
  if (!pending) throw new Error('La prévisualizzazione del merge è scaduta. Riapri il confronto con il foglio.')
  const set = sets.find((item) => item.id === pending.setId)
  if (!set) throw new Error('Il set da aggiornare non esiste più.')
  for (const column of pending.restoreColumns) if (!set.columns.some((existing) => existing.fieldId === column.fieldId)) set.columns.push(column)
  const baselineByCardId = new Map((set.importBaseline ?? []).map((row) => [row.cardId, { ...row.values }]))
  const existingByKey = new Map<string, Card>()
  for (const card of set.cards) {
    const baseline = baselineByCardId.get(card.id)
    const keyValue = baseline && Object.prototype.hasOwnProperty.call(baseline, pending.matchFieldId) ? baseline[pending.matchFieldId] : cardFieldValue(card, pending.matchFieldId)
    const key = mergeKey(keyValue)
    if (key) existingByKey.set(key, card)
  }
  const addedCards: Card[] = []
  const now = new Date().toISOString()
  for (const incoming of pending.incoming) {
    const key = mergeKey(cardFieldValue(incoming, pending.matchFieldId))
    if (!key) continue
    const current = existingByKey.get(key)
    if (!current) {
      const newFieldIds = [...new Set([...pending.selectedFieldIds, pending.matchFieldId])]
      const added = { ...incoming, id: `card_${crypto.randomUUID()}`, title: newFieldIds.includes('meta_title') ? incoming.title : `Carta ${set.cards.length + addedCards.length + 1}`, status: 'Idea' as const, tags: [], quantity: newFieldIds.includes('meta_quantity') ? incoming.quantity : 1, values: Object.fromEntries(newFieldIds.map((fieldId) => [fieldId, incoming.values[fieldId] ?? ''])), updatedAt: now }
      addedCards.push(added)
      baselineByCardId.set(added.id, Object.fromEntries(pending.baselineFieldIds.map((fieldId) => [fieldId, cardFieldValue(incoming, fieldId)])))
      continue
    }
    const baseline = baselineByCardId.get(current.id) ?? {}
    const next: Card = { ...current, values: { ...current.values } }
    for (const fieldId of pending.selectedFieldIds) {
      const currentValue = cardFieldValue(current, fieldId)
      const incomingValue = cardFieldValue(incoming, fieldId)
      const fieldChanged = currentValue !== incomingValue
      const conflictKey = `${current.id}::${fieldId}`
      if (fieldChanged && resolutions[conflictKey] === 'excel') {
        if (fieldId === 'meta_title') next.title = incoming.title
        else if (fieldId === 'meta_quantity') next.quantity = incoming.quantity
        else if (!['meta_status', 'meta_tags'].includes(fieldId)) next.values[fieldId] = incoming.values[fieldId] ?? ''
      } else if (fieldChanged && !Object.prototype.hasOwnProperty.call(baseline, fieldId) && currentValue === '' && !Object.prototype.hasOwnProperty.call(resolutions, conflictKey)) {
        // Legacy imported sets have no prior baseline; fill empty fields while preserving non-empty local values.
        if (fieldId === 'meta_title') next.title = incoming.title
        else if (fieldId === 'meta_quantity') next.quantity = incoming.quantity
        else if (!['meta_status', 'meta_tags'].includes(fieldId)) next.values[fieldId] = incoming.values[fieldId] ?? ''
      } else if (fieldChanged && Object.prototype.hasOwnProperty.call(baseline, fieldId) && currentValue === baseline[fieldId] && cardFieldValue(incoming, fieldId) !== baseline[fieldId]) {
        if (fieldId === 'meta_title') next.title = incoming.title
        else if (fieldId === 'meta_quantity') next.quantity = incoming.quantity
        else if (!['meta_status', 'meta_tags'].includes(fieldId)) next.values[fieldId] = incoming.values[fieldId] ?? ''
      }
      baseline[fieldId] = incomingValue
    }
    for (const fieldId of pending.baselineFieldIds) baseline[fieldId] = cardFieldValue(incoming, fieldId)
    if (JSON.stringify(next) !== JSON.stringify(current)) next.updatedAt = now
    const index = set.cards.findIndex((card) => card.id === current.id)
    if (index >= 0) set.cards[index] = next
    baselineByCardId.set(current.id, baseline)
  }
  set.cards.push(...addedCards)
  set.cards = set.cards.map((card) => resolveConditionalValues(set.columns, card))
  set.importBaseline = [...baselineByCardId].map(([cardId, values]) => ({ cardId, values }))
  set.importMatchFieldId = pending.matchFieldId
  activeSetId = set.id
  pendingMerges.delete(token)
  await persistSets()
  workbooks = await scanWorkbooks()
  return snapshot()
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
    const relative = path.relative(assetRoot, file).split(path.sep).join('/').replace(/^images\/card-studio\//, 'card-studio/')
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

function tabletopBuiltInIconRoots(): string[] {
  const home = app.getPath('home')
  const steamRoots = [
    process.env.STEAM_DIR,
    process.env.STEAM_COMPAT_CLIENT_INSTALL_PATH,
    path.join(home, '.local', 'share', 'Steam'),
    path.join(home, '.steam', 'steam'),
    path.join(home, 'Library', 'Application Support', 'Steam'),
    process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)']!, 'Steam') : undefined,
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Steam') : undefined,
  ].filter((item): item is string => Boolean(item))
  const libraries = new Set(steamRoots)
  for (const root of steamRoots) {
    try {
      const config = readFileSync(path.join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8')
      for (const match of config.matchAll(/"path"\s+"([^"]+)"/g)) libraries.add(match[1].replace(/\\\\/g, '\\'))
    } catch { /* Steam may be installed outside this location */ }
  }
  const roots: string[] = []
  for (const library of libraries) {
    for (const folder of ['TabletopCreatorPro', 'Tabletop Creator Pro', 'TabletopCreator']) {
      const game = path.join(library, 'steamapps', 'common', folder)
      roots.push(path.join(game, 'Assets_BuiltIn', 'icons'))
      for (const appName of ['Tabletop Creator Pro.app', 'TabletopCreator.app', 'Tabletop Creator.app']) {
        roots.push(path.join(game, appName, 'Contents', 'Resources', 'Assets_BuiltIn', 'icons'))
      }
    }
  }
  return [...new Set(roots)].filter((root) => existsSync(root))
}

async function collectIcons(root: string, library: ProjectIconReference['library']): Promise<ProjectIconReference[]> {
  const result: ProjectIconReference[] = []
  const supported = new Set(['.png', '.svg', '.webp', '.jpg', '.jpeg'])
  const visit = async (directory: string) => {
    let entries
    try { entries = await fs.readdir(directory, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(file)
      else if (entry.isFile() && supported.has(path.extname(entry.name).toLowerCase())) {
        const relative = path.relative(root, file).split(path.sep).join('/')
        const extension = path.extname(relative)
        const name = path.basename(relative, extension)
        const reference = library === 'tabletop' ? relative.slice(0, -extension.length) : relative
        result.push({ reference, name, category: path.posix.dirname(relative) === '.' ? '' : path.posix.dirname(relative), library })
      }
    }
  }
  await visit(root)
  return result
}

async function searchAvailableIcons(query: string, library: 'all' | 'tabletop' | 'project') {
  if (!activeProject) return { items: [] as ProjectIconReference[], total: 0 }
  const roots = [...tabletopBuiltInIconRoots()]
  const rootKey = roots.join('|')
  if (!iconCatalogCache || iconCatalogCache.projectPath !== activeProject || iconCatalogCache.roots !== rootKey) {
    const projectIcons = await collectIcons(path.join(activeProject, 'assets', 'icons'), 'project')
    const builtInIcons = (await Promise.all(roots.map((root) => collectIcons(root, 'tabletop')))).flat()
    const deduplicated = new Map<string, ProjectIconReference>()
    for (const item of [...projectIcons, ...builtInIcons]) deduplicated.set(`${item.library}:${item.reference.toLocaleLowerCase()}`, item)
    iconCatalogCache = { projectPath: activeProject, roots: rootKey, icons: [...deduplicated.values()].sort((a, b) => a.reference.localeCompare(b.reference, 'en', { numeric: true, sensitivity: 'base' })) }
  }
  const term = query.trim().toLocaleLowerCase()
  const matching = iconCatalogCache.icons.filter((icon) => (library === 'all' || icon.library === library) && (!term || `${icon.reference} ${icon.name} ${icon.category}`.toLocaleLowerCase().includes(term)))
  return { items: matching.slice(0, 120), total: matching.length }
}

async function resolveProjectIcon(reference: string): Promise<string | null> {
  const normalized = reference.trim().replace(/\\/g, '/').replace(/^\{\s*|\s*\}$/g, '')
  if (!normalized || normalized.split('/').some((part) => part === '..')) return null
  const relative = normalized.replace(/^icons\//i, '')
  const projectRoot = path.join(activeProject, 'assets', 'icons')
  const roots = [projectRoot, ...tabletopBuiltInIconRoots()]
  const extensions = path.extname(relative) ? [''] : ['.png', '.svg', '.webp', '.jpg', '.jpeg']
  for (const root of roots) {
    for (const extension of extensions) {
      const file = path.join(root, ...relative.split('/')) + extension
      if (!existsSync(file)) continue
      const ext = path.extname(file).toLowerCase()
      try {
        if (ext === '.svg') return `data:image/svg+xml;base64,${(await fs.readFile(file)).toString('base64')}`
        const image = nativeImage.createFromPath(file)
        if (!image.isEmpty()) return image.resize({ width: 160, height: 160, quality: 'good' }).toDataURL()
      } catch { /* an unsupported icon remains identifiable by its name */ }
    }
  }
  return null
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
    let typeMap: Record<string, 'text' | 'color' | 'icon'> = {}
    try {
      const metadata = JSON.parse(await fs.readFile(path.join(activeProject, dataDirName, 'variable-types.json'), 'utf8'))
      if (metadata && typeof metadata === 'object' && metadata.variables && typeof metadata.variables === 'object') typeMap = metadata.variables
    } catch { /* no CMS variable type metadata yet */ }
    return source.map((variable) => ({ ...variable, studioTags: tagMap[variable.code.toLocaleLowerCase()] ?? variable.studioTags ?? [], studioType: typeMap[variable.code.toLocaleLowerCase()] ?? variable.studioType ?? 'text' }))
  } catch { return [] }
}

function sha256(data: string | Buffer) { return createHash('sha256').update(data).digest('hex') }

async function scanNativeSets(): Promise<NativeSetInfo[]> {
  const directory = path.join(activeProject, 'data', 'sets')
  let files: string[]
  try { files = (await fs.readdir(directory)).filter((file) => file.toLowerCase().endsWith('.json')).sort() }
  catch { return [] }
  const result: NativeSetInfo[] = []
  for (const file of files) {
    try {
      const document = JSON.parse(await fs.readFile(path.join(directory, file), 'utf8'))
      if (!Array.isArray(document.sets)) continue
      document.sets.forEach((set: Record<string, unknown>, index: number) => {
        if (typeof set.name !== 'string' || !Array.isArray(set.items)) return
        result.push({ file, index, name: set.name, blueprintName: typeof set.blueprint_name === 'string' ? set.blueprint_name : '', itemCount: set.items.length })
      })
    } catch { /* ignore malformed or incomplete JSON files */ }
  }
  return result
}

function columnIdForNativeHeader(header: string) {
  if (['title', 'name', 'nome', 'titolo'].includes(header.trim().toLocaleLowerCase())) return 'meta_title'
  if (['[item amount]', 'amount', 'quantità', 'quantita'].includes(header.trim().toLocaleLowerCase())) return 'meta_quantity'
  return fieldIdFor(header)
}

function columnsFromNativeItems(items: Record<string, unknown>[], existing: ColumnDefinition[]): ColumnDefinition[] {
  const headers = new Set<string>(['[Item Amount]', 'title'])
  for (const item of items) {
    const details = Array.isArray(item.details) ? item.details : []
    for (const detail of details) {
      if (!detail || typeof detail !== 'object') continue
      const record = detail as { name?: unknown; data?: unknown }
      if (typeof record.name !== 'string' || !record.data || typeof record.data !== 'object') continue
      for (const property of Object.keys(record.data)) headers.add(property === 'value' ? record.name : `${record.name}:${property}`)
    }
  }
  return [...headers].map((header) => {
    const prior = existing.find((column) => column.header.toLocaleLowerCase() === header.toLocaleLowerCase())
    const fieldId = columnIdForNativeHeader(header)
    return { ...(prior ?? {}), id: prior?.id ?? `column_${fieldId}`, header, fieldId, type: prior?.type ?? guessFieldType(header) ?? 'text' }
  })
}

function nativeValue(detailMap: Map<string, Record<string, unknown>>, header: string): unknown {
  const separator = header.lastIndexOf(':')
  const name = separator >= 0 ? header.slice(0, separator) : header
  const property = separator >= 0 ? header.slice(separator + 1) : 'value'
  return (detailMap.get(name) ?? {})[property]
}

function nativeCard(title: string, item: Record<string, unknown>, columns: ColumnDefinition[], existing?: Card): Card {
  const detailMap = new Map<string, Record<string, unknown>>()
  for (const detail of Array.isArray(item.details) ? item.details : []) {
    if (!detail || typeof detail !== 'object') continue
    const record = detail as { name?: unknown; data?: unknown }
    if (typeof record.name === 'string' && record.data && typeof record.data === 'object') detailMap.set(record.name, record.data as Record<string, unknown>)
  }
  const titleValue = String(nativeValue(detailMap, 'title') ?? title)
  const values: Record<string, string> = {}
  for (const column of columns) {
    if (column.fieldId === 'meta_title' || column.fieldId === 'meta_quantity') continue
    const value = nativeValue(detailMap, column.header)
    if (value !== null && value !== undefined) values[column.fieldId] = String(value)
  }
  const modified = Number(item.last_modification_date_unix)
  return {
    id: existing?.id ?? `card_${crypto.randomUUID()}`,
    title: titleValue,
    status: existing?.status ?? 'Idea',
    tags: existing?.tags ? [...existing.tags] : [],
    quantity: Math.max(1, Number(item.amount) || 1),
    values: { ...(existing?.values ?? {}), ...values },
    updatedAt: existing?.updatedAt ?? (Number.isFinite(modified) && modified > 0 ? new Date(modified * 1000).toISOString() : new Date().toISOString()),
    nativeItem: JSON.parse(JSON.stringify(item)),
  }
}

function nativeItemFromCard(card: Card, columns: ColumnDefinition[]): Record<string, unknown> {
  const item = card.nativeItem ? JSON.parse(JSON.stringify(card.nativeItem)) as Record<string, unknown> : { amount: card.quantity, creation_date_unix: Math.floor(Date.now() / 1000), last_modification_date_unix: Math.floor(Date.now() / 1000), details: [] }
  let nativeChanged = !card.nativeItem
  if (Number(item.amount) !== card.quantity) nativeChanged = true
  item.amount = card.quantity
  const details = Array.isArray(item.details) ? item.details as Array<Record<string, unknown>> : []
  item.details = details
  for (const column of columns) {
    if (column.fieldId === 'meta_quantity') continue
    const separator = column.header.lastIndexOf(':')
    const name = separator >= 0 ? column.header.slice(0, separator) : column.header
    const property = separator >= 0 ? column.header.slice(separator + 1) : 'value'
    let detail = details.find((candidate) => candidate.name === name)
    if (!detail) { detail = { name, data: {} }; details.push(detail); nativeChanged = true }
    const data = detail.data && typeof detail.data === 'object' && !Array.isArray(detail.data) ? detail.data as Record<string, unknown> : (detail.data = {}) as Record<string, unknown>
    const value = cardFieldValue(card, column.fieldId)
    const current = data[property]
    let nextValue: unknown = column.type === 'image' && value ? tabletopAssetReference(value) : value
    if (typeof current === 'number' && value.trim() && Number.isFinite(Number(value))) nextValue = Number(value)
    else if (typeof current === 'boolean') nextValue = ['true', '1', 'yes'].includes(value.toLocaleLowerCase())
    if (JSON.stringify(current) !== JSON.stringify(nextValue)) nativeChanged = true
    data[property] = nextValue
  }
  if (nativeChanged) item.last_modification_date_unix = Math.floor(Date.now() / 1000)
  return item
}

async function writeLinkedNativeSets(linkedSets: ProjectSet[]) {
  if (!linkedSets.length) return
  const file = path.basename(linkedSets[0].nativeSetFile ?? '')
  const filePath = path.join(activeProject, 'data', 'sets', file)
  const original = await fs.readFile(filePath)
  const actualHash = sha256(original)
  if (linkedSets.some((set) => set.nativeSetHash && actualHash !== set.nativeSetHash)) throw new Error(`Il set nativo ${file} è cambiato fuori da Card Studio. Ricollega o ricarica il set prima di salvare.`)
  const backupDirectory = path.join(activeProject, dataDirName, 'native-backups')
  await fs.mkdir(backupDirectory, { recursive: true })
  const backupPath = path.join(backupDirectory, `${file}.${actualHash.slice(0, 16)}.json`)
  if (!existsSync(backupPath)) await fs.copyFile(filePath, backupPath)
  const document = JSON.parse(original.toString('utf8'))
  for (const set of linkedSets) {
    if (set.nativeSetIndex === undefined) continue
    const nativeSet = document.sets?.[set.nativeSetIndex]
    if (!nativeSet || !Array.isArray(nativeSet.items)) throw new Error(`Il set ${file} non ha più la struttura prevista.`)
    nativeSet.items = set.cards.map((card) => nativeItemFromCard(card, set.columns))
    for (let index = 0; index < set.cards.length; index += 1) set.cards[index].nativeItem = JSON.parse(JSON.stringify(nativeSet.items[index]))
  }
  const serialized = JSON.stringify(document, null, 2)
  const temporary = `${filePath}.card-studio-${crypto.randomUUID()}.tmp`
  await fs.writeFile(temporary, serialized)
  await fs.rename(temporary, filePath)
  const nextHash = sha256(serialized)
  for (const set of linkedSets) set.nativeSetHash = nextHash
}

async function loadBlueprints(): Promise<TabletopBlueprint[]> {
  if (!activeProject) return []
  const directory = path.join(activeProject, 'data', 'blueprints')
  let files: string[]
  try { files = (await fs.readdir(directory)).filter((file) => file.toLowerCase().endsWith('.json')).sort() }
  catch { return [] }
  const loaded = await Promise.all(files.map(async (file) => {
    try {
      const document = JSON.parse(await fs.readFile(path.join(directory, file), 'utf8'))
      return Array.isArray(document.blueprints) ? document.blueprints.filter((blueprint: unknown): blueprint is TabletopBlueprint => typeof blueprint === 'object' && blueprint !== null && typeof (blueprint as TabletopBlueprint).name === 'string') : []
    } catch { return [] }
  }))
  return loaded.flat()
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
  blueprints = await loadBlueprints()
  nativeSets = await scanNativeSets()
  await fs.mkdir(storeDir, { recursive: true })
  await persistProjectList()
  return snapshot()
}

async function connectNativeSet(setId: string, file: string, index: number): Promise<ProjectSnapshot> {
  const target = sets.find((set) => set.id === setId)
  if (!target) throw new Error('Il set Card Studio da collegare non esiste più.')
  if (target.nativeSetFile) throw new Error(`“${target.name}” è già collegato a un set Tabletop Creator. Scollegalo prima di assegnarne un altro.`)
  const safeFile = path.basename(file)
  if (safeFile !== file || !safeFile.toLowerCase().endsWith('.json')) throw new Error('Il file del set nativo non è valido.')
  const alreadyLinked = sets.find((set) => set.nativeSetFile && path.basename(set.nativeSetFile) === safeFile && set.nativeSetIndex === index)
  if (alreadyLinked) throw new Error(`Il set Tabletop Creator è già collegato a “${alreadyLinked.name}”. Scollega prima quel collegamento.`)
  const filePath = path.join(activeProject, 'data', 'sets', safeFile)
  const raw = await fs.readFile(filePath)
  const document = JSON.parse(raw.toString('utf8'))
  const nativeSet = document.sets?.[index]
  if (!nativeSet || !Array.isArray(nativeSet.items)) throw new Error('Il set selezionato non è più disponibile nel progetto.')
  const rawItems = (nativeSet.items as unknown[]).filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
  const columns = columnsFromNativeItems(rawItems, target.columns)
  const existingByTitle = new Map<string, Card[]>()
  for (const card of target.cards) {
    const key = card.title.trim().toLocaleLowerCase()
    existingByTitle.set(key, [...(existingByTitle.get(key) ?? []), card])
  }
  const cards = rawItems.map((item, itemIndex) => {
    const details = new Map<string, Record<string, unknown>>()
    for (const detail of Array.isArray(item.details) ? item.details : []) {
      if (!detail || typeof detail !== 'object') continue
      const record = detail as { name?: unknown; data?: unknown }
      if (typeof record.name === 'string' && record.data && typeof record.data === 'object') details.set(record.name, record.data as Record<string, unknown>)
    }
    const title = String(details.get('title')?.value ?? `Carta ${itemIndex + 1}`).trim().toLocaleLowerCase()
    const existing = existingByTitle.get(title)?.shift()
    return nativeCard(`Carta ${itemIndex + 1}`, item, columns, existing)
  })
  target.cards = cards
  target.columns = columns
  target.nativeSetFile = safeFile
  target.nativeSetIndex = index
  target.nativeSetHash = sha256(raw)
  activeSetId = target.id
  nativeSets = await scanNativeSets()
  await persistSets(false)
  return snapshot()
}

async function createNativeSet(setId: string, name: string, blueprintName: string): Promise<ProjectSnapshot> {
  const target = sets.find((set) => set.id === setId)
  const trimmedName = name.trim()
  if (!target) throw new Error('Il set Card Studio da collegare non esiste più.')
  if (target.nativeSetFile) throw new Error(`“${target.name}” è già collegato a un set Tabletop Creator. Scollegalo prima di crearne un altro.`)
  if (!trimmedName) throw new Error('Inserisci un nome per il set Tabletop Creator.')
  if (!blueprints.some((blueprint) => blueprint.name === blueprintName)) throw new Error('Scegli un blueprint presente nel progetto Tabletop Creator.')
  if (nativeSets.some((nativeSet) => nativeSet.name.toLocaleLowerCase() === trimmedName.toLocaleLowerCase())) throw new Error(`Esiste già un set Tabletop Creator chiamato “${trimmedName}”.`)
  const nativeSet = {
    name: trimmedName,
    blueprint_name: blueprintName,
    hint_order_index: nativeSets.length,
    zoom: 0,
    collapsed: false,
    items: target.cards.map((card) => nativeItemFromCard(card, target.columns)),
  }
  const document = { json_version: 5, sets: [nativeSet] }
  const serialized = JSON.stringify(document, null, 2)
  const directory = path.join(activeProject, 'data', 'sets')
  await fs.mkdir(directory, { recursive: true })
  let file = `${crypto.randomUUID()}.json`
  while (existsSync(path.join(directory, file))) file = `${crypto.randomUUID()}.json`
  await fs.writeFile(path.join(directory, file), serialized, { flag: 'wx' })
  for (let index = 0; index < target.cards.length; index += 1) target.cards[index].nativeItem = JSON.parse(JSON.stringify(nativeSet.items[index]))
  target.nativeSetFile = file
  target.nativeSetIndex = 0
  target.nativeSetHash = sha256(serialized)
  nativeSets = await scanNativeSets()
  await persistSets(false)
  return snapshot()
}

async function disconnectNativeSet(setId: string): Promise<ProjectSnapshot> {
  const target = sets.find((set) => set.id === setId)
  if (!target) throw new Error('Il set Card Studio selezionato non esiste più.')
  if (!target.nativeSetFile) throw new Error(`“${target.name}” non è collegato a un set Tabletop Creator.`)
  target.nativeSetFile = undefined
  target.nativeSetIndex = undefined
  target.nativeSetHash = undefined
  target.cards = target.cards.map(({ nativeItem: _nativeItem, ...card }) => card)
  await persistSets(false)
  return snapshot()
}

async function duplicateProjectSet(setId: string): Promise<ProjectSnapshot> {
  const source = sets.find((set) => set.id === setId)
  if (!source) throw new Error('Il set da duplicare non esiste più.')
  const names = new Set(sets.map((set) => set.name.toLocaleLowerCase()))
  let copyName = `${source.name} copia`
  let suffix = 2
  while (names.has(copyName.toLocaleLowerCase())) copyName = `${source.name} copia ${suffix++}`
  const duplicate: ProjectSet = {
    ...source,
    id: `set_${crypto.randomUUID()}`,
    name: copyName,
    sourceFile: undefined,
    cards: source.cards.map((card) => ({ ...card, id: `card_${crypto.randomUUID()}`, tags: [...card.tags], values: { ...card.values }, nativeItem: card.nativeItem ? JSON.parse(JSON.stringify(card.nativeItem)) : undefined })),
    columns: structuredClone(source.columns),
    importBaseline: undefined,
    importMatchFieldId: undefined,
    nativeSetFile: undefined,
    nativeSetIndex: undefined,
    nativeSetHash: undefined,
  }
  if (source.nativeSetFile && source.nativeSetIndex !== undefined) {
    const sourceFile = path.basename(source.nativeSetFile)
    const sourcePath = path.join(activeProject, 'data', 'sets', sourceFile)
    const original = await fs.readFile(sourcePath)
    if (source.nativeSetHash && sha256(original) !== source.nativeSetHash) throw new Error(`Il set nativo ${sourceFile} è cambiato fuori da Card Studio. Ricaricalo prima di duplicarlo.`)
    const document = JSON.parse(original.toString('utf8'))
    const nativeSet = document.sets?.[source.nativeSetIndex]
    if (!nativeSet) throw new Error('Non trovo il set nativo da duplicare.')
    const nativeCopy = JSON.parse(JSON.stringify(nativeSet)) as Record<string, unknown>
    const nativeNames = new Set(nativeSets.map((item) => item.name.toLocaleLowerCase()))
    const baseNativeName = `${String(nativeSet.name || source.name)}_copy`
    let nativeName = baseNativeName
    let nativeSuffix = 2
    while (nativeNames.has(nativeName.toLocaleLowerCase())) nativeName = `${baseNativeName}_${nativeSuffix++}`
    nativeCopy.name = nativeName
    nativeCopy.hint_order_index = nativeSets.length
    const nativeItems = Array.isArray(nativeCopy.items) ? nativeCopy.items : []
    duplicate.cards.forEach((card, index) => { card.nativeItem = JSON.parse(JSON.stringify(nativeItems[index] ?? card.nativeItem ?? {})) })
    const nativeDocument = { ...document, sets: [nativeCopy] }
    const serialized = JSON.stringify(nativeDocument, null, 2)
    const directory = path.join(activeProject, 'data', 'sets')
    let file = `${crypto.randomUUID()}.json`
    while (existsSync(path.join(directory, file))) file = `${crypto.randomUUID()}.json`
    await fs.writeFile(path.join(directory, file), serialized, { flag: 'wx' })
    duplicate.nativeSetFile = file
    duplicate.nativeSetIndex = 0
    duplicate.nativeSetHash = sha256(serialized)
    nativeSets = await scanNativeSets()
  }
  sets.push(duplicate)
  activeSetId = duplicate.id
  await persistSets(false)
  return snapshot()
}

async function moveCardBetweenSets(cardId: string, targetSetId: string, draft?: Card): Promise<ProjectSnapshot> {
  const source = activeSet()
  const target = sets.find((set) => set.id === targetSetId)
  if (!source) throw new Error('Il set corrente non esiste più.')
  if (!target || target.id === source.id) throw new Error('Scegli un altro set come destinazione.')
  const index = source.cards.findIndex((card) => card.id === cardId)
  if (index < 0) throw new Error('La carta da spostare non esiste più nel set corrente.')
  for (const set of [source, target]) {
    if (!set.nativeSetFile || !set.nativeSetHash) continue
    const file = path.basename(set.nativeSetFile)
    const current = await fs.readFile(path.join(activeProject, 'data', 'sets', file))
    if (sha256(current) !== set.nativeSetHash) throw new Error(`Il set nativo ${file} è cambiato fuori da Card Studio. Ricaricalo prima di spostare carte.`)
  }
  const card = draft ? resolveConditionalValues(source.columns, { ...draft, id: cardId, updatedAt: new Date().toISOString() }) : source.cards[index]
  const values = { ...card.values }
  for (const targetColumn of target.columns) {
    if (values[targetColumn.fieldId] !== undefined) continue
    const sourceColumn = source.columns.find((column) => column.fieldId === targetColumn.fieldId || column.header.trim().toLocaleLowerCase() === targetColumn.header.trim().toLocaleLowerCase() || (column.fieldLabel?.trim() && column.fieldLabel.trim().toLocaleLowerCase() === targetColumn.fieldLabel?.trim().toLocaleLowerCase()))
    if (sourceColumn && values[sourceColumn.fieldId] !== undefined) values[targetColumn.fieldId] = values[sourceColumn.fieldId]
  }
  source.cards.splice(index, 1)
  const targetTemplate = target.cards[0]?.nativeItem
  target.cards.push({ ...card, values, nativeItem: targetTemplate ? JSON.parse(JSON.stringify(targetTemplate)) : undefined, updatedAt: new Date().toISOString() })
  activeSetId = target.id
  await persistSets()
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
      runGit(['log', '-5', '--no-merges', '--format=%h%x09%s%x09%cr']).catch(() => ({ stdout: '', stderr: '' })),
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
  const iconPath = path.join(__dirname, app.isPackaged ? '../../renderer-dist/tabletop-card-studio.png' : '../../public/tabletop-card-studio.png')
  win = new BrowserWindow({
    width: 1440, height: 940, minWidth: 1080, minHeight: 700,
    backgroundColor: '#f4f0e8', title: 'Tabletop Card Studio',
    icon: iconPath,
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
  ipcMain.handle('git:revert', (_event, hash: string) => gitAction(async () => {
    if (!/^[a-f\d]{7,40}$/i.test(hash)) throw new Error('Il riferimento del commit non è valido.')
    const dirty = await runGit(['status', '--porcelain=v1'])
    if (dirty.stdout) throw new Error('Prima registra o annulla le modifiche locali, poi riprova il ripristino.')
    await runGit(['cat-file', '-e', `${hash}^{commit}`])
    const parents = await runGit(['rev-list', '--parents', '-n', '1', hash])
    if (parents.stdout.split(/\s+/).length > 2) throw new Error('I commit di merge non possono essere annullati da qui.')
    try { await runGit(['revert', '--no-edit', hash]) }
    catch (error) {
      await runGit(['revert', '--abort']).catch(() => undefined)
      throw error
    }
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
    document.variables = nextVariables.map(({ studioTags: _studioTags, studioType: _studioType, ...variable }) => variable)
    await fs.writeFile(filePath, JSON.stringify(document, null, 2))
    const tagMap = Object.fromEntries(nextVariables
      .filter((variable) => variable.studioTags?.length)
      .map((variable) => [variable.code.toLocaleLowerCase(), [...new Set(variable.studioTags!.map((tag) => tag.trim()).filter(Boolean))]]))
    const metadataPath = path.join(activeProject, dataDirName, 'variable-tags.json')
    await fs.mkdir(path.dirname(metadataPath), { recursive: true })
    await fs.writeFile(metadataPath, JSON.stringify({ variables: tagMap }, null, 2))
    const typeMap = Object.fromEntries(nextVariables
      .filter((variable) => variable.studioType === 'color' || variable.studioType === 'icon')
      .map((variable) => [variable.code.toLocaleLowerCase(), variable.studioType]))
    const typeMetadataPath = path.join(activeProject, dataDirName, 'variable-types.json')
    await fs.writeFile(typeMetadataPath, JSON.stringify({ variables: typeMap }, null, 2))
    variables = nextVariables.map((variable) => ({ ...variable, studioType: variable.studioType ?? 'text' }))
    return snapshot()
  })
  ipcMain.handle('sets:select', async (_event, id: string) => { if (sets.some((set) => set.id === id)) activeSetId = id; return snapshot() })
  ipcMain.handle('sets:link-native', async (_event, setId: string, file: string, index: number) => connectNativeSet(setId, file, index))
  ipcMain.handle('sets:create-native', async (_event, setId: string, name: string, blueprintName: string) => createNativeSet(setId, name, blueprintName))
  ipcMain.handle('sets:unlink-native', async (_event, setId: string) => disconnectNativeSet(setId))
  ipcMain.handle('sets:duplicate', async (_event, setId: string) => duplicateProjectSet(setId))
  ipcMain.handle('cards:move', async (_event, cardId: string, targetSetId: string, draft?: Card) => moveCardBetweenSets(cardId, targetSetId, draft))
  ipcMain.handle('sets:rename', async (_event, id: string, name: string) => {
    const target = sets.find((set) => set.id === id)
    const trimmedName = name.trim()
    if (!target) throw new Error('Il set selezionato non esiste più.')
    if (!trimmedName) throw new Error('Il nome del set non può essere vuoto.')
    target.name = trimmedName
    await persistSets()
    return snapshot()
  })
  ipcMain.handle('sets:delete', async (_event, id: string) => {
    const targetIndex = sets.findIndex((set) => set.id === id)
    if (targetIndex < 0) throw new Error('Il set selezionato non esiste più.')
    sets.splice(targetIndex, 1)
    if (activeSetId === id) activeSetId = sets[0]?.id ?? null
    await persistSets()
    return snapshot()
  })
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
  ipcMain.handle('workbooks:merge-preview', async (_event, file: string, setId: string, matchFieldId?: string, fieldIds?: string[], restoreFieldIds?: string[]) => previewWorkbookMerge(file, setId, matchFieldId, fieldIds, restoreFieldIds))
  ipcMain.handle('workbooks:merge-apply', async (_event, token: string, resolutions: Record<string, 'excel' | 'set'>) => applyWorkbookMerge(token, resolutions))
  ipcMain.handle('assets:import', async () => {
    const result = await dialog.showOpenDialog(win!, { title: 'Aggiungi asset al progetto', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Immagini', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif'] }] })
    if (!result.canceled) {
      const targetDir = path.join(activeProject, 'assets', 'images', 'card-studio')
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
  ipcMain.handle('icons:resolve', (_event, reference: string) => resolveProjectIcon(reference))
  ipcMain.handle('icons:search', (_event, query: string, library: 'all' | 'tabletop' | 'project') => searchAvailableIcons(query, library))
  ipcMain.handle('project:export', async (_event, cardIds?: string[]) => {
    const current = activeSet()
    if (!activeProject || !current) return null
    const cardsToExport = cardIds === undefined
      ? current.cards
      : cardIds.map((id) => current.cards.find((card) => card.id === id)).filter((card): card is Card => Boolean(card))
    const setSlug = current.name.trim().toLocaleLowerCase().replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'set'
    const exportedAt = new Date()
    const pad = (value: number) => String(value).padStart(2, '0')
    const dateStamp = `${exportedAt.getFullYear()}-${pad(exportedAt.getMonth() + 1)}-${pad(exportedAt.getDate())}_${pad(exportedAt.getHours())}-${pad(exportedAt.getMinutes())}-${pad(exportedAt.getSeconds())}`
    const exportDirectory = path.join(activeProject, 'exports')
    await fs.mkdir(exportDirectory, { recursive: true })
    let file = path.join(exportDirectory, `${setSlug}_${dateStamp}.xlsx`)
    let collision = 2
    while (existsSync(file)) file = path.join(exportDirectory, `${setSlug}_${dateStamp}_${collision++}.xlsx`)
    const workbook = new ExcelJS.Workbook()
    const exportedAtLabel = exportedAt.toLocaleString('it-IT')
    workbook.creator = 'Tabletop Card Studio'
    workbook.lastModifiedBy = 'Tabletop Card Studio'
    workbook.created = exportedAt
    workbook.modified = exportedAt
    workbook.title = current.name
    workbook.subject = `Esportazione del set ${current.name} · ${exportedAtLabel}`
    workbook.description = `Set: ${current.name}\nEsportato il: ${exportedAtLabel}`
    const worksheet = workbook.addWorksheet('Cards')
    worksheet.addRow(current.columns.map((column) => column.header))
    for (const card of cardsToExport) {
      const values = resolveConditionalValues(current.columns, card).values
      worksheet.addRow(current.columns.map((column) => {
        const value = column.fieldId === 'meta_title' ? card.title : column.fieldId === 'meta_quantity' ? card.quantity : column.fieldId === 'meta_status' ? card.status : column.fieldId === 'meta_tags' ? card.tags.join(', ') : (values[column.fieldId] ?? '')
        return column.type === 'image' && value ? tabletopAssetReference(String(value)) : value
      }))
    }
    await workbook.xlsx.writeFile(file)
    return { path: file, count: cardsToExport.length }
  })
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
