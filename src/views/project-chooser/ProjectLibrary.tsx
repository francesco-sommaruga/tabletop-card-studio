import { Archive, ArrowRight } from 'lucide-react'
import type { ProjectSummary } from '../../types'

export function ProjectLibrary({ projects, onOpen }: { projects: ProjectSummary[]; onOpen: (path: string) => void }) {
  return (
    <section className="project-library">
      <div className="project-library-heading">
        <h2>Progetti recenti</h2>
        <span>{projects.length} NELLA LIBRERIA</span>
      </div>
      {projects.map((project, index) => (
        <button className="project-library-row" key={project.path} onClick={() => onOpen(project.path)}>
          <span className={`project-file-icon project-tone-${index % 3}`}>
            <Archive size={18} />
          </span>
          <span className="project-library-copy">
            <strong>{project.name}</strong>
            <small>{project.path}</small>
          </span>
          <span className="project-library-stats">
            <b>{project.setCount}</b> set <i>·</i> <b>{project.cardCount}</b> carte <i>·</i> <b>{project.fileCount}</b>{' '}
            file Excel
          </span>
          <ArrowRight size={17} />
        </button>
      ))}
    </section>
  )
}
