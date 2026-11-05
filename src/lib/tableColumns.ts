import type { CardStatus, ColumnDefinition } from '../types'

export const statuses: CardStatus[] = ['Idea', 'Design', 'Playtest', 'Ready']

export const tableMetaColumns = [
  { fieldId: 'meta_title', header: 'Carta', label: 'Carta', className: 'col-card', type: 'text' },
  { fieldId: 'meta_tags', header: 'Tag', label: 'Tag', className: 'col-tags', type: 'text' },
  { fieldId: 'meta_status', header: 'Stato', label: 'Stato CMS', className: 'col-status', type: 'text' },
  { fieldId: 'meta_quantity', header: 'Q.tà', label: 'Quantità', className: 'col-qty', type: 'number' },
  {
    fieldId: 'meta_updated',
    header: 'Ultima modifica',
    label: 'Ultima modifica',
    className: 'col-updated',
    type: 'text',
  },
]

export const defaultTableColumnIds = tableMetaColumns.map((column) => column.fieldId)

export const tableMetaFieldIds = new Set(defaultTableColumnIds)

export const metaFields = [
  { id: 'meta_title', label: 'Titolo carta' },
  { id: 'meta_quantity', label: 'Quantità' },
  { id: 'meta_status', label: 'Stato CMS' },
  { id: 'meta_tags', label: 'Tag CMS' },
]

export const internalFieldName = (column: ColumnDefinition) => column.fieldLabel?.trim() || column.header

export function defaultTableColumnWidth(fieldId: string, type?: string) {
  if (fieldId === 'meta_title') return 320
  if (fieldId === 'meta_tags') return 200
  if (fieldId === 'meta_status') return 130
  if (fieldId === 'meta_quantity') return 70
  if (fieldId === 'meta_updated') return 140
  return type === 'number' ? 120 : 170
}

export function minimumTableColumnWidth(fieldId: string) {
  if (fieldId === 'meta_title') return 180
  if (fieldId === 'meta_tags') return 90
  if (fieldId === 'meta_status') return 84
  if (fieldId === 'meta_quantity') return 54
  if (fieldId === 'meta_updated') return 90
  return 80
}

export const maximumTableColumnWidth = 2000

export function guessType(header: string): NonNullable<ColumnDefinition['type']> {
  return /color|colour|colore/i.test(header)
    ? 'color'
    : /amount|quantit|costo|cost|speed|potenza|numero|count/i.test(header)
      ? 'number'
      : /text|effetto|description|descrizione|regole/i.test(header)
        ? 'longtext'
        : /image|immagine|illustrazione|artwork/i.test(header)
          ? 'image'
          : 'text'
}
