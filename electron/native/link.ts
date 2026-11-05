import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { Card, ProjectSnapshot } from '../../src/types'
import { state } from '../state'
import { columnsFromBlueprint, synchronizeBlueprintFields } from '../blueprints'
import { dataDirName } from '../constants'
import { writeDiagnostic } from '../diagnostics'
import { mergeColumnDefinitions, ensureSetGeneratedIds } from '../fields'
import { nativeDocumentHash } from '../hash'
import { scanNativeSets } from './files'
import { columnsFromNativeItems, nativeCard, nativeItemFromCard } from './items'
import { snapshot } from '../snapshot'
import { persistSets } from '../store'

export async function connectNativeSet(setId: string, file: string, index: number): Promise<ProjectSnapshot> {
  const target = state.sets.find((set) => set.id === setId)
  if (!target) throw new Error('Il set Card Studio da collegare non esiste più.')
  if (target.nativeSetFile)
    throw new Error(
      `“${target.name}” è già collegato a un set Tabletop Creator. Scollegalo prima di assegnarne un altro.`,
    )
  const safeFile = path.basename(file)
  if (safeFile !== file || !safeFile.toLowerCase().endsWith('.json'))
    throw new Error('Il file del set nativo non è valido.')
  const alreadyLinked = state.sets.find(
    (set) => set.nativeSetFile && path.basename(set.nativeSetFile) === safeFile && set.nativeSetIndex === index,
  )
  if (alreadyLinked)
    throw new Error(
      `Il set Tabletop Creator è già collegato a “${alreadyLinked.name}”. Scollega prima quel collegamento.`,
    )
  const filePath = path.join(state.activeProject, 'data', 'sets', safeFile)
  const raw = await fs.readFile(filePath)
  const document = JSON.parse(raw.toString('utf8'))
  const nativeSet = document.sets?.[index]
  if (!nativeSet || !Array.isArray(nativeSet.items))
    throw new Error('Il set selezionato non è più disponibile nel progetto.')
  const rawItems = (nativeSet.items as unknown[]).filter(
    (item: unknown): item is Record<string, unknown> =>
      Boolean(item) && typeof item === 'object' && !Array.isArray(item),
  )
  const nativeBlueprintName =
    typeof nativeSet.blueprint_name === 'string' && nativeSet.blueprint_name
      ? nativeSet.blueprint_name
      : target.blueprintName
  const blueprintPeers = nativeBlueprintName
    ? state.sets.filter((set) => set.id !== target.id && set.blueprintName === nativeBlueprintName)
    : []
  const columns = mergeColumnDefinitions(
    ...blueprintPeers.map((set) => set.columns),
    columnsFromBlueprint(nativeBlueprintName ?? '', target.columns),
    columnsFromNativeItems(rawItems, target.columns),
  )
  await writeDiagnostic('info', 'native-set.fields.discovered', {
    file: safeFile,
    nativeSetIndex: index,
    blueprintName: nativeBlueprintName || undefined,
    itemCount: rawItems.length,
    fieldCount: columns.length,
    fieldHeaders: columns.map((column) => column.header),
  })
  const existingByTitle = new Map<string, Card[]>()
  for (const card of target.cards) {
    const key = card.title.trim().toLocaleLowerCase()
    existingByTitle.set(key, [...(existingByTitle.get(key) ?? []), card])
  }
  const cards = rawItems.map((item, itemIndex) => {
    const details = new Map<string, Record<string, unknown>>()
    for (const detail of Array.isArray(item.details) ? item.details : []) {
      if (!detail || typeof detail !== 'object') continue
      const record = detail as { name?: unknown; data?: unknown }
      if (typeof record.name === 'string' && record.data && typeof record.data === 'object')
        details.set(record.name, record.data as Record<string, unknown>)
    }
    const title = String(details.get('title')?.value ?? `Carta ${itemIndex + 1}`)
      .trim()
      .toLocaleLowerCase()
    const existing = existingByTitle.get(title)?.shift()
    return nativeCard(`Carta ${itemIndex + 1}`, item, columns, existing)
  })
  target.cards = cards
  target.columns = columns
  ensureSetGeneratedIds(target)
  target.blueprintName = nativeBlueprintName
  target.nativeSetFile = safeFile
  target.nativeSetIndex = index
  target.nativeSetHash = nativeDocumentHash(raw)
  state.activeSetId = target.id
  if (nativeBlueprintName) synchronizeBlueprintFields(nativeBlueprintName, columns)
  state.nativeSets = await scanNativeSets()
  await persistSets(false)
  return snapshot()
}

