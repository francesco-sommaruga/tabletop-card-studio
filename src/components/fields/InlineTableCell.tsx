import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import type { ColumnDefinition, ProjectAsset, ProjectVariable } from '../../types'
import { statuses, internalFieldName } from '../../lib/tableColumns'
import { ImageField } from './ImageField'
import { ColorField } from './ColorField'
import { VariableField } from './VariableField'

export function InlineTableCell({
  fieldId,
  value,
  display,
  definition,
  assets,
  variables,
  projectPath,
  onSave,
}: {
  fieldId: string
  value: string
  display: ReactNode
  definition?: ColumnDefinition
  assets: ProjectAsset[]
  variables: ProjectVariable[]
  projectPath: string
  onSave: (value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])
  const type =
    definition?.type ?? (fieldId === 'meta_status' ? 'select' : fieldId === 'meta_quantity' ? 'number' : 'text')
  const choices = fieldId === 'meta_status' ? statuses : (definition?.options ?? [])
  const complex = type === 'image' || type === 'color' || type === 'variable'
  const readOnly = Boolean(definition?.rules?.length) || definition?.type === 'id' || fieldId === 'meta_updated'
  const commit = () => {
    onSave(draft)
    setEditing(false)
  }
  const cancel = () => {
    setDraft(value)
    setEditing(false)
  }
  if (readOnly)
    return (
      <span
        className="inline-cell-readonly"
        title={
          definition?.type === 'id'
            ? 'ID generato automaticamente'
            : definition?.rules?.length
              ? 'Campo calcolato da regole automatiche'
              : undefined
        }
      >
        {display}
      </span>
    )
  if (!editing)
    return (
      <button
        type="button"
        className="inline-cell-value"
        title="Fai clic per modificare"
        onClick={(event) => {
          event.stopPropagation()
          setDraft(value)
          setEditing(true)
        }}
      >
        {display}
        <Pencil className="inline-cell-pencil" size={11} />
      </button>
    )
  return (
    <span className={`inline-cell-editor ${complex ? 'has-actions' : ''}`} onClick={(event) => event.stopPropagation()}>
      {type === 'image' ? (
        <ImageField
          assets={assets}
          value={draft}
          onChange={setDraft}
          fieldName={definition ? internalFieldName(definition) : fieldId}
        />
      ) : type === 'color' ? (
        <ColorField value={draft} variables={variables} onChange={setDraft} />
      ) : type === 'variable' ? (
        <VariableField
          variables={variables}
          tags={definition?.variableTags ?? []}
          value={draft}
          projectPath={projectPath}
          onChange={setDraft}
        />
      ) : type === 'select' ? (
        <select
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => commit()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') cancel()
          }}
        >
          <option value="">Seleziona…</option>
          {choices.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      ) : (
        <input
          autoFocus
          type={type === 'number' ? 'number' : 'text'}
          value={draft}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (!complex) commit()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
            }
            if (event.key === 'Escape') cancel()
          }}
          aria-label={`Modifica ${definition ? internalFieldName(definition) : fieldId === 'meta_title' ? 'titolo' : fieldId === 'meta_tags' ? 'tag' : fieldId === 'meta_quantity' ? 'quantità' : 'stato'}`}
        />
      )}
      {complex && (
        <span className="inline-cell-actions">
          <button type="button" onClick={commit} aria-label="Salva campo">
            <Check size={12} />
          </button>
          <button type="button" onClick={cancel} aria-label="Annulla modifica">
            <X size={12} />
          </button>
        </span>
      )}
    </span>
  )
}
