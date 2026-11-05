import { ChevronDown } from 'lucide-react'
import type { ColumnDefinition } from '../../types'
import { supportsGeneratedId } from '../../generatedIds'
import type { FieldOption } from './columnOps'

/** Field select, type select and Card Studio name input for one schema row. */
export function FieldMappingControls({
  column,
  fields,
  fieldName,
  canRename,
  onEdit,
  onRename,
}: {
  column: ColumnDefinition
  fields: FieldOption[]
  fieldName: string
  canRename: boolean
  onEdit: (patch: Partial<ColumnDefinition>) => void
  onRename: (value: string) => void
}) {
  return (
    <div className="mapping-control-stack">
      <div className="mapping-control-top">
        <label className="mapping-select">
          <select
            aria-label={`Collega la colonna Excel ${column.header} al campo interno`}
            value={column.fieldId}
            onChange={(event) => {
              const fieldId = event.target.value
              onEdit(column.type === 'id' && !supportsGeneratedId(fieldId) ? { fieldId, type: 'text' } : { fieldId })
            }}
          >
            {fields.map((field) => (
              <option key={field.id} value={field.id}>
                {field.label}
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
        <select
          className="field-type-select"
          aria-label={`Tipo del campo ${column.header}`}
          value={column.type ?? 'text'}
          onChange={(event) => {
            const type = event.target.value as ColumnDefinition['type']
            onEdit(
              type === 'id'
                ? {
                    type,
                    defaultValue: undefined,
                    rules: undefined,
                    options: undefined,
                    variableTags: undefined,
                  }
                : { type },
            )
          }}
        >
          <option value="text">Testo</option>
          <option value="longtext">Testo lungo</option>
          <option value="number">Numero</option>
          <option value="select">Select</option>
          <option value="image">Immagine</option>
          <option value="variable">Variabile</option>
          <option value="color">Colore</option>
          <option value="id" disabled={!supportsGeneratedId(column.fieldId)}>
            ID automatico
          </option>
        </select>
      </div>
      <label className="internal-name-field">
        <span>NOME IN CARD STUDIO</span>
        <input
          value={fieldName}
          disabled={!canRename}
          onChange={(event) => onRename(event.target.value)}
          aria-label={`Nome campo interno per ${column.header}`}
          title="Nome usato nell’editor carta; non modifica la colonna Excel."
          placeholder="Nome mostrato nell’editor"
        />
      </label>
    </div>
  )
}
