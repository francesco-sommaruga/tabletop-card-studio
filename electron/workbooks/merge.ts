import path from 'node:path'
import type {
  Card,
  ColumnDefinition,
  MergeFieldChange,
  MergeFieldConflict,
  ProjectSnapshot,
  WorkbookMergePreview,
} from '../../src/types'
import { resolveConditionalValues } from '../../src/conditional'
import { state } from '../state'
import { synchronizeBlueprintFields } from '../blueprints'
import { cardFieldValue, ensureSetGeneratedIds } from '../fields'
import { snapshot } from '../snapshot'
import { persistSets } from '../store'
import { workbookRestoreFields, readWorkbookRowsForSet, scanWorkbooks } from './import'

const pendingMerges = new Map<
  string,
  {
    setId: string
    matchFieldId: string
    incoming: Card[]
    selectedFieldIds: string[]
    baselineFieldIds: string[]
    restoreColumns: ColumnDefinition[]
  }
>()

function mergeKey(value: string): string {
  return value.trim().toLocaleLowerCase()
}

export async function previewWorkbookMerge(
  file: string,
  setId: string,
  requestedMatchFieldId?: string,
  requestedFieldIds?: string[],
  requestedRestoreFieldIds?: string[],
): Promise<WorkbookMergePreview> {
  const set = state.sets.find((item) => item.id === setId)
  if (!set) throw new Error('Il set da aggiornare non esiste più.')
  if (set.sourceFile !== path.basename(file)) throw new Error('Questo foglio non è collegato al set selezionato.')
  const filePath = path.join(state.activeProject, path.basename(file))
  const restoreFields = await workbookRestoreFields(filePath, set)
  const restoredFieldIds = restoreFields
    .filter((field) => requestedRestoreFieldIds?.includes(field.id))
    .map((field) => field.id)
  const restoreColumns: ColumnDefinition[] = restoreFields
    .filter((field) => restoredFieldIds.includes(field.id))
    .map((field) => ({ id: `column_${field.id}`, header: field.header, fieldId: field.id, type: field.type }))
  const effectiveSet = restoreColumns.length ? { ...set, columns: [...set.columns, ...restoreColumns] } : set
  const { cards: incoming, importedFieldIds } = await readWorkbookRowsForSet(filePath, effectiveSet)
  const matchFields = set.columns
    .filter(
      (column, index, all) =>
        importedFieldIds.includes(column.fieldId) &&
        all.findIndex((candidate) => candidate.fieldId === column.fieldId) === index,
    )
    .map((column) => ({ id: column.fieldId, label: column.header }))
  if (!matchFields.length) throw new Error('Non trovo colonne del foglio corrispondenti ai campi del set.')
  const matchFieldId = matchFields.some((field) => field.id === requestedMatchFieldId)
    ? requestedMatchFieldId!
    : matchFields.some((field) => field.id === set.importMatchFieldId)
      ? set.importMatchFieldId!
      : (matchFields.find((field) => field.id === 'meta_title')?.id ?? matchFields[0].id)
  const selectedIds = new Set(requestedFieldIds ?? importedFieldIds)
  const selectedFieldIds = importedFieldIds.filter((fieldId) => selectedIds.has(fieldId))
  const baselineFieldIds = [...new Set([...selectedFieldIds, matchFieldId])]

  const baselineByCardId = new Map((set.importBaseline ?? []).map((row) => [row.cardId, row.values]))
  const legacyBaseline = !set.importBaseline?.length
  const existingByKey = new Map<string, Card>()
  const existingKeyCounts = new Map<string, number>()
  for (const card of set.cards) {
    const baseline = baselineByCardId.get(card.id)
    const keyValue =
      baseline && Object.prototype.hasOwnProperty.call(baseline, matchFieldId)
        ? baseline[matchFieldId]
        : cardFieldValue(card, matchFieldId)
    const key = mergeKey(keyValue)
    if (!key) continue
    existingKeyCounts.set(key, (existingKeyCounts.get(key) ?? 0) + 1)
    existingByKey.set(key, card)
  }
  const incomingKeyCounts = new Map<string, number>()
  for (const card of incoming) {
    const key = mergeKey(cardFieldValue(card, matchFieldId))
    incomingKeyCounts.set(key, (incomingKeyCounts.get(key) ?? 0) + 1)
  }
  const duplicateKeys = [
    ...new Set([
      ...[...existingKeyCounts].filter(([, count]) => count > 1).map(([key]) => key),
      ...[...incomingKeyCounts].filter(([, count]) => count > 1).map(([key]) => key),
      ...[...incomingKeyCounts.keys()].filter((key) => !key),
    ]),
  ]
  const duplicateSet = new Set(duplicateKeys)
  const conflicts: MergeFieldConflict[] = []
  const automaticChanges: MergeFieldChange[] = []
  const preservedLocalChanges: MergeFieldChange[] = []
  const newTitles: string[] = []
  const seenCards = new Set<string>()
  let matchedRows = 0
  let unchangedRows = 0

  for (const incomingCard of incoming) {
    const key = mergeKey(cardFieldValue(incomingCard, matchFieldId))
    if (!key || duplicateSet.has(key)) continue
    const current = existingByKey.get(key)
    if (!current) {
      newTitles.push(incomingCard.title)
      continue
    }
    matchedRows += 1
    seenCards.add(current.id)
    const baseline = baselineByCardId.get(current.id)
    let changed = false
    for (const fieldId of selectedFieldIds) {
      const currentValue = cardFieldValue(current, fieldId)
      const incomingValue = cardFieldValue(incomingCard, fieldId)
      const header = set.columns.find((column) => column.fieldId === fieldId)?.header ?? fieldId
      if (currentValue === incomingValue) continue
      changed = true
      const hasBaselineValue = baseline && Object.prototype.hasOwnProperty.call(baseline, fieldId)
      const baselineValue = hasBaselineValue ? baseline[fieldId] : currentValue
      if (legacyBaseline || !hasBaselineValue) {
        conflicts.push({
          conflictId: `${current.id}::${fieldId}`,
          cardId: current.id,
          cardTitle: current.title,
          fieldId,
          header,
          currentValue,
          incomingValue,
        })
        continue
      }
      const currentChanged = currentValue !== baselineValue
      const incomingChanged = incomingValue !== baselineValue
      if (currentChanged && incomingChanged)
        conflicts.push({
          conflictId: `${current.id}::${fieldId}`,
          cardId: current.id,
          cardTitle: current.title,
          fieldId,
          header,
          currentValue,
          incomingValue,
        })
      else if (incomingChanged)
        automaticChanges.push({
          cardId: current.id,
          cardTitle: current.title,
          fieldId,
          header,
          currentValue,
          incomingValue,
          source: 'excel',
        })
      else
        preservedLocalChanges.push({
          cardId: current.id,
          cardTitle: current.title,
          fieldId,
          header,
          currentValue,
          incomingValue,
          source: 'set',
        })
    }
    if (!changed) unchangedRows += 1
  }
  const missingTitles = set.cards.filter((card) => !seenCards.has(card.id)).map((card) => card.title)
  const token = crypto.randomUUID()
  pendingMerges.clear()
  pendingMerges.set(token, { setId, matchFieldId, incoming, selectedFieldIds, baselineFieldIds, restoreColumns })
  const importFields = effectiveSet.columns
    .filter(
      (column, index, all) =>
        importedFieldIds.includes(column.fieldId) &&
        all.findIndex((candidate) => candidate.fieldId === column.fieldId) === index,
    )
    .map((column) => ({ id: column.fieldId, label: column.header }))
  return {
    token,
    setId,
    setName: set.name,
    file: path.basename(file),
    matchFieldId,
    matchFields,
    importFields,
    selectedFieldIds,
    restoreFields,
    restoredFieldIds,
    matchedRows,
    unchangedRows,
    newTitles,
    missingTitles,
    automaticChanges,
    preservedLocalChanges,
    conflicts,
    duplicateKeys,
    legacyBaseline,
  }
}

