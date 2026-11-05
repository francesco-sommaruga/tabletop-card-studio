import { describe, expect, it } from 'vitest'
import { adjacentField, cellEditorKind } from './inlineCells'
import type { ColumnDefinition } from '../types'

const column = (patch: Partial<ColumnDefinition>): ColumnDefinition => ({
  id: 'col',
  header: 'Campo',
  fieldId: 'field',
  ...patch,
})

describe('cellEditorKind', () => {
  it('treats built-in editable columns as simple', () => {
    for (const fieldId of ['meta_title', 'meta_tags', 'meta_status', 'meta_quantity'])
      expect(cellEditorKind(fieldId)).toBe('simple')
  })

  it('makes the updated date, generated ids and rule-driven fields read-only', () => {
    expect(cellEditorKind('meta_updated')).toBe('readonly')
    expect(cellEditorKind('code', column({ type: 'id' }))).toBe('readonly')
    expect(cellEditorKind('power', column({ rules: [{ sourceFieldId: 'x', operator: 'is_set', value: '1' }] }))).toBe(
      'readonly',
    )
  })

  it('uses a complex editor for image, color and variable fields', () => {
    for (const type of ['image', 'color', 'variable'] as const)
      expect(cellEditorKind('field', column({ type }))).toBe('complex')
  })

  it('uses a simple editor for text, number, select and long text fields', () => {
    for (const type of ['text', 'number', 'select', 'longtext'] as const)
      expect(cellEditorKind('field', column({ type }))).toBe('simple')
    expect(cellEditorKind('field', column({}))).toBe('simple')
  })
})

describe('adjacentField', () => {
  const order = ['meta_title', 'meta_tags', 'meta_status']

  it('returns the next and previous field', () => {
    expect(adjacentField(order, 'meta_tags', 1)).toBe('meta_status')
    expect(adjacentField(order, 'meta_tags', -1)).toBe('meta_title')
  })

  it('returns null at the edges or for an unknown field', () => {
    expect(adjacentField(order, 'meta_status', 1)).toBeNull()
    expect(adjacentField(order, 'meta_title', -1)).toBeNull()
    expect(adjacentField(order, 'other', 1)).toBeNull()
  })
})
