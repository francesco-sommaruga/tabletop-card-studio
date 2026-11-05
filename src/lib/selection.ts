/** Pure selection logic for the cards table. Selections are id lists; `order` is the filtered row order. */

export type SelectionState = 'none' | 'some' | 'all'

export const toggleSelection = (selected: string[], id: string) =>
  selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]

/**
 * Shift-click: applies the target's new state (selected if it was not, deselected if it was) to every
 * id between the anchor and the target, inclusive. Without a usable anchor it is a plain toggle.
 */
export function rangeSelection(selected: string[], order: string[], anchorId: string | null, targetId: string) {
  const from = anchorId ? order.indexOf(anchorId) : -1
  const to = order.indexOf(targetId)
  if (from < 0 || to < 0) return toggleSelection(selected, targetId)
  const range = order.slice(Math.min(from, to), Math.max(from, to) + 1)
  if (selected.includes(targetId)) return selected.filter((id) => !range.includes(id))
  return [...selected, ...range.filter((id) => !selected.includes(id))]
}

/** Keeps only allowed ids; returns the same array when nothing is dropped (safe for setState). */
export function pruneSelection(selected: string[], allowed: string[]) {
  const allowedSet = new Set(allowed)
  const kept = selected.filter((id) => allowedSet.has(id))
  return kept.length === selected.length ? selected : kept
}

export function selectionState(selected: string[], order: string[]): SelectionState {
  const selectedSet = new Set(selected)
  const count = order.filter((id) => selectedSet.has(id)).length
  if (!count) return 'none'
  return count === order.length ? 'all' : 'some'
}

/** Header checkbox: selects every ordered id, or clears when all of them are already selected. */
export const toggleAllSelection = (selected: string[], order: string[]) =>
  selectionState(selected, order) === 'all' ? [] : [...order]
