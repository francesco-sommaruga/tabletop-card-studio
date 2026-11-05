import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import type { Card, ColumnDefinition, ProjectAsset, ProjectVariable } from '../../types'
import type { TableColumn } from '../../hooks/useTableColumns'
import { formatDate } from '../../lib/format'
import { InlineTableCell } from '../../components/fields/InlineTableCell'
import { VariableTextPreview } from '../../components/fields/VariableTextPreview'
import { preview } from '../../components/cards/cardPreview'

interface ProjectContext {
  columns: ColumnDefinition[]
  assets: ProjectAsset[]
  variables: ProjectVariable[]
  projectPath: string
}

/** Value and read-only display of the built-in (meta_*) columns, or null for a custom field. */
function metaCell(card: Card, fieldId: string, index: number, project: ProjectContext) {
  if (fieldId === 'meta_title')
    return {
      value: card.title,
      display: (
        <span className="card-name col-card">
          <span className={`card-index tone-${index % 4}`}>{String(index + 1).padStart(2, '0')}</span>
          <span>
            <strong>{card.title || 'Carta senza titolo'}</strong>
            <small>{preview(card, project.columns, project.assets, project.variables, project.projectPath)}</small>
          </span>
        </span>
      ),
    }
  if (fieldId === 'meta_tags')
    return {
      value: card.tags.join(', '),
      display: (
        <span className="col-tags row-tags">
          {card.tags.length ? (
            card.tags.slice(0, 3).map((tag) => (
              <span className="tag-pill" key={tag}>
                {tag}
              </span>
            ))
          ) : (
            <span className="muted-dash">—</span>
          )}
          {card.tags.length > 3 && <span className="tag-extra">+{card.tags.length - 3}</span>}
        </span>
      ),
    }
  if (fieldId === 'meta_status')
    return {
      value: card.status,
      display: (
        <span className="col-status">
          <span className={`status-pill status-${card.status.toLowerCase()}`}>
            <i />
            {card.status}
          </span>
        </span>
      ),
    }
  if (fieldId === 'meta_quantity')
    return {
      value: String(card.quantity),
      display: <span className="col-qty quantity">{String(card.quantity).padStart(2, '0')}</span>,
    }
  if (fieldId === 'meta_updated')
    return {
      value: card.updatedAt,
      display: <span className="col-updated updated">{formatDate(card.updatedAt)}</span>,
    }
  return null
}

/** Read-only display of a custom field value: image thumbnail, color swatch, variable preview or text. */
function customDisplay(definition: ColumnDefinition | undefined, value: string, project: ProjectContext): ReactNode {
  const asset =
    definition?.type === 'image' ? project.assets.find((item) => item.path === value || item.name === value) : undefined
  const textLikeField =
    !definition?.type || definition.type === 'text' || definition.type === 'longtext' || definition.type === 'variable'
  const variablePreview =
    textLikeField && /\{[^{}]+\}/.test(value) ? (
      <VariableTextPreview
        value={value}
        variables={project.variables}
        projectPath={project.projectPath}
        className="row-variable-preview"
        inline
      />
    ) : null
  if (definition?.type === 'image' && asset?.previewUrl)
    return (
      <span className="table-image-cell" title={asset.name}>
        <img src={asset.previewUrl} alt="" />
        <small>{asset.name}</small>
      </span>
    )
  if (definition?.type === 'color' && value)
    return (
      <span className="table-custom-cell" title={value}>
        <i className="table-color-swatch" style={{ backgroundColor: value }} />
        <span>{value}</span>
      </span>
    )
  if (variablePreview)
    return (
      <span className="table-custom-cell table-variable-cell" title={value}>
        {variablePreview}
      </span>
    )
  return (
    <span className="table-custom-cell" title={value || '—'}>
      {value || <span className="muted-dash">—</span>}
    </span>
  )
}

export function CardRow({
  card,
  index,
  visibleColumns,
  project,
  onSaveField,
  onOpen,
}: {
  card: Card
  index: number
  visibleColumns: TableColumn[]
  project: ProjectContext
  onSaveField: (card: Card, fieldId: string, value: string) => void
  onOpen: (card: Card) => void
}) {
  return (
    <div className="card-row">
      {visibleColumns.map((column) => {
        const meta = metaCell(card, column.fieldId, index, project)
        const definition = meta ? undefined : project.columns.find((item) => item.fieldId === column.fieldId)
        const value = meta ? meta.value : (card.values[column.fieldId]?.trim() ?? '')
        return (
          <InlineTableCell
            key={column.fieldId}
            fieldId={column.fieldId}
            value={value}
            display={meta ? meta.display : customDisplay(definition, value, project)}
            definition={definition}
            assets={project.assets}
            variables={project.variables}
            projectPath={project.projectPath}
            onSave={
              column.fieldId === 'meta_updated' ? () => undefined : (next) => onSaveField(card, column.fieldId, next)
            }
          />
        )
      })}
      <button
        type="button"
        className="col-action row-chevron inline-row-open"
        onClick={() => onOpen(card)}
        aria-label={`Apri ${card.title} nell'editor`}
      >
        <ArrowRight size={15} />
      </button>
    </div>
  )
}
