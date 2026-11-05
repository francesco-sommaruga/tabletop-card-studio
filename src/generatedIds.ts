import type { Card, ColumnDefinition } from './types'

const reservedCardFieldIds = new Set(['meta_title', 'meta_quantity', 'meta_status', 'meta_tags'])

export function supportsGeneratedId(fieldId: string) {
  return !reservedCardFieldIds.has(fieldId)
}

export function ensureGeneratedIdValues(
  cards: Card[],
  columns: ColumnDefinition[],
  createId: () => string,
  regenerate = false,
): Card[] {
  const idColumns = columns.filter((column) => column.type === 'id' && supportsGeneratedId(column.fieldId))
  if (!idColumns.length || !cards.length) return cards

  const nextValues = cards.map((card) => card.values ?? {})
  const changedCards = new Set<number>()

  for (const column of idColumns) {
    const preserved = new Set<string>()
    const needsGeneration: number[] = []
    for (let index = 0; index < cards.length; index += 1) {
      const current = nextValues[index][column.fieldId]
      const value = typeof current === 'string' ? current.trim() : ''
      if (!regenerate && value && !preserved.has(value)) {
        preserved.add(value)
        if (current !== value) {
          nextValues[index] = { ...nextValues[index], [column.fieldId]: value }
          changedCards.add(index)
        }
      } else needsGeneration.push(index)
    }

    const used = new Set(preserved)
    for (const index of needsGeneration) {
      let value = createId().trim()
      while (!value || used.has(value)) value = createId().trim()
      nextValues[index] = { ...nextValues[index], [column.fieldId]: value }
      changedCards.add(index)
      used.add(value)
    }
  }

  if (!changedCards.size) return cards
  return cards.map((card, index) => (changedCards.has(index) ? { ...card, values: nextValues[index] } : card))
}
