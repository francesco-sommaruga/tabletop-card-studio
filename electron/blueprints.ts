import { randomUUID } from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs/promises'
import { ensureGeneratedIdValues } from '../src/generatedIds'
import type { ColumnDefinition, TabletopBlueprint } from '../src/types'
import { state } from './state'
import { writeDiagnostic } from './diagnostics'
import { mergeColumnDefinitions } from './fields'
import { columnIdForNativeHeader, hydrateNativeValues } from './native/items'
import { snapshot } from './snapshot'

export function columnsFromBlueprint(blueprintName: string, existing: ColumnDefinition[] = []): ColumnDefinition[] {
  const blueprint = state.blueprints.find((item) => item.name === blueprintName)
  if (!blueprint) return []
  const headers = new Map<string, ColumnDefinition['type']>()
  for (const group of [
    ...(blueprint.front_groups ?? []),
    ...(blueprint.back_groups ?? []),
    ...(blueprint.front_layers ?? []),
    ...(blueprint.back_layers ?? []),
  ]) {
    for (const panel of group.panels ?? []) {
      const data = panel.data ?? {}
      if (String(data.panel_editable ?? '').toLocaleLowerCase() === 'false') continue
      const panelType = String(data.panel_type ?? '').toLocaleLowerCase()
      if (Object.prototype.hasOwnProperty.call(data, 'value'))
        headers.set(panel.name, panelType === 'image' ? 'image' : 'text')
      if (Object.prototype.hasOwnProperty.call(data, 'color')) headers.set(`${panel.name}:color`, 'color')
    }
  }
  return [...headers].map(([header, type]) => {
    const prior = existing.find((column) => column.header.toLocaleLowerCase() === header.toLocaleLowerCase())
    const fieldId = columnIdForNativeHeader(header)
    return {
      ...(prior ?? {}),
      id: prior?.id ?? `column_${fieldId}`,
      header,
      fieldId,
      type: prior?.type ?? type ?? 'text',
    }
  })
}

export function synchronizeBlueprintFields(
  blueprintName: string,
  preferredColumns?: ColumnDefinition[],
): ColumnDefinition[] {
  const groupedSets = state.sets.filter((set) => set.blueprintName === blueprintName)
  const columns = mergeColumnDefinitions(
    ...(preferredColumns ? [preferredColumns] : []),
    ...groupedSets.map((set) => set.columns),
  )
  for (const set of groupedSets) {
    set.columns = structuredClone(columns)
    set.cards = ensureGeneratedIdValues(
      set.cards.map((card) => hydrateNativeValues(card, columns)),
      columns,
      randomUUID,
    )
  }
  return columns
}

export function replaceBlueprintFields(blueprintName: string, columns: ColumnDefinition[]): ColumnDefinition[] {
  const groupedSets = state.sets.filter((set) => set.blueprintName === blueprintName)
  for (const set of groupedSets) {
    set.columns = structuredClone(columns)
    set.cards = ensureGeneratedIdValues(
      set.cards.map((card) => hydrateNativeValues(card, columns)),
      columns,
      randomUUID,
    )
  }
  return columns
}

export function normalizeBlueprintFieldSets(): boolean {
  const before = JSON.stringify(state.sets)
  for (const set of state.sets) {
    if (!set.nativeSetFile || set.nativeSetIndex === undefined) continue
    const nativeSet = state.nativeSets.find(
      (item) => item.file === path.basename(set.nativeSetFile!) && item.index === set.nativeSetIndex,
    )
    if (nativeSet?.blueprintName) set.blueprintName = nativeSet.blueprintName
  }
  for (const name of new Set(
    state.sets.map((set) => set.blueprintName).filter((value): value is string => Boolean(value)),
  ))
    synchronizeBlueprintFields(name)
  return before !== JSON.stringify(state.sets)
}

export async function loadBlueprints(): Promise<TabletopBlueprint[]> {
  if (!state.activeProject) return []
  const directory = path.join(state.activeProject, 'data', 'blueprints')
  let files: string[]
  try {
    files = (await fs.readdir(directory)).filter((file) => file.toLowerCase().endsWith('.json')).sort()
  } catch {
    return []
  }
  const loaded = await Promise.all(
    files.map(async (file) => {
      try {
        const document = JSON.parse(await fs.readFile(path.join(directory, file), 'utf8'))
        return Array.isArray(document.blueprints)
          ? document.blueprints.filter(
              (blueprint: unknown): blueprint is TabletopBlueprint =>
                typeof blueprint === 'object' &&
                blueprint !== null &&
                typeof (blueprint as TabletopBlueprint).name === 'string',
            )
          : []
      } catch {
        return []
      }
    }),
  )
  return loaded.flat()
}

export async function reloadBlueprints() {
  if (!state.activeProject) throw new Error('Apri prima un progetto Tabletop Creator.')
  state.blueprints = await loadBlueprints()
  await writeDiagnostic('info', 'blueprints.reloaded', {
    blueprintCount: state.blueprints.length,
    blueprintNames: state.blueprints.map((blueprint) => blueprint.name),
  })
  return snapshot()
}
