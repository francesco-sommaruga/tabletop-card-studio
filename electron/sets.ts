import { randomUUID } from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { ensureGeneratedIdValues } from '../src/generatedIds'
import type { Card, ColumnDefinition, ProjectSet, ProjectSnapshot } from '../src/types'
import { resolveConditionalValues } from '../src/conditional'
import { state } from './state'
import { synchronizeBlueprintFields, replaceBlueprintFields } from './blueprints'
import { defaultColumns } from './constants'
import { writeDiagnostic } from './diagnostics'
import { mergeColumnDefinitions, ensureSetGeneratedIds } from './fields'
import { nativeDocumentHash } from './hash'
import { scanNativeSets, writeLinkedNativeSetName } from './native/files'
import { createNativeFile, nativeSetsDirectory, serializeNativeDocument } from './native/io'
import { nativeItemFromCard } from './native/items'
import { snapshot, activeSet } from './snapshot'
import { persistSets } from './store'

export async function saveBlueprintAssignments(assignments: Record<string, string>): Promise<ProjectSnapshot> {
  const previousBlueprints = new Map(state.sets.map((set) => [set.id, set.blueprintName]))
  const updates = state.sets.map((set) => {
    const requested = (assignments[set.id] ?? '').trim()
    if (requested && !state.blueprints.some((blueprint) => blueprint.name === requested))
      throw new Error(`Il blueprint “${requested}” non è disponibile nel progetto.`)
    if (set.nativeSetFile) {
      const nativeSet = state.nativeSets.find(
        (item) => item.file === path.basename(set.nativeSetFile!) && item.index === set.nativeSetIndex,
      )
      const nativeBlueprint = nativeSet?.blueprintName ?? ''
      if (requested && requested !== nativeBlueprint)
        throw new Error(
          `“${set.name}” è collegato a un set nativo che usa il blueprint “${nativeBlueprint || 'non assegnato'}”. Cambia prima il collegamento nativo.`,
        )
      return { set, blueprintName: nativeBlueprint || undefined }
    }
    return { set, blueprintName: requested || undefined }
  })
  for (const { set, blueprintName } of updates) set.blueprintName = blueprintName
  for (const name of new Set(
    updates.map(({ blueprintName }) => blueprintName).filter((value): value is string => Boolean(value)),
  )) {
    const established = state.sets.filter(
      (set) => set.blueprintName === name && previousBlueprints.get(set.id) === name,
    )
    const joining = state.sets.filter((set) => set.blueprintName === name && previousBlueprints.get(set.id) !== name)
    const seedColumns = mergeColumnDefinitions(
      ...established.map((set) => set.columns),
      ...joining.map((set) => set.columns),
    )
    const columns = synchronizeBlueprintFields(name, seedColumns)
    for (const set of state.sets.filter((item) => item.blueprintName === name))
      set.cards = set.cards.map((card) => resolveConditionalValues(columns, card))
  }
  await persistSets()
  return snapshot()
}

