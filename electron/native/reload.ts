// Pure merge of a native Tabletop Creator set into a linked Card Studio set.
import type { Card, ColumnDefinition, ProjectSet } from '../../src/types'
import { mergeColumnDefinitions } from '../fields'
import { columnsFromNativeItems, nativeCard } from './items'

export type NativeItem = Record<string, unknown>

/** Object items of a native set (`document.sets[index].items`), skipping malformed entries. */
export function nativeSetItems(nativeSet: { items?: unknown }): NativeItem[] {
  return (Array.isArray(nativeSet.items) ? nativeSet.items : []).filter(
    (item: unknown): item is NativeItem => Boolean(item) && typeof item === 'object' && !Array.isArray(item),
  )
}

function titleKey(item: NativeItem, index: number) {
  let title: unknown
  for (const detail of Array.isArray(item.details) ? item.details : []) {
    const record = detail as { name?: unknown; data?: { value?: unknown } } | null
    if (record?.name === 'title' && record.data && typeof record.data === 'object') title = record.data.value
  }
  return String(title ?? `Carta ${index + 1}`)
    .trim()
    .toLocaleLowerCase()
}

/**
 * Pairs each native item with an existing Card Studio card: first by title (as linking does), then,
 * when `useIndexFallback` is set, by position for items whose title changed. Each card is used once.
 */
export function matchCardsToItems(cards: Card[], items: NativeItem[], useIndexFallback: boolean) {
  const byTitle = new Map<string, Card[]>()
  for (const card of cards) {
    const key = card.title.trim().toLocaleLowerCase()
    byTitle.set(key, [...(byTitle.get(key) ?? []), card])
  }
  const used = new Set<Card>()
  const matches = items.map((item, index) => {
    const match = byTitle.get(titleKey(item, index))?.shift()
    if (match) used.add(match)
    return match
  })
  if (!useIndexFallback) return matches
  return matches.map((match, index) => {
    if (match || !cards[index] || used.has(cards[index])) return match
    used.add(cards[index])
    return cards[index]
  })
}

/**
 * Rebuilds the cards of a linked set from the native items: native fields, title and quantity come
 * from Tabletop Creator; ids, status, tags, updatedAt and values of fields absent in the native file
 * are kept from the matching card. Existing column definitions are kept, new native fields appended.
 */
export function reloadSetFromNative(
  set: ProjectSet,
  items: NativeItem[],
): { cards: Card[]; columns: ColumnDefinition[] } {
  const columns = mergeColumnDefinitions(set.columns, columnsFromNativeItems(items, set.columns))
  const matches = matchCardsToItems(set.cards, items, true)
  const cards = items.map((item, index) => nativeCard(`Carta ${index + 1}`, item, columns, matches[index]))
  return { cards, columns }
}
