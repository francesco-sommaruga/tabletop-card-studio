import { useMemo, useState } from 'react'
import type { Card, ColumnDefinition } from '../types'

const allStatuses = 'Tutti gli stati'

/** Search, tag, status and property filters plus sorting for the cards list. */
export function useCardFilters(cards: Card[], columns: ColumnDefinition[]) {
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState('')
  const [filterStatus, setFilterStatus] = useState(allStatuses)
  const [propertyFilterField, setPropertyFilterField] = useState('')
  const [propertyFilterValue, setPropertyFilterValue] = useState('')
  const [sortField, setSortField] = useState('meta_title')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const tags = useMemo(() => {
    const counts = new Map<string, number>()
    cards.forEach((card) => card.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)))
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [cards])
  const listColumns = columns.filter(
    (column, index, all) =>
      column.type !== 'image' && all.findIndex((item) => item.fieldId === column.fieldId) === index,
  )
  const toggleSort = (fieldId: string) => {
    if (sortField === fieldId) setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'))
    else {
      setSortField(fieldId)
      setSortDirection('asc')
    }
  }
  const sortIndicator = (fieldId: string) => (sortField === fieldId ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '')
  const propertyFilterOptions = useMemo(() => {
    if (!propertyFilterField) return []
    if (propertyFilterField === 'meta_tags') return tags.map(([tag]) => tag)
    if (propertyFilterField === 'meta_status')
      return [...new Set(cards.map((card) => card.status))].sort((a, b) => a.localeCompare(b, 'it'))
    if (propertyFilterField === 'meta_quantity')
      return [...new Set(cards.map((card) => String(card.quantity)))].sort((a, b) => Number(a) - Number(b))
    const column = listColumns.find((item) => item.fieldId === propertyFilterField)
    return [
      ...new Set([
        ...cards
          .map((card) => card.values[propertyFilterField]?.trim())
          .filter((value): value is string => Boolean(value)),
        ...(column?.options ?? []),
      ]),
    ].sort((a, b) => a.localeCompare(b, 'it', { numeric: true }))
  }, [propertyFilterField, tags, cards, listColumns])
  const filteredCards = useMemo(
    () =>
      cards
        .filter((card) => {
          const text =
            `${card.title} ${card.tags.join(' ')} ${Object.values(card.values).join(' ')}`.toLocaleLowerCase()
          const propertyMatches =
            !propertyFilterField ||
            !propertyFilterValue ||
            (propertyFilterField === 'meta_tags'
              ? card.tags.includes(propertyFilterValue)
              : propertyFilterField === 'meta_status'
                ? card.status === propertyFilterValue
                : propertyFilterField === 'meta_quantity'
                  ? String(card.quantity) === propertyFilterValue
                  : card.values[propertyFilterField]?.trim() === propertyFilterValue)
          return (
            (!search || text.includes(search.toLocaleLowerCase())) &&
            (!activeTag || card.tags.includes(activeTag)) &&
            (filterStatus === allStatuses || card.status === filterStatus) &&
            propertyMatches
          )
        })
        .sort((a, b) => {
          const value = (card: Card) => {
            if (sortField === 'meta_title') return card.title
            if (sortField === 'meta_tags') return [...card.tags].sort((x, y) => x.localeCompare(y, 'it')).join(', ')
            if (sortField === 'meta_status') return card.status
            if (sortField === 'meta_quantity') return card.quantity
            if (sortField === 'meta_updated') return new Date(card.updatedAt).getTime() || 0
            const raw = card.values[sortField]?.trim() ?? ''
            const sortColumn = listColumns.find((column) => column.fieldId === sortField)
            return sortColumn?.type === 'number' && raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : raw
          }
          const left = value(a),
            right = value(b)
          const comparison =
            typeof left === 'number' && typeof right === 'number'
              ? left - right
              : String(left).localeCompare(String(right), 'it', { numeric: true, sensitivity: 'base' })
          return comparison === 0
            ? a.title.localeCompare(b.title, 'it')
            : comparison * (sortDirection === 'asc' ? 1 : -1)
        }),
    [
      cards,
      search,
      activeTag,
      filterStatus,
      propertyFilterField,
      propertyFilterValue,
      sortField,
      sortDirection,
      listColumns,
    ],
  )
  const hasActiveFilters = Boolean(search || activeTag || filterStatus !== allStatuses || propertyFilterValue)
  const resetListControls = () => {
    setSearch('')
    setActiveTag('')
    setFilterStatus(allStatuses)
    setPropertyFilterField('')
    setPropertyFilterValue('')
    setSortField('meta_title')
    setSortDirection('asc')
  }
  return {
    search,
    setSearch,
    activeTag,
    setActiveTag,
    filterStatus,
    setFilterStatus,
    propertyFilterField,
    setPropertyFilterField,
    propertyFilterValue,
    setPropertyFilterValue,
    toggleSort,
    sortIndicator,
    tags,
    listColumns,
    propertyFilterOptions,
    filteredCards,
    hasActiveFilters,
    resetListControls,
  }
}

export type CardFilters = ReturnType<typeof useCardFilters>
