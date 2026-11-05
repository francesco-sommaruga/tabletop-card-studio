import { useState } from 'react'
import type { ImportPlan, WorkbookMergePreview } from '../types'
import { errorMessage } from './shellContext'
import type { ShellContext } from './shellContext'

type ImportFlowContext = Pick<
  ShellContext,
  'snapshot' | 'setSnapshot' | 'setToast' | 'confirmDiscardFields' | 'setView' | 'refreshProjects'
>

/** Excel import wizard and workbook merge preview. */
export function useImportFlow({
  snapshot,
  setSnapshot,
  setToast,
  confirmDiscardFields,
  setView,
  refreshProjects,
}: ImportFlowContext) {
  const [importOpen, setImportOpen] = useState(false)
  const [mergePreview, setMergePreview] = useState<WorkbookMergePreview | null>(null)

  const refreshWorkbooks = async () => {
    if (!snapshot || !confirmDiscardFields()) return
    const workbooks = await window.cardCms.scanWorkbooks()
    setSnapshot({ ...snapshot, workbooks })
    setImportOpen(true)
  }
  const rescanWorkbooks = async () => {
    const found = await window.cardCms.scanWorkbooks()
    if (snapshot) setSnapshot({ ...snapshot, workbooks: found })
    return found
  }
  const finishImport = async (plans: ImportPlan[]) => {
    const result = await window.cardCms.importWorkbooks(plans)
    setSnapshot(result)
    setImportOpen(false)
    setView('cards')
    setToast(`${plans.length} set importati`)
    await refreshProjects()
  }
  const openMergePreview = async (
    file: string,
    setId: string,
    matchFieldId?: string,
    fieldIds?: string[],
    restoreFieldIds?: string[],
  ) => {
    setImportOpen(false)
    try {
      setMergePreview(await window.cardCms.previewWorkbookMerge(file, setId, matchFieldId, fieldIds, restoreFieldIds))
    } catch (error) {
      setToast(errorMessage(error, 'Impossibile confrontare il foglio'))
    }
  }
  const applyMerge = async (token: string, resolutions: Record<string, 'excel' | 'set'>) => {
    try {
      const result = await window.cardCms.applyWorkbookMerge(token, resolutions)
      setSnapshot(result)
      setMergePreview(null)
      setView('cards')
      setToast('Merge applicato al set')
      await refreshProjects()
    } catch (error) {
      setToast(errorMessage(error, 'Impossibile applicare il merge'))
    }
  }
  return {
    importOpen,
    setImportOpen,
    mergePreview,
    setMergePreview,
    refreshWorkbooks,
    rescanWorkbooks,
    finishImport,
    openMergePreview,
    applyMerge,
  }
}

export type ImportFlow = ReturnType<typeof useImportFlow>
