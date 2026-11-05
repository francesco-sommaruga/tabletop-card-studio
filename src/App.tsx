import type { ShellContext } from './hooks/shellContext'
import { useProjectSession } from './hooks/useProjectSession'
import { useToast } from './hooks/useToast'
import { useDiagnosticsReporting } from './hooks/useDiagnosticsReporting'
import { useDirtyGuard } from './hooks/useDirtyGuard'
import { useAppNavigation } from './hooks/useAppNavigation'
import { useCardFilters } from './hooks/useCardFilters'
import { useTableColumns } from './hooks/useTableColumns'
import { useGitStatus } from './hooks/useGitStatus'
import { useCardMutations } from './hooks/useCardMutations'
import { useImportFlow } from './hooks/useImportFlow'
import { useExport } from './hooks/useExport'
import { useNativeSetLink } from './hooks/useNativeSetLink'
import { useSetActions } from './hooks/useSetActions'
import { useProjectActions } from './hooks/useProjectActions'
import { useUndoShortcuts } from './hooks/useUndoShortcuts'
import { Sidebar } from './app/Sidebar'
import { TopBar } from './app/TopBar'
import { ViewRouter } from './app/ViewRouter'
import { AppDialogs } from './app/AppDialogs'
import { useNativeSync } from './hooks/useNativeSync'
import { ToastMessage } from './app/ToastMessage'

function App() {
  const session = useProjectSession()
  const { snapshot, setSnapshot, refreshProjects, activeSet } = session
  const { toast, setToast, dismissToast } = useToast()
  useDiagnosticsReporting()
  const { fieldsDirty, setFieldsDirty, confirmDiscardFields } = useDirtyGuard()
  const { view, setView, navigateView, selected, setSelected } = useAppNavigation(confirmDiscardFields)
  const filters = useCardFilters(session.cards, session.columns)
  const table = useTableColumns(snapshot, activeSet, session.columns)
  const git = useGitStatus(setToast)

  const ctx: ShellContext = {
    snapshot,
    setSnapshot,
    setToast,
    confirmDiscardFields,
    setView,
    setSelected,
    resetListControls: filters.resetListControls,
    refreshProjects,
  }
  const mutations = useCardMutations(ctx)
  const sync = useNativeSync(ctx)
  useUndoShortcuts(mutations, view === 'cards' && Boolean(activeSet))
  const importFlow = useImportFlow(ctx)
  const exportFlow = useExport(setToast)
  const native = useNativeSetLink(ctx)
  const sets = useSetActions(ctx, native.startNewSetFlow)
  const project = useProjectActions(ctx, { setImportOpen: importFlow.setImportOpen, setFieldsDirty })

  const selectTag = (tag: string) => {
    if (!confirmDiscardFields()) return
    filters.setActiveTag(filters.activeTag === tag ? '' : tag)
    setView('cards')
  }
  const openGitHub = () => {
    if (view !== 'github' && !confirmDiscardFields()) return
    setView('github')
    void git.refreshGit()
  }
  const importWorkbooks = () => void importFlow.refreshWorkbooks()

  return (
    <div className="app-shell">
      {snapshot && (
        <Sidebar
          snapshot={snapshot}
          activeSet={activeSet}
          availableNativeSetCount={session.availableNativeSets.length}
          cardCount={session.cards.length}
          view={view}
          tags={filters.tags}
          activeTag={filters.activeTag}
          gitStatus={git.gitStatus}
          onSwitchProject={project.switchProject}
          onCreateSet={sets.createSet}
          onChooseSet={(id) => void sets.chooseSet(id)}
          onDuplicateSet={(id) => void sets.duplicateSet(id)}
          onRenameSet={sets.startRename}
          onDeleteSet={(id, name, cardCount) => void sets.deleteSet(id, name, cardCount)}
          onOpenNativeLink={(setId) => void native.openNativeLink(setId)}
          onNavigate={navigateView}
          onTagClick={selectTag}
          onOpenGitHub={openGitHub}
        />
      )}

      <main className="main-area">
        <TopBar
          snapshot={snapshot}
          activeSet={activeSet}
          fieldsDirty={fieldsDirty}
          onSwitchProject={() => void project.switchProject()}
          onShowCards={() => navigateView('cards')}
          onImport={importWorkbooks}
          onExport={exportFlow.exportCards}
          onAddProject={project.addProject}
        />
        <ViewRouter
          session={session}
          view={view}
          filters={filters}
          table={table}
          git={git}
          sync={sync}
          mutations={mutations}
          project={project}
          native={native}
          onImport={importWorkbooks}
          onExport={exportFlow.exportCards}
          onCreateSet={sets.createSet}
          onDirty={setFieldsDirty}
          onOpenCard={setSelected}
        />
      </main>
      <AppDialogs
        session={session}
        selected={selected}
        filteredCards={filters.filteredCards}
        onCloseEditor={() => setSelected(null)}
        onOpenCard={setSelected}
        mutations={mutations}
        importFlow={importFlow}
        exportFlow={exportFlow}
        native={native}
        sets={sets}
        project={project}
      />
      {toast && <ToastMessage toast={toast} onDismiss={dismissToast} />}
    </div>
  )
}

export default App
