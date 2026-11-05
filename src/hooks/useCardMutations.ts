import { useRef } from 'react'
import type { Card, CardStatus, ColumnDefinition, ProjectSnapshot } from '../types'
import { ensureGeneratedIdValues } from '../generatedIds'
import { resolveConditionalValues } from '../conditional'
import { blankCard } from '../lib/cards'
import { cardLabel, sameCards } from '../lib/cardHistory'
import { errorMessage } from './shellContext'
import type { ShellContext } from './shellContext'
import { useCardHistory } from './useCardHistory'

type CardMutationsContext = Pick<ShellContext, 'snapshot' | 'setSnapshot' | 'setToast' | 'setSelected'>

export interface CommitCardsOptions {
  /**
   * New column definitions saved together with the cards (columns page). Rules and generated IDs are
   * resolved against them, and the columns are saved before the cards. Not undoable: the set's history is cleared.
   */
  columns?: ColumnDefinition[]
  /** Human-readable description of the change (Italian), shown by undo/redo. */
  label?: string
}

/** Applies conditional rules and fills generated IDs for every card. */
const resolveCards = (cards: Card[], columns: ColumnDefinition[]) =>
  ensureGeneratedIdValues(
    cards.map((card) => resolveConditionalValues(columns, card)),
    columns,
    () => crypto.randomUUID(),
  )

const withActiveCards = (snapshot: ProjectSnapshot, cards: Card[]): ProjectSnapshot => ({
  ...snapshot,
  cards,
  sets: snapshot.sets.map((set) => (set.id === snapshot.activeSetId ? { ...set, cardCount: cards.length } : set)),
})

const parseTags = (value: string) => [
  ...new Set(
    value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  ),
]

/** Card changes of the active set. All of them persist through `commitCards`; card changes are undoable. */
export function useCardMutations({ snapshot, setSnapshot, setToast, setSelected }: CardMutationsContext) {
  // Latest snapshot, also between a commit and the re-render it causes: rapid commits and undo/redo
  // build on each other instead of on the snapshot of a stale render.
  const latest = useRef(snapshot)
  latest.current = snapshot
  const history = useCardHistory(snapshot?.projectPath)
  const currentCards = () => latest.current?.cards ?? []
  const currentColumns = () => latest.current?.columns ?? []

  /** Applies `patch` to the snapshot right away (optimistic), unless another set became active meanwhile. */
  const patchActiveSet = (setId: string | null, patch: (current: ProjectSnapshot) => ProjectSnapshot) => {
    const apply = (current: ProjectSnapshot | null) =>
      current && current.activeSetId === setId ? patch(current) : current
    latest.current = apply(latest.current)
    setSnapshot(apply)
  }
  const persistCards = (setId: string | null, cards: Card[]) => {
    patchActiveSet(setId, (current) => withActiveCards(current, cards))
    return window.cardCms
      .saveCards(cards)
      .catch((error) => setToast(errorMessage(error, 'Impossibile salvare le carte')))
  }

  /**
   * THE card persistence funnel: the only renderer caller of `window.cardCms.saveCards`.
   * Resolves rules and generated IDs, records an undo entry, updates the snapshot optimistically, then saves.
   * Save errors are reported as a toast; the returned promise never rejects.
   */
  const commitCards = (next: Card[], options: CommitCardsOptions = {}): Promise<void> => {
    const current = latest.current
    if (!current) return Promise.resolve()
    const setId = current.activeSetId
    if (options.columns) {
      const nextColumns = options.columns
      const resolved = resolveCards(next, nextColumns)
      if (setId) history.clear(setId)
      patchActiveSet(setId, (snapshot) => ({ ...snapshot, columns: nextColumns, cards: resolved }))
      return window.cardCms
        .saveColumns(nextColumns)
        .then(() => window.cardCms.saveCards(resolved))
        .catch((error) => setToast(errorMessage(error, 'Impossibile salvare le modifiche')))
    }
    const resolved = resolveCards(next, current.columns)
    const label = options.label ?? 'Modifica delle carte'
    if (setId) history.record(setId, { label, before: current.cards, after: resolved })
    return persistCards(setId, resolved)
  }

  /** Undo/redo for the active set. Refuses (and forgets the set's history) if its cards changed elsewhere. */
  const stepHistory = (isUndo: boolean) => {
    const current = latest.current
    const setId = current?.activeSetId
    if (!current || !setId) return
    const entry = isUndo ? history.takeUndo(setId) : history.takeRedo(setId)
    if (!entry) return setToast(isUndo ? 'Niente da annullare' : 'Niente da ripristinare')
    if (!sameCards(isUndo ? entry.after : entry.before, current.cards)) {
      history.clear(setId)
      const action = isUndo ? 'annullare' : 'ripristinare'
      return setToast(`Impossibile ${action}: le carte del set sono cambiate nel frattempo`)
    }
    void persistCards(setId, isUndo ? entry.before : entry.after)
    if (isUndo) setToast(`Annullato: ${entry.label}`, { label: 'Ripristina', run: redo })
    else setToast(`Ripristinato: ${entry.label}`)
  }
  const undo = () => stepHistory(true)
  const redo = () => stepHistory(false)

  const saveInlineField = (card: Card, fieldId: string, value: string) => {
    const updated: Card = { ...card, updatedAt: new Date().toISOString() }
    if (fieldId === 'meta_title') updated.title = value
    else if (fieldId === 'meta_tags') updated.tags = parseTags(value)
    else if (fieldId === 'meta_status') updated.status = value as CardStatus
    else if (fieldId === 'meta_quantity') updated.quantity = Math.max(1, Number(value) || 1)
    else updated.values = { ...card.values, [fieldId]: value }
    const next = currentCards().map((item) => (item.id === card.id ? updated : item))
    void commitCards(next, { label: cardLabel('Modifica di', card) })
  }
  const addCard = () => {
    const columns = currentColumns()
    const next = resolveConditionalValues(columns, blankCard(columns))
    void commitCards([next, ...currentCards()], { label: 'Nuova carta' })
    setSelected(next)
  }
  /** Saves an edited card and keeps the editor open (used when moving to another card). */
  const updateCard = (next: Card) => {
    const cards = currentCards()
    const previous = cards.find((card) => card.id === next.id) ?? next
    const resolved = { ...resolveConditionalValues(currentColumns(), next), updatedAt: new Date().toISOString() }
    void commitCards(
      cards.map((card) => (card.id === next.id ? resolved : card)),
      { label: cardLabel('Modifica di', previous) },
    )
  }
  const saveCard = (next: Card) => {
    updateCard(next)
    setSelected(null)
    setToast('Carta aggiornata')
  }
  const deleteCard = (target: Card) => {
    void commitCards(
      currentCards().filter((card) => card.id !== target.id),
      { label: cardLabel('Eliminazione di', target) },
    )
    setSelected(null)
    setToast('Carta rimossa dal set')
  }
  /** Columns page save: cards are re-resolved against the new columns and saved after them. */
  const updateColumns = (next: ColumnDefinition[]) => {
    if (latest.current) void commitCards(latest.current.cards, { columns: next })
  }
  return { commitCards, saveInlineField, addCard, updateCard, saveCard, deleteCard, updateColumns, undo, redo }
}

export type CardMutations = ReturnType<typeof useCardMutations>
