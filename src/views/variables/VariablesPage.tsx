import { useState, useRef, useEffect, useMemo } from 'react'
import { Plus, Braces, Search, Check } from 'lucide-react'
import type { ProjectVariable } from '../../types'
import { VariableEditorCard } from './VariableEditorCard'

export function VariablesPage({
  variables,
  projectPath,
  onSave,
  onDirty,
}: {
  variables: ProjectVariable[]
  projectPath: string
  onSave: (variables: ProjectVariable[]) => Promise<void>
  onDirty: (dirty: boolean) => void
}) {
  const [draft, setDraft] = useState<ProjectVariable[]>(variables)
  const [draftKeys, setDraftKeys] = useState(() => variables.map((_, index) => `variable-${index}`))
  const nextDraftKey = useRef(variables.length)
  const [saveError, setSaveError] = useState('')
  const [filterQuery, setFilterQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | NonNullable<ProjectVariable['studioType']>>('all')
  const dirty = JSON.stringify(draft) !== JSON.stringify(variables)
  useEffect(() => {
    onDirty(dirty)
  }, [dirty, onDirty])
  const duplicateCode = draft.find(
    (variable, index) =>
      variable.code.trim() &&
      draft.findIndex((other) => other.code.trim().toLocaleLowerCase() === variable.code.trim().toLocaleLowerCase()) !==
        index,
  )
  const filteredDraft = useMemo(() => {
    const term = filterQuery.trim().toLocaleLowerCase()
    return draft
      .map((variable, index) => ({ variable, index }))
      .filter(
        ({ variable }) =>
          (filterType === 'all' || (variable.studioType ?? 'text') === filterType) &&
          (!term ||
            `${variable.code} ${variable.replacement} ${(variable.studioTags ?? []).join(' ')}`
              .toLocaleLowerCase()
              .includes(term)),
      )
  }, [draft, filterQuery, filterType])
  const update = (index: number, patch: Partial<ProjectVariable>) =>
    setDraft((current) =>
      current.map((variable, itemIndex) => (itemIndex === index ? { ...variable, ...patch } : variable)),
    )
  const add = () => {
    setDraft((current) => [
      ...current,
      { code: '', replacement: '', force_tint: 'False', color: '#FFFFFFFF', studioTags: [], studioType: 'text' },
    ])
    setDraftKeys((current) => [...current, `new-variable-${nextDraftKey.current++}`])
    setSaveError('')
  }
  const save = async () => {
    if (draft.some((variable) => !variable.code.trim())) {
      setSaveError('Ogni variabile deve avere un codice.')
      return
    }
    if (duplicateCode) {
      setSaveError(`Il codice “${duplicateCode.code}” è già presente.`)
      return
    }
    setSaveError('')
    try {
      await onSave(
        draft.map((variable) => ({
          ...variable,
          code: variable.code.trim(),
          studioTags: [...new Set((variable.studioTags ?? []).map((tag) => tag.trim()).filter(Boolean))],
          studioType: variable.studioType ?? 'text',
        })),
      )
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Non è stato possibile salvare variables.json.')
    }
  }
  const cancel = () => {
    setDraft(variables)
    setDraftKeys(variables.map(() => `reset-variable-${nextDraftKey.current++}`))
    setSaveError('')
    onDirty(false)
  }
  const tagSuggestions = [
    ...new Set(
      draft
        .flatMap((variable) => variable.studioTags ?? [])
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b))
  return (
    <div className="page-content variables-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            DATA · VARIABLES.JSON
          </div>
          <h1>
            Variabili<span className="heading-period">.</span>
          </h1>
          <p>Crea e organizza le variabili usate nei pannelli di Tabletop Creator.</p>
        </div>
        <button className="button button-primary add-button" onClick={add}>
          <Plus size={16} />
          Nuova variabile
        </button>
      </div>
      <section className="variables-intro">
        <Braces size={20} />
        <div>
          <strong>Codice e sostituzione</strong>
          <p>
            Il codice viene richiamato nelle carte come <code>{'{codice}'}</code>. I tag limitano le opzioni dei campi
            variabile; “Icona” mostra l’anteprima della sostituzione e “Colore salvato” la aggiunge alla palette.
          </p>
        </div>
        <span>{draft.length} VARIABILI</span>
      </section>
      {draft.length ? (
        <>
          <div className="variable-filter-tools">
            <label className="variables-filter">
              <Search size={15} />
              <input
                value={filterQuery}
                onChange={(event) => setFilterQuery(event.target.value)}
                placeholder="Filtra per codice, sostituzione o tag…"
              />
              <span>
                {filteredDraft.length} / {draft.length}
              </span>
            </label>
            <div className="variable-type-filters" role="group" aria-label="Filtra per tipo di variabile">
              {(
                [
                  { id: 'all', label: 'Tutte' },
                  { id: 'text', label: 'Testo' },
                  { id: 'color', label: 'Colore salvato' },
                  { id: 'icon', label: 'Icona' },
                ] as const
              ).map(({ id, label }) => {
                const count =
                  id === 'all'
                    ? draft.length
                    : draft.filter((variable) => (variable.studioType ?? 'text') === id).length
                return (
                  <button
                    type="button"
                    key={id}
                    className={filterType === id ? 'active' : ''}
                    aria-pressed={filterType === id}
                    onClick={() => setFilterType(id)}
                  >
                    {label}
                    <span>{count}</span>
                  </button>
                )
              })}
            </div>
          </div>
          {filteredDraft.length ? (
            <div className="variable-list">
              {filteredDraft.map(({ variable, index }) => (
                <VariableEditorCard
                  key={draftKeys[index]}
                  variable={variable}
                  index={index}
                  projectPath={projectPath}
                  tagSuggestions={tagSuggestions}
                  onChange={(patch) => update(index, patch)}
                  onTags={(value) => update(index, { studioTags: value })}
                  onDelete={() => {
                    setDraft((current) => current.filter((_, itemIndex) => itemIndex !== index))
                    setDraftKeys((current) => current.filter((_, itemIndex) => itemIndex !== index))
                    setSaveError('')
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="variables-filter-empty">Nessuna variabile corrisponde al filtro.</div>
          )}
        </>
      ) : (
        <div className="variables-empty">
          <Braces size={23} />
          <strong>Nessuna variabile nel progetto.</strong>
          <span>Aggiungi una variabile per creare il primo campo riutilizzabile.</span>
          <button className="button button-quiet" onClick={add}>
            <Plus size={14} />
            Crea variabile
          </button>
        </div>
      )}
      <div className="variables-footer">
        <span className={saveError ? 'variables-error' : dirty ? 'unsaved-note' : ''}>
          {saveError ||
            (dirty
              ? 'Modifiche non salvate'
              : `Sincronizzate con ${variables.length ? 'data/variables.json' : 'il progetto'}`)}
        </span>
        <div>
          <button className="text-button" onClick={cancel} disabled={!dirty}>
            Annulla
          </button>
          <button
            className="button button-primary"
            onClick={() => void save()}
            disabled={!dirty || Boolean(duplicateCode) || draft.some((variable) => !variable.code.trim())}
          >
            <Check size={14} />
            Salva variabili
          </button>
        </div>
      </div>
    </div>
  )
}