export async function duplicateProjectSet(setId: string): Promise<ProjectSnapshot> {
  const source = state.sets.find((set) => set.id === setId)
  if (!source) throw new Error('Il set da duplicare non esiste più.')
  const names = new Set(state.sets.map((set) => set.name.toLocaleLowerCase()))
  let copyName = `${source.name} copia`
  let suffix = 2
  while (names.has(copyName.toLocaleLowerCase())) copyName = `${source.name} copia ${suffix++}`
  const duplicate: ProjectSet = {
    ...source,
    id: `set_${crypto.randomUUID()}`,
    name: copyName,
    sourceFile: undefined,
    cards: source.cards.map((card) => ({
      ...card,
      id: `card_${crypto.randomUUID()}`,
      tags: [...card.tags],
      values: { ...card.values },
      nativeItem: card.nativeItem ? JSON.parse(JSON.stringify(card.nativeItem)) : undefined,
    })),
    columns: structuredClone(source.columns),
    importBaseline: undefined,
    importMatchFieldId: undefined,
    nativeSetFile: undefined,
    nativeSetIndex: undefined,
    nativeSetHash: undefined,
    nativeSyncPending: undefined,
  }
  duplicate.cards = ensureGeneratedIdValues(duplicate.cards, duplicate.columns, randomUUID, true)
  if (source.nativeSetFile && source.nativeSetIndex !== undefined) {
    const sourceFile = path.basename(source.nativeSetFile)
    const sourcePath = path.join(state.activeProject, 'data', 'sets', sourceFile)
    const original = await fs.readFile(sourcePath)
    if (source.nativeSetHash && nativeDocumentHash(original) !== source.nativeSetHash) {
      await writeDiagnostic('info', 'native-set.duplicate-from-local-copy', { file: sourceFile, setName: source.name })
    }
    const document = JSON.parse(original.toString('utf8'))
    const nativeSet = document.sets?.[source.nativeSetIndex]
    if (!nativeSet) throw new Error('Non trovo il set nativo da duplicare.')
    const nativeCopy = JSON.parse(JSON.stringify(nativeSet)) as Record<string, unknown>
    const nativeNames = new Set(state.nativeSets.map((item) => item.name.toLocaleLowerCase()))
    const baseNativeName = copyName
    let nativeName = baseNativeName
    let nativeSuffix = 2
    while (nativeNames.has(nativeName.toLocaleLowerCase())) nativeName = `${baseNativeName} ${nativeSuffix++}`
    duplicate.name = nativeName
    nativeCopy.name = nativeName
    nativeCopy.hint_order_index = state.nativeSets.length
    const nativeItems = Array.isArray(nativeCopy.items) ? nativeCopy.items : []
    duplicate.cards = duplicate.cards.map((card, index) => ({
      ...card,
      nativeItem: JSON.parse(JSON.stringify(nativeItems[index] ?? card.nativeItem ?? {})),
    }))
    const copiedNativeItems = duplicate.cards.map((card) => nativeItemFromCard(card, duplicate.columns))
    nativeCopy.items = copiedNativeItems
    duplicate.cards.forEach((card, index) => {
      card.nativeItem = JSON.parse(JSON.stringify(copiedNativeItems[index]))
    })
    const nativeDocument = { ...document, sets: [nativeCopy] }
    const directory = nativeSetsDirectory()
    let file = `${crypto.randomUUID()}.json`
    while (existsSync(path.join(directory, file))) file = `${crypto.randomUUID()}.json`
    duplicate.nativeSetHash = await createNativeFile(file, serializeNativeDocument(nativeDocument))
    duplicate.nativeSetFile = file
    duplicate.nativeSetIndex = 0
    state.nativeSets = await scanNativeSets()
  }
  state.sets.push(duplicate)
  state.activeSetId = duplicate.id
  await persistSets(false)
  return snapshot()
}

