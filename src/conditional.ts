import type { Card, ColumnDefinition } from './types'

function cardFieldValue(card: Card, fieldId: string) {
  if (fieldId === 'meta_title') return card.title
  if (fieldId === 'meta_quantity') return String(card.quantity)
  if (fieldId === 'meta_status') return card.status
  if (fieldId === 'meta_tags') return card.tags.join(', ')
  return card.values[fieldId] ?? ''
}

export function resolveConditionalValues(columns: ColumnDefinition[], card: Card): Card {
  const values = { ...card.values }
  for (const column of columns) {
    if (!column.rules?.length) continue
    const matched = column.rules.find((rule) => {
      const source = cardFieldValue({ ...card, values }, rule.sourceFieldId).trim()
      const target = (rule.matchValue ?? '').trim()
      if (rule.operator === 'is_set') return Boolean(source)
      if (rule.operator === 'is_empty') return !source
      if (rule.operator === 'equals') return source.toLocaleLowerCase() === target.toLocaleLowerCase()
      if (rule.operator === 'not_equals') return Boolean(source) && source.toLocaleLowerCase() !== target.toLocaleLowerCase()
      return Boolean(target) && source.toLocaleLowerCase().includes(target.toLocaleLowerCase())
    })
    values[column.fieldId] = matched?.value ?? ''
  }
  return { ...card, values }
}
