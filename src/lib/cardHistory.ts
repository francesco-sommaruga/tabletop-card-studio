import type { Card } from '../types'

/** Maximum undo entries kept per set. */
export const HISTORY_LIMIT = 50

/** One undoable card change: the full card list of a set before and after it. */
export interface HistoryEntry {
  label: string
  before: Card[]
  after: Card[]
}

interface SetStacks {
  undo: HistoryEntry[]
  redo: HistoryEntry[]
}

/** Undo/redo stacks keyed by set id. Immutable: every operation returns a new history. */
export type CardHistory = Readonly<Record<string, SetStacks>>

/** Result of an undo/redo step: the entry to apply and the history after the step. */
export interface HistoryStep {
  entry: HistoryEntry
  history: CardHistory
}

export const emptyHistory: CardHistory = {}

const stacksOf = (history: CardHistory, setId: string): SetStacks => history[setId] ?? { undo: [], redo: [] }

/** Records a new change for a set; its redo stack is cleared. */
export function recordChange(history: CardHistory, setId: string, entry: HistoryEntry): CardHistory {
  const undo = [...stacksOf(history, setId).undo, entry].slice(-HISTORY_LIMIT)
  return { ...history, [setId]: { undo, redo: [] } }
}

/** Takes the latest change of a set (to undo) and moves it to the redo stack. */
export function stepBack(history: CardHistory, setId: string): HistoryStep | null {
  const { undo, redo } = stacksOf(history, setId)
  const entry = undo[undo.length - 1]
  if (!entry) return null
  return { entry, history: { ...history, [setId]: { undo: undo.slice(0, -1), redo: [...redo, entry] } } }
}

/** Takes the latest undone change of a set (to redo) and moves it back to the undo stack. */
export function stepForward(history: CardHistory, setId: string): HistoryStep | null {
  const { undo, redo } = stacksOf(history, setId)
  const entry = redo[redo.length - 1]
  if (!entry) return null
  return { entry, history: { ...history, [setId]: { undo: [...undo, entry], redo: redo.slice(0, -1) } } }
}

/** Forgets the whole history of one set. */
export function clearSet(history: CardHistory, setId: string): CardHistory {
  const { [setId]: _removed, ...rest } = history
  return rest
}

/** True when two card lists have the same content in the same order. */
export const sameCards = (a: Card[], b: Card[]) => a === b || JSON.stringify(a) === JSON.stringify(b)

/** Undo label for a single card, e.g. `Modifica di «Goblin»`. */
export const cardLabel = (action: string, card: Card) => `${action} «${card.title.trim() || 'Senza titolo'}»`
