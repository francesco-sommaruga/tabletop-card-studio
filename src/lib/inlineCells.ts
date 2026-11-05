import type { ColumnDefinition } from '../types'

/** How a table cell is edited: not at all, with a single input/select, or with a richer field editor. */
export type CellEditorKind = 'readonly' | 'simple' | 'complex'

export function cellEditorKind(fieldId: string, definition?: ColumnDefinition): CellEditorKind {
  if (fieldId === 'meta_updated' || definition?.type === 'id' || definition?.rules?.length) return 'readonly'
  const type = definition?.type
  return type === 'image' || type === 'color' || type === 'variable' ? 'complex' : 'simple'
}

/** The field before/after `current` in `order`, or null at the edges. */
export function adjacentField(order: string[], current: string, direction: 1 | -1) {
  const index = order.indexOf(current)
  if (index < 0) return null
  return order[index + direction] ?? null
}
