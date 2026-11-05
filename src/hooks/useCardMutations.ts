import type { Card, CardStatus, ColumnDefinition } from '../types'
import { ensureGeneratedIdValues } from '../generatedIds'
import { resolveConditionalValues } from '../conditional'
import { blankCard } from '../lib/cards'
import { errorMessage } from './shellContext'
import type { ShellContext } from './shellContext'

type CardMutationsContext = Pick<ShellContext, 'snapshot' | 'setSnapshot' | 'setToast' | 'setSelected'>

export interface CommitCardsOptions {
  /**
   * New column definitions saved together with the cards (columns page). Rules and generated IDs are
   * resolved against them, and the columns are saved before the cards.
   */
  columns?: ColumnDefinition[]
}

/** Applies conditional rules and fills generated IDs for every card. */
const resolveCards = (cards: Card[], columns: ColumnDefinition[]) =>
  ensureGeneratedIdValues(
    cards.map((card) => resolveConditionalValues(columns, card)),
    columns,
    () => crypto.randomUUID(),
  )

const parseTags = (value: string) => [
  ...new Set(
    value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  ),
]

/** Card changes of the active set. All of them persist through `commitCards`. */
export function useCardMutations({ snapshot, setSnapshot, setToast, setSelected }: CardMutationsContext) {
  const cards = snapshot?.cards ?? []
  const columns = snapshot?.columns ?? []

  /**
   * THE card persistence funnel: the only renderer caller of `window.cardCms.saveCards`.
   * Resolves rules and generated IDs, updates the snapshot optimistically, then saves.
   * Save errors are reported as a toast; the returned promise never rejects.
   */
  const commitCards = (next: Card[], options: CommitCardsOptions = {}): Promise<void> => {
    if (!snapshot) return Promise.resolve()
    if (options.columns) {
      const nextColumns = options.columns
      const resolved = resolveCards(next, nextColumns)
      setSnapshot({ ...snapshot, columns: nextColumns, cards: resolved })
      return window.cardCms
        .saveColumns(nextColumns)
        .then(() => window.cardCms.saveCards(resolved))
        .catch((error) => setToast(errorMessage(error, 'Impossibile salvare le modifiche')))
    }
    const resolved = resolveCards(next, columns)
    setSnapshot({
      ...snapshot,
      cards: resolved,
      sets: snapshot.sets.map((set) =>
        set.id === snapshot.activeSetId ? { ...set, cardCount: resolved.length } : set,
      ),
    })
    return window.cardCms
      .saveCards(resolved)
      .catch((error) => setToast(errorMessage(error, 'Impossibile salvare le carte')))
  }

  const saveInlineField = (card: Card, fieldId: string, value: string) => {
    const updated: Card = { ...card, updatedAt: new Date().toISOString() }
    if (fieldId === 'meta_title') updated.title = value
    else if (fieldId === 'meta_tags') updated.tags = parseTags(value)
    else if (fieldId === 'meta_status') updated.status = value as CardStatus
    else if (fieldId === 'meta_quantity') updated.quantity = Math.max(1, Number(value) || 1)
    else updated.values = { ...card.values, [fieldId]: value }
    void commitCards(cards.map((item) => (item.id === card.id ? updated : item)))
  }
  const addCard = () => {
    const next = resolveConditionalValues(columns, blankCard(columns))
    void commitCards([next, ...cards])
    setSelected(next)
  }
  const saveCard = (next: Card) => {
    next = resolveConditionalValues(columns, next)
    void commitCards(
      cards.map((card) => (card.id === next.id ? { ...next, updatedAt: new Date().toISOString() } : card)),
    )
    setSelected(null)
    setToast('Carta aggiornata')
  }
  const deleteCard = (target: Card) => {
    void commitCards(cards.filter((card) => card.id !== target.id))
    setSelected(null)
    setToast('Carta rimossa dal set')
  }
  /** Columns page save: cards are re-resolved against the new columns and saved after them. */
  const updateColumns = (next: ColumnDefinition[]) => {
    if (!snapshot) return
    void commitCards(snapshot.cards, { columns: next })
  }
  return { commitCards, saveInlineField, addCard, saveCard, deleteCard, updateColumns }
}

export type CardMutations = ReturnType<typeof useCardMutations>
