import { BookOpen, BarChart3, Columns3, Tag, Images, Braces, FileText, Settings, Github } from 'lucide-react'
import type { GitStatus } from '../types'
import type { View } from '../lib/view'

export function SidebarNavigation({
  view,
  hasActiveSet,
  activeSetCardCount,
  assetCount,
  variableCount,
  tags,
  activeTag,
  gitStatus,
  onNavigate,
  onTagClick,
  onOpenGitHub,
}: {
  view: View
  hasActiveSet: boolean
  activeSetCardCount: number
  assetCount: number
  variableCount: number
  tags: Array<[string, number]>
  activeTag: string
  gitStatus: GitStatus | null
  onNavigate: (view: View) => void
  onTagClick: (tag: string) => void
  onOpenGitHub: () => void
}) {
  const navClass = (target: View) => `nav-item ${view === target ? 'active' : ''}`
  return (
    <nav className="sidebar-navigation" aria-label="Navigazione progetto e set">
      <section className="sidebar-nav-group" aria-label="Set corrente">
        <div className="side-caption nav-group-heading">SET CORRENTE</div>
        <button className={navClass('cards')} onClick={() => onNavigate('cards')} disabled={!hasActiveSet}>
          <BookOpen size={17} />
          <span>Carte</span>
          <span className="nav-count">{activeSetCardCount}</span>
        </button>
        <button className={navClass('stats')} onClick={() => onNavigate('stats')} disabled={!hasActiveSet}>
          <BarChart3 size={17} />
          <span>Statistiche</span>
        </button>
        <button className={navClass('columns')} onClick={() => onNavigate('columns')} disabled={!hasActiveSet}>
          <Columns3 size={17} />
          <span>Campi e colonne</span>
        </button>
        <div className="side-caption tag-heading">
          <span>TAG DEL SET</span>
          <Tag size={13} />
        </div>
        <div className="tag-list">
          {tags.length ? (
            tags.map(([tag, count]) => (
              <button
                key={tag}
                className={`tag-filter ${activeTag === tag ? 'selected' : ''}`}
                onClick={() => onTagClick(tag)}
              >
                <span className="tag-dot" />
                <span>{tag}</span>
                <span className="tag-count">{count}</span>
              </button>
            ))
          ) : (
            <div className="tag-empty">I tag delle carte compariranno qui.</div>
          )}
        </div>
      </section>
      <div className="sidebar-nav-divider" />
      <section className="sidebar-nav-group" aria-label="Strumenti del progetto">
        <div className="side-caption nav-group-heading">PROGETTO</div>
        <button className={navClass('assets')} onClick={() => onNavigate('assets')}>
          <Images size={17} />
          <span>Asset di progetto</span>
          <span className="nav-count">{assetCount}</span>
        </button>
        <button className={navClass('variables')} onClick={() => onNavigate('variables')}>
          <Braces size={17} />
          <span>Variabili</span>
          <span className="nav-count">{variableCount}</span>
        </button>
        <button className={navClass('markdown')} onClick={() => onNavigate('markdown')}>
          <FileText size={17} />
          <span>Documenti Markdown</span>
        </button>
        <button className={navClass('settings')} onClick={() => onNavigate('settings')}>
          <Settings size={17} />
          <span>Impostazioni progetto</span>
        </button>
        <button className={navClass('github')} onClick={onOpenGitHub}>
          <Github size={17} />
          <span>GitHub</span>
          {gitStatus?.isRepo && (
            <span className={`github-nav-dot ${gitStatus.changedFiles.length ? 'has-changes' : ''}`} />
          )}
        </button>
      </section>
    </nav>
  )
}
