import { useEffect, useRef, useState } from 'react'
import { ArrowRightLeft, Check } from 'lucide-react'
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
import { CardEditorHeader } from './CardEditorHeader'
import { CardTagsField } from './CardTagsField'
import { useEditorShortcuts } from '../../hooks/useEditorShortcuts'

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
  onPrevious,
  onNext,
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
  /** Opens the previous card; receives the draft when it has unsaved changes. Undefined at the start. */
  onPrevious?: (unsaved: Card | null) => void
  /** Opens the next card; receives the draft when it has unsaved changes. Undefined at the end. */
  onNext?: (unsaved: Card | null) => void
}) {
  const [baseline, setBaseline] = useState<Card>(() => resolveConditionalValues(columns, initial))
  const [card, setCard] = useState<Card>(baseline)
  const [previewOpen, setPreviewOpen] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  if (initial.id !== baseline.id) {
    // Another card was opened (previous/next): start a fresh draft without remounting the drawer.
    const next = resolveConditionalValues(columns, initial)
    setBaseline(next)
    setCard(next)
  }
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }, [initial.id])
  const isDirty = JSON.stringify(card) !== JSON.stringify(baseline)
  const goTo = (open?: (unsaved: Card | null) => void) => open && (() => open(isDirty ? card : null))
  const goPrevious = goTo(onPrevious)
  const goNext = goTo(onNext)
  useEditorShortcuts({ onSave: () => onSave(card), onPrevious: goPrevious, onNext: goNext })
  const fields = columns.filter(
    (column) => !['meta_title', 'meta_quantity', 'meta_status', 'meta_tags'].includes(column.fieldId) && !column.hidden,
  )
  const setValue = (id: string, value: string) =>
    setCard((current) => resolveConditionalValues(columns, { ...current, values: { ...current.values, [id]: value } }))
  const patchCard = (next: Card) => setCard(resolveConditionalValues(columns, next))
  return (
    <>
      <button className="scrim card-editor-scrim" aria-label="Chiudi editor" onClick={onClose} />
      <aside className="editor-panel">
        <CardEditorHeader
          canPreview={blueprints.length > 0}
          onPreview={() => setPreviewOpen(true)}
          onPrevious={goPrevious}
          onNext={goNext}
          onClose={onClose}
        />
        <div className="editor-body" ref={bodyRef}>
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
          <CardTagsField key={card.id} tags={card.tags} onChange={(tags) => patchCard({ ...card, tags })} />
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
            <button className="button button-primary" onClick={() => onSave(card)} title="Salva modifiche (Ctrl+S)">
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
