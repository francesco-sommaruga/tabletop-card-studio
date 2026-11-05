import { useState } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import type { Card } from '../types'
import type { CardSelection } from './useCardSelection'

/** True when the key event comes from the row itself or its selection checkbox, not from a cell control. */
const isRowLevelTarget = (event: KeyboardEvent<HTMLElement>) =>
  event.target === event.currentTarget || (event.target as HTMLElement).classList.contains('row-select-checkbox')

/**
 * Keyboard access to the cards table rows with a roving tabindex: one row is tabbable, ↑/↓ move focus,
 * Enter opens the editor, Space toggles the selection (Shift+Space extends a range), Escape clears it.
 */
export function useRowNavigation(
  tableRef: RefObject<HTMLDivElement>,
  cards: Card[],
  selection: CardSelection,
  onOpenCard: (card: Card) => void,
) {
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const tabbableId = cards.some((card) => card.id === focusedId) ? focusedId : cards[0]?.id

  const focusRow = (index: number) => tableRef.current?.querySelectorAll<HTMLElement>('.card-row')[index]?.focus()

  const onKeyDown = (event: KeyboardEvent<HTMLElement>, card: Card, index: number) => {
    if (event.key === 'Escape') {
      if (selection.count) event.preventDefault()
      selection.clear()
      return
    }
    if (!isRowLevelTarget(event)) return
    const isCheckbox = event.target !== event.currentTarget
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      focusRow(index + (event.key === 'ArrowDown' ? 1 : -1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      onOpenCard(card)
    } else if (event.key === ' ' && !isCheckbox) {
      event.preventDefault()
      selection.toggle(card.id, event.shiftKey)
    }
  }

  return (card: Card, index: number) => ({
    tabIndex: card.id === tabbableId ? 0 : -1,
    onFocus: () => setFocusedId(card.id),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => onKeyDown(event, card, index),
  })
}

export type RowNavigationProps = ReturnType<ReturnType<typeof useRowNavigation>>
