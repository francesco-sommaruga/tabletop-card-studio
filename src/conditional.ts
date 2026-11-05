import type { Card, CardStatus, ColumnDefinition } from './types'

function cardFieldValue(card: Card, fieldId: string) {
  if (fieldId === 'meta_title') return card.title
  if (fieldId === 'meta_quantity') return String(card.quantity)
  if (fieldId === 'meta_status') return card.status
  if (fieldId === 'meta_tags') return card.tags.join(', ')
  return card.values[fieldId] ?? ''
}

export function resolveConditionalValues(columns: ColumnDefinition[], card: Card): Card {
  const resolved = { ...card, values: { ...card.values }, tags: [...card.tags] }
  const writeValue = (fieldId: string, value: string) => {
    if (fieldId === 'meta_title') resolved.title = value
    else if (fieldId === 'meta_quantity') {
      const number = Number(value)
      resolved.quantity = value.trim() && Number.isFinite(number) ? number : 1
    } else if (fieldId === 'meta_status') resolved.status = value as CardStatus
    else if (fieldId === 'meta_tags')
      resolved.tags = value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    else resolved.values[fieldId] = value
  }
  for (const column of columns) {
    if (column.type === 'id') continue
    const fallback = column.defaultValue ?? ''
    if (!column.rules?.length) {
      if (!cardFieldValue(resolved, column.fieldId).trim() && fallback) writeValue(column.fieldId, fallback)
      continue
    }
    const matched = column.rules.find((rule) => {
      const source = cardFieldValue(resolved, rule.sourceFieldId).trim()
      const target = (rule.matchValue ?? '').trim()
      if (rule.operator === 'is_set') return Boolean(source)
      if (rule.operator === 'is_empty') return !source
      if (rule.operator === 'equals') return source.toLocaleLowerCase() === target.toLocaleLowerCase()
      if (rule.operator === 'not_equals')
        return Boolean(source) && source.toLocaleLowerCase() !== target.toLocaleLowerCase()
      if (rule.operator === 'greater_than' || rule.operator === 'less_than') {
        const sourceNumber = Number(source)
        const targetNumber = Number(target)
        if (!source.trim() || !target.trim() || !Number.isFinite(sourceNumber) || !Number.isFinite(targetNumber))
          return false
        return rule.operator === 'greater_than' ? sourceNumber > targetNumber : sourceNumber < targetNumber
      }
      return Boolean(target) && source.toLocaleLowerCase().includes(target.toLocaleLowerCase())
    })
    writeValue(column.fieldId, matched ? matched.value : fallback)
  }
  return resolved
}
