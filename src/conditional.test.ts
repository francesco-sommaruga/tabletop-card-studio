import { describe, expect, it } from 'vitest'
import { resolveConditionalValues } from './conditional'
import type { Card, ColumnDefinition, ConditionalValueRule } from './types'

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    title: 'Goblin',
    status: 'Idea',
    tags: [],
    quantity: 1,
    values: {},
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeColumn(fieldId: string, overrides: Partial<ColumnDefinition> = {}): ColumnDefinition {
  return { id: `col-${fieldId}`, header: fieldId, fieldId, type: 'text', ...overrides }
}

function rule(
  sourceFieldId: string,
  operator: ConditionalValueRule['operator'],
  value: string,
  matchValue?: string,
): ConditionalValueRule {
  return { sourceFieldId, operator, matchValue, value }
}

/** Resolves a single target column with the given rules against a card holding `source`. */
function resolveTarget(source: string, rules: ConditionalValueRule[], defaultValue?: string) {
  const column = makeColumn('target', { rules, defaultValue })
  return resolveConditionalValues([column], makeCard({ values: { source } })).values.target
}

describe('resolveConditionalValues', () => {
  describe('without rules', () => {
    it('returns an equal card when there are no columns', () => {
      const card = makeCard({ values: { a: '1' } })
      expect(resolveConditionalValues([], card)).toEqual(card)
    })

    it('fills an empty field with its default value', () => {
      const card = makeCard({ values: { power: '' } })
      const result = resolveConditionalValues([makeColumn('power', { defaultValue: '3' })], card)
      expect(result.values.power).toBe('3')
    })

    it('fills a missing field with its default value', () => {
      const result = resolveConditionalValues([makeColumn('power', { defaultValue: '3' })], makeCard())
      expect(result.values.power).toBe('3')
    })

    it('treats a whitespace-only value as empty and replaces it with the default', () => {
      const card = makeCard({ values: { power: '   ' } })
      const result = resolveConditionalValues([makeColumn('power', { defaultValue: '3' })], card)
      expect(result.values.power).toBe('3')
    })

    it('keeps an existing value instead of the default', () => {
      const card = makeCard({ values: { power: '7' } })
      const result = resolveConditionalValues([makeColumn('power', { defaultValue: '3' })], card)
      expect(result.values.power).toBe('7')
    })

    it('leaves the field untouched when there is no default', () => {
      const result = resolveConditionalValues([makeColumn('power')], makeCard())
      expect(result.values).not.toHaveProperty('power')
    })

    it('treats an empty rules array like no rules', () => {
      const card = makeCard({ values: { power: '7' } })
      const result = resolveConditionalValues([makeColumn('power', { rules: [], defaultValue: '3' })], card)
      expect(result.values.power).toBe('7')
    })
  })

  describe('immutability', () => {
    it('does not mutate the input card, its values or its tags', () => {
      const card = makeCard({ tags: ['a'], values: { source: 'x' } })
      const snapshot = structuredClone(card)
      const columns = [
        makeColumn('target', { rules: [rule('source', 'is_set', 'yes')] }),
        makeColumn('meta_tags', { defaultValue: 'b, c' }),
      ]
      const result = resolveConditionalValues(columns, card)
      expect(card).toEqual(snapshot)
      expect(result.values).not.toBe(card.values)
      expect(result.tags).not.toBe(card.tags)
      expect(result.values.target).toBe('yes')
    })
  })

  describe('with rules', () => {
    it('writes the value of the matching rule', () => {
      expect(resolveTarget('fire', [rule('source', 'equals', 'Hot', 'fire')])).toBe('Hot')
    })

    it('uses the first matching rule when several match', () => {
      const rules = [
        rule('source', 'is_set', 'first'),
        rule('source', 'equals', 'second', 'fire'),
        rule('source', 'contains', 'third', 'fi'),
      ]
      expect(resolveTarget('fire', rules)).toBe('first')
    })

    it('skips non-matching rules and uses a later matching one', () => {
      const rules = [rule('source', 'equals', 'water', 'water'), rule('source', 'equals', 'fire', 'fire')]
      expect(resolveTarget('fire', rules)).toBe('fire')
    })

    it('uses the default value when no rule matches', () => {
      expect(resolveTarget('earth', [rule('source', 'equals', 'Hot', 'fire')], 'Neutral')).toBe('Neutral')
    })

    it('clears the field when no rule matches and there is no default', () => {
      expect(resolveTarget('earth', [rule('source', 'equals', 'Hot', 'fire')])).toBe('')
    })

    it('overwrites a manually entered value: rule-driven fields are fully computed', () => {
      const column = makeColumn('target', { rules: [rule('source', 'equals', 'Hot', 'fire')], defaultValue: 'Cold' })
      const card = makeCard({ values: { source: 'ice', target: 'manual' } })
      expect(resolveConditionalValues([column], card).values.target).toBe('Cold')
    })

    it('treats a missing source field as empty', () => {
      const column = makeColumn('target', { rules: [rule('missing', 'is_empty', 'empty')] })
      expect(resolveConditionalValues([column], makeCard()).values.target).toBe('empty')
    })

    it('resolves hidden fields exactly like visible ones', () => {
      const column = makeColumn('target', {
        hidden: true,
        rules: [rule('source', 'is_set', 'yes')],
        defaultValue: 'no',
      })
      expect(resolveConditionalValues([column], makeCard({ values: { source: 'x' } })).values.target).toBe('yes')
      expect(resolveConditionalValues([column], makeCard()).values.target).toBe('no')
    })

    it('skips generated id columns even when they have rules or defaults', () => {
      const column = makeColumn('code', {
        type: 'id',
        defaultValue: 'fallback',
        rules: [rule('source', 'is_empty', 'ruled')],
      })
      const card = makeCard({ values: { code: 'abc' } })
      expect(resolveConditionalValues([column], card).values.code).toBe('abc')
      expect(resolveConditionalValues([column], makeCard()).values).not.toHaveProperty('code')
    })
  })

  describe('operators', () => {
    describe('is_set ("is filled")', () => {
      it.each([
        ['x', 'yes'],
        ['0', 'yes'],
        ['', 'no'],
        ['   ', 'no'],
      ])('source %j resolves to %j', (source, expected) => {
        expect(resolveTarget(source, [rule('source', 'is_set', 'yes')], 'no')).toBe(expected)
      })
    })

    describe('is_empty', () => {
      it.each([
        ['', 'yes'],
        ['  ', 'yes'],
        ['x', 'no'],
      ])('source %j resolves to %j', (source, expected) => {
        expect(resolveTarget(source, [rule('source', 'is_empty', 'yes')], 'no')).toBe(expected)
      })
    })

    describe('equals', () => {
      it.each([
        ['fire', 'fire', 'yes'],
        ['FIRE', 'fire', 'yes'],
        ['  fire ', ' fire', 'yes'],
        ['fire', 'firestorm', 'no'],
        ['firestorm', 'fire', 'no'],
        ['', '', 'yes'],
        ['', undefined, 'yes'],
        ['x', '', 'no'],
      ])('source %j vs match %j resolves to %j', (source, matchValue, expected) => {
        expect(resolveTarget(source, [rule('source', 'equals', 'yes', matchValue)], 'no')).toBe(expected)
      })
    })

    describe('not_equals', () => {
      it.each([
        ['water', 'fire', 'yes'],
        ['FIRE', 'fire', 'no'],
        ['fire', 'fire', 'no'],
        ['x', '', 'yes'],
        // An empty source never matches "not equals", even when the target is non-empty.
        ['', 'fire', 'no'],
        ['  ', 'fire', 'no'],
      ])('source %j vs match %j resolves to %j', (source, matchValue, expected) => {
        expect(resolveTarget(source, [rule('source', 'not_equals', 'yes', matchValue)], 'no')).toBe(expected)
      })
    })

    describe('contains', () => {
      it.each([
        ['firestorm', 'storm', 'yes'],
        ['FireStorm', 'STORM', 'yes'],
        ['fire', 'storm', 'no'],
        // An empty match value never matches, although every string "contains" ''.
        ['fire', '', 'no'],
        ['fire', '   ', 'no'],
        ['fire', undefined, 'no'],
        ['', 'x', 'no'],
      ])('source %j vs match %j resolves to %j', (source, matchValue, expected) => {
        expect(resolveTarget(source, [rule('source', 'contains', 'yes', matchValue)], 'no')).toBe(expected)
      })
    })

    describe('greater_than', () => {
      it.each([
        ['5', '3', 'yes'],
        ['3', '3', 'no'],
        ['2', '3', 'no'],
        ['10', '9', 'yes'], // numeric, not lexicographic
        ['-1', '-2', 'yes'],
        ['2.5', '2.4', 'yes'],
        [' 5 ', ' 3 ', 'yes'],
        ['abc', '3', 'no'],
        ['5', 'abc', 'no'],
        ['', '3', 'no'], // empty is not treated as 0
        ['5', '', 'no'],
        ['5', undefined, 'no'],
        ['Infinity', '3', 'no'],
      ])('source %j vs match %j resolves to %j', (source, matchValue, expected) => {
        expect(resolveTarget(source, [rule('source', 'greater_than', 'yes', matchValue)], 'no')).toBe(expected)
      })
    })

    describe('less_than', () => {
      it.each([
        ['2', '3', 'yes'],
        ['3', '3', 'no'],
        ['5', '3', 'no'],
        ['9', '10', 'yes'], // numeric, not lexicographic
        ['0', '1', 'yes'],
        ['abc', '3', 'no'],
        ['', '3', 'no'], // empty is not treated as 0
        ['3', '', 'no'],
        ['-Infinity', '3', 'no'],
      ])('source %j vs match %j resolves to %j', (source, matchValue, expected) => {
        expect(resolveTarget(source, [rule('source', 'less_than', 'yes', matchValue)], 'no')).toBe(expected)
      })
    })

    it('accepts any string Number() parses (hex, exponent) in numeric comparisons', () => {
      expect(resolveTarget('0x10', [rule('source', 'greater_than', 'yes', '15')], 'no')).toBe('yes')
      expect(resolveTarget('1e3', [rule('source', 'greater_than', 'yes', '999')], 'no')).toBe('yes')
    })

    it('rejects partially numeric input like "3 gold" in numeric comparisons', () => {
      expect(resolveTarget('3 gold', [rule('source', 'greater_than', 'yes', '1')], 'no')).toBe('no')
    })
  })

  describe('card meta fields as rule sources', () => {
    const target = (sourceFieldId: string, operator: ConditionalValueRule['operator'], matchValue: string) =>
      makeColumn('target', { rules: [rule(sourceFieldId, operator, 'yes', matchValue)], defaultValue: 'no' })

    it('reads the card title', () => {
      expect(resolveConditionalValues([target('meta_title', 'equals', 'goblin')], makeCard()).values.target).toBe('yes')
    })

    it('reads the quantity as a number string', () => {
      const card = makeCard({ quantity: 4 })
      expect(resolveConditionalValues([target('meta_quantity', 'greater_than', '3')], card).values.target).toBe('yes')
    })

    it('reads the status', () => {
      const card = makeCard({ status: 'Playtest' })
      expect(resolveConditionalValues([target('meta_status', 'equals', 'playtest')], card).values.target).toBe('yes')
    })

    it('reads tags joined with ", "', () => {
      const card = makeCard({ tags: ['undead', 'boss'] })
      expect(resolveConditionalValues([target('meta_tags', 'equals', 'undead, boss')], card).values.target).toBe('yes')
      expect(resolveConditionalValues([target('meta_tags', 'contains', 'boss')], card).values.target).toBe('yes')
    })
  })

  describe('card meta fields as targets', () => {
    it('writes the title', () => {
      const column = makeColumn('meta_title', { rules: [rule('source', 'is_set', 'Renamed')] })
      const result = resolveConditionalValues([column], makeCard({ values: { source: 'x' } }))
      expect(result.title).toBe('Renamed')
      expect(result.values).not.toHaveProperty('meta_title')
    })

    it('writes the status without validating it', () => {
      const column = makeColumn('meta_status', { rules: [rule('source', 'is_set', 'Ready')] })
      expect(resolveConditionalValues([column], makeCard({ values: { source: 'x' } })).status).toBe('Ready')
      const invalid = makeColumn('meta_status', { rules: [rule('source', 'is_set', 'Bogus')] })
      expect(resolveConditionalValues([invalid], makeCard({ values: { source: 'x' } })).status).toBe('Bogus')
    })

    it('splits, trims and drops empty tags', () => {
      const column = makeColumn('meta_tags', { rules: [rule('source', 'is_set', ' a, b ,, c ,')] })
      expect(resolveConditionalValues([column], makeCard({ values: { source: 'x' } })).tags).toEqual(['a', 'b', 'c'])
    })

    it('fills empty tags from the default value', () => {
      const result = resolveConditionalValues([makeColumn('meta_tags', { defaultValue: 'x, y' })], makeCard())
      expect(result.tags).toEqual(['x', 'y'])
    })

    it.each([
      ['4', 4],
      [' 4 ', 4],
      ['2.5', 2.5], // fractional quantities are accepted as-is
      ['0', 0],
      ['abc', 1],
      ['', 1],
      ['  ', 1],
    ])('writes quantity %j as %j', (value, expected) => {
      const column = makeColumn('meta_quantity', { rules: [rule('source', 'is_set', value)] })
      expect(resolveConditionalValues([column], makeCard({ quantity: 9, values: { source: 'x' } })).quantity).toBe(
        expected,
      )
    })

    it('resets quantity to 1 when no rule matches and there is no default', () => {
      const column = makeColumn('meta_quantity', { rules: [rule('source', 'is_set', '5')] })
      expect(resolveConditionalValues([column], makeCard({ quantity: 9 })).quantity).toBe(1)
    })
  })

  describe('column order', () => {
    it('lets a later column see values resolved by an earlier column', () => {
      const columns = [
        makeColumn('element', { rules: [rule('source', 'equals', 'fire', 'red')] }),
        makeColumn('damage', { rules: [rule('element', 'equals', '5', 'fire')], defaultValue: '1' }),
      ]
      expect(resolveConditionalValues(columns, makeCard({ values: { source: 'red' } })).values.damage).toBe('5')
    })

    it('lets an earlier column see only the unresolved value of a later column', () => {
      const columns = [
        makeColumn('damage', { rules: [rule('element', 'equals', '5', 'fire')], defaultValue: '1' }),
        makeColumn('element', { rules: [rule('source', 'equals', 'fire', 'red')] }),
      ]
      const result = resolveConditionalValues(columns, makeCard({ values: { source: 'red' } }))
      expect(result.values.element).toBe('fire')
      expect(result.values.damage).toBe('1')
      // A second pass (as the editor does on every change) converges.
      expect(resolveConditionalValues(columns, result).values.damage).toBe('5')
    })
  })
})
