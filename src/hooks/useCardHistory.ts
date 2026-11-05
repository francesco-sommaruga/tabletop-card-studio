import { useEffect, useRef } from 'react'
import { clearSet, emptyHistory, recordChange, stepBack, stepForward } from '../lib/cardHistory'
import type { CardHistory, HistoryEntry, HistoryStep } from '../lib/cardHistory'

/**
 * Undo/redo stacks of the open project, keyed by set id (see `lib/cardHistory`). Kept in a ref: no UI
 * renders from it, and a ref always holds the latest stacks for rapid successive shortcuts.
 * Cleared when the project changes.
 */
export function useCardHistory(projectPath: string | undefined) {
  const history = useRef<CardHistory>(emptyHistory)
  useEffect(() => {
    history.current = emptyHistory
  }, [projectPath])

  const take = (step: HistoryStep | null) => {
    if (step) history.current = step.history
    return step?.entry ?? null
  }
  return {
    record: (setId: string, entry: HistoryEntry) => {
      history.current = recordChange(history.current, setId, entry)
    },
    takeUndo: (setId: string) => take(stepBack(history.current, setId)),
    takeRedo: (setId: string) => take(stepForward(history.current, setId)),
    clear: (setId: string) => {
      history.current = clearSet(history.current, setId)
    },
  }
}
