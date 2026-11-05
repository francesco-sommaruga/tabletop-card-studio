import type { Card } from '../types'
import { formatNumber } from './format'

export function makeDistribution(cards: Card[], fieldId: string, type: string, groupId?: string, groupType?: string) {
  type Row = { label: string; count: number; copies: number }
  const getValues = (card: Card, id: string, valueType?: string): string[] => {
    if (id === 'meta_tags') return card.tags.length ? [...new Set(card.tags)] : ['(Senza tag)']
    if (id === 'meta_status') return [card.status || '(Vuoto)']
    if (id === 'meta_quantity') return [String(card.quantity)]
    const raw = card.values[id]?.trim() ?? ''
    if (!raw) return ['(Vuoto)']
    if (valueType === 'number' && Number.isFinite(Number(raw))) return [String(Number(raw))]
    return [raw]
  }

  // Without an intersection, retain the compact histogram for high-cardinality numeric fields.
  if (type === 'number' && !groupId) {
    const numeric = cards
      .map((card) =>
        fieldId === 'meta_quantity'
          ? card.quantity
          : card.values[fieldId]?.trim()
            ? Number(card.values[fieldId])
            : Number.NaN,
      )
      .filter(Number.isFinite)
    if (!numeric.length) return [] as Row[]
    const distinct = [...new Set(numeric)].sort((a, b) => a - b)
    if (distinct.length <= 8)
      return distinct
        .map((value) => {
          const matching = cards.filter(
            (card) => (fieldId === 'meta_quantity' ? card.quantity : Number(card.values[fieldId])) === value,
          )
          return {
            label: String(value),
            count: matching.length,
            copies: matching.reduce((sum, card) => sum + Math.max(0, card.quantity), 0),
          }
        })
        .sort((a, b) => b.count - a.count || Number(a.label) - Number(b.label))
    const min = distinct[0],
      max = distinct[distinct.length - 1]
    const bucketCount = Math.min(8, Math.ceil(Math.sqrt(numeric.length)))
    const size = (max - min) / bucketCount || 1
    return Array.from({ length: bucketCount }, (_, index) => {
      const low = min + index * size
      const high = index === bucketCount - 1 ? max : min + (index + 1) * size
      const matching = cards.filter((card) => {
        const value =
          fieldId === 'meta_quantity'
            ? card.quantity
            : card.values[fieldId]?.trim()
              ? Number(card.values[fieldId])
              : Number.NaN
        return (
          Number.isFinite(value) &&
          (index === bucketCount - 1 ? value >= low && value <= high : value >= low && value < high)
        )
      })
      return {
        label: `${formatNumber(low)} – ${formatNumber(high)}`,
        count: matching.length,
        copies: matching.reduce((sum, card) => sum + Math.max(0, card.quantity), 0),
      }
    })
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)
  }

  const rows = new Map<string, Row>()
  for (const card of cards) {
    const primary = getValues(card, fieldId, type)
    const secondary = groupId ? getValues(card, groupId, groupType) : ['']
    for (const value of primary)
      for (const group of secondary) {
        const label = group ? `${value} · ${group}` : value
        const key = JSON.stringify([value, group])
        const row = rows.get(key) ?? { label, count: 0, copies: 0 }
        row.count += 1
        row.copies += Math.max(0, card.quantity)
        rows.set(key, row)
      }
  }
  return [...rows.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'it'))
}
