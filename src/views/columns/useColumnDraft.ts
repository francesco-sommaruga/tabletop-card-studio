import { useState, useEffect } from 'react'
import type { ColumnDefinition } from '../../types'
import { duplicateColumn } from './columnOps'

/** Draft copy of the set columns; reports dirty state to the parent via `onDirty`. */
export function useColumnDraft(columns: ColumnDefinition[], onDirty: (dirty: boolean) => void) {
  const [draftColumns, setDraftColumns] = useState(columns)
  const dirty = JSON.stringify(draftColumns) !== JSON.stringify(columns)
  useEffect(() => {
    onDirty(dirty)
  }, [dirty, onDirty])
  const edit = (id: string, patch: Partial<ColumnDefinition>) =>
    setDraftColumns(draftColumns.map((column) => (column.id === id ? { ...column, ...patch } : column)))
  const remove = (id: string) => setDraftColumns(draftColumns.filter((column) => column.id !== id))
  const duplicate = (id: string) => {
    const index = draftColumns.findIndex((column) => column.id === id)
    if (index < 0) return
    const copy = duplicateColumn(draftColumns, draftColumns[index])
    setDraftColumns((current) => {
      const currentIndex = current.findIndex((column) => column.id === id)
      if (currentIndex < 0) return current
      const next = [...current]
      next.splice(currentIndex + 1, 0, copy)
      return next
    })
  }
  return { draftColumns, setDraftColumns, dirty, edit, remove, duplicate }
}
