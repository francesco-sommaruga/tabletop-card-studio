import type { ProjectSummary, ProjectSnapshot } from '../types'
import { ChooserHeader } from './project-chooser/ChooserHeader'
import { ProjectLibrary } from './project-chooser/ProjectLibrary'
import { GithubProjectSection } from './project-chooser/GithubProjectSection'

export function ProjectChooser({
  projects,
  onOpen,
  onAdd,
  onOpenSnapshot,
}: {
  projects: ProjectSummary[]
  onOpen: (path: string) => void
  onAdd: () => void
  onOpenSnapshot: (snapshot: ProjectSnapshot) => void
}) {
  return (
    <div className="chooser-page">
      <ChooserHeader hasProjects={projects.length > 0} onAdd={onAdd} />
      {projects.length > 0 && <ProjectLibrary projects={projects} onOpen={onOpen} />}
      <GithubProjectSection onOpenSnapshot={onOpenSnapshot} />
    </div>
  )
}
