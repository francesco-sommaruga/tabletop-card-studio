import type { Card, ColumnDefinition } from '../../src/types'
import { fieldIdFor, guessFieldType, cardFieldValue, tabletopAssetReference } from '../fields'

export function columnIdForNativeHeader(header: string) {
  if (['title', 'name', 'nome', 'titolo'].includes(header.trim().toLocaleLowerCase())) return 'meta_title'
  if (['[item amount]', 'amount', 'quantità', 'quantita'].includes(header.trim().toLocaleLowerCase()))
    return 'meta_quantity'
  return fieldIdFor(header)
}

export function columnsFromNativeItems(
  items: Record<string, unknown>[],
  existing: ColumnDefinition[],
): ColumnDefinition[] {
  const headers = new Set<string>(['[Item Amount]', 'title'])
  for (const item of items) {
    const details = Array.isArray(item.details) ? item.details : []
    for (const detail of details) {
      if (!detail || typeof detail !== 'object') continue
      const record = detail as { name?: unknown; data?: unknown }
      if (typeof record.name !== 'string' || !record.data || typeof record.data !== 'object') continue
      for (const property of Object.keys(record.data))
        headers.add(property === 'value' ? record.name : `${record.name}:${property}`)
    }
  }
  return [...headers].map((header) => {
    const prior = existing.find((column) => column.header.toLocaleLowerCase() === header.toLocaleLowerCase())
    const fieldId = columnIdForNativeHeader(header)
    return {
      ...(prior ?? {}),
      id: prior?.id ?? `column_${fieldId}`,
      header,
      fieldId,
      type: prior?.type ?? guessFieldType(header) ?? 'text',
    }
  })
}

function nativeValue(detailMap: Map<string, Record<string, unknown>>, header: string): unknown {
  const separator = header.lastIndexOf(':')
  const name = separator >= 0 ? header.slice(0, separator) : header
  const property = separator >= 0 ? header.slice(separator + 1) : 'value'
  return (detailMap.get(name) ?? {})[property]
}

export function hydrateNativeValues(card: Card, columns: ColumnDefinition[]): Card {
  if (!card.nativeItem) return card
  const item = card.nativeItem as Record<string, unknown>
  const details = new Map<string, Record<string, unknown>>()
  for (const detail of Array.isArray(item.details) ? item.details : []) {
    if (!detail || typeof detail !== 'object') continue
    const record = detail as { name?: unknown; data?: unknown }
    if (typeof record.name === 'string' && record.data && typeof record.data === 'object')
      details.set(record.name, record.data as Record<string, unknown>)
  }
  const values = { ...card.values }
  for (const column of columns) {
    if (
      column.fieldId === 'meta_title' ||
      column.fieldId === 'meta_quantity' ||
      Object.prototype.hasOwnProperty.call(values, column.fieldId)
    )
      continue
    const value = nativeValue(details, column.header)
    if (value !== null && value !== undefined) values[column.fieldId] = String(value)
  }
  return { ...card, values }
}

export function nativeCard(
  title: string,
  item: Record<string, unknown>,
  columns: ColumnDefinition[],
  existing?: Card,
): Card {
  const detailMap = new Map<string, Record<string, unknown>>()
  for (const detail of Array.isArray(item.details) ? item.details : []) {
    if (!detail || typeof detail !== 'object') continue
    const record = detail as { name?: unknown; data?: unknown }
    if (typeof record.name === 'string' && record.data && typeof record.data === 'object')
      detailMap.set(record.name, record.data as Record<string, unknown>)
  }
  const titleValue = String(nativeValue(detailMap, 'title') ?? title)
  const values: Record<string, string> = {}
  for (const column of columns) {
    if (column.fieldId === 'meta_title' || column.fieldId === 'meta_quantity') continue
    const value = nativeValue(detailMap, column.header)
    if (value !== null && value !== undefined) values[column.fieldId] = String(value)
  }
  const modified = Number(item.last_modification_date_unix)
  return {
    id: existing?.id ?? `card_${crypto.randomUUID()}`,
    title: titleValue,
    status: existing?.status ?? 'Idea',
    tags: existing?.tags ? [...existing.tags] : [],
    quantity: Math.max(1, Number(item.amount) || 1),
    values: { ...(existing?.values ?? {}), ...values },
    updatedAt:
      existing?.updatedAt ??
      (Number.isFinite(modified) && modified > 0 ? new Date(modified * 1000).toISOString() : new Date().toISOString()),
    nativeItem: JSON.parse(JSON.stringify(item)),
  }
}

export function nativeItemFromCard(card: Card, columns: ColumnDefinition[]): Record<string, unknown> {
  const item = card.nativeItem
    ? (JSON.parse(JSON.stringify(card.nativeItem)) as Record<string, unknown>)
    : {
        amount: card.quantity,
        creation_date_unix: Math.floor(Date.now() / 1000),
        last_modification_date_unix: Math.floor(Date.now() / 1000),
        details: [],
      }
  let nativeChanged = !card.nativeItem
  if (Number(item.amount) !== card.quantity) nativeChanged = true
  item.amount = card.quantity
  const details = Array.isArray(item.details) ? (item.details as Array<Record<string, unknown>>) : []
  item.details = details
  for (const column of columns) {
    if (column.fieldId === 'meta_quantity') continue
    const separator = column.header.lastIndexOf(':')
    const name = separator >= 0 ? column.header.slice(0, separator) : column.header
    const property = separator >= 0 ? column.header.slice(separator + 1) : 'value'
    let detail = details.find((candidate) => candidate.name === name)
    if (!detail) {
      detail = { name, data: {} }
      details.push(detail)
      nativeChanged = true
    }
    const data =
      detail.data && typeof detail.data === 'object' && !Array.isArray(detail.data)
        ? (detail.data as Record<string, unknown>)
        : ((detail.data = {}) as Record<string, unknown>)
    const value = cardFieldValue(card, column.fieldId)
    const current = data[property]
    let nextValue: unknown = column.type === 'image' && value ? tabletopAssetReference(value) : value
    if (typeof current === 'number' && value.trim() && Number.isFinite(Number(value))) nextValue = Number(value)
    else if (typeof current === 'boolean') nextValue = ['true', '1', 'yes'].includes(value.toLocaleLowerCase())
    if (JSON.stringify(current) !== JSON.stringify(nextValue)) nativeChanged = true
    data[property] = nextValue
  }
  if (nativeChanged) item.last_modification_date_unix = Math.floor(Date.now() / 1000)
  return item
}
