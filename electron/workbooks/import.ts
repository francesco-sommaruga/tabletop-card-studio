import { randomUUID } from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs/promises'
import ExcelJS from 'exceljs'
import { ensureGeneratedIdValues } from '../../src/generatedIds'
import type { Card, ColumnDefinition, ImportPlan, ProjectSet, WorkbookInfo } from '../../src/types'
import { state } from '../state'
import { importedFieldIdFor, guessFieldType, fieldIdFor, cardFieldValue } from '../fields'
import { snapshot } from '../snapshot'
import { persistSets } from '../store'

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
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
    if (cell.text.trim()) headers.push(cell.text.trim())
  })
  let rowCount = 0
  for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
    let hasContent = false
    sheet.getRow(rowIndex).eachCell((cell) => {
      if (cell.text.trim()) hasContent = true
    })
    if (hasContent) rowCount += 1
  }
  return { file: path.basename(filePath), rowCount, headers }
}

export async function scanWorkbooks(): Promise<WorkbookInfo[]> {
  const entries = await fs.readdir(state.activeProject, { withFileTypes: true })
  const files = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        /\.xlsx$/i.test(entry.name) &&
        !entry.name.startsWith('~$') &&
        !entry.name.startsWith('.~') &&
        !/-cms-export\.xlsx$/i.test(entry.name),
    )
    .map((entry) => path.join(state.activeProject, entry.name))
  const results = await Promise.all(
    files.map(async (file) => {
      try {
        return await workbookInfo(file)
      } catch {
        return null
      }
    }),
  )
  return results
    .filter((item): item is WorkbookInfo => item !== null)
    .sort((a, b) => a.file.localeCompare(b.file, 'it'))
}

export async function workbookRestoreFields(filePath: string, set: ProjectSet) {
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
  const titleHeader = headerEntries.find(({ header }) =>
    ['title', 'titolo', 'name', 'nome'].includes(header.toLowerCase()),
  )?.header
  const quantityHeader = headerEntries.find(({ header }) =>
    ['[item amount]', 'amount', 'quantità', 'quantita'].includes(header.toLowerCase()),
  )?.header
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
  const cardsWithIds = ensureGeneratedIdValues(cards, columns, randomUUID)
  const importMatchFieldId = titleHeader ? 'meta_title' : columns[0]?.fieldId
  const importBaseline = cardsWithIds.map((card) => ({
    cardId: card.id,
    values: Object.fromEntries(columns.map((column) => [column.fieldId, cardFieldValue(card, column.fieldId)])),
  }))
  return {
    id: `set_${crypto.randomUUID()}`,
    name: plan.name.trim() || path.parse(plan.file).name,
    sourceFile: path.basename(plan.file),
    cards: cardsWithIds,
    columns,
    importBaseline,
    importMatchFieldId,
  }
}

export async function readWorkbookRowsForSet(
  filePath: string,
  set: ProjectSet,
): Promise<{ cards: Card[]; importedFieldIds: string[] }> {
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

export async function rescanWorkbooks() {
  state.workbooks = await scanWorkbooks()
  return state.workbooks
}

export async function importWorkbooks(plans: ImportPlan[]) {
  const imported: ProjectSet[] = []
  for (const plan of plans) {
    if (state.sets.some((set) => set.sourceFile === path.basename(plan.file))) continue
    const importedSet = await readPlannedWorkbook(path.join(state.activeProject, path.basename(plan.file)), plan)
    state.sets.push(importedSet)
    imported.push(importedSet)
  }
  state.activeSetId = imported[0]?.id ?? state.activeSetId
  await persistSets(false)
  state.workbooks = await scanWorkbooks()
  return snapshot()
}
