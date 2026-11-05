import { useState } from 'react'
import type { ColumnDefinition, ProjectAsset, ProjectVariable } from '../../types'
import { variableTagList } from '../../lib/variables'
import { SchemaRow } from './SchemaRow'
import { fieldNameFor, fieldOptionsFor, moveColumn } from './columnOps'

/** Draft column rows with drag-and-drop / Alt+arrow reordering. */
export function SchemaList({
  columns,
  assets,
  variables,
  onChange,
  onEdit,
  onRemove,
  onDuplicate,
}: {
  columns: ColumnDefinition[]
  assets: ProjectAsset[]
  variables: ProjectVariable[]
  onChange: (columns: ColumnDefinition[]) => void
  onEdit: (id: string, patch: Partial<ColumnDefinition>) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
}) {
  const [dragColumnId, setDragColumnId] = useState<string | null>(null)
  const [dropColumnId, setDropColumnId] = useState<string | null>(null)
  const allVariableTags = variableTagList(variables)
  const fields = fieldOptionsFor(columns)
  const clearDrag = () => {
    setDragColumnId(null)
    setDropColumnId(null)
  }
  const reorder = (targetId: string) => {
    if (!dragColumnId || dragColumnId === targetId) {
      clearDrag()
      return
    }
    const from = columns.findIndex((column) => column.id === dragColumnId)
    const to = columns.findIndex((column) => column.id === targetId)
    if (from < 0 || to < 0) return
    onChange(moveColumn(columns, from, to))
    clearDrag()
  }
  const moveByKeyboard = (from: number, to: number) => {
    if (to < 0 || to >= columns.length || from === to) return
    onChange(moveColumn(columns, from, to))
  }
  const renameField = (fieldId: string, value: string) => {
    const field = columns.find((column) => column.fieldId === fieldId)
    if (field) onEdit(field.id, { fieldLabel: value })
  }
  return (
    <div className="schema-list">
      <div className="schema-list-head">
        <span>CAMPO TABLETOP CREATOR</span>
        <span>CAMPO CARD STUDIO / TIPO</span>
        <span />
      </div>
      {columns.map((column, index) => (
        <SchemaRow
          key={column.id}
          column={column}
          index={index}
          columns={columns}
          fields={fields}
          fieldName={fieldNameFor(columns, fields, column.fieldId)}
          canRename={columns.some((item) => item.fieldId === column.fieldId)}
          allVariableTags={allVariableTags}
          assets={assets}
          variables={variables}
          drag={{
            isDragging: dragColumnId === column.id,
            isDropTarget: dropColumnId === column.id && dragColumnId !== column.id,
            onDragOver: () => setDropColumnId(column.id),
            onDrop: () => reorder(column.id),
            onDragStart: () => {
              setDragColumnId(column.id)
              setDropColumnId(null)
            },
            onDragEnd: clearDrag,
            onMoveBy: (offset) => moveByKeyboard(index, index + offset),
          }}
          actions={{
            onEdit: (patch) => onEdit(column.id, patch),
            onRename: (value) => renameField(column.fieldId, value),
            onDuplicate: () => onDuplicate(column.id),
            onRemove: () => onRemove(column.id),
          }}
        />
      ))}
      {!columns.length && <div className="schema-empty">Aggiungi un campo per definire questo foglio.</div>}
    </div>
  )
}
