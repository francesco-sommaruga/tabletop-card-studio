import type { ColumnDefinition } from '../../types'
import { slug } from '../../lib/format'
import { metaFields, internalFieldName } from '../../lib/tableColumns'

export type FieldType = NonNullable<ColumnDefinition['type']>

export type FieldOption = { id: string; label: string }

/** Returns `base`, or `base_2`, `base_3`, … if a column already uses that fieldId. */
export function uniqueFieldId(columns: ColumnDefinition[], base: string) {
  let fieldId = base
  let suffix = 2
  while (columns.some((column) => column.fieldId === fieldId)) fieldId = `${base}_${suffix++}`
  return fieldId
}

export function matchesBlueprintField(column: ColumnDefinition, header: string) {
  return column.header.toLocaleLowerCase() === header.toLocaleLowerCase() || column.fieldId === slug(header)
}

/** Builds a copy of `source` with a unique "copia" header and fieldId. */
export function duplicateColumn(columns: ColumnDefinition[], source: ColumnDefinition): ColumnDefinition {
  const usedHeaders = new Set(columns.map((column) => column.header.trim().toLocaleLowerCase()))
  let header = `${source.header} copia`
  let number = 2
  while (usedHeaders.has(header.trim().toLocaleLowerCase())) header = `${source.header} copia ${number++}`
  return {
    ...source,
    id: `column_${crypto.randomUUID()}`,
    header,
    fieldLabel: header,
    fieldId: uniqueFieldId(columns, slug(header)),
    options: source.options ? [...source.options] : undefined,
    variableTags: source.variableTags ? [...source.variableTags] : undefined,
    rules: source.rules?.map((rule) => ({ ...rule })),
  }
}

export function moveColumn(columns: ColumnDefinition[], from: number, to: number) {
  const next = [...columns]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/** Meta fields plus one entry per distinct fieldId used by the draft columns. */
export function fieldOptionsFor(columns: ColumnDefinition[]): FieldOption[] {
  return [
    ...metaFields,
    ...columns
      .filter(
        (column, index, all) =>
          !metaFields.some((meta) => meta.id === column.fieldId) &&
          all.findIndex((item) => item.fieldId === column.fieldId) === index,
      )
      .map((column) => ({ id: column.fieldId, label: internalFieldName(column) })),
  ]
}

export function fieldNameFor(columns: ColumnDefinition[], fields: FieldOption[], fieldId: string) {
  const field = columns.find((column) => column.fieldId === fieldId)
  return field ? internalFieldName(field) : (fields.find((item) => item.id === fieldId)?.label ?? fieldId)
}

export function splitOptions(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}
