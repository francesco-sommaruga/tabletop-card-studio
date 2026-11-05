import type { TabletopBlueprint, ColumnDefinition, Card, ProjectVariable } from '../types'

export function fieldsForBlueprint(blueprint: TabletopBlueprint) {
  const found = new Map<
    string,
    { type: NonNullable<ColumnDefinition['type']>; group: string; side: 'front' | 'back' }
  >()
  const groups = [
    ...(blueprint.front_groups ?? []).map((group) => ({ group, side: 'front' as const })),
    ...(blueprint.front_layers ?? []).map((group) => ({ group, side: 'front' as const })),
    ...(blueprint.back_groups ?? []).map((group) => ({ group, side: 'back' as const })),
    ...(blueprint.back_layers ?? []).map((group) => ({ group, side: 'back' as const })),
  ]
  for (const { group, side } of groups) {
    for (const panel of group.panels ?? []) {
      const data = panel.data ?? {}
      const panelType = String(data.panel_type ?? '').toLocaleLowerCase()
      if (String(data.panel_editable ?? '').toLocaleLowerCase() === 'false') continue
      if (Object.prototype.hasOwnProperty.call(data, 'value'))
        found.set(panel.name, { type: panelType === 'image' ? 'image' : 'text', group: group.name, side })
      if (Object.prototype.hasOwnProperty.call(data, 'color'))
        found.set(`${panel.name}:color`, { type: 'color', group: group.name, side })
    }
  }
  return [...found].map(([header, details]) => ({ header, ...details }))
}

export function blueprintGroups(blueprint: TabletopBlueprint, side: 'front' | 'back') {
  const groups = side === 'front' ? blueprint.front_groups : blueprint.back_groups
  const layers = side === 'front' ? blueprint.front_layers : blueprint.back_layers
  return groups?.length ? groups : (layers ?? [])
}

export function parseBlueprintVector(value: string | undefined, fallback: [number, number]): [number, number] {
  if (!value) return fallback
  const values = value.split(',').map((item) => Number.parseFloat(item.trim()))
  return values.length >= 2 && values.every(Number.isFinite) ? [values[0], values[1]] : fallback
}

export function normalizeBlueprintHorizontalAlignment(
  value: string | undefined,
): 'left' | 'center' | 'right' | 'justify' {
  const normalized = value?.trim().toLocaleLowerCase().replace(/[ -]/g, '_')
  if (['left', 'center', 'right'].includes(normalized ?? '')) return normalized as 'left' | 'center' | 'right'
  if (['justify', 'justified', 'fill'].includes(normalized ?? '')) return 'justify'
  return 'center'
}

export function normalizeBlueprintVerticalAlignment(value: string | undefined): 'top' | 'center' | 'bottom' {
  const normalized = value?.trim().toLocaleLowerCase()
  if (['top', 'center', 'bottom'].includes(normalized ?? '')) return normalized as 'top' | 'center' | 'bottom'
  return 'center'
}

export function cardPanelValue(card: Card, columns: ColumnDefinition[], name: string, property: string) {
  const suffix = property === 'value' ? '' : `_${property}`
  const directId = `field_${name}${suffix}`
  if (Object.prototype.hasOwnProperty.call(card.values, directId)) return card.values[directId]
  const alternateId = `${name}${suffix}`
  if (Object.prototype.hasOwnProperty.call(card.values, alternateId)) return card.values[alternateId]
  const column = columns.find(
    (item) =>
      item.header.toLocaleLowerCase() === `${name}${suffix}`.toLocaleLowerCase() ||
      item.fieldId === directId ||
      item.fieldId === alternateId,
  )
  if (column && Object.prototype.hasOwnProperty.call(card.values, column.fieldId)) return card.values[column.fieldId]
  if (property === 'value' && name === 'title') return card.title
  return undefined
}

export function renderBlueprintText(value: string, variables: ProjectVariable[]) {
  const withVariables = value.replace(/\{\s*([^{}]+?)\s*\}/g, (token, code: string) => {
    const variable = variables.find((item) => item.code.toLocaleLowerCase() === code.toLocaleLowerCase())
    return variable?.studioType === 'icon' ? `[${code}]` : (variable?.replacement ?? token)
  })
  return withVariables
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /&lt;(\/?)((?:b|i|u|s|br))&gt;/gi,
      (_match, close: string, tag: string) => `<${close}${tag.toLowerCase()}>`,
    )
    .replace(/&lt;color=(#[\da-f]{6}(?:[\da-f]{2})?)&gt;/gi, '<span style="color:$1">')
    .replace(
      /&lt;size=(\d+(?:\.\d+)?)(%)?&gt;/gi,
      (_match, size: string, percent: string) => `<span style="font-size:${size}${percent ? '%' : 'px'}">`,
    )
    .replace(/&lt;\/(?:color|size)&gt;/gi, '</span>')
    .replace(/\r?\n/g, '<br/>')
}
