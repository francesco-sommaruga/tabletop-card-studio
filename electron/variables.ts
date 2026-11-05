import path from 'node:path'
import fs from 'node:fs/promises'
import type { ProjectVariable } from '../src/types'
import { state } from './state'
import { dataDirName } from './constants'
import { snapshot } from './snapshot'

export async function loadVariables(): Promise<ProjectVariable[]> {
  try {
    const json = JSON.parse(await fs.readFile(path.join(state.activeProject, 'data', 'variables.json'), 'utf8'))
    const source: ProjectVariable[] = Array.isArray(json.variables)
      ? json.variables.filter(
          (item: unknown): item is ProjectVariable =>
            typeof item === 'object' &&
            item !== null &&
            'code' in item &&
            typeof (item as Record<string, unknown>).code === 'string',
        )
      : []
    let tagMap: Record<string, string[]> = {}
    try {
      const metadata = JSON.parse(
        await fs.readFile(path.join(state.activeProject, dataDirName, 'variable-tags.json'), 'utf8'),
      )
      if (metadata && typeof metadata === 'object' && metadata.variables && typeof metadata.variables === 'object')
        tagMap = metadata.variables
    } catch {
      /* no CMS tag metadata yet */
    }
    let typeMap: Record<string, 'text' | 'color' | 'icon'> = {}
    try {
      const metadata = JSON.parse(
        await fs.readFile(path.join(state.activeProject, dataDirName, 'variable-types.json'), 'utf8'),
      )
      if (metadata && typeof metadata === 'object' && metadata.variables && typeof metadata.variables === 'object')
        typeMap = metadata.variables
    } catch {
      /* no CMS variable type metadata yet */
    }
    return source.map((variable) => ({
      ...variable,
      studioTags: tagMap[variable.code.toLocaleLowerCase()] ?? variable.studioTags ?? [],
      studioType: typeMap[variable.code.toLocaleLowerCase()] ?? variable.studioType ?? 'text',
    }))
  } catch {
    return []
  }
}

export async function saveVariables(nextVariables: ProjectVariable[]) {
  if (!state.activeProject) throw new Error('Apri prima un progetto Tabletop Creator.')
  const filePath = path.join(state.activeProject, 'data', 'variables.json')
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  let document: Record<string, unknown> = { json_version: 5, variables: [] }
  try {
    const existing = JSON.parse(await fs.readFile(filePath, 'utf8'))
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) document = existing
  } catch {
    /* create the variables file when it does not exist yet */
  }
  document.variables = nextVariables.map(
    ({ studioTags: _studioTags, studioType: _studioType, ...variable }) => variable,
  )
  await fs.writeFile(filePath, JSON.stringify(document, null, 2))
  const tagMap = Object.fromEntries(
    nextVariables
      .filter((variable) => variable.studioTags?.length)
      .map((variable) => [
        variable.code.toLocaleLowerCase(),
        [...new Set(variable.studioTags!.map((tag) => tag.trim()).filter(Boolean))],
      ]),
  )
  const metadataPath = path.join(state.activeProject, dataDirName, 'variable-tags.json')
  await fs.mkdir(path.dirname(metadataPath), { recursive: true })
  await fs.writeFile(metadataPath, JSON.stringify({ variables: tagMap }, null, 2))
  const typeMap = Object.fromEntries(
    nextVariables
      .filter((variable) => variable.studioType === 'color' || variable.studioType === 'icon')
      .map((variable) => [variable.code.toLocaleLowerCase(), variable.studioType]),
  )
  const typeMetadataPath = path.join(state.activeProject, dataDirName, 'variable-types.json')
  await fs.writeFile(typeMetadataPath, JSON.stringify({ variables: typeMap }, null, 2))
  state.variables = nextVariables.map((variable) => ({ ...variable, studioType: variable.studioType ?? 'text' }))
  return snapshot()
}
