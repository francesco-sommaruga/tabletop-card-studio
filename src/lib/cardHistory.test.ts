import { describe, expect, it } from 'vitest'
import {
  HISTORY_LIMIT,
  cardLabel,
  clearSet,
  emptyHistory,
  recordChange,
  sameCards,
  stepBack,
  stepForward,
} from './cardHistory'
import type { HistoryEntry } from './cardHistory'
import type { Card } from '../types'

function makeCard(id: string, title = id): Card {
  return { id, title, status: 'Idea', tags: [], quantity: 1, values: {}, updatedAt: '2026-01-01T00:00:00.000Z' }
}

const entry = (label: string, before: Card[] = [], after: Card[] = []): HistoryEntry => ({ label, before, after })

describe('recordChange', () => {
  it('pushes entries per set without touching other sets', () => {
    let history = recordChange(emptyHistory, 'a', entry('one'))
    history = recordChange(history, 'b', entry('two'))
    expect(stepBack(history, 'a')?.entry.label).toBe('one')
    expect(stepBack(history, 'b')?.entry.label).toBe('two')
  })

  it(`keeps at most ${HISTORY_LIMIT} entries, dropping the oldest`, () => {
    let history = emptyHistory
    for (let index = 0; index < HISTORY_LIMIT + 5; index += 1) history = recordChange(history, 'a', entry(`e${index}`))
    const labels: string[] = []
    let step = stepBack(history, 'a')
    while (step) {
      labels.push(step.entry.label)
      step = stepBack(step.history, 'a')
    }
    expect(labels).toHaveLength(HISTORY_LIMIT)
    expect(labels[0]).toBe(`e${HISTORY_LIMIT + 4}`)
    expect(labels.at(-1)).toBe('e5')
  })

  it('clears the redo stack of that set', () => {
    const history = recordChange(emptyHistory, 'a', entry('one'))
    const undone = stepBack(history, 'a')!.history
    expect(stepForward(undone, 'a')).not.toBeNull()
    expect(stepForward(recordChange(undone, 'a', entry('two')), 'a')).toBeNull()
  })

  it('does not mutate the previous history', () => {
    const first = recordChange(emptyHistory, 'a', entry('one'))
    recordChange(first, 'a', entry('two'))
    stepBack(first, 'a')
    expect(stepBack(first, 'a')?.entry.label).toBe('one')
    expect(stepBack(stepBack(first, 'a')!.history, 'a')).toBeNull()
  })
})

describe('stepBack / stepForward', () => {
  it('returns null when there is nothing to undo or redo', () => {
    expect(stepBack(emptyHistory, 'a')).toBeNull()
    expect(stepForward(emptyHistory, 'a')).toBeNull()
  })

  it('moves entries between undo and redo in LIFO order', () => {
    let history = recordChange(emptyHistory, 'a', entry('one'))
    history = recordChange(history, 'a', entry('two'))
    const firstUndo = stepBack(history, 'a')!
    expect(firstUndo.entry.label).toBe('two')
    const secondUndo = stepBack(firstUndo.history, 'a')!
    expect(secondUndo.entry.label).toBe('one')
    const redo = stepForward(secondUndo.history, 'a')!
    expect(redo.entry.label).toBe('one')
    expect(stepBack(redo.history, 'a')?.entry.label).toBe('one')
    expect(stepForward(redo.history, 'a')?.entry.label).toBe('two')
  })

  it('keeps each set independent', () => {
    let history = recordChange(emptyHistory, 'a', entry('a1'))
    history = recordChange(history, 'b', entry('b1'))
    history = stepBack(history, 'a')!.history
    expect(stepBack(history, 'a')).toBeNull()
    expect(stepBack(history, 'b')?.entry.label).toBe('b1')
    expect(stepForward(history, 'b')).toBeNull()
  })
})

describe('clearSet', () => {
  it('drops undo and redo of one set only', () => {
    let history = recordChange(emptyHistory, 'a', entry('a1'))
    history = recordChange(history, 'a', entry('a2'))
    history = recordChange(history, 'b', entry('b1'))
    history = stepBack(history, 'a')!.history
    history = clearSet(history, 'a')
    expect(stepBack(history, 'a')).toBeNull()
    expect(stepForward(history, 'a')).toBeNull()
    expect(stepBack(history, 'b')?.entry.label).toBe('b1')
  })
})

describe('sameCards', () => {
  it('compares card lists by content', () => {
    const cards = [makeCard('x'), makeCard('y')]
    expect(sameCards(cards, structuredClone(cards))).toBe(true)
    expect(sameCards(cards, [makeCard('x'), makeCard('y', 'changed')])).toBe(false)
    expect(sameCards(cards, [cards[1], cards[0]])).toBe(false)
  })
})

describe('cardLabel', () => {
  it('quotes the card title and falls back for empty titles', () => {
    expect(cardLabel('Modifica di', makeCard('x', 'Goblin'))).toBe('Modifica di «Goblin»')
    expect(cardLabel('Eliminazione di', makeCard('x', '  '))).toBe('Eliminazione di «Senza titolo»')
  })
})
