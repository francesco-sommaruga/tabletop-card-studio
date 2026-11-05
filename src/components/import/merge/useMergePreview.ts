import { useState, useEffect } from 'react'
import type { WorkbookMergePreview } from '../../../types'

export type Resolution = 'excel' | 'set'

export type MergePreviewLoader = (
  file: string,
  setId: string,
  matchFieldId: string,
  fieldIds: string[],
  restoreFieldIds: string[],
) => Promise<WorkbookMergePreview>

const defaultResolutions = (preview: WorkbookMergePreview): Record<string, Resolution> =>
  Object.fromEntries(preview.conflicts.map((conflict) => [conflict.conflictId, 'set']))

/** Current merge preview, field selection and conflict resolutions; re-previews on every selection change. */
export function useMergePreview(preview: WorkbookMergePreview, onPreview: MergePreviewLoader) {
  const [current, setCurrent] = useState(preview)
  const [selectedFields, setSelectedFields] = useState<Set<string>>(() => new Set(preview.selectedFieldIds))
  const [restoredFields, setRestoredFields] = useState<Set<string>>(() => new Set(preview.restoredFieldIds))
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>(() => defaultResolutions(preview))
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    setCurrent(preview)
    setSelectedFields(new Set(preview.selectedFieldIds))
    setRestoredFields(new Set(preview.restoredFieldIds))
    setResolutions(defaultResolutions(preview))
  }, [preview.token])
  const refreshPreview = async (
    matchFieldId: string,
    fieldIds: Set<string>,
    restoreFieldIds: Set<string> = restoredFields,
  ) => {
    setLoading(true)
    try {
      const next = await onPreview(current.file, current.setId, matchFieldId, [...fieldIds], [...restoreFieldIds])
      setCurrent(next)
      setSelectedFields(new Set(next.selectedFieldIds))
      setRestoredFields(new Set(next.restoredFieldIds))
      setResolutions(defaultResolutions(next))
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Impossibile aggiornare il confronto')
    } finally {
      setLoading(false)
    }
  }
  const selection = fieldSelectionActions(current, selectedFields, restoredFields, refreshPreview)
  const chooseAll = (resolution: Resolution) =>
    setResolutions(Object.fromEntries(current.conflicts.map((conflict) => [conflict.conflictId, resolution])))
  const resolve = (conflictId: string, resolution: Resolution) =>
    setResolutions((existing) => ({ ...existing, [conflictId]: resolution }))
  const unresolvedCount = current.conflicts.filter((conflict) => !resolutions[conflict.conflictId]).length
  const hasWork =
    current.newTitles.length +
      current.automaticChanges.length +
      current.preservedLocalChanges.length +
      current.conflicts.length >
    0
  return {
    current,
    selectedFields,
    restoredFields,
    resolutions,
    loading,
    ...selection,
    chooseAll,
    resolve,
    unresolvedCount,
    hasWork,
    canApplyFields: selectedFields.size > 0,
  }
}

export type FieldSelectionActions = ReturnType<typeof fieldSelectionActions>

function fieldSelectionActions(
  current: WorkbookMergePreview,
  selectedFields: Set<string>,
  restoredFields: Set<string>,
  refreshPreview: (matchFieldId: string, fieldIds: Set<string>, restoreFieldIds?: Set<string>) => Promise<void>,
) {
  const selectMatchField = (matchFieldId: string) => {
    void refreshPreview(matchFieldId, new Set(selectedFields))
  }
  const toggleImportField = (fieldId: string, checked: boolean) => {
    const next = new Set(selectedFields)
    checked ? next.add(fieldId) : next.delete(fieldId)
    void refreshPreview(current.matchFieldId, next)
  }
  const toggleRestoreField = (fieldId: string, checked: boolean) => {
    const nextRestored = new Set(restoredFields)
    checked ? nextRestored.add(fieldId) : nextRestored.delete(fieldId)
    const nextSelected = new Set(selectedFields)
    checked ? nextSelected.add(fieldId) : nextSelected.delete(fieldId)
    void refreshPreview(current.matchFieldId, nextSelected, nextRestored)
  }
  const selectAllFields = () =>
    void refreshPreview(
      current.matchFieldId,
      new Set([...current.importFields.map((field) => field.id), ...restoredFields]),
    )
  const selectOnlyMatchField = () =>
    void refreshPreview(current.matchFieldId, new Set([...restoredFields, current.matchFieldId]))
  return { selectMatchField, toggleImportField, toggleRestoreField, selectAllFields, selectOnlyMatchField }
}
