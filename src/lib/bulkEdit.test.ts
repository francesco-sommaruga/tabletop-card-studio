import { describe, expect, it } from 'vitest'
import {
  addTag,
  applyStatus,
  bulkEditableFields,
  cardCountLabel,
  deleteCards,
  hasCardChanges,
  removeTag,
  selectedTags,
  setFieldValue,
} from './bulkEdit'
import type { Card, ColumnDefinition } from '../types'

const old = '2026-01-01T00:00:00.000Z'
const now = '2026-11-05T10:00:00.000Z'

function makeCard(id: string, patch: Partial<Card> = {}): Card {
  return { id, title: id, status: 'Idea', tags: [], quantity: 1, values: {}, updatedAt: old, ...patch }
}

const cards = [
  makeCard('a', { tags: ['raro'] }),
  makeCard('b', { status: 'Playtest' }),
  makeCard('c', { tags: ['raro', 'fuoco'] }),
]

describe('applyStatus', () => {
  it('sets the status on selected cards only and stamps updatedAt', () => {
    const next = applyStatus(cards, ['a', 'b'], 'Playtest', now)
    expect(next.map((card) => card.status)).toEqual(['Playtest', 'Playtest', 'Idea'])
    expect(next[0].updatedAt).toBe(now)
    expect(next[2]).toBe(cards[2])
  })

  it('leaves cards that already have the status untouched', () => {
    const next = applyStatus(cards, ['b'], 'Playtest', now)
    expect(next[1]).toBe(cards[1])
    expect(hasCardChanges(cards, next)).toBe(false)
  })
})

describe('addTag', () => {
  it('adds the trimmed tag to selected cards that miss it', () => {
    const next = addTag(cards, ['a', 'b'], '  raro ', now)
    expect(next[0]).toBe(cards[0])
    expect(next[1].tags).toEqual(['raro'])
    expect(next[1].updatedAt).toBe(now)
  })

  it('ignores an empty tag', () => {
    expect(addTag(cards, ['a', 'b'], '   ', now)).toEqual(cards)
  })
})

describe('removeTag', () => {
  it('removes the tag from selected cards only', () => {
    const next = removeTag(cards, ['a', 'b'], 'raro', now)
    expect(next[0].tags).toEqual([])
    expect(next[0].updatedAt).toBe(now)
    expect(next[1]).toBe(cards[1])
    expect(next[2]).toBe(cards[2])
  })
})

describe('setFieldValue', () => {
  it('sets a custom field value on selected cards', () => {
    const next = setFieldValue(cards, ['a', 'c'], 'cost', '3', now)
    expect(next[0].values).toEqual({ cost: '3' })
    expect(next[2].values).toEqual({ cost: '3' })
    expect(next[1]).toBe(cards[1])
  })

  it('skips cards that already have the value', () => {
    const withValue = [makeCard('a', { values: { cost: '3' } })]
    expect(setFieldValue(withValue, ['a'], 'cost', '3', now)[0]).toBe(withValue[0])
  })

  it('sets the quantity as a positive integer', () => {
    expect(setFieldValue(cards, ['a'], 'meta_quantity', '4', now)[0].quantity).toBe(4)
    expect(setFieldValue(cards, ['a'], 'meta_quantity', 'x', now)[0].quantity).toBe(1)
  })
})

describe('deleteCards', () => {
  it('removes selected cards and keeps the order of the rest', () => {
    expect(deleteCards(cards, ['b']).map((card) => card.id)).toEqual(['a', 'c'])
  })
})

describe('hasCardChanges', () => {
  it('detects changed, added and removed cards', () => {
    expect(hasCardChanges(cards, [...cards])).toBe(false)
    expect(hasCardChanges(cards, cards.slice(1))).toBe(true)
    expect(hasCardChanges(cards, applyStatus(cards, ['a'], 'Ready', now))).toBe(true)
  })
})

describe('selectedTags', () => {
  it('lists the distinct tags of the selected cards, sorted', () => {
    expect(selectedTags(cards, ['a', 'c'])).toEqual(['fuoco', 'raro'])
    expect(selectedTags(cards, ['b'])).toEqual([])
  })
})

describe('bulkEditableFields', () => {
  const column = (fieldId: string, patch: Partial<ColumnDefinition> = {}): ColumnDefinition => ({
    id: `col-${fieldId}`,
    header: fieldId,
    fieldId,
    ...patch,
  })

  it('offers quantity plus custom fields without images, ids, rules or duplicates', () => {
    const fields = bulkEditableFields([
      column('cost', { type: 'number', fieldLabel: 'Costo' }),
      column('art', { type: 'image' }),
      column('code', { type: 'id' }),
      column('power', { rules: [{ sourceFieldId: 'cost', operator: 'is_set', value: '1' }] }),
      column('cost', { type: 'text' }),
      column('meta_title'),
      column('color', { type: 'color' }),
    ])
    expect(fields.map((field) => [field.fieldId, field.label, field.type])).toEqual([
      ['meta_quantity', 'Quantità', 'number'],
      ['cost', 'Costo', 'number'],
      ['color', 'color', 'color'],
    ])
  })
})

describe('cardCountLabel', () => {
  it('uses singular and plural', () => {
    expect(cardCountLabel(1)).toBe('1 carta')
    expect(cardCountLabel(5)).toBe('5 carte')
  })
})
