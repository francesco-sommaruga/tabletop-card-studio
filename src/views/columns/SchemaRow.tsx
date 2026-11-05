import { Sparkles, EyeOff, GripVertical, ArrowRight, Copy, X } from 'lucide-react'
import type { ColumnDefinition, ProjectAsset, ProjectVariable } from '../../types'
import { VariableTagPicker } from '../../components/fields/VariableTagPicker'
import { ConditionalRulesEditor } from '../../components/fields/ConditionalRulesEditor'
import { DefaultValueEditor } from '../../components/fields/DefaultValueEditor'
import { FieldMappingControls } from './FieldMappingControls'
import { splitOptions, type FieldOption } from './columnOps'

export type SchemaRowDrag = {
  isDragging: boolean
  isDropTarget: boolean
  onDragOver: () => void
  onDrop: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onMoveBy: (offset: number) => void
}

export type SchemaRowActions = {
  onEdit: (patch: Partial<ColumnDefinition>) => void
  onRename: (value: string) => void
  onDuplicate: () => void
  onRemove: () => void
}

export function SchemaRow({
  column,
  index,
  columns,
  fields,
  fieldName,
  canRename,
  allVariableTags,
  assets,
  variables,
  drag,
  actions,
}: {
  column: ColumnDefinition
  index: number
  columns: ColumnDefinition[]
  fields: FieldOption[]
  fieldName: string
  canRename: boolean
  allVariableTags: string[]
  assets: ProjectAsset[]
  variables: ProjectVariable[]
  drag: SchemaRowDrag
  actions: SchemaRowActions
}) {
  const { onEdit } = actions
  return (
    <div
      className={`schema-row ${drag.isDragging ? 'dragging' : ''} ${drag.isDropTarget ? 'drop-target' : ''} ${column.rules?.length || column.hidden || column.defaultValue ? 'has-conditions' : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        drag.onDragOver()
      }}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        drag.onDrop()
      }}
    >
      <button
        type="button"
        className="schema-drag-handle"
        draggable
        aria-label={`Sposta ${column.header}. Usa Alt più freccia su o giù per riordinare.`}
        title="Trascina per riordinare · Alt + ↑/↓ da tastiera"
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', column.id)
          drag.onDragStart()
        }}
        onDragEnd={drag.onDragEnd}
        onKeyDown={(event) => {
          if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
          event.preventDefault()
          drag.onMoveBy(event.key === 'ArrowUp' ? -1 : 1)
        }}
      >
        <GripVertical size={15} />
      </button>
      <span className="schema-number">{String(index + 1).padStart(2, '0')}</span>
      <SchemaHeaderCell column={column} onEdit={onEdit} />
      <span className="mapping-arrow">
        <ArrowRight size={15} />
      </span>
      <FieldMappingControls
        column={column}
        fields={fields}
        fieldName={fieldName}
        canRename={canRename}
        onEdit={onEdit}
        onRename={actions.onRename}
      />
      <button
        type="button"
        className="icon-button duplicate-column"
        onClick={actions.onDuplicate}
        aria-label={`Duplica ${column.header}`}
        title="Duplica il campo sotto"
      >
        <Copy size={14} />
      </button>
      <button className="icon-button remove-column" onClick={actions.onRemove} aria-label={`Rimuovi ${column.header}`}>
        <X size={15} />
      </button>
      {column.type === 'select' && (
        <input
          className="choice-options schema-options"
          value={(column.options ?? []).join(', ')}
          placeholder="opzioni separate da virgola"
          onChange={(event) => onEdit({ options: splitOptions(event.target.value) })}
        />
      )}
      {column.type === 'variable' && (
        <VariableTagPicker
          className="schema-options"
          tags={allVariableTags}
          selected={column.variableTags ?? []}
          onChange={(next) => onEdit({ variableTags: next })}
        />
      )}
      {column.type !== 'id' && (
        <ConditionalRulesEditor column={column} columns={columns} variables={variables} onChange={onEdit} />
      )}
      {column.type !== 'id' && (
        <DefaultValueEditor column={column} assets={assets} variables={variables} onChange={onEdit} />
      )}
    </div>
  )
}

function SchemaHeaderCell({
  column,
  onEdit,
}: {
  column: ColumnDefinition
  onEdit: (patch: Partial<ColumnDefinition>) => void
}) {
  return (
    <div className="schema-header-cell">
      <input
        className="header-input"
        value={column.header}
        onChange={(event) => onEdit({ header: event.target.value })}
        aria-label="Intestazione Excel"
      />
      {column.rules?.length ? (
        <span className="schema-condition-badge" title={`${column.rules.length} regole automatiche`}>
          <Sparkles size={11} />
          {column.rules.length} {column.rules.length === 1 ? 'regola' : 'regole'}
        </span>
      ) : null}
      {column.hidden ? (
        <span className="schema-hidden-badge" title="Campo nascosto nell’editor carte">
          <EyeOff size={11} />
          Nascosto
        </span>
      ) : null}
      {column.defaultValue ? (
        <span className="schema-default-badge" title={`Valore predefinito: ${column.defaultValue}`}>
          Default
        </span>
      ) : null}
    </div>
  )
}
