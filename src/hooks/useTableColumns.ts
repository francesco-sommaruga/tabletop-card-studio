import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ColumnDefinition, ProjectSnapshot } from '../types'
import type { SetSummary } from './useProjectSession'
import {
  defaultTableColumnIds,
  tableMetaColumns,
  tableMetaFieldIds,
  internalFieldName,
  defaultTableColumnWidth,
  tableGridTemplate as gridTemplate,
  tableGridMinWidth as gridMinWidth,
} from '../lib/tableColumns'
import { useColumnResize } from './useColumnResize'

export interface TableColumn {
  fieldId: string
  header: string
  label: string
  className: string
  type: string
  definition?: ColumnDefinition
}

const defaultColumnTrack = (column: TableColumn) =>
  column.fieldId === 'meta_title'
    ? 'minmax(200px,2fr)'
    : column.fieldId === 'meta_tags'
      ? 'minmax(140px,1.3fr)'
      : column.fieldId === 'meta_status'
        ? 'minmax(105px,.8fr)'
        : column.fieldId === 'meta_quantity'
          ? '62px'
          : column.fieldId === 'meta_updated'
            ? 'minmax(120px,.9fr)'
            : column.type === 'number'
              ? 'minmax(85px,.65fr)'
              : 'minmax(125px,1fr)'

function readStoredIds(key: string) {
  try {
    const stored = window.localStorage.getItem(key)
    const ids = stored ? JSON.parse(stored) : defaultTableColumnIds
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : defaultTableColumnIds
  } catch {
    return defaultTableColumnIds
  }
}

function readStoredWidths(key: string): Record<string, number> {
  try {
    const stored = window.localStorage.getItem(key)
    const parsed = stored ? (JSON.parse(stored) as Record<string, unknown>) : {}
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] > 0,
      ),
    )
  } catch {
    return {}
  }
}

/** Visible table columns and their widths, persisted per project and set in localStorage. */
export function useTableColumns(
  snapshot: ProjectSnapshot | null,
  activeSet: SetSummary | undefined,
  columns: ColumnDefinition[],
) {
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false)
  const [tableColumnPrefs, setTableColumnPrefs] = useState<{ key: string; ids: string[] } | null>(null)
  const [tableColumnWidths, setTableColumnWidths] = useState<{ key: string; widths: Record<string, number> } | null>(
    null,
  )
  const cardsTableRef = useRef<HTMLDivElement>(null)

  const tableColumnKey =
    snapshot && activeSet ? `tabletop-card-studio:visible-columns:${snapshot.projectPath}:${activeSet.id}` : ''
  const tableColumnWidthsKey = tableColumnKey ? `${tableColumnKey}:widths` : ''
  useEffect(() => {
    setTableColumnPrefs(tableColumnKey ? { key: tableColumnKey, ids: readStoredIds(tableColumnKey) } : null)
  }, [tableColumnKey])
  useEffect(() => {
    setTableColumnWidths(
      tableColumnWidthsKey ? { key: tableColumnWidthsKey, widths: readStoredWidths(tableColumnWidthsKey) } : null,
    )
  }, [tableColumnWidthsKey])

  const availableTableColumns: TableColumn[] = [
    ...tableMetaColumns,
    ...columns
      .filter(
        (column, index, all) =>
          !tableMetaFieldIds.has(column.fieldId) && all.findIndex((item) => item.fieldId === column.fieldId) === index,
      )
      .map((column) => ({
        fieldId: column.fieldId,
        header: internalFieldName(column),
        label: internalFieldName(column),
        className: 'col-custom',
        type: column.type ?? 'text',
        definition: column,
      })),
  ]
  const visibleTableColumnIds = tableColumnPrefs?.key === tableColumnKey ? tableColumnPrefs.ids : defaultTableColumnIds
  const visibleTableColumns = availableTableColumns.filter((column) => visibleTableColumnIds.includes(column.fieldId))
  const storedTableWidths = tableColumnWidths?.key === tableColumnWidthsKey ? tableColumnWidths.widths : null
  const hasCustomTableWidths = Boolean(storedTableWidths && Object.keys(storedTableWidths).length)
  const columnWidth = (column: TableColumn) =>
    storedTableWidths?.[column.fieldId] ?? defaultTableColumnWidth(column.fieldId, column.type)
  const tableGridTemplate = hasCustomTableWidths
    ? gridTemplate(visibleTableColumns.map((column) => `${columnWidth(column)}px`))
    : gridTemplate(visibleTableColumns.map(defaultColumnTrack))
  const tableGridMinWidth = hasCustomTableWidths ? `${gridMinWidth(visibleTableColumns.map(columnWidth))}px` : '100%'
  const tableGridStyle = {
    '--card-grid-template': tableGridTemplate,
    '--card-grid-min-width': tableGridMinWidth,
  } as CSSProperties

  const saveTableColumnWidths = (widths: Record<string, number>) => {
    if (!tableColumnWidthsKey) return
    setTableColumnWidths({ key: tableColumnWidthsKey, widths })
    window.localStorage.setItem(tableColumnWidthsKey, JSON.stringify(widths))
  }
  const resize = useColumnResize(cardsTableRef, visibleTableColumns, storedTableWidths, saveTableColumnWidths)
  const toggleTableColumn = (fieldId: string) => {
    if (!tableColumnKey) return
    const ids = visibleTableColumnIds.includes(fieldId)
      ? visibleTableColumnIds.filter((id) => id !== fieldId)
      : [...visibleTableColumnIds, fieldId]
    setTableColumnPrefs({ key: tableColumnKey, ids })
    window.localStorage.setItem(tableColumnKey, JSON.stringify(ids))
  }
  const resetTableColumns = () => {
    if (!tableColumnKey) return
    setTableColumnPrefs({ key: tableColumnKey, ids: defaultTableColumnIds })
    window.localStorage.setItem(tableColumnKey, JSON.stringify(defaultTableColumnIds))
    setTableColumnWidths({ key: tableColumnWidthsKey, widths: {} })
    window.localStorage.removeItem(tableColumnWidthsKey)
  }
  return {
    columnsMenuOpen,
    setColumnsMenuOpen,
    cardsTableRef,
    availableTableColumns,
    visibleTableColumnIds,
    visibleTableColumns,
    storedTableWidths,
    tableGridStyle,
    toggleTableColumn,
    resetTableColumns,
    ...resize,
  }
}

export type TableColumns = ReturnType<typeof useTableColumns>
