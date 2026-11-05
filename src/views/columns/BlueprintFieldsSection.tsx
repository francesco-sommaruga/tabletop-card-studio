import { Plus } from 'lucide-react'
import type { FieldType } from './columnOps'

type BlueprintField = { header: string; type: FieldType; group: string }

export function BlueprintFieldsSection({
  blueprintName,
  fields,
  message,
  onAdd,
}: {
  blueprintName?: string
  fields: BlueprintField[]
  message: string
  onAdd: (field: BlueprintField) => void
}) {
  return (
    <>
      {fields.length > 0 && (
        <section className="schema-blueprint-fields">
          <div className="schema-blueprint-heading">
            <span>
              <strong>Campi disponibili in {blueprintName}</strong>
              <small>Aggiungi singoli campi oppure usa il pulsante di importazione in alto.</small>
            </span>
          </div>
          <div>
            {fields.map((field) => (
              <button type="button" className="button button-quiet" key={field.header} onClick={() => onAdd(field)}>
                <Plus size={13} />
                {field.header}
                <small className="blueprint-field-origin">{field.group}</small>
                <small>{field.type === 'image' ? 'Immagine' : field.type === 'color' ? 'Colore' : 'Testo'}</small>
              </button>
            ))}
          </div>
        </section>
      )}
      {message && (
        <p className="schema-blueprint-message" role="status">
          {message}
        </p>
      )}
    </>
  )
}
