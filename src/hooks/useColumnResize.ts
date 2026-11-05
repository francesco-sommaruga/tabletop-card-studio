import { useRef } from 'react'
import type { RefObject, PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { defaultTableColumnWidth, minimumTableColumnWidth, maximumTableColumnWidth } from '../lib/tableColumns'
import type { TableColumn } from './useTableColumns'

interface ResizeState {
  pointerId: number
  fieldId: string
  startX: number
  startWidth: number
  widths: Record<string, number>
}

/**
 * Pointer and keyboard resizing of table columns. While dragging, widths are applied directly to the
 * table element's CSS variables; they are persisted (via `saveWidths`) when the drag ends.
 */
export function useColumnResize(
  cardsTableRef: RefObject<HTMLDivElement>,
  visibleTableColumns: TableColumn[],
  storedTableWidths: Record<string, number> | null,
  saveWidths: (widths: Record<string, number>) => void,
) {
  const columnResizeRef = useRef<ResizeState | null>(null)
  const widthOf = (widths: Record<string, number>, column: TableColumn) =>
    widths[column.fieldId] ?? defaultTableColumnWidth(column.fieldId, column.type)

  const getVisibleTableWidths = () => {
    const measured: Record<string, number> = {}
    cardsTableRef.current?.querySelectorAll<HTMLElement>('.table-head-cell').forEach((cell) => {
      const fieldId = cell.dataset.fieldId
      if (fieldId) measured[fieldId] = cell.getBoundingClientRect().width
    })
    return Object.fromEntries(
      visibleTableColumns.map((column) => [
        column.fieldId,
        Math.round(
          storedTableWidths?.[column.fieldId] ??
            measured[column.fieldId] ??
            defaultTableColumnWidth(column.fieldId, column.type),
        ),
      ]),
    )
  }
  const applyLiveTableWidths = (widths: Record<string, number>) => {
    const root = cardsTableRef.current
    if (!root) return
    const template = [...visibleTableColumns.map((column) => `${widthOf(widths, column)}px`), '22px'].join(' ')
    root.style.setProperty('--card-grid-template', template)
    const minWidth =
      visibleTableColumns.reduce((sum, column) => sum + widthOf(widths, column), 22) +
      visibleTableColumns.length * 10 +
      20
    root.style.setProperty('--card-grid-min-width', `${minWidth}px`)
  }
  const startColumnResize = (fieldId: string, event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const widths = getVisibleTableWidths()
    const startWidth = widths[fieldId] ?? minimumTableColumnWidth(fieldId)
    columnResizeRef.current = { pointerId: event.pointerId, fieldId, startX: event.clientX, startWidth, widths }
    event.currentTarget.setPointerCapture(event.pointerId)
    cardsTableRef.current?.classList.add('is-column-resizing')
  }
  const moveColumnResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resize = columnResizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    const width = Math.min(
      maximumTableColumnWidth,
      Math.max(minimumTableColumnWidth(resize.fieldId), Math.round(resize.startWidth + event.clientX - resize.startX)),
    )
    resize.widths = { ...resize.widths, [resize.fieldId]: width }
    applyLiveTableWidths(resize.widths)
  }
  const finishColumnResize = (pointerId: number) => {
    const resize = columnResizeRef.current
    if (!resize || resize.pointerId !== pointerId) return
    columnResizeRef.current = null
    cardsTableRef.current?.classList.remove('is-column-resizing')
    saveWidths(resize.widths)
  }
  const resizeTableColumnByKeyboard = (fieldId: string, delta: number) => {
    const column = visibleTableColumns.find((item) => item.fieldId === fieldId)
    if (!column) return
    const widths = getVisibleTableWidths()
    widths[fieldId] = Math.min(
      maximumTableColumnWidth,
      Math.max(
        minimumTableColumnWidth(fieldId),
        (widths[fieldId] ?? defaultTableColumnWidth(fieldId, column.type)) + delta,
      ),
    )
    applyLiveTableWidths(widths)
    saveWidths(widths)
  }
  const onColumnResizeKeyDown = (fieldId: string, event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    resizeTableColumnByKeyboard(fieldId, (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 50 : 10))
  }
  const isColumnResizing = () => Boolean(columnResizeRef.current)
  return { startColumnResize, moveColumnResize, finishColumnResize, onColumnResizeKeyDown, isColumnResizing }
}
