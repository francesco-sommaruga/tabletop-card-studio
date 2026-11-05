import type { Dispatch, SetStateAction } from 'react'
import type { Card, ProjectSnapshot } from '../types'
import type { View } from '../lib/view'
import type { ShowToast } from './useToast'

/** State and guards shared by the action hooks (project, sets, import, card mutations). */
export interface ShellContext {
  snapshot: ProjectSnapshot | null
  setSnapshot: Dispatch<SetStateAction<ProjectSnapshot | null>>
  setToast: ShowToast
  confirmDiscardFields: () => boolean
  setView: (view: View) => void
  setSelected: (card: Card | null) => void
  resetListControls: () => void
  refreshProjects: () => Promise<void>
}

export const errorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback)
