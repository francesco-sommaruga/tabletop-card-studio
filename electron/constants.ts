import type { ColumnDefinition } from '../src/types'

export const dataDirName = '.tabletop-card-studio'

export const defaultColumns: ColumnDefinition[] = [
  { id: 'column_title', header: 'title', fieldId: 'meta_title', type: 'text' },
  { id: 'column_quantity', header: '[Item Amount]', fieldId: 'meta_quantity', type: 'number' },
]
