import type { ProjectSnapshot, ProjectVariable } from '../types'
import { errorMessage } from './shellContext'
import type { ShellContext } from './shellContext'

interface ProjectActionsDeps {
  setImportOpen: (open: boolean) => void
  setFieldsDirty: (dirty: boolean) => void
}

/** Opening/switching projects and project-level saves (variables, assets, blueprints, name conflicts). */
export function useProjectActions(ctx: ShellContext, { setImportOpen, setFieldsDirty }: ProjectActionsDeps) {
  const { snapshot, setSnapshot, setToast, confirmDiscardFields, setView, setSelected, resetListControls } = ctx
  const { refreshProjects } = ctx

  const openSnapshot = (result: ProjectSnapshot) => {
    setSnapshot(result)
    setView('cards')
    resetListControls()
    setSelected(null)
    void refreshProjects()
  }
  const openPath = async (projectPath: string) => {
    if (!confirmDiscardFields()) return
    const result = await window.cardCms.openProjectPath(projectPath)
    if (result) {
      setSnapshot(result)
      setView('cards')
      resetListControls()
      setSelected(null)
      await refreshProjects()
    }
  }
  const addProject = async () => {
    if (!confirmDiscardFields()) return
    const result = await window.cardCms.openProject()
    if (result) {
      setSnapshot(result)
      setView('cards')
      resetListControls()
      setSelected(null)
      await refreshProjects()
      const pending = result.workbooks.some((book) => !result.sets.some((set) => set.sourceFile === book.file))
      if (pending) setImportOpen(true)
    }
  }
  const switchProject = async () => {
    if (!confirmDiscardFields()) return
    await refreshProjects()
    setSnapshot(null)
    setSelected(null)
    setView('cards')
  }
  const updateVariables = async (next: ProjectVariable[]) => {
    const updated = await window.cardCms.saveVariables(next)
    setSnapshot(updated)
    setFieldsDirty(false)
    setToast('Variabili salvate in Tabletop Creator')
  }
  const addAssets = async () => {
    if (!snapshot) return
    const assets = await window.cardCms.importAssets()
    setSnapshot({ ...snapshot, assets })
    setToast('Libreria asset aggiornata')
  }
  const reloadBlueprints = async () => {
    const updated = await window.cardCms.reloadBlueprints()
    setSnapshot(updated)
    setToast('Blueprint riletti dal progetto')
  }
  const saveBlueprintAssignments = async (assignments: Record<string, string>) => {
    const result = await window.cardCms.saveBlueprintAssignments(assignments)
    setSnapshot(result)
    setToast('Associazioni ai blueprint salvate; i campi sono condivisi tra i set associati')
  }
  const openDiagnosticLog = () =>
    void window.cardCms
      .openDiagnosticLog()
      .then((file) => setToast(`Log aperto: ${file}`))
      .catch((error) => setToast(errorMessage(error, 'Impossibile aprire il log')))
  const resolveNameConflict = async (setId: string, resolution: 'card-studio' | 'tabletop') => {
    try {
      const next = await window.cardCms.resolveNativeSetNameConflict(setId, resolution)
      setSnapshot(next)
      setToast('Nomi dei set sincronizzati')
    } catch (error) {
      setToast(errorMessage(error, 'Impossibile risolvere il conflitto'))
    }
  }
  return {
    openSnapshot,
    openPath,
    addProject,
    switchProject,
    updateVariables,
    addAssets,
    reloadBlueprints,
    saveBlueprintAssignments,
    openDiagnosticLog,
    resolveNameConflict,
  }
}

export type ProjectActions = ReturnType<typeof useProjectActions>
