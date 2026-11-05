import { useState } from 'react'
import { Eye, X, Tag, Plus, ArrowRightLeft, Check } from 'lucide-react'
import type { Card, ColumnDefinition, ProjectAsset, ProjectVariable, TabletopBlueprint, CardStatus } from '../../types'
import { resolveConditionalValues } from '../../conditional'
import { VariableInsert, IconVariableInsert } from '../fields/VariableInsert'
import { appendVariable } from '../../lib/variables'
import { VariableTextPreview } from '../fields/VariableTextPreview'
import { statuses, internalFieldName } from '../../lib/tableColumns'
import { ColorField } from '../fields/ColorField'
import { VariableField } from '../fields/VariableField'
import { ImageField } from '../fields/ImageField'
import { CardBlueprintPreview } from './CardBlueprintPreview'

export function CardEditor({
  card: initial,
  columns,
  assets,
  variables,
  blueprints,
  blueprintName,
  projectPath,
  canMove,
  onMove,
  onClose,
  onSave,
  onDelete,
}: {
  card: Card
  columns: ColumnDefinition[]
  assets: ProjectAsset[]
  variables: ProjectVariable[]
  blueprints: TabletopBlueprint[]
  blueprintName: string
  projectPath: string
  canMove: boolean
  onMove: (card: Card) => void
  onClose: () => void
  onSave: (card: Card) => void
  onDelete: () => void
}) {
  const [card, setCard] = useState<Card>(() => resolveConditionalValues(columns, initial))
  const [tagInput, setTagInput] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const fields = columns.filter(
    (column) => !['meta_title', 'meta_quantity', 'meta_status', 'meta_tags'].includes(column.fieldId) && !column.hidden,
  )
  const setValue = (id: string, value: string) =>
    setCard((current) => resolveConditionalValues(columns, { ...current, values: { ...current.values, [id]: value } }))
  const patchCard = (next: Card) => setCard(resolveConditionalValues(columns, next))
  const addTag = () => {
    const tag = tagInput.trim()
    if (tag && !card.tags.includes(tag)) patchCard({ ...card, tags: [...card.tags, tag] })
    setTagInput('')
  }
  return (
    <>
      <button className="scrim" aria-label="Chiudi editor" onClick={onClose} />
      <aside className="editor-panel">
        <div className="editor-head">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />
              EDITOR CARTA
            </div>
            <h2>Dettagli</h2>
          </div>
          <div className="editor-head-actions">
            {blueprints.length > 0 && (
              <button
                type="button"
                className="button button-quiet preview-open-button"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye size={14} />
                Anteprima
              </button>
            )}
            <button className="icon-button close-editor" onClick={onClose} aria-label="Chiudi">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="editor-body">
          <div className="field-group">
            <label>TITOLO DELLA CARTA</label>
            <input
              className="title-input"
              autoFocus
              value={card.title}
              onChange={(event) => patchCard({ ...card, title: event.target.value })}
              placeholder="Dai un nome alla carta"
            />
            <VariableInsert
              variables={variables}
              onInsert={(token) => patchCard({ ...card, title: appendVariable(card.title, token) })}
            />
            <IconVariableInsert
              variables={variables}
              projectPath={projectPath}
              onInsert={(token) => patchCard({ ...card, title: appendVariable(card.title, token) })}
            />
            <VariableTextPreview value={card.title} variables={variables} projectPath={projectPath} />
          </div>
          <div className="field-pair">
            <div className="field-group">
              <label>STATO</label>
              <select
                value={card.status}
                onChange={(event) => patchCard({ ...card, status: event.target.value as CardStatus })}
              >
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>QUANTITÀ</label>
              <input
                type="number"
                min="1"
                value={card.quantity}
                onChange={(event) => patchCard({ ...card, quantity: Math.max(1, Number(event.target.value)) })}
              />
            </div>
          </div>
          <div className="field-group">
            <label>
              TAG <span className="label-hint">· premi Invio per aggiungere</span>
            </label>
            <div className="tag-entry">
              <Tag size={15} />
              <input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), addTag())}
                placeholder="es. azione, risorsa, raro"
              />
              <button onClick={addTag} aria-label="Aggiungi tag">
                <Plus size={16} />
              </button>
            </div>
            <div className="editor-tags">
              {card.tags.map((tag) => (
                <button
                  key={tag}
                  className="tag-pill editable-tag"
                  onClick={() => patchCard({ ...card, tags: card.tags.filter((item) => item !== tag) })}
                >
                  {tag}
                  <X size={11} />
                </button>
              ))}
            </div>
          </div>
          <div className="field-divider">
            <span>CAMPI DELLA CARTA</span>
            <span>{fields.length} CAMPI</span>
          </div>
          {fields.map((column) => {
            const value = card.values[column.fieldId] ?? ''
            return (
              <div className="field-group" key={column.id}>
                <label>
                  {internalFieldName(column)}
                  {column.type === 'id' ? (
                    <span className="label-hint"> · GENERATO</span>
                  ) : column.rules?.length ? (
                    <span className="label-hint"> · AUTOMATICO</span>
                  ) : null}
                </label>
                {column.type === 'id' ? (
                  <div className="conditional-value-preview generated-id-value">{value || 'ID non generato'}</div>
                ) : column.rules?.length ? (
                  column.type === 'color' ? (
                    <ColorField value={value} readOnly />
                  ) : column.type === 'variable' ? (
                    <VariableField
                      variables={variables}
                      tags={column.variableTags ?? []}
                      value={value}
                      projectPath={projectPath}
                      hasRules
                    />
                  ) : (
                    <>
                      <div className="conditional-value-preview">{value || 'Nessuna regola attiva'}</div>
                      <VariableTextPreview value={value} variables={variables} projectPath={projectPath} />
                    </>
                  )
                ) : column.type === 'select' ? (
                  <select value={value} onChange={(event) => setValue(column.fieldId, event.target.value)}>
                    <option value="">Seleziona…</option>
                    {(column.options ?? []).map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : column.type === 'image' ? (
                  <ImageField
                    assets={assets}
                    value={value}
                    onChange={(next) => setValue(column.fieldId, next)}
                    fieldName={column.header}
                  />
                ) : column.type === 'variable' ? (
                  <VariableField
                    variables={variables}
                    tags={column.variableTags ?? []}
                    value={value}
                    projectPath={projectPath}
                    onChange={(next) => setValue(column.fieldId, next)}
                  />
                ) : column.type === 'color' ? (
                  <ColorField value={value} variables={variables} onChange={(next) => setValue(column.fieldId, next)} />
                ) : column.type === 'longtext' ? (
                  <>
                    <textarea
                      rows={3}
                      value={value}
                      onChange={(event) => setValue(column.fieldId, event.target.value)}
                      placeholder="Aggiungi un testo…"
                    />
                    <VariableInsert
                      variables={variables}
                      onInsert={(token) => setValue(column.fieldId, appendVariable(value, token))}
                    />
                    <IconVariableInsert
                      variables={variables}
                      projectPath={projectPath}
                      onInsert={(token) => setValue(column.fieldId, appendVariable(value, token))}
                    />
                    <VariableTextPreview value={value} variables={variables} projectPath={projectPath} />
                  </>
                ) : (
                  <>
                    <input
                      type={column.type === 'number' ? 'number' : 'text'}
                      value={value}
                      onChange={(event) => setValue(column.fieldId, event.target.value)}
                      placeholder="Aggiungi un valore…"
                    />
                    <VariableInsert
                      variables={variables}
                      onInsert={(token) => setValue(column.fieldId, appendVariable(value, token))}
                    />
                    <IconVariableInsert
                      variables={variables}
                      projectPath={projectPath}
                      onInsert={(token) => setValue(column.fieldId, appendVariable(value, token))}
                    />
                    <VariableTextPreview value={value} variables={variables} projectPath={projectPath} />
                  </>
                )}
              </div>
            )
          })}
          {!fields.length && (
            <div className="field-hint-box">
              Scegli i campi nella configurazione d’importazione oppure aggiungili in Campi e colonne.
            </div>
          )}
        </div>
        <div className="editor-footer">
          <button className="delete-button" onClick={onDelete}>
            Elimina carta
          </button>
          <div className="editor-footer-actions">
            {canMove && (
              <button type="button" className="button button-quiet" onClick={() => onMove(card)}>
                <ArrowRightLeft size={14} />
                Sposta carta
              </button>
            )}
            <button className="button button-primary" onClick={() => onSave(card)}>
              <Check size={16} />
              Salva modifiche
            </button>
          </div>
        </div>
      </aside>
      {previewOpen && (
        <CardBlueprintPreview
          card={card}
          columns={columns}
          blueprints={blueprints}
          blueprintName={blueprintName}
          assets={assets}
          variables={variables}
          projectPath={projectPath}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  )
}
