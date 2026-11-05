import { useState } from 'react'
import type { FormEvent } from 'react'
import { ChevronDown, X } from 'lucide-react'
import type { ProjectVariable } from '../../types'
import type { BulkField } from '../../lib/bulkEdit'
import { ColorField } from '../../components/fields/ColorField'

/** "Aggiungi tag": free text with the set's tags as suggestions. */
export function AddTagPopover({ suggestions, onApply }: { suggestions: string[]; onApply: (tag: string) => void }) {
  const [tag, setTag] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (tag.trim()) onApply(tag.trim())
  }
  return (
    <form className="bulk-popover" aria-label="Aggiungi tag alle carte selezionate" onSubmit={submit}>
      <strong>Aggiungi tag</strong>
      <input
        autoFocus
        value={tag}
        list="bulk-tag-suggestions"
        placeholder="Nome del tag"
        aria-label="Tag da aggiungere"
        onChange={(event) => setTag(event.target.value)}
      />
      <datalist id="bulk-tag-suggestions">
        {suggestions.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      <button type="submit" className="button button-primary bulk-apply" disabled={!tag.trim()}>
        Aggiungi
      </button>
    </form>
  )
}

/** "Rimuovi tag": one button per tag carried by the selected cards. */
export function RemoveTagPopover({ tags, onApply }: { tags: string[]; onApply: (tag: string) => void }) {
  return (
    <section className="bulk-popover" aria-label="Rimuovi tag dalle carte selezionate">
      <strong>Rimuovi tag</strong>
      <div className="bulk-tag-list">
        {tags.map((tag, index) => (
          <button
            key={tag}
            type="button"
            className="tag-pill bulk-tag"
            autoFocus={index === 0}
            onClick={() => onApply(tag)}
          >
            {tag}
            <X size={10} />
          </button>
        ))}
      </div>
    </section>
  )
}

/** Value editor matching the field type: options for select, color picker for color, else text/number. */
function FieldValueInput({
  field,
  value,
  variables,
  onChange,
}: {
  field: BulkField
  value: string
  variables: ProjectVariable[]
  onChange: (value: string) => void
}) {
  if (field.type === 'color') return <ColorField value={value} variables={variables} onChange={onChange} />
  if (field.type === 'select')
    return (
      <label className="select-wrap">
        <select
          value={value}
          aria-label={`Valore di ${field.label}`}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Vuoto</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown size={14} />
      </label>
    )
  return (
    <input
      type={field.type === 'number' ? 'number' : 'text'}
      value={value}
      placeholder={field.fieldId === 'meta_quantity' ? '1' : 'Lascia vuoto per svuotare'}
      aria-label={`Valore di ${field.label}`}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

/** "Imposta campo": field picker plus a value editor for that field. */
export function FieldPopover({
  fields,
  variables,
  onApply,
}: {
  fields: BulkField[]
  variables: ProjectVariable[]
  onApply: (field: BulkField, value: string) => void
}) {
  const [fieldId, setFieldId] = useState(fields[0]?.fieldId ?? '')
  const [value, setValue] = useState('')
  const field = fields.find((item) => item.fieldId === fieldId)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (field) onApply(field, value)
  }
  return (
    <form className="bulk-popover bulk-field-popover" aria-label="Imposta un campo" onSubmit={submit}>
      <strong>Imposta campo</strong>
      <label className="select-wrap">
        <select
          autoFocus
          value={fieldId}
          aria-label="Campo da impostare"
          onChange={(event) => {
            setFieldId(event.target.value)
            setValue('')
          }}
        >
          {fields.map((item) => (
            <option key={item.fieldId} value={item.fieldId}>
              {item.label}
            </option>
          ))}
        </select>
        <ChevronDown size={14} />
      </label>
      {field && <FieldValueInput field={field} value={value} variables={variables} onChange={setValue} />}
      <button type="submit" className="button button-primary bulk-apply" disabled={!field}>
        Applica
      </button>
    </form>
  )
}
