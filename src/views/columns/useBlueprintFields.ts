import { useState, type Dispatch, type SetStateAction } from 'react'
import type { ColumnDefinition, TabletopBlueprint } from '../../types'
import { fieldsForBlueprint } from '../../lib/blueprint'
import { slug } from '../../lib/format'
import { matchesBlueprintField, uniqueFieldId, type FieldType } from './columnOps'

/** Blueprint fields not yet present in the draft, plus actions to add them. */
export function useBlueprintFields(
  blueprintName: string | undefined,
  blueprint: TabletopBlueprint | undefined,
  draftColumns: ColumnDefinition[],
  setDraftColumns: Dispatch<SetStateAction<ColumnDefinition[]>>,
) {
  const blueprintCandidates = blueprint ? fieldsForBlueprint(blueprint) : []
  const blueprintFields = blueprintCandidates.filter(
    (field) => !draftColumns.some((column) => matchesBlueprintField(column, field.header)),
  )
  const [blueprintImportMessage, setBlueprintImportMessage] = useState('')
  const importBlueprintFields = () => {
    if (!blueprintName || !blueprint) {
      setBlueprintImportMessage('Assegna prima un blueprint al set nelle Impostazioni progetto.')
      return
    }
    if (!blueprintFields.length) {
      setBlueprintImportMessage('Tutti i campi disponibili sono già presenti.')
      return
    }
    const importedCount = blueprintFields.length
    setBlueprintImportMessage(
      `${importedCount} ${importedCount === 1 ? 'campo importato' : 'campi importati'} in bozza.`,
    )
    setDraftColumns((current) => {
      const next = [...current]
      for (const field of blueprintCandidates) {
        if (next.some((column) => matchesBlueprintField(column, field.header))) continue
        const fieldId = uniqueFieldId(next, slug(field.header))
        next.push({ id: `column_${crypto.randomUUID()}`, header: field.header, fieldId, type: field.type })
      }
      return next
    })
  }
  const addBlueprintField = (field: { header: string; type: FieldType }) => {
    const fieldId = uniqueFieldId(draftColumns, slug(field.header))
    setDraftColumns((current) => [
      ...current,
      { id: `column_${crypto.randomUUID()}`, header: field.header, fieldId, type: field.type },
    ])
  }
  return { blueprintFields, blueprintImportMessage, importBlueprintFields, addBlueprintField }
}
