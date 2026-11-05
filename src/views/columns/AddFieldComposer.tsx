import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { ColumnDefinition, ProjectVariable } from '../../types'
import { slug } from '../../lib/format'
import { variableTagList } from '../../lib/variables'
import { VariableTagPicker } from '../../components/fields/VariableTagPicker'
import { splitOptions, type FieldType } from './columnOps'

/** "Nuovo campo per le carte" composer; appends the new column via `onAdd`. */
export function AddFieldComposer({
  columns,
  variables,
  onAdd,
}: {
  columns: ColumnDefinition[]
  variables: ProjectVariable[]
  onAdd: (column: ColumnDefinition) => void
}) {
  const [fieldLabel, setFieldLabel] = useState('')
  const [fieldType, setFieldType] = useState<FieldType>('text')
  const [fieldOptions, setFieldOptions] = useState('')
  const [fieldVariableTags, setFieldVariableTags] = useState<string[]>([])
  const addField = () => {
    const label = fieldLabel.trim()
    if (!label) return
    const baseId = slug(label)
    const id = columns.some((column) => column.fieldId === baseId) ? `${baseId}_${columns.length + 1}` : baseId
    onAdd({
      id: `column_${id}`,
      header: label,
      fieldId: id,
      type: fieldType,
      options: fieldType === 'select' ? splitOptions(fieldOptions) : undefined,
      variableTags: fieldType === 'variable' ? fieldVariableTags : undefined,
    })
    setFieldLabel('')
    setFieldOptions('')
    setFieldVariableTags([])
  }
  return (
    <div className="add-column add-field-composer">
      <div className="add-column-icon">
        <Plus size={17} />
      </div>
      <div className="add-column-copy">
        <strong>Nuovo campo per le carte</strong>
        <span>Testo, ID automatico, select, colore, immagine o variabile.</span>
      </div>
      <div className="add-column-control">
        <input
          value={fieldLabel}
          onChange={(event) => setFieldLabel(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && addField()}
          placeholder="es. Rarità, costo, illustrazione"
        />
        <select value={fieldType} onChange={(event) => setFieldType(event.target.value as FieldType)}>
          <option value="text">Testo</option>
          <option value="longtext">Testo lungo</option>
          <option value="number">Numero</option>
          <option value="select">Select</option>
          <option value="image">Immagine</option>
          <option value="variable">Variabile</option>
          <option value="color">Colore</option>
          <option value="id">ID automatico</option>
        </select>
        <button className="button button-dark" onClick={addField}>
          <Plus size={15} />
          Aggiungi
        </button>
      </div>
      {fieldType === 'select' && (
        <input
          className="choice-options composer-options"
          value={fieldOptions}
          onChange={(event) => setFieldOptions(event.target.value)}
          placeholder="opzioni per la select, separate da virgola"
        />
      )}
      {fieldType === 'variable' && (
        <VariableTagPicker
          className="variable-composer-tags"
          tags={variableTagList(variables)}
          selected={fieldVariableTags}
          onChange={setFieldVariableTags}
        />
      )}
    </div>
  )
}
