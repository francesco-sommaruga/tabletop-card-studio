import { MoreHorizontal, Plus, Braces, Archive, CircleHelp } from 'lucide-react'
import type { GitStatus, ProjectSnapshot } from '../types'
import type { View } from '../lib/view'
import type { SetSummary } from '../hooks/useProjectSession'
import { SidebarSetList } from './SidebarSetList'
import { SidebarNavigation } from './SidebarNavigation'

export interface SidebarProps {
  snapshot: ProjectSnapshot
  activeSet: SetSummary | undefined
  availableNativeSetCount: number
  cardCount: number
  view: View
  tags: Array<[string, number]>
  activeTag: string
  gitStatus: GitStatus | null
  onSwitchProject: () => void
  onCreateSet: () => void
  onChooseSet: (id: string) => void
  onDuplicateSet: (id: string) => void
  onRenameSet: (id: string, name: string) => void
  onDeleteSet: (id: string, name: string, cardCount: number) => void
  onOpenNativeLink: (setId: string) => void
  onNavigate: (view: View) => void
  onTagClick: (tag: string) => void
  onOpenGitHub: () => void
}

export function Sidebar(props: SidebarProps) {
  const { snapshot, activeSet, onSwitchProject } = props
  return (
    <aside className="sidebar">
      <div className="brand">
        <img className="brand-logo" src="./tabletop-card-studio-logo.svg" alt="Tabletop Card Studio" />
      </div>
      <div className="side-caption project-switch-caption">
        <span>PROGETTO</span>
        <button onClick={onSwitchProject} title="Cambia progetto">
          <MoreHorizontal size={15} />
        </button>
      </div>
      <div className="sidebar-project-name" title={snapshot.projectPath}>
        {snapshot.projectName}
      </div>
      <div className="side-caption sets-caption">
        <span>
          SET DI CARTE <b>{snapshot.sets.length}</b>
        </span>
        <button onClick={props.onCreateSet} title="Crea un set">
          <Plus size={14} />
        </button>
      </div>
      <SidebarSetList
        sets={snapshot.sets}
        activeSetId={snapshot.activeSetId}
        onChoose={props.onChooseSet}
        onDuplicate={props.onDuplicateSet}
        onRename={props.onRenameSet}
        onDelete={props.onDeleteSet}
      />
      <button
        type="button"
        className="native-set-link"
        onClick={() => activeSet && props.onOpenNativeLink(activeSet.id)}
        disabled={!activeSet || Boolean(activeSet.nativeSetFile)}
      >
        <Braces size={14} />
        <span>{activeSet?.nativeSetFile ? 'Set nativo collegato' : 'Collega un set nativo'}</span>
        <small>{props.availableNativeSetCount}</small>
      </button>
      <SidebarNavigation
        view={props.view}
        hasActiveSet={Boolean(activeSet)}
        activeSetCardCount={activeSet?.cardCount ?? 0}
        assetCount={snapshot.assets.length}
        variableCount={snapshot.variables.length}
        tags={props.tags}
        activeTag={props.activeTag}
        gitStatus={props.gitStatus}
        onNavigate={props.onNavigate}
        onTagClick={props.onTagClick}
        onOpenGitHub={props.onOpenGitHub}
      />
      <div className="sidebar-bottom">
        <div className="project-mini">
          <div className="project-icon">
            <Archive size={16} />
          </div>
          <div className="project-mini-copy">
            <strong>
              {snapshot.sets.length} set · {props.cardCount} carte
            </strong>
            <span>{snapshot.workbooks.length} file Excel nel progetto</span>
          </div>
          <button className="icon-button mini-more" aria-label="Cambia progetto" onClick={onSwitchProject}>
            <MoreHorizontal size={18} />
          </button>
        </div>
        <div className="sidebar-foot">
          <span>STUDIO EDITION</span>
          <CircleHelp size={15} />
        </div>
      </div>
    </aside>
  )
}
