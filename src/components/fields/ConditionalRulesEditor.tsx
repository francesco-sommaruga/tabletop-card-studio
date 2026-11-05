import { ArrowRight, X, Plus } from 'lucide-react'
import type { ColumnDefinition, ProjectVariable } from '../../types'
import { metaFields, internalFieldName } from '../../lib/tableColumns'
import { ColorField } from './ColorField'

export function ConditionalRulesEditor({
  column,
  columns,
  variables,
  onChange,
}: {
  column: ColumnDefinition
  columns: ColumnDefinition[]
  variables: ProjectVariable[]
  onChange: (patch: Partial<ColumnDefinition>) => void
}) {
  if (metaFields.some((field) => field.id === column.fieldId)) return null
  const sources = [
    ...metaFields,
    ...columns
      .filter((item) => item.fieldId !== column.fieldId && !metaFields.some((meta) => meta.id === item.fieldId))
      .map((item) => ({ id: item.fieldId, label: internalFieldName(item) })),
  ]
  const sourceType = (id: string) =>
    id === 'meta_quantity' ? 'number' : (columns.find((item) => item.fieldId === id)?.type ?? 'text')
  const isNumericSource = (id: string) => sourceType(id) === 'number'
  const numericOperators = ['greater_than', 'less_than']
  const availableVariables = column.variableTags?.length
    ? variables.filter((variable) =>
        (variable.studioTags ?? []).some((tag) =>
          column.variableTags!.some((selected) => selected.toLocaleLowerCase() === tag.toLocaleLowerCase()),
        ),
      )
    : variables
  const update = (index: number, rulePatch: Partial<NonNullable<ColumnDefinition['rules']>[number]>) =>
    onChange({
      rules: (column.rules ?? []).map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...rulePatch } : rule)),
    })
  const changeSource = (index: number, sourceFieldId: string) => {
    const current = column.rules?.[index]
    if (!current) return
    update(index, {
      sourceFieldId,
      ...(numericOperators.includes(current.operator) && !isNumericSource(sourceFieldId)
        ? { operator: 'equals' as const }
        : {}),
    })
  }
  const add = () =>
    onChange({
      rules: [
        ...(column.rules ?? []),
        { sourceFieldId: sources[0]?.id ?? '', operator: 'is_set', matchValue: '', value: '' },
      ],
    })
  return (
    <details className="field-conditions schema-options">
      <summary>
        Regole automatiche e visibilità
        <span>
          {column.hidden ? 'nascosto' : 'visibile'} · {column.rules?.length ?? 0} regole
        </span>
      </summary>
      <div className="field-condition-panel">
        <label className="field-hidden-toggle">
          <input
            type="checkbox"
            checked={Boolean(column.hidden)}
            onChange={(event) => onChange({ hidden: event.target.checked })}
          />
          <span>
            <strong>Nascondi nell’editor carte</strong>
            <small>Il campo resta nel set e viene incluso nel foglio esportato.</small>
          </span>
        </label>
        <div className="rule-explainer">
          Le regole compilano il campo in automatico. Vale la prima corrispondenza; se nessuna regola corrisponde,{' '}
          {column.defaultValue ? `viene usato il default “${column.defaultValue}”.` : 'il campo resta vuoto.'}
        </div>
        {(column.rules ?? []).map((rule, index) => {
          const numeric = isNumericSource(rule.sourceFieldId)
          const compareValue = ['equals', 'not_equals', 'contains', ...numericOperators].includes(rule.operator)
          return (
            <div className="conditional-rule" key={`${column.id}-rule-${index}`}>
              <select
                aria-label="Campo da controllare"
                value={rule.sourceFieldId}
                onChange={(event) => changeSource(index, event.target.value)}
              >
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Condizione"
                value={rule.operator}
                onChange={(event) =>
                  update(index, {
                    operator: event.target.value as NonNullable<ColumnDefinition['rules']>[number]['operator'],
                  })
                }
              >
                <option value="is_set">è compilato</option>
                <option value="is_empty">è vuoto</option>
                <option value="equals">è uguale a</option>
                <option value="not_equals">è diverso da</option>
                <option value="contains">contiene</option>
                {numeric && (
                  <>
                    <option value="greater_than">è maggiore di</option>
                    <option value="less_than">è minore di</option>
                  </>
                )}
              </select>
              {compareValue ? (
                <input
                  type={numericOperators.includes(rule.operator) ? 'number' : 'text'}
                  step={numericOperators.includes(rule.operator) ? 'any' : undefined}
                  aria-label="Valore da confrontare"
                  value={rule.matchValue ?? ''}
                  onChange={(event) => update(index, { matchValue: event.target.value })}
                  placeholder={numericOperators.includes(rule.operator) ? 'numero' : 'valore'}
                />
              ) : (
                <span className="rule-any-value">qualsiasi valore</span>
              )}
              <ArrowRight size={14} />
              {column.type === 'color' ? (
                <ColorField value={rule.value} onChange={(value) => update(index, { value })} variables={variables} />
              ) : column.type === 'variable' ? (
                <select
                  className="rule-variable-output"
                  aria-label="Variabile da assegnare"
                  value={rule.value}
                  onChange={(event) => update(index, { value: event.target.value })}
                >
                  <option value="">Scegli variabile…</option>
                  {availableVariables.map((variable) => (
                    <option key={variable.code} value={`{${variable.code}}`}>
                      {`{${variable.code}}`} · {variable.replacement}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="rule-output"
                  aria-label="Valore automatico"
                  value={rule.value}
                  onChange={(event) => update(index, { value: event.target.value })}
                  placeholder="valore da assegnare"
                />
              )}
              <button
                type="button"
                className="icon-button remove-column"
                onClick={() => onChange({ rules: (column.rules ?? []).filter((_, ruleIndex) => ruleIndex !== index) })}
                aria-label="Rimuovi regola"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
        <button type="button" className="text-button add-condition-rule" onClick={add}>
          <Plus size={13} />
          Aggiungi regola
        </button>
      </div>
    </details>
  )
}
