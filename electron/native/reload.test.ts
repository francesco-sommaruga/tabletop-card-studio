import { describe, expect, it } from 'vitest'
import type { Card, ColumnDefinition, ProjectSet } from '../../src/types'
import { matchCardsToItems, reloadSetFromNative } from './reload'

const columns: ColumnDefinition[] = [
  { id: 'column_title', header: 'title', fieldId: 'meta_title', type: 'text' },
  { id: 'column_quantity', header: '[Item Amount]', fieldId: 'meta_quantity', type: 'number' },
  { id: 'column_power', header: 'power', fieldId: 'field_power', type: 'number', hidden: true },
  { id: 'column_note', header: 'note', fieldId: 'field_note', type: 'text' },
]

function item(title: string, power: string, amount = 1, extra: Record<string, string> = {}) {
  return {
    amount,
    details: [
      { name: 'title', data: { value: title } },
      { name: 'power', data: { value: power } },
      ...Object.entries(extra).map(([name, value]) => ({ name, data: { value } })),
    ],
  }
}

function card(id: string, title: string, values: Record<string, string>, extra: Partial<Card> = {}): Card {
  return {
    id,
    title,
    status: 'Playtest',
    tags: ['cms'],
    quantity: 1,
    values,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  }
}

function linkedSet(cards: Card[]): ProjectSet {
  return { id: 'set_a', name: 'A', cards, columns, nativeSetFile: 'a.json', nativeSetIndex: 0 }
}

describe('matchCardsToItems', () => {
  const cards = [card('c1', 'Alpha', {}), card('c2', 'Beta', {})]

  it('matches by trimmed, case-insensitive title first', () => {
    const matches = matchCardsToItems(cards, [item(' beta ', '1'), item('ALPHA', '2')], false)
    expect(matches.map((match) => match?.id)).toEqual(['c2', 'c1'])
  })

  it('falls back to the card at the same position only when asked to', () => {
    const items = [item('Alpha renamed', '1'), item('Beta', '2')]
    expect(matchCardsToItems(cards, items, false).map((match) => match?.id)).toEqual([undefined, 'c2'])
    expect(matchCardsToItems(cards, items, true).map((match) => match?.id)).toEqual(['c1', 'c2'])
  })

  it('never assigns the same card twice', () => {
    const matches = matchCardsToItems(cards, [item('Alpha', '1'), item('Alpha', '2'), item('Gamma', '3')], true)
    expect(matches.map((match) => match?.id)).toEqual(['c1', 'c2', undefined])
  })
})

describe('reloadSetFromNative', () => {
  const set = linkedSet([
    card('c1', 'Alpha', { field_power: '1', field_note: 'cms note', field_cms: 'only here' }),
    card('c2', 'Beta', { field_power: '2' }, { status: 'Ready', tags: ['keep'] }),
  ])

  it('refreshes native values and keeps Card Studio metadata', () => {
    const { cards } = reloadSetFromNative(set, [item('Alpha', '5', 3), item('Beta', '7')])
    expect(cards.map((entry) => entry.id)).toEqual(['c1', 'c2'])
    expect(cards[0]).toMatchObject({
      title: 'Alpha',
      quantity: 3,
      status: 'Playtest',
      tags: ['cms'],
      values: { field_power: '5', field_note: 'cms note', field_cms: 'only here' },
    })
    expect(cards[1]).toMatchObject({ status: 'Ready', tags: ['keep'], values: { field_power: '7' } })
    expect(cards[0].nativeItem).toEqual(item('Alpha', '5', 3))
  })

  it('keeps metadata of a card renamed in Tabletop Creator', () => {
    const { cards } = reloadSetFromNative(set, [item('Alpha 2', '1'), item('Beta', '2')])
    expect(cards[0]).toMatchObject({ id: 'c1', title: 'Alpha 2', tags: ['cms'] })
  })

  it('follows additions, removals and reordering in the native file', () => {
    const { cards } = reloadSetFromNative(set, [item('Beta', '2'), item('Delta', '9'), item('Gamma', '4')])
    expect(cards.map((entry) => entry.title)).toEqual(['Beta', 'Delta', 'Gamma'])
    expect(cards[0].id).toBe('c2')
    expect(cards[1]).toMatchObject({ status: 'Idea', tags: [] })
    expect(cards[1].id).not.toBe('c1')
  })

  it('keeps existing column definitions and appends new native fields', () => {
    const result = reloadSetFromNative(set, [item('Alpha', '1', 1, { cost: '2' })])
    expect(result.columns.slice(0, columns.length)).toEqual(columns)
    expect(result.columns.map((column) => column.header)).toContain('cost')
    expect(result.cards[0].values.field_cost).toBe('2')
  })

  it('does not mutate the input set', () => {
    const before = structuredClone(set)
    reloadSetFromNative(set, [item('Alpha', '9')])
    expect(set).toEqual(before)
  })
})
