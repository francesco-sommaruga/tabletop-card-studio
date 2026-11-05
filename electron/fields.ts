import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { ensureGeneratedIdValues } from '../src/generatedIds'
import type { Card, ColumnDefinition, ProjectSet } from '../src/types'

export function fieldIdFor(header: string) {
  return `field_${
    header
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || 'unnamed'
  }`
}

export function importedFieldIdFor(header: string) {
  const lower = header.toLocaleLowerCase()
  if (['title', 'titolo', 'name', 'nome'].includes(lower)) return 'meta_title'
  if (['[item amount]', 'amount', 'quantità', 'quantita'].includes(lower)) return 'meta_quantity'
  return fieldIdFor(header)
}

export function ensureSetGeneratedIds(set: ProjectSet, regenerate = false) {
  const cards = ensureGeneratedIdValues(set.cards, set.columns, randomUUID, regenerate)
  const changed = cards !== set.cards
  if (changed) set.cards = cards
  return changed
}

export function cardFieldValue(card: Card, fieldId: string): string {
  if (fieldId === 'meta_title') return card.title
  if (fieldId === 'meta_quantity') return String(card.quantity)
  if (fieldId === 'meta_status') return card.status
  if (fieldId === 'meta_tags') return card.tags.join(', ')
  return card.values[fieldId] ?? ''
}

export function tabletopAssetReference(value: string): string {
  const normalized = value.trim().replace(/\\/g, '/')
  if (!normalized) return ''
  const lower = normalized.toLocaleLowerCase()
  const assetsMarker = lower.lastIndexOf('/assets/')
  const tabletopReference = (reference: string) =>
    reference.startsWith('images/card-studio/') ? reference.slice('images/'.length) : reference
  if (assetsMarker >= 0) return tabletopReference(normalized.slice(assetsMarker + '/assets/'.length))
  if (lower.startsWith('assets/')) return tabletopReference(normalized.slice('assets/'.length))
  if (normalized.startsWith('/') || /^[a-z]:\//i.test(normalized)) return path.posix.basename(normalized)
  return tabletopReference(normalized.replace(/^\.\//, '').replace(/^\/+/, ''))
}

export function guessFieldType(header: string): ColumnDefinition['type'] {
  return /color|colour|colore/i.test(header)
    ? 'color'
    : /image|immagine|illustrazione|artwork/i.test(header)
      ? 'image'
      : /amount|quantit|costo|cost|speed|potenza|numero|count/i.test(header)
        ? 'number'
        : /text|effetto|description|descrizione|regole/i.test(header)
          ? 'longtext'
          : 'text'
}

export function mergeColumnDefinitions(...sources: ColumnDefinition[][]): ColumnDefinition[] {
  const merged = new Map<string, ColumnDefinition>()
  for (const source of sources)
    for (const column of source) {
      if (!merged.has(column.fieldId)) merged.set(column.fieldId, structuredClone(column))
    }
  return [...merged.values()]
}
