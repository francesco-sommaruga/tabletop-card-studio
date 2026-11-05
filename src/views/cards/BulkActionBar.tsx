import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { ChevronDown, PenLine, Tag, Tags, Trash2, X } from 'lucide-react'
import type { Card, CardStatus, ColumnDefinition, ProjectVariable } from '../../types'
import type { CardSelection } from '../../hooks/useCardSelection'
import { statuses } from '../../lib/tableColumns'
import {
  addTag,
  applyStatus,
  bulkEditableFields,
  cardCountLabel,
  deleteCards,
  hasCardChanges,
  removeTag,
  selectedTags,
  setFieldValue,
} from '../../lib/bulkEdit'
import { AddTagPopover, FieldPopover, RemoveTagPopover } from './BulkPopovers'

type Panel = 'add-tag' | 'remove-tag' | 'field' | 'delete' | null

/** Toolbar button that toggles a popover anchored below it. */
function MenuButton({
  label,
  icon,
  isOpen,
  isDisabled = false,
  onToggle,
  children,
}: {
  label: string
  icon: ReactNode
  isOpen: boolean
  isDisabled?: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="bulk-menu">
      <button
        type="button"
        className={`bulk-action ${isOpen ? 'active' : ''}`}
        aria-expanded={isOpen}
        disabled={isDisabled}
        onClick={onToggle}
      >
        {icon}
        {label}
      </button>
      {isOpen && children}
    </div>
  )
}

/**
 * Actions on the selected cards, shown in place of the archive controls. Every action is a single
 * `onCommit` call (one save, one undo step) with an Italian label; no-op changes are not committed.
 */
export function BulkActionBar({
  cards,
  columns,
  variables,
  setTags,
  selection,
  onCommit,
}: {
  cards: Card[]
  columns: ColumnDefinition[]
  variables: ProjectVariable[]
  setTags: string[]
  selection: CardSelection
  onCommit: (next: Card[], label: string) => void
}) {
  const [panel, setPanel] = useState<Panel>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const ids = selection.selectedIds
  const countLabel = cardCountLabel(selection.count)
  const tagsOnSelection = selectedTags(cards, ids)
  useEffect(() => {
    if (!panel) return
    const closeOutside = (event: MouseEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setPanel(null)
    }
    document.addEventListener('mousedown', closeOutside)
    return () => document.removeEventListener('mousedown', closeOutside)
  }, [panel])

  const now = () => new Date().toISOString()
  const apply = (next: Card[], label: string) => {
    setPanel(null)
    if (hasCardChanges(cards, next)) onCommit(next, label)
  }
  const toggle = (next: Panel) => setPanel((current) => (current === next ? null : next))
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    if (panel) setPanel(null)
    else selection.clear()
  }

  if (panel === 'delete')
    return (
      <div
        ref={barRef}
        className="bulk-bar is-confirming"
        role="group"
        aria-label="Conferma eliminazione"
        onKeyDown={onKeyDown}
      >
        <span className="bulk-confirm-text">Eliminare {countLabel} dal set?</span>
        <button type="button" className="bulk-action" autoFocus onClick={() => setPanel(null)}>
          Annulla
        </button>
        <button
          type="button"
          className="bulk-action bulk-danger-confirm"
          onClick={() => apply(deleteCards(cards, ids), `Eliminazione di ${countLabel}`)}
        >
          <Trash2 size={13} />
          Elimina {countLabel}
        </button>
      </div>
    )

  return (
    <div
      ref={barRef}
      className="bulk-bar"
      role="toolbar"
      aria-label="Azioni sulle carte selezionate"
      onKeyDown={onKeyDown}
    >
      <span className="bulk-count">
        <strong>{selection.count}</strong> {selection.count === 1 ? 'selezionata' : 'selezionate'}
      </span>
      <label className="bulk-status" title="Imposta lo stato">
        <select
          value=""
          aria-label="Imposta lo stato delle carte selezionate"
          onChange={(event) => {
            const status = event.target.value as CardStatus
            apply(applyStatus(cards, ids, status, now()), `Stato «${status}» su ${countLabel}`)
          }}
        >
          <option value="" disabled>
            Stato…
          </option>
          {statuses.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
        <ChevronDown size={13} />
      </label>
      <MenuButton
        label="Aggiungi tag"
        icon={<Tag size={13} />}
        isOpen={panel === 'add-tag'}
        onToggle={() => toggle('add-tag')}
      >
        <AddTagPopover
          suggestions={setTags}
          onApply={(tag) => apply(addTag(cards, ids, tag, now()), `Tag «${tag}» aggiunto a ${countLabel}`)}
        />
      </MenuButton>
      <MenuButton
        label="Rimuovi tag"
        icon={<Tags size={13} />}
        isOpen={panel === 'remove-tag'}
        isDisabled={!tagsOnSelection.length}
        onToggle={() => toggle('remove-tag')}
      >
        <RemoveTagPopover
          tags={tagsOnSelection}
          onApply={(tag) => apply(removeTag(cards, ids, tag, now()), `Tag «${tag}» rimosso da ${countLabel}`)}
        />
      </MenuButton>
      <MenuButton
        label="Imposta campo"
        icon={<PenLine size={13} />}
        isOpen={panel === 'field'}
        onToggle={() => toggle('field')}
      >
        <FieldPopover
          fields={bulkEditableFields(columns)}
          variables={variables}
          onApply={(field, value) =>
            apply(
              setFieldValue(cards, ids, field.fieldId, value, now()),
              `Campo «${field.label}» impostato su ${countLabel}`,
            )
          }
        />
      </MenuButton>
      <button type="button" className="bulk-action bulk-danger" onClick={() => setPanel('delete')}>
        <Trash2 size={13} />
        Elimina
      </button>
      <button type="button" className="bulk-clear" onClick={selection.clear}>
        <X size={13} />
        Deseleziona
      </button>
    </div>
  )
}