export async function createNativeSet(setId: string, name: string, blueprintName: string): Promise<ProjectSnapshot> {
  const target = state.sets.find((set) => set.id === setId)
  const trimmedName = name.trim()
  if (!target) throw new Error('Il set Card Studio da collegare non esiste più.')
  if (target.nativeSetFile)
    throw new Error(`“${target.name}” è già collegato a un set Tabletop Creator. Scollegalo prima di crearne un altro.`)
  if (!trimmedName) throw new Error('Inserisci un nome per il set Tabletop Creator.')
  if (!state.blueprints.some((blueprint) => blueprint.name === blueprintName))
    throw new Error('Scegli un blueprint presente nel progetto Tabletop Creator.')
  if (state.nativeSets.some((nativeSet) => nativeSet.name.toLocaleLowerCase() === trimmedName.toLocaleLowerCase()))
    throw new Error(`Esiste già un set Tabletop Creator chiamato “${trimmedName}”.`)
  const existingBlueprintColumns = state.sets
    .filter((set) => set.id !== target.id && set.blueprintName === blueprintName)
    .map((set) => set.columns)
  target.blueprintName = blueprintName
  target.name = trimmedName
  const sharedColumns = synchronizeBlueprintFields(
    blueprintName,
    mergeColumnDefinitions(...existingBlueprintColumns, target.columns),
  )
  target.columns = sharedColumns
  const nativeSet = {
    name: trimmedName,
    blueprint_name: blueprintName,
    hint_order_index: state.nativeSets.length,
    zoom: 0,
    collapsed: false,
    items: target.cards.map((card) => nativeItemFromCard(card, target.columns)),
  }
  const document = { json_version: 5, sets: [nativeSet] }
  const serialized = JSON.stringify(document, null, 2)
  const directory = path.join(state.activeProject, 'data', 'sets')
  await fs.mkdir(directory, { recursive: true })
  let file = `${crypto.randomUUID()}.json`
  while (existsSync(path.join(directory, file))) file = `${crypto.randomUUID()}.json`
  await fs.writeFile(path.join(directory, file), serialized, { flag: 'wx' })
  for (let index = 0; index < target.cards.length; index += 1)
    target.cards[index].nativeItem = JSON.parse(JSON.stringify(nativeSet.items[index]))
  target.nativeSetFile = file
  target.nativeSetIndex = 0
  target.nativeSetHash = nativeDocumentHash(serialized)
  state.nativeSets = await scanNativeSets()
  await persistSets(false)
  return snapshot()
}

export async function disconnectNativeSet(setId: string): Promise<ProjectSnapshot> {
  const target = state.sets.find((set) => set.id === setId)
  if (!target) throw new Error('Il set Card Studio selezionato non esiste più.')
  if (!target.nativeSetFile) throw new Error(`“${target.name}” non è collegato a un set Tabletop Creator.`)
  target.nativeSetFile = undefined
  target.nativeSetIndex = undefined
  target.nativeSetHash = undefined
  target.cards = target.cards.map(({ nativeItem: _nativeItem, ...card }) => card)
  await persistSets(false)
  return snapshot()
}

export async function resolveNativeSetNameConflict(
  setId: string,
  resolution: 'card-studio' | 'tabletop',
): Promise<ProjectSnapshot> {
  const target = state.sets.find((set) => set.id === setId)
  if (!target?.nativeSetFile || target.nativeSetIndex === undefined)
    throw new Error('Il set non è collegato a Tabletop Creator.')
  const file = path.basename(target.nativeSetFile)
  const filePath = path.join(state.activeProject, 'data', 'sets', file)
  const raw = await fs.readFile(filePath)
  const document = JSON.parse(raw.toString('utf8'))
  const nativeSet = document.sets?.[target.nativeSetIndex]
  if (!nativeSet || !Array.isArray(nativeSet.items))
    throw new Error('Il set nativo non è più disponibile nel progetto.')
  if (resolution === 'card-studio') nativeSet.name = target.name
  else target.name = String(nativeSet.name || target.name)
  const serialized = JSON.stringify(document, null, 2)
  if (resolution === 'card-studio') {
    const backupDirectory = path.join(state.activeProject, dataDirName, 'native-backups')
    await fs.mkdir(backupDirectory, { recursive: true })
    const hash = nativeDocumentHash(raw)
    const backupPath = path.join(backupDirectory, `${file}.${hash.slice(0, 16)}.json`)
    if (!existsSync(backupPath)) await fs.copyFile(filePath, backupPath)
    const temporary = `${filePath}.card-studio-${crypto.randomUUID()}.tmp`
    await fs.writeFile(temporary, serialized)
    await fs.rename(temporary, filePath)
  }
  const nextHash = nativeDocumentHash(resolution === 'card-studio' ? serialized : raw)
  for (const set of state.sets)
    if (set.nativeSetFile && path.basename(set.nativeSetFile) === file) set.nativeSetHash = nextHash
  await persistSets(false)
  state.nativeSets = await scanNativeSets()
  return snapshot()
}
