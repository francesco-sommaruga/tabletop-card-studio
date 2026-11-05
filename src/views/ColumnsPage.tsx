import { useState, useEffect } from 'react'
import {
  ArrowDownToLine,
  Braces,
  Plus,
  Sparkles,
  EyeOff,
  RefreshCw,
  Download,
  GripVertical,
  ArrowRight,
  ChevronDown,
  Copy,
  X,
  Check,
  FileSpreadsheet,
} from 'lucide-react'
import type { ColumnDefinition, ProjectAsset, ProjectVariable, TabletopBlueprint } from '../types'
import { fieldsForBlueprint } from '../lib/blueprint'
import { slug } from '../lib/format'
import { variableTagList } from '../lib/variables'
import { metaFields, internalFieldName } from '../lib/tableColumns'
import { supportsGeneratedId } from '../generatedIds'
import { VariableTagPicker } from '../components/fields/VariableTagPicker'
import { ConditionalRulesEditor } from '../components/fields/ConditionalRulesEditor'
import { DefaultValueEditor } from '../components/fields/DefaultValueEditor'

export function ColumnsPage({
  columns,
  assets,
  variables,
  blueprintName,
  blueprint,
  sharedSetCount,
  onReloadBlueprints,
  onSave,
  onDirty,
  onExport,
}: {
  columns: ColumnDefinition[]
  assets: ProjectAsset[]
  variables: ProjectVariable[]
  blueprintName?: string
  blueprint?: TabletopBlueprint
  sharedSetCount: number
  onReloadBlueprints: () => Promise<void>
  onSave: (columns: ColumnDefinition[]) => void
  onDirty: (dirty: boolean) => void
  onExport: () => void
}) {
  const [draftColumns, setDraftColumns] = useState(columns)
  const dirty = JSON.stringify(draftColumns) !== JSON.stringify(columns)
  useEffect(() => {
    onDirty(dirty)
  }, [dirty, onDirty])
  const [fieldLabel, setFieldLabel] = useState('')
  const [fieldType, setFieldType] = useState<NonNullable<ColumnDefinition['type']>>('text')
  const [fieldOptions, setFieldOptions] = useState('')
  const [fieldVariableTags, setFieldVariableTags] = useState<string[]>([])
  const [dragColumnId, setDragColumnId] = useState<string | null>(null)
  const [dropColumnId, setDropColumnId] = useState<string | null>(null)
  const blueprintCandidates = blueprint ? fieldsForBlueprint(blueprint) : []
  const blueprintFields = blueprintCandidates.filter(
    (field) =>
      !draftColumns.some(
        (column) =>
          column.header.toLocaleLowerCase() === field.header.toLocaleLowerCase() ||
          column.fieldId === slug(field.header),
      ),
  )
  const [blueprintImportMessage, setBlueprintImportMessage] = useState('')
  const importBlueprintFields = () => {
    if (!blueprintName || !blueprint) {
      setBlueprintImportMessage('Assegna prima un blueprint al set nelle Impostazioni progetto.')
      return
    }
    if (!blueprintFields.length) {
      setBlueprintImportMessage('Tutti i campi disponibili sono già presenti.')
      return
    }
    const importedCount = blueprintFields.length
    setBlueprintImportMessage(
      `${importedCount} ${importedCount === 1 ? 'campo importato' : 'campi importati'} in bozza.`,
    )
    setDraftColumns((current) => {
      const next = [...current]
      for (const field of blueprintCandidates) {
        if (
          next.some(
            (column) =>
              column.header.toLocaleLowerCase() === field.header.toLocaleLowerCase() ||
              column.fieldId === slug(field.header),
          )
        )
          continue
        const base = slug(field.header)
        let fieldId = base
        let suffix = 2
        while (next.some((column) => column.fieldId === fieldId)) fieldId = `${base}_${suffix++}`
        next.push({ id: `column_${crypto.randomUUID()}`, header: field.header, fieldId, type: field.type })
      }
      return next
    })
  }
  const addBlueprintField = (field: { header: string; type: NonNullable<ColumnDefinition['type']> }) => {
    const base = slug(field.header)
    let fieldId = base
    let suffix = 2
    while (draftColumns.some((column) => column.fieldId === fieldId)) fieldId = `${base}_${suffix++}`
    setDraftColumns((current) => [
      ...current,
      { id: `column_${crypto.randomUUID()}`, header: field.header, fieldId, type: field.type },
    ])
  }
  const addField = () => {
    const label = fieldLabel.trim()
    if (!label) return
    const baseId = slug(label)
    const id = draftColumns.some((column) => column.fieldId === baseId)
      ? `${baseId}_${draftColumns.length + 1}`
      : baseId
    setDraftColumns([
      ...draftColumns,
      {
        id: `column_${id}`,
        header: label,
        fieldId: id,
        type: fieldType,
        options:
          fieldType === 'select'
            ? fieldOptions
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
            : undefined,
        variableTags: fieldType === 'variable' ? fieldVariableTags : undefined,
      },
    ])
    setFieldLabel('')
    setFieldOptions('')
    setFieldVariableTags([])
  }
  const edit = (id: string, patch: Partial<ColumnDefinition>) =>
    setDraftColumns(draftColumns.map((column) => (column.id === id ? { ...column, ...patch } : column)))
  const remove = (id: string) => setDraftColumns(draftColumns.filter((column) => column.id !== id))
  const duplicate = (id: string) => {
    const index = draftColumns.findIndex((column) => column.id === id)
    if (index < 0) return
    const source = draftColumns[index]
    const usedHeaders = new Set(draftColumns.map((column) => column.header.trim().toLocaleLowerCase()))
    let suffix = 'copia'
    let header = `${source.header} ${suffix}`
    let number = 2
    while (usedHeaders.has(header.trim().toLocaleLowerCase())) header = `${source.header} copia ${number++}`
    const baseFieldId = slug(header)
    const usedFieldIds = new Set(draftColumns.map((column) => column.fieldId))
    let fieldId = baseFieldId
    number = 2
    while (usedFieldIds.has(fieldId)) fieldId = `${baseFieldId}_${number++}`
    const copy: ColumnDefinition = {
      ...source,
      id: `column_${crypto.randomUUID()}`,
      header,
      fieldLabel: header,
      fieldId,
      options: source.options ? [...source.options] : undefined,
      variableTags: source.variableTags ? [...source.variableTags] : undefined,
      rules: source.rules?.map((rule) => ({ ...rule })),
    }
    setDraftColumns((current) => {
      const currentIndex = current.findIndex((column) => column.id === id)
      if (currentIndex < 0) return current
      const next = [...current]
      next.splice(currentIndex + 1, 0, copy)
      return next
    })
  }
  const allVariableTags = variableTagList(variables)
  const automaticFields = draftColumns.filter((column) => column.rules?.length)
  const automaticRuleCount = automaticFields.reduce((sum, column) => sum + (column.rules?.length ?? 0), 0)
  const hiddenFieldCount = draftColumns.filter((column) => column.hidden).length
  const fields = [
    ...metaFields,
    ...draftColumns
      .filter(
        (column, index, all) =>
          !metaFields.some((meta) => meta.id === column.fieldId) &&
          all.findIndex((item) => item.fieldId === column.fieldId) === index,
      )
      .map((column) => ({ id: column.fieldId, label: internalFieldName(column) })),
  ]
  const fieldNameFor = (fieldId: string) => {
    const field = draftColumns.find((column) => column.fieldId === fieldId)
    return field ? internalFieldName(field) : (fields.find((item) => item.id === fieldId)?.label ?? fieldId)
  }
  const renameField = (fieldId: string, value: string) => {
    const field = draftColumns.find((column) => column.fieldId === fieldId)
    if (field) edit(field.id, { fieldLabel: value })
  }
  const canRenameField = (fieldId: string) => draftColumns.some((column) => column.fieldId === fieldId)
  const reorder = (targetId: string) => {
    if (!dragColumnId || dragColumnId === targetId) {
      setDragColumnId(null)
      setDropColumnId(null)
      return
    }
    const from = draftColumns.findIndex((column) => column.id === dragColumnId)
    const to = draftColumns.findIndex((column) => column.id === targetId)
    if (from < 0 || to < 0) return
    const next = [...draftColumns]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setDraftColumns(next)
    setDragColumnId(null)
    setDropColumnId(null)
  }
  const moveByKeyboard = (from: number, to: number) => {
    if (to < 0 || to >= draftColumns.length || from === to) return
    const next = [...draftColumns]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setDraftColumns(next)
  }
  return (
    <div className="page-content columns-content">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            {blueprintName ? `BLUEPRINT · ${blueprintName.toLocaleUpperCase()}` : 'CAMPI DEL SET'}
          </div>
          <h1>
            Campi del set<span className="heading-period">.</span>
          </h1>
          <p>
            Definisci il campo del set Tabletop Creator, il nome mostrato nell’editor Card Studio e il tipo di dato.
          </p>
        </div>
        <button
          className="button button-primary add-button"
          onClick={onExport}
          disabled={dirty}
          title={dirty ? 'Salva i campi prima di esportare' : 'Esporta set'}
        >
          <ArrowDownToLine size={16} />
          Esporta set
        </button>
      </div>
      <section className="schema-intro">
        <div className="schema-icon">
          <Braces size={20} />
        </div>
        <div>
          <strong>
            {blueprintName
              ? `Campi condivisi con ${sharedSetCount} set che usano ${blueprintName}.`
              : 'Questo set ha campi indipendenti.'}
          </strong>
          <p>
            A sinistra indichi il nome del campo nel set Tabletop Creator. A destra scegli il campo e il nome da
            mostrare in Card Studio, poi imposti il tipo di dato.
            {!blueprintName && ' Per condividerli, assegna un blueprint nelle Impostazioni progetto.'}
          </p>
        </div>
        <div className="schema-badge">
          <span className="live-dot" />
          {draftColumns.length} CAMPI
        </div>
      </section>
      {blueprintFields.length > 0 && (
        <section className="schema-blueprint-fields">
          <div className="schema-blueprint-heading">
            <span>
              <strong>Campi disponibili in {blueprintName}</strong>
              <small>Aggiungi singoli campi oppure usa il pulsante di importazione in alto.</small>
            </span>
          </div>
          <div>
            {blueprintFields.map((field) => (
              <button
                type="button"
                className="button button-quiet"
                key={field.header}
                onClick={() => addBlueprintField(field)}
              >
                <Plus size={13} />
                {field.header}
                <small className="blueprint-field-origin">{field.group}</small>
                <small>{field.type === 'image' ? 'Immagine' : field.type === 'color' ? 'Colore' : 'Testo'}</small>
              </button>
            ))}
          </div>
        </section>
      )}
      {blueprintImportMessage && (
        <p className="schema-blueprint-message" role="status">
          {blueprintImportMessage}
        </p>
      )}
      {(automaticRuleCount > 0 || hiddenFieldCount > 0) && (
        <section className="automation-summary" aria-label="Riepilogo automazioni e visibilità">
          <span className="automation-summary-icon">
            <Sparkles size={16} />
          </span>
          <span className="automation-summary-copy">
            <strong>
              {automaticRuleCount > 0
                ? `${automaticRuleCount} ${automaticRuleCount === 1 ? 'regola automatica' : 'regole automatiche'} in ${automaticFields.length} ${automaticFields.length === 1 ? 'campo' : 'campi'}`
                : `${hiddenFieldCount} ${hiddenFieldCount === 1 ? 'campo nascosto' : 'campi nascosti'}`}
            </strong>
            <small>
              {hiddenFieldCount > 0
                ? `${hiddenFieldCount} ${hiddenFieldCount === 1 ? 'campo nascosto nell’editor carte' : 'campi nascosti nell’editor carte'}`
                : 'I campi automatici si aggiornano quando cambiano le sorgenti.'}
            </small>
          </span>
          {hiddenFieldCount > 0 && (
            <span className="automation-summary-hidden">
              <EyeOff size={12} />
              {hiddenFieldCount} nascosti
            </span>
          )}
        </section>
      )}
      <div className="schema-title-row">
        <div>
          <h2>Campi disponibili</h2>
          <span>
            Trascina la presa per riordinare · Alt + ↑/↓ da tastiera ·{' '}
            {dirty ? 'modifiche non salvate' : 'struttura salvata'}
          </span>
        </div>
        <div className="schema-title-actions">
          <button
            type="button"
            className="button button-quiet"
            onClick={() => void onReloadBlueprints()}
            disabled={dirty}
            title="Rileggi i blueprint da data/blueprints"
          >
            <RefreshCw size={14} />
            Ricarica blueprint
          </button>
          <button
            type="button"
            className="button button-primary blueprint-import-action"
            onClick={importBlueprintFields}
            title={
              !blueprintName
                ? 'Assegna un blueprint nelle Impostazioni progetto'
                : blueprintFields.length
                  ? `Importa ${blueprintFields.length} campi mancanti`
                  : 'Tutti i campi blueprint sono già presenti'
            }
          >
            <Download size={14} />
            Importa campi dal blueprint
          </button>
          <span className="schema-index">{String(draftColumns.length).padStart(2, '0')} CAMPI</span>
        </div>
      </div>
      <div className="schema-list">
        <div className="schema-list-head">
          <span>CAMPO TABLETOP CREATOR</span>
          <span>CAMPO CARD STUDIO / TIPO</span>
          <span />
        </div>
        {draftColumns.map((column, index) => (
          <div
            className={`schema-row ${dragColumnId === column.id ? 'dragging' : ''} ${dropColumnId === column.id && dragColumnId !== column.id ? 'drop-target' : ''} ${column.rules?.length || column.hidden || column.defaultValue ? 'has-conditions' : ''}`}
            key={column.id}
            onDragOver={(event) => {
              event.preventDefault()
              setDropColumnId(column.id)
            }}
            onDrop={(event) => {
              event.preventDefault()
              event.stopPropagation()
              reorder(column.id)
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
                setDragColumnId(column.id)
                setDropColumnId(null)
              }}
              onDragEnd={() => {
                setDragColumnId(null)
                setDropColumnId(null)
              }}
              onKeyDown={(event) => {
                if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
                event.preventDefault()
                moveByKeyboard(index, index + (event.key === 'ArrowUp' ? -1 : 1))
              }}
            >
              <GripVertical size={15} />
            </button>
            <span className="schema-number">{String(index + 1).padStart(2, '0')}</span>
            <div className="schema-header-cell">
              <input
                className="header-input"
                value={column.header}
                onChange={(event) => edit(column.id, { header: event.target.value })}
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
            <span className="mapping-arrow">
              <ArrowRight size={15} />
            </span>
            <div className="mapping-control-stack">
              <div className="mapping-control-top">
                <label className="mapping-select">
                  <select
                    aria-label={`Collega la colonna Excel ${column.header} al campo interno`}
                    value={column.fieldId}
                    onChange={(event) => {
                      const fieldId = event.target.value
                      edit(
                        column.id,
                        column.type === 'id' && !supportsGeneratedId(fieldId) ? { fieldId, type: 'text' } : { fieldId },
                      )
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
                    edit(
                      column.id,
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
                  value={fieldNameFor(column.fieldId)}
                  disabled={!canRenameField(column.fieldId)}
                  onChange={(event) => renameField(column.fieldId, event.target.value)}
                  aria-label={`Nome campo interno per ${column.header}`}
                  title="Nome usato nell’editor carta; non modifica la colonna Excel."
                  placeholder="Nome mostrato nell’editor"
                />
              </label>
            </div>
            <button
              type="button"
              className="icon-button duplicate-column"
              onClick={() => duplicate(column.id)}
              aria-label={`Duplica ${column.header}`}
              title="Duplica il campo sotto"
            >
              <Copy size={14} />
            </button>
            <button
              className="icon-button remove-column"
              onClick={() => remove(column.id)}
              aria-label={`Rimuovi ${column.header}`}
            >
              <X size={15} />
            </button>
            {column.type === 'select' && (
              <input
                className="choice-options schema-options"
                value={(column.options ?? []).join(', ')}
                placeholder="opzioni separate da virgola"
                onChange={(event) =>
                  edit(column.id, {
                    options: event.target.value
                      .split(',')
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
              />
            )}
            {column.type === 'variable' && (
              <VariableTagPicker
                className="schema-options"
                tags={allVariableTags}
                selected={column.variableTags ?? []}
                onChange={(next) => edit(column.id, { variableTags: next })}
              />
            )}
            {column.type !== 'id' && (
              <ConditionalRulesEditor
                column={column}
                columns={draftColumns}
                variables={variables}
                onChange={(patch) => edit(column.id, patch)}
              />
            )}
            {column.type !== 'id' && (
              <DefaultValueEditor
                column={column}
                assets={assets}
                variables={variables}
                onChange={(patch) => edit(column.id, patch)}
              />
            )}
          </div>
        ))}
        {!draftColumns.length && <div className="schema-empty">Aggiungi un campo per definire questo foglio.</div>}
      </div>
      <div className="add-column add-field-composer">
        <div className="add-column-icon">
          <Plus size={17} />
        </div>
        <div className="add-column-copy">
          <strong>Nuovo campo per le carte</strong>
          <span>Testo, ID automatico, select, colore, immagine o variabile.</span>
        </div>
        <div className="add-column-control">
          <input
            value={fieldLabel}
            onChange={(event) => setFieldLabel(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && addField()}
            placeholder="es. Rarità, costo, illustrazione"
          />
          <select
            value={fieldType}
            onChange={(event) => setFieldType(event.target.value as NonNullable<ColumnDefinition['type']>)}
          >
            <option value="text">Testo</option>
            <option value="longtext">Testo lungo</option>
            <option value="number">Numero</option>
            <option value="select">Select</option>
            <option value="image">Immagine</option>
            <option value="variable">Variabile</option>
            <option value="color">Colore</option>
            <option value="id">ID automatico</option>
          </select>
          <button className="button button-dark" onClick={addField}>
            <Plus size={15} />
            Aggiungi
          </button>
        </div>
        {fieldType === 'select' && (
          <input
            className="choice-options composer-options"
            value={fieldOptions}
            onChange={(event) => setFieldOptions(event.target.value)}
            placeholder="opzioni per la select, separate da virgola"
          />
        )}
        {fieldType === 'variable' && (
          <VariableTagPicker
            className="variable-composer-tags"
            tags={allVariableTags}
            selected={fieldVariableTags}
            onChange={setFieldVariableTags}
          />
        )}
      </div>
      <div className="schema-bottom">
        <div className={dirty ? 'unsaved-note' : ''}>
          <span className="tiny-check">
            <Check size={11} />
          </span>
          {dirty ? 'Modifiche non salvate' : 'Struttura salvata nel progetto'}
        </div>
        <div className="column-draft-actions">
          <button
            className="text-button"
            onClick={() => {
              setDraftColumns(columns)
              onDirty(false)
            }}
            disabled={!dirty}
          >
            Annulla
          </button>
          <button
            className="button button-primary"
            onClick={() => {
              onSave(draftColumns)
              onDirty(false)
            }}
            disabled={!dirty}
          >
            <Check size={14} />
            Salva modifiche
          </button>
          <button className="text-button" onClick={onExport} disabled={dirty}>
            <FileSpreadsheet size={15} />
            Esporta questo set
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
