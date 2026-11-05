import type { Card, CardStatus, ColumnDefinition } from '../types'
import { internalFieldName, tableMetaFieldIds } from './tableColumns'

/**
 * Pure bulk transformations of the active set's cards. Each returns the full card list; cards that do
 * not change keep their identity (so `hasCardChanges` can detect no-ops) and changed ones get `now`.
 */

export interface BulkField {
  fieldId: string
  label: string
  type: NonNullable<ColumnDefinition['type']>
  options: string[]
}

function updateSelected(cards: Card[], ids: string[], now: string, change: (card: Card) => Card | null) {
  const selected = new Set(ids)
  return cards.map((card) => {
    if (!selected.has(card.id)) return card
    const next = change(card)
    return next ? { ...next, updatedAt: now } : card
  })
}

export const applyStatus = (cards: Card[], ids: string[], status: CardStatus, now: string) =>
  updateSelected(cards, ids, now, (card) => (card.status === status ? null : { ...card, status }))

export function addTag(cards: Card[], ids: string[], tag: string, now: string) {
  const clean = tag.trim()
  if (!clean) return cards
  return updateSelected(cards, ids, now, (card) =>
    card.tags.includes(clean) ? null : { ...card, tags: [...card.tags, clean] },
  )
}

export const removeTag = (cards: Card[], ids: string[], tag: string, now: string) =>
  updateSelected(cards, ids, now, (card) =>
    card.tags.includes(tag) ? { ...card, tags: card.tags.filter((item) => item !== tag) } : null,
  )

export function setFieldValue(cards: Card[], ids: string[], fieldId: string, value: string, now: string) {
  if (fieldId === 'meta_quantity') {
    const quantity = Math.max(1, Math.floor(Number(value)) || 1)
    return updateSelected(cards, ids, now, (card) => (card.quantity === quantity ? null : { ...card, quantity }))
  }
  return updateSelected(cards, ids, now, (card) =>
    (card.values[fieldId] ?? '') === value ? null : { ...card, values: { ...card.values, [fieldId]: value } },
  )
}

export function deleteCards(cards: Card[], ids: string[]) {
  const selected = new Set(ids)
  return cards.filter((card) => !selected.has(card.id))
}

export const hasCardChanges = (before: Card[], after: Card[]) =>
  before.length !== after.length || after.some((card, index) => card !== before[index])

/** Distinct tags carried by the selected cards, sorted (Italian collation). */
export function selectedTags(cards: Card[], ids: string[]) {
  const selected = new Set(ids)
  const tags = cards.filter((card) => selected.has(card.id)).flatMap((card) => card.tags)
  return [...new Set(tags)].sort((a, b) => a.localeCompare(b, 'it'))
}

/** Fields offered by "Imposta campo": quantity and custom fields, minus images, generated ids and rule-driven fields. */
export function bulkEditableFields(columns: ColumnDefinition[]): BulkField[] {
  const custom = columns.filter(
    (column, index, all) =>
      !tableMetaFieldIds.has(column.fieldId) &&
      column.type !== 'image' &&
      column.type !== 'id' &&
      !column.rules?.length &&
      all.findIndex((item) => item.fieldId === column.fieldId) === index,
  )
  return [
    { fieldId: 'meta_quantity', label: 'Quantità', type: 'number', options: [] },
    ...custom.map((column) => ({
      fieldId: column.fieldId,
      label: internalFieldName(column),
      type: column.type ?? 'text',
      options: column.options ?? [],
    })),
  ]
}

export const cardCountLabel = (count: number) => `${count} ${count === 1 ? 'carta' : 'carte'}`