export async function moveCardBetweenSets(cardId: string, targetSetId: string, draft?: Card): Promise<ProjectSnapshot> {
  const source = activeSet()
  const target = state.sets.find((set) => set.id === targetSetId)
  if (!source) throw new Error('Il set corrente non esiste più.')
  if (!target || target.id === source.id) throw new Error('Scegli un altro set come destinazione.')
  const index = source.cards.findIndex((card) => card.id === cardId)
  if (index < 0) throw new Error('La carta da spostare non esiste più nel set corrente.')
  for (const set of [source, target]) {
    if (!set.nativeSetFile || !set.nativeSetHash) continue
    const file = path.basename(set.nativeSetFile)
    try {
      const current = await fs.readFile(path.join(state.activeProject, 'data', 'sets', file))
      if (nativeDocumentHash(current) !== set.nativeSetHash)
        await writeDiagnostic('info', 'native-set.move-will-save-locally', { file, setName: set.name })
    } catch (error) {
      await writeDiagnostic('info', 'native-set.move-will-save-locally', {
        file,
        setName: set.name,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  if (source.blueprintName && source.blueprintName === target.blueprintName)
    synchronizeBlueprintFields(source.blueprintName, mergeColumnDefinitions(source.columns, target.columns))
  const card = draft
    ? resolveConditionalValues(source.columns, { ...draft, id: cardId, updatedAt: new Date().toISOString() })
    : source.cards[index]
  const values = { ...card.values }
  for (const targetColumn of target.columns) {
    if (values[targetColumn.fieldId] !== undefined) continue
    const sourceColumn = source.columns.find(
      (column) =>
        column.fieldId === targetColumn.fieldId ||
        column.header.trim().toLocaleLowerCase() === targetColumn.header.trim().toLocaleLowerCase() ||
        (column.fieldLabel?.trim() &&
          column.fieldLabel.trim().toLocaleLowerCase() === targetColumn.fieldLabel?.trim().toLocaleLowerCase()),
    )
    if (sourceColumn && values[sourceColumn.fieldId] !== undefined)
      values[targetColumn.fieldId] = values[sourceColumn.fieldId]
  }
  source.cards.splice(index, 1)
  const targetTemplate = target.cards[0]?.nativeItem
  target.cards.push({
    ...card,
    values,
    nativeItem: targetTemplate ? JSON.parse(JSON.stringify(targetTemplate)) : undefined,
    updatedAt: new Date().toISOString(),
  })
  ensureSetGeneratedIds(target)
  state.activeSetId = target.id
  await persistSets()
  return snapshot()
}

export async function saveActiveCards(nextCards: Card[]) {
  const current = activeSet()
  if (!current) return
  current.cards = ensureGeneratedIdValues(nextCards, current.columns, randomUUID)
  await persistSets()
}

export async function saveActiveColumns(nextColumns: ColumnDefinition[]) {
  const current = activeSet()
  if (!current) return
  if (current.blueprintName) {
    const columns = replaceBlueprintFields(current.blueprintName, nextColumns)
    for (const set of state.sets.filter((item) => item.blueprintName === current.blueprintName))
      set.cards = ensureGeneratedIdValues(
        set.cards.map((card) => resolveConditionalValues(columns, card)),
        columns,
        randomUUID,
      )
  } else {
    current.columns = nextColumns
    current.cards = ensureGeneratedIdValues(
      current.cards.map((card) => resolveConditionalValues(nextColumns, card)),
      nextColumns,
      randomUUID,
    )
  }
  await persistSets()
}

export async function selectSet(id: string) {
  if (state.sets.some((set) => set.id === id)) state.activeSetId = id
  return snapshot()
}

export async function renameSet(id: string, name: string) {
  const target = state.sets.find((set) => set.id === id)
  const trimmedName = name.trim()
  if (!target) throw new Error('Il set selezionato non esiste più.')
  if (!trimmedName) throw new Error('Il nome del set non può essere vuoto.')
  target.name = trimmedName
  await writeLinkedNativeSetName(target)
  await persistSets(false)
  state.nativeSets = await scanNativeSets()
  return snapshot()
}

export async function deleteSet(id: string) {
  const targetIndex = state.sets.findIndex((set) => set.id === id)
  if (targetIndex < 0) throw new Error('Il set selezionato non esiste più.')
  state.sets.splice(targetIndex, 1)
  if (state.activeSetId === id) state.activeSetId = state.sets[0]?.id ?? null
  await persistSets(false)
  return snapshot()
}

export async function createSet(name: string) {
  const set: ProjectSet = {
    id: `set_${crypto.randomUUID()}`,
    name: name.trim() || 'Nuovo set',
    cards: [],
    columns: structuredClone(defaultColumns),
  }
  state.sets.push(set)
  state.activeSetId = set.id
  await persistSets(false)
  return snapshot()
}
