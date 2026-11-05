import { useState } from 'react'
import { errorMessage } from './shellContext'

/** Excel export dialog: export the filtered view (card ids) or the whole set. */
export function useExport(setToast: (message: string) => void) {
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const exportCards = () => setExportOpen(true)
  const performExport = async (cardIds?: string[]) => {
    setExporting(true)
    try {
      const result = await window.cardCms.exportExcel(cardIds)
      if (result) setToast(`Esportate ${result.count} carte in ${result.path.split(/[\\/]/).pop()}`)
      setExportOpen(false)
    } catch (error) {
      setToast(errorMessage(error, 'Impossibile esportare il set'))
    } finally {
      setExporting(false)
    }
  }
  return { exportOpen, setExportOpen, exporting, exportCards, performExport }
}

export type ExportFlow = ReturnType<typeof useExport>