export async function applyWorkbookMerge(
  token: string,
  resolutions: Record<string, 'excel' | 'set'>,
): Promise<ProjectSnapshot> {
  const pending = pendingMerges.get(token)
  if (!pending) throw new Error('La prévisualizzazione del merge è scaduta. Riapri il confronto con il foglio.')
  const set = state.sets.find((item) => item.id === pending.setId)
  if (!set) throw new Error('Il set da aggiornare non esiste più.')
  for (const column of pending.restoreColumns)
    if (!set.columns.some((existing) => existing.fieldId === column.fieldId)) set.columns.push(column)
  const baselineByCardId = new Map((set.importBaseline ?? []).map((row) => [row.cardId, { ...row.values }]))
  const existingByKey = new Map<string, Card>()
  for (const card of set.cards) {
    const baseline = baselineByCardId.get(card.id)
    const keyValue =
      baseline && Object.prototype.hasOwnProperty.call(baseline, pending.matchFieldId)
        ? baseline[pending.matchFieldId]
        : cardFieldValue(card, pending.matchFieldId)
    const key = mergeKey(keyValue)
    if (key) existingByKey.set(key, card)
  }
  const addedCards: Card[] = []
  const now = new Date().toISOString()
  for (const incoming of pending.incoming) {
    const key = mergeKey(cardFieldValue(incoming, pending.matchFieldId))
    if (!key) continue
    const current = existingByKey.get(key)
    if (!current) {
      const newFieldIds = [...new Set([...pending.selectedFieldIds, pending.matchFieldId])]
      const added = {
        ...incoming,
        id: `card_${crypto.randomUUID()}`,
        title: newFieldIds.includes('meta_title')
          ? incoming.title
          : `Carta ${set.cards.length + addedCards.length + 1}`,
        status: 'Idea' as const,
        tags: [],
        quantity: newFieldIds.includes('meta_quantity') ? incoming.quantity : 1,
        values: Object.fromEntries(newFieldIds.map((fieldId) => [fieldId, incoming.values[fieldId] ?? ''])),
        updatedAt: now,
      }
      addedCards.push(added)
      baselineByCardId.set(
        added.id,
        Object.fromEntries(pending.baselineFieldIds.map((fieldId) => [fieldId, cardFieldValue(incoming, fieldId)])),
      )
      continue
    }
    const baseline = baselineByCardId.get(current.id) ?? {}
    const next: Card = { ...current, values: { ...current.values } }
    for (const fieldId of pending.selectedFieldIds) {
      const currentValue = cardFieldValue(current, fieldId)
      const incomingValue = cardFieldValue(incoming, fieldId)
      const fieldChanged = currentValue !== incomingValue
      const conflictKey = `${current.id}::${fieldId}`
      if (fieldChanged && resolutions[conflictKey] === 'excel') {
        if (fieldId === 'meta_title') next.title = incoming.title
        else if (fieldId === 'meta_quantity') next.quantity = incoming.quantity
        else if (!['meta_status', 'meta_tags'].includes(fieldId)) next.values[fieldId] = incoming.values[fieldId] ?? ''
      } else if (
        fieldChanged &&
        !Object.prototype.hasOwnProperty.call(baseline, fieldId) &&
        currentValue === '' &&
        !Object.prototype.hasOwnProperty.call(resolutions, conflictKey)
      ) {
        // Legacy imported sets have no prior baseline; fill empty fields while preserving non-empty local values.
        if (fieldId === 'meta_title') next.title = incoming.title
        else if (fieldId === 'meta_quantity') next.quantity = incoming.quantity
        else if (!['meta_status', 'meta_tags'].includes(fieldId)) next.values[fieldId] = incoming.values[fieldId] ?? ''
      } else if (
        fieldChanged &&
        Object.prototype.hasOwnProperty.call(baseline, fieldId) &&
        currentValue === baseline[fieldId] &&
        cardFieldValue(incoming, fieldId) !== baseline[fieldId]
      ) {
        if (fieldId === 'meta_title') next.title = incoming.title
        else if (fieldId === 'meta_quantity') next.quantity = incoming.quantity
        else if (!['meta_status', 'meta_tags'].includes(fieldId)) next.values[fieldId] = incoming.values[fieldId] ?? ''
      }
      baseline[fieldId] = incomingValue
    }
    for (const fieldId of pending.baselineFieldIds) baseline[fieldId] = cardFieldValue(incoming, fieldId)
    if (JSON.stringify(next) !== JSON.stringify(current)) next.updatedAt = now
    const index = set.cards.findIndex((card) => card.id === current.id)
    if (index >= 0) set.cards[index] = next
    baselineByCardId.set(current.id, baseline)
  }
  set.cards.push(...addedCards)
  set.cards = set.cards.map((card) => resolveConditionalValues(set.columns, card))
  ensureSetGeneratedIds(set)
  set.importBaseline = [...baselineByCardId].map(([cardId, values]) => ({ cardId, values }))
  set.importMatchFieldId = pending.matchFieldId
  if (set.blueprintName) synchronizeBlueprintFields(set.blueprintName, set.columns)
  state.activeSetId = set.id
  pendingMerges.delete(token)
  await persistSets()
  state.workbooks = await scanWorkbooks()
  return snapshot()
}
