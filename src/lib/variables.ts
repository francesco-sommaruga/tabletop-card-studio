import type { ProjectVariable } from '../types'

export function variableIconTint(variable: ProjectVariable, defaultTint?: string) {
  return (variable.force_tint ?? '').toLocaleLowerCase() === 'true'
    ? variable.color?.trim() || defaultTint
    : defaultTint
}

export function resolvePreviewReference(value: string, variables: ProjectVariable[]) {
  const token = value.match(/^\{\s*(.*?)\s*\}$/)?.[1]
  const variable = token
    ? variables.find((item) => item.code.toLocaleLowerCase() === token.toLocaleLowerCase())
    : undefined
  return { reference: variable?.replacement ?? value, variable }
}

export function appendVariable(value: string, token: string) {
  return `${value}${value && !/\s$/.test(value) ? ' ' : ''}${token}`
}

export function variableTagList(variables: ProjectVariable[]) {
  return [
    ...new Set(
      variables
        .flatMap((variable) => variable.studioTags ?? [])
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, 'it'))
}
