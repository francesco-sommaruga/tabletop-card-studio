import { useEffect, useState } from 'react'
import type { ProjectSnapshot, ProjectSummary } from '../types'

/** The open project snapshot, the recent-projects list and values derived from the snapshot. */
export function useProjectSession() {
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const refreshProjects = () => window.cardCms.listProjects().then(setProjects)
  useEffect(() => {
    void refreshProjects()
  }, [])

  const cards = snapshot?.cards ?? []
  const columns = snapshot?.columns ?? []
  const activeSet = snapshot?.sets.find((set) => set.id === snapshot.activeSetId)
  const linkedNativeKeys = new Set(
    (snapshot?.sets ?? [])
      .filter((set) => set.nativeSetFile && set.nativeSetIndex !== undefined)
      .map((set) => `${set.nativeSetFile}:${set.nativeSetIndex}`),
  )
  const availableNativeSets = (snapshot?.nativeSets ?? []).filter(
    (nativeSet) => !linkedNativeKeys.has(`${nativeSet.file}:${nativeSet.index}`),
  )
  return { snapshot, setSnapshot, projects, refreshProjects, cards, columns, activeSet, availableNativeSets }
}

export type ProjectSession = ReturnType<typeof useProjectSession>
export type SetSummary = ProjectSnapshot['sets'][number]
