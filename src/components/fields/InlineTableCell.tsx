import { useState, useEffect, useRef } from 'react'
import type { ReactNode, KeyboardEvent } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import type { ColumnDefinition, ProjectAsset, ProjectVariable } from '../../types'
import { statuses, internalFieldName } from '../../lib/tableColumns'
import { cellEditorKind } from '../../lib/inlineCells'
import { ImageField } from './ImageField'
import { ColorField } from './ColorField'
import { VariableField } from './VariableField'

const metaLabels: Record<string, string> = {
  meta_title: 'titolo',
  meta_tags: 'tag',
  meta_quantity: 'quantità',
  meta_status: 'stato',
}

/**
 * Click-to-edit table cell. Editing state is owned by the row (`editing`, `onStartEdit`, `onStopEdit`) so
 * Tab/Shift+Tab can move editing to the next/previous cell via `onNavigate` (returns false at the edges).
 * Enter saves, Escape cancels; keyboard exits return focus to the cell. Unchanged drafts are not saved.
 */
export function InlineTableCell({
  fieldId,
  value,
  display,
  definition,
  assets,
  variables,
  projectPath,
  editing,
  onStartEdit,
  onStopEdit,
  onNavigate,
  onSave,
}: {
  fieldId: string
  value: string
  display: ReactNode
  definition?: ColumnDefinition
  assets: ProjectAsset[]
  variables: ProjectVariable[]
  projectPath: string
  editing: boolean
  onStartEdit: () => void
  onStopEdit: () => void
  onNavigate: (direction: 1 | -1) => boolean
  onSave: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const refocusRef = useRef(false)
  const closedRef = useRef(false)
  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])
  useEffect(() => {
    if (editing) closedRef.current = false
    else if (refocusRef.current) {
      refocusRef.current = false
      buttonRef.current?.focus()
    }
  }, [editing])
  const kind = cellEditorKind(fieldId, definition)
  const type =
    definition?.type ?? (fieldId === 'meta_status' ? 'select' : fieldId === 'meta_quantity' ? 'number' : 'text')
  const choices = fieldId === 'meta_status' ? statuses : (definition?.options ?? [])
  const complex = kind === 'complex'
  /** Ends editing once (a blur after Enter/Tab is ignored), saving only a changed draft. */
  const close = (save: boolean, refocus: boolean) => {
    if (closedRef.current) return
    closedRef.current = true
    if (save && draft !== value) onSave(draft)
    if (!save) setDraft(value)
    refocusRef.current = refocus
    onStopEdit()
  }
  const commit = () => close(true, false)
  const cancel = () => close(false, true)
  const onEditorKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    cancel()
  }
  const onFieldKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      close(true, true)
    } else if (event.key === 'Tab') {
      event.preventDefault()
      const moved = onNavigate(event.shiftKey ? -1 : 1)
      close(true, !moved)
    }
  }
  if (kind === 'readonly')
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
        ref={buttonRef}
        type="button"
        className="inline-cell-value"
        title="Fai clic per modificare"
        onClick={(event) => {
          event.stopPropagation()
          setDraft(value)
          onStartEdit()
        }}
      >
        {display}
        <Pencil className="inline-cell-pencil" size={11} />
      </button>
    )
  return (
    <span
      className={`inline-cell-editor ${complex ? 'has-actions' : ''}`}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={onEditorKeyDown}
    >
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
          onBlur={commit}
          onKeyDown={onFieldKeyDown}
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
          onBlur={commit}
          onKeyDown={onFieldKeyDown}
          aria-label={`Modifica ${definition ? internalFieldName(definition) : (metaLabels[fieldId] ?? 'stato')}`}
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
