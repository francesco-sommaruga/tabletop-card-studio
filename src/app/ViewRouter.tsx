import type { Card } from '../types'
import type { View } from '../lib/view'
import type { ProjectSession } from '../hooks/useProjectSession'
import type { CardFilters } from '../hooks/useCardFilters'
import type { TableColumns } from '../hooks/useTableColumns'
import type { GitState } from '../hooks/useGitStatus'
import type { CardMutations } from '../hooks/useCardMutations'
import type { ProjectActions } from '../hooks/useProjectActions'
import type { NativeSetLink } from '../hooks/useNativeSetLink'
import { ProjectChooser } from '../views/ProjectChooser'
import { MarkdownPage } from '../views/markdown/MarkdownPage'
import { AssetsPage } from '../views/AssetsPage'
import { VariablesPage } from '../views/variables/VariablesPage'
import { ProjectSettingsPage } from '../views/ProjectSettingsPage'
import { StatisticsPage } from '../views/StatisticsPage'
import { ColumnsPage } from '../views/ColumnsPage'
import { CardsView } from '../views/cards/CardsView'
import { ImportLanding } from '../components/import/ImportLanding'
import { GitHubView } from './GitHubView'

export interface ViewRouterProps {
  session: ProjectSession
  view: View
  filters: CardFilters
  table: TableColumns
  git: GitState
  mutations: CardMutations
  project: ProjectActions
  native: NativeSetLink
  onImport: () => void
  onExport: () => void
  onCreateSet: () => void
  onDirty: (dirty: boolean) => void
  onOpenCard: (card: Card) => void
}

/** Main area content: project chooser when no project is open, otherwise the current view. */
export function ViewRouter(props: ViewRouterProps) {
  const { session, view, project, native, mutations, onDirty } = props
  const { snapshot, activeSet, cards, columns } = session
  if (!snapshot)
    return (
      <ProjectChooser
        projects={session.projects}
        onOpen={(projectPath) => void project.openPath(projectPath)}
        onAdd={project.addProject}
        onOpenSnapshot={project.openSnapshot}
      />
    )
  if (view === 'markdown')
    return (
      <MarkdownPage
        onList={() => window.cardCms.markdownList()}
        onRead={(file) => window.cardCms.markdownRead(file)}
        onSave={(file, content) => window.cardCms.markdownSave(file, content)}
        onCreate={(file) => window.cardCms.markdownCreate(file)}
        onRename={(file, name) => window.cardCms.markdownRename(file, name)}
        onDelete={(file) => window.cardCms.markdownDelete(file)}
        onSaved={async () => {
          await props.git.runGitAction(window.cardCms.gitStatus)
        }}
      />
    )
  if (view === 'github') return <GitHubView snapshot={snapshot} git={props.git} />
  if (view === 'assets') return <AssetsPage assets={snapshot.assets} onAdd={project.addAssets} />
  if (view === 'variables')
    return (
      <VariablesPage
        key={snapshot.projectPath}
        projectPath={snapshot.projectPath}
        variables={snapshot.variables}
        onSave={project.updateVariables}
        onDirty={onDirty}
      />
    )
  if (view === 'settings')
    return (
      <ProjectSettingsPage
        projectName={snapshot.projectName}
        projectPath={snapshot.projectPath}
        sets={snapshot.sets}
        nativeSets={snapshot.nativeSets}
        blueprints={snapshot.blueprints}
        onLink={(setId) => void native.openNativeLink(setId)}
        onUnlink={(setId, name) => void native.unlinkNativeSet(setId, name)}
        onSaveBlueprints={project.saveBlueprintAssignments}
        onDirty={onDirty}
        onOpenLog={project.openDiagnosticLog}
      />
    )
  if (!activeSet) return <ImportLanding snapshot={snapshot} onImport={props.onImport} onCreate={props.onCreateSet} />
  if (view === 'stats') return <StatisticsPage key={snapshot.activeSetId} cards={cards} columns={columns} />
  if (view === 'cards')
    return (
      <CardsView
        snapshot={snapshot}
        activeSet={activeSet}
        filters={props.filters}
        table={props.table}
        onAddCard={mutations.addCard}
        onImport={props.onImport}
        onSaveField={mutations.saveInlineField}
        onOpenCard={props.onOpenCard}
      />
    )
  return (
    <ColumnsPage
      key={snapshot.activeSetId}
      columns={columns}
      assets={snapshot.assets}
      variables={snapshot.variables}
      blueprintName={activeSet.blueprintName}
      blueprint={snapshot.blueprints.find((item) => item.name === activeSet.blueprintName)}
      sharedSetCount={
        activeSet.blueprintName
          ? snapshot.sets.filter((set) => set.blueprintName === activeSet.blueprintName).length
          : 1
      }
      onReloadBlueprints={project.reloadBlueprints}
      onSave={mutations.updateColumns}
      onDirty={onDirty}
      onExport={props.onExport}
    />
  )
}
