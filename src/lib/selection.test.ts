import { describe, expect, it } from 'vitest'
import { pruneSelection, rangeSelection, selectionState, toggleAllSelection, toggleSelection } from './selection'

const order = ['a', 'b', 'c', 'd', 'e']

describe('toggleSelection', () => {
  it('adds a missing id', () => {
    expect(toggleSelection(['a'], 'c')).toEqual(['a', 'c'])
  })

  it('removes a present id', () => {
    expect(toggleSelection(['a', 'c'], 'a')).toEqual(['c'])
  })
})

describe('rangeSelection', () => {
  it('selects every id between anchor and target (forward)', () => {
    expect(rangeSelection(['b'], order, 'b', 'd')).toEqual(['b', 'c', 'd'])
  })

  it('selects every id between anchor and target (backward)', () => {
    expect(rangeSelection(['d'], order, 'd', 'a')).toEqual(['d', 'a', 'b', 'c'])
  })

  it('keeps ids selected outside the range', () => {
    expect(rangeSelection(['e', 'a'], order, 'a', 'b')).toEqual(['e', 'a', 'b'])
  })

  it('deselects the range when the target was already selected', () => {
    expect(rangeSelection(['a', 'b', 'c', 'd'], order, 'b', 'c')).toEqual(['a', 'd'])
  })

  it('falls back to a toggle without a usable anchor', () => {
    expect(rangeSelection(['a'], order, null, 'c')).toEqual(['a', 'c'])
    expect(rangeSelection(['a'], order, 'gone', 'c')).toEqual(['a', 'c'])
  })

  it('falls back to a toggle when the target is not in the order', () => {
    expect(rangeSelection([], order, 'a', 'x')).toEqual(['x'])
  })
})

describe('pruneSelection', () => {
  it('drops ids that are no longer allowed', () => {
    expect(pruneSelection(['a', 'x', 'c'], order)).toEqual(['a', 'c'])
  })

  it('returns the same array when nothing changes', () => {
    const selected = ['a', 'c']
    expect(pruneSelection(selected, order)).toBe(selected)
  })
})

describe('selectionState', () => {
  it('is none without selected ids in the order', () => {
    expect(selectionState([], order)).toBe('none')
    expect(selectionState(['x'], order)).toBe('none')
  })

  it('is some with a partial selection', () => {
    expect(selectionState(['a', 'b'], order)).toBe('some')
  })

  it('is all when every ordered id is selected', () => {
    expect(selectionState([...order], order)).toBe('all')
  })

  it('is none for an empty order', () => {
    expect(selectionState(['a'], [])).toBe('none')
  })
})

describe('toggleAllSelection', () => {
  it('selects every ordered id when not all are selected', () => {
    expect(toggleAllSelection(['b'], order)).toEqual(order)
  })

  it('clears when all are selected', () => {
    expect(toggleAllSelection([...order], order)).toEqual([])
  })
})
