import { describe, expect, it, vi } from 'vitest'
import { ensureGeneratedIdValues, supportsGeneratedId } from './generatedIds'
import type { Card, ColumnDefinition } from './types'

function makeCard(id: string, values: Record<string, string> = {}): Card {
  return { id, title: id, status: 'Idea', tags: [], quantity: 1, values, updatedAt: '2026-01-01T00:00:00.000Z' }
}

function idColumn(fieldId = 'code'): ColumnDefinition {
  return { id: `col-${fieldId}`, header: fieldId, fieldId, type: 'id' }
}

/** Returns a createId that yields the given values in order, then `id-N` sequentially. */
function sequence(...values: string[]) {
  let counter = 0
  return vi.fn(() => values.shift() ?? `id-${++counter}`)
}

const codes = (cards: Card[], fieldId = 'code') => cards.map((card) => card.values[fieldId])

describe('supportsGeneratedId', () => {
  it.each(['meta_title', 'meta_quantity', 'meta_status', 'meta_tags'])('rejects reserved field %s', (fieldId) => {
    expect(supportsGeneratedId(fieldId)).toBe(false)
  })

  it.each(['code', 'meta_other', ''])('accepts custom field %j', (fieldId) => {
    expect(supportsGeneratedId(fieldId)).toBe(true)
  })
})

describe('ensureGeneratedIdValues', () => {
  it('fills missing and empty ids', () => {
    const cards = [makeCard('a'), makeCard('b', { code: '' }), makeCard('c', { code: '   ' })]
    expect(codes(ensureGeneratedIdValues(cards, [idColumn()], sequence()))).toEqual(['id-1', 'id-2', 'id-3'])
  })

  it('keeps existing ids and only generates the missing ones', () => {
    const cards = [makeCard('a', { code: 'X' }), makeCard('b'), makeCard('c', { code: 'Y' })]
    const createId = sequence()
    expect(codes(ensureGeneratedIdValues(cards, [idColumn()], createId))).toEqual(['X', 'id-1', 'Y'])
    expect(createId).toHaveBeenCalledTimes(1)
  })

  it('trims whitespace around existing ids', () => {
    const cards = [makeCard('a', { code: '  X ' })]
    expect(codes(ensureGeneratedIdValues(cards, [idColumn()], sequence()))).toEqual(['X'])
  })

  it('keeps the first occurrence of a duplicate id and regenerates later ones', () => {
    const cards = [makeCard('a', { code: 'X' }), makeCard('b', { code: 'X' }), makeCard('c', { code: ' X ' })]
    expect(codes(ensureGeneratedIdValues(cards, [idColumn()], sequence()))).toEqual(['X', 'id-1', 'id-2'])
  })

  it('regenerates every id when regenerate is true', () => {
    const cards = [makeCard('a', { code: 'X' }), makeCard('b', { code: 'Y' })]
    expect(codes(ensureGeneratedIdValues(cards, [idColumn()], sequence(), true))).toEqual(['id-1', 'id-2'])
  })

  it('retries when createId returns an id already in use', () => {
    const cards = [makeCard('a', { code: 'X' }), makeCard('b'), makeCard('c')]
    const createId = sequence('X', 'N1', 'N1', 'N2')
    expect(codes(ensureGeneratedIdValues(cards, [idColumn()], createId))).toEqual(['X', 'N1', 'N2'])
    expect(createId).toHaveBeenCalledTimes(4)
  })

  it('does not avoid an existing id that regenerate is replacing', () => {
    const cards = [makeCard('a', { code: 'X' })]
    expect(codes(ensureGeneratedIdValues(cards, [idColumn()], sequence('X'), true))).toEqual(['X'])
  })

  it('retries when createId returns an empty or blank id, and trims generated ids', () => {
    const cards = [makeCard('a')]
    const createId = sequence('', '   ', ' N1 ')
    expect(codes(ensureGeneratedIdValues(cards, [idColumn()], createId))).toEqual(['N1'])
    expect(createId).toHaveBeenCalledTimes(3)
  })

  it('produces unique ids across all cards', () => {
    const cards = Array.from({ length: 50 }, (_, index) => makeCard(`c${index}`, index % 3 ? {} : { code: 'dup' }))
    let counter = 0
    const createId = () => `id-${Math.floor(counter++ / 3)}` // each id is returned three times
    const result = codes(ensureGeneratedIdValues(cards, [idColumn()], createId))
    expect(new Set(result).size).toBe(cards.length)
    expect(result[0]).toBe('dup')
  })

  it('handles each id column independently (uniqueness is per column)', () => {
    const cards = [makeCard('a', { code: 'X' }), makeCard('b')]
    const result = ensureGeneratedIdValues(cards, [idColumn('code'), idColumn('serial')], sequence('A', 'X', 'Y'))
    expect(codes(result, 'code')).toEqual(['X', 'A'])
    // 'X' is allowed in serial even though it is used in code.
    expect(codes(result, 'serial')).toEqual(['X', 'Y'])
  })

  it('ignores id columns on reserved card fields', () => {
    const cards = [makeCard('a')]
    const createId = sequence()
    expect(ensureGeneratedIdValues(cards, [idColumn('meta_title')], createId)).toBe(cards)
    expect(createId).not.toHaveBeenCalled()
  })

  it('ignores columns that are not of type id', () => {
    const cards = [makeCard('a')]
    const column: ColumnDefinition = { id: 'c', header: 'code', fieldId: 'code', type: 'text' }
    expect(ensureGeneratedIdValues(cards, [column], sequence())).toBe(cards)
  })

  it('returns the same array when there are no cards or no columns', () => {
    const empty: Card[] = []
    expect(ensureGeneratedIdValues(empty, [idColumn()], sequence())).toBe(empty)
    const cards = [makeCard('a')]
    expect(ensureGeneratedIdValues(cards, [], sequence())).toBe(cards)
  })

  it('returns the same array and card objects when nothing changes', () => {
    const cards = [makeCard('a', { code: 'X' }), makeCard('b', { code: 'Y' })]
    expect(ensureGeneratedIdValues(cards, [idColumn()], sequence())).toBe(cards)
  })

  it('only replaces the cards that changed and does not mutate the input', () => {
    const cards = [makeCard('a', { code: 'X', name: 'Goblin' }), makeCard('b', { name: 'Orc' })]
    const snapshot = structuredClone(cards)
    const result = ensureGeneratedIdValues(cards, [idColumn()], sequence())
    expect(cards).toEqual(snapshot)
    expect(result[0]).toBe(cards[0])
    expect(result[1]).not.toBe(cards[1])
    expect(result[1].values).toEqual({ name: 'Orc', code: 'id-1' })
  })

  it('tolerates cards without a values object', () => {
    const card = { ...makeCard('a'), values: undefined } as unknown as Card
    expect(codes(ensureGeneratedIdValues([card], [idColumn()], sequence()))).toEqual(['id-1'])
  })
})
