import { useEffect, useMemo, useState } from 'react'
import type { Card } from '../types'
import { pruneSelection, rangeSelection, selectionState, toggleAllSelection, toggleSelection } from '../lib/selection'

/**
 * Selected rows of the cards table. The selection is always a subset of the filtered cards: it clears
 * when `resetKey` (active set + filters) changes, and ids that leave the filtered list are dropped.
 * Shift-click ranges are anchored on the last toggled row, in filtered order.
 */
export function useCardSelection(filteredCards: Card[], resetKey: string) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [anchorId, setAnchorId] = useState<string | null>(null)
  const order = useMemo(() => filteredCards.map((card) => card.id), [filteredCards])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const clear = () => {
    setSelectedIds([])
    setAnchorId(null)
  }
  useEffect(clear, [resetKey])
  useEffect(() => setSelectedIds((current) => pruneSelection(current, order)), [order])

  const toggle = (id: string, isRange = false) => {
    setSelectedIds((current) => (isRange ? rangeSelection(current, order, anchorId, id) : toggleSelection(current, id)))
    setAnchorId(id)
  }
  const toggleAll = () => {
    setSelectedIds((current) => toggleAllSelection(current, order))
    setAnchorId(null)
  }
  return {
    selectedIds,
    count: selectedIds.length,
    headerState: selectionState(selectedIds, order),
    isSelected: (id: string) => selectedSet.has(id),
    toggle,
    toggleAll,
    clear,
  }
}

export type CardSelection = ReturnType<typeof useCardSelection>
