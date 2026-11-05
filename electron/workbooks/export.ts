import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import ExcelJS from 'exceljs'
import type { Card } from '../../src/types'
import { resolveConditionalValues } from '../../src/conditional'
import { state } from '../state'
import { tabletopAssetReference } from '../fields'
import { activeSet } from '../snapshot'

export async function exportActiveSet(cardIds?: string[]) {
  const current = activeSet()
  if (!state.activeProject || !current) return null
  const cardsToExport =
    cardIds === undefined
      ? current.cards
      : cardIds.map((id) => current.cards.find((card) => card.id === id)).filter((card): card is Card => Boolean(card))
  const setSlug =
    current.name
      .trim()
      .toLocaleLowerCase()
      .replace(/[^a-z0-9-_]+/gi, '-')
      .replace(/^-|-$/g, '') || 'set'
  const exportedAt = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  const dateStamp = `${exportedAt.getFullYear()}-${pad(exportedAt.getMonth() + 1)}-${pad(exportedAt.getDate())}_${pad(exportedAt.getHours())}-${pad(exportedAt.getMinutes())}-${pad(exportedAt.getSeconds())}`
  const exportDirectory = path.join(state.activeProject, 'exports')
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
    worksheet.addRow(
      current.columns.map((column) => {
        const value =
          column.fieldId === 'meta_title'
            ? card.title
            : column.fieldId === 'meta_quantity'
              ? card.quantity
              : column.fieldId === 'meta_status'
                ? card.status
                : column.fieldId === 'meta_tags'
                  ? card.tags.join(', ')
                  : (values[column.fieldId] ?? '')
        return column.type === 'image' && value ? tabletopAssetReference(String(value)) : value
      }),
    )
  }
  await workbook.xlsx.writeFile(file)
  return { path: file, count: cardsToExport.length }
}
