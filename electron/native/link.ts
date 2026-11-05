import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { ProjectSnapshot } from '../../src/types'
import { state } from '../state'
import { columnsFromBlueprint, synchronizeBlueprintFields } from '../blueprints'
import { writeDiagnostic } from '../diagnostics'
import { mergeColumnDefinitions, ensureSetGeneratedIds } from '../fields'
import { nativeDocumentHash } from '../hash'
import { scanNativeSets } from './files'
import {
  backupNativeFileByHash,
  createNativeFile,
  linkedNativeGroups,
  nativeSetsDirectory,
  readNativeFile,
  serializeNativeDocument,
  writeNativeFile,
} from './io'
import { columnsFromNativeItems, nativeCard, nativeItemFromCard } from './items'
import { nativeSetItems, matchCardsToItems } from './reload'
import { reloadNativeGroup } from './sync'
import { startNativeWatcher } from './watch'
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
  const rawItems = nativeSetItems(nativeSet)
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
  const matches = matchCardsToItems(target.cards, rawItems, false)
  const cards = rawItems.map((item, itemIndex) =>
    nativeCard(`Carta ${itemIndex + 1}`, item, columns, matches[itemIndex]),
  )
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
  startNativeWatcher()
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
  const serialized = serializeNativeDocument({ json_version: 5, sets: [nativeSet] })
  const directory = nativeSetsDirectory()
  let file = `${crypto.randomUUID()}.json`
  while (existsSync(path.join(directory, file))) file = `${crypto.randomUUID()}.json`
  const hash = await createNativeFile(file, serialized)
  for (let index = 0; index < target.cards.length; index += 1)
    target.cards[index].nativeItem = JSON.parse(JSON.stringify(nativeSet.items[index]))
  target.nativeSetFile = file
  target.nativeSetIndex = 0
  target.nativeSetHash = hash
  state.nativeSets = await scanNativeSets()
  await persistSets(false)
  startNativeWatcher()
  return snapshot()
}

export async function disconnectNativeSet(setId: string): Promise<ProjectSnapshot> {
  const target = state.sets.find((set) => set.id === setId)
  if (!target) throw new Error('Il set Card Studio selezionato non esiste più.')
  if (!target.nativeSetFile) throw new Error(`“${target.name}” non è collegato a un set Tabletop Creator.`)
  target.nativeSetFile = undefined
  target.nativeSetIndex = undefined
  target.nativeSetHash = undefined
  target.nativeSyncPending = undefined
  target.cards = target.cards.map(({ nativeItem: _nativeItem, ...card }) => card)
  await persistSets(false)
  return snapshot()
}

/**
 * Reloads the file's linked sets from the native content first, so card edits made in Tabletop
 * Creator are kept, then applies the chosen name. Refused while a sync conflict is open.
 */
export async function resolveNativeSetNameConflict(
  setId: string,
  resolution: 'card-studio' | 'tabletop',
): Promise<ProjectSnapshot> {
  const target = state.sets.find((set) => set.id === setId)
  if (!target?.nativeSetFile || target.nativeSetIndex === undefined)
    throw new Error('Il set non è collegato a Tabletop Creator.')
  const file = path.basename(target.nativeSetFile)
  const group = linkedNativeGroups().get(file) ?? [target]
  if (group.some((set) => set.nativeSyncPending))
    throw new Error('Risolvi prima il conflitto di sincronizzazione con Tabletop Creator.')
  const native = await readNativeFile(file)
  const nativeSet = native.document.sets?.[target.nativeSetIndex]
  if (!nativeSet || !Array.isArray(nativeSet.items))
    throw new Error('Il set nativo non è più disponibile nel progetto.')
  reloadNativeGroup(file, group, native)
  if (resolution === 'tabletop') target.name = String(nativeSet.name || target.name)
  else {
    nativeSet.name = target.name
    await backupNativeFileByHash(file, native.hash)
    const nextHash = await writeNativeFile(file, serializeNativeDocument(native.document))
    for (const set of group) set.nativeSetHash = nextHash
  }
  await persistSets(false)
  state.nativeSets = await scanNativeSets()
  return snapshot()
}
