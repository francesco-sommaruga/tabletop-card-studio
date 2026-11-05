import type { ColumnDefinition, ProjectAsset, ProjectVariable } from '../../types'
import { ColorField } from './ColorField'
import { ImageField } from './ImageField'

export function DefaultValueEditor({
  column,
  assets,
  variables,
  onChange,
}: {
  column: ColumnDefinition
  assets: ProjectAsset[]
  variables: ProjectVariable[]
  onChange: (patch: Partial<ColumnDefinition>) => void
}) {
  const value = column.defaultValue ?? ''
  const update = (next: string) => onChange({ defaultValue: next.trim() ? next : undefined })
  const availableVariables = column.variableTags?.length
    ? variables.filter((variable) =>
        (variable.studioTags ?? []).some((tag) =>
          column.variableTags!.some((selected) => selected.toLocaleLowerCase() === tag.toLocaleLowerCase()),
        ),
      )
    : variables
  return (
    <details className="field-default-editor schema-options">
      <summary>
        <span>Valore predefinito</span>
        <small>{value || 'non impostato'}</small>
      </summary>
      <div className="field-default-panel">
        <p>
          {column.rules?.length
            ? 'Usato quando nessuna regola condizionale corrisponde.'
            : 'Usato quando il campo è vuoto. Lascia vuoto per non applicare un valore.'}
        </p>
        {column.type === 'color' ? (
          <ColorField value={value} onChange={update} variables={variables} />
        ) : column.type === 'image' ? (
          <ImageField assets={assets} value={value} onChange={update} fieldName={`${column.header} · default`} />
        ) : column.type === 'select' ? (
          <select
            aria-label={`Valore predefinito per ${column.header}`}
            value={value}
            onChange={(event) => update(event.target.value)}
          >
            <option value="">Nessun default</option>
            {value && !(column.options ?? []).includes(value) && (
              <option value={value}>{value} · valore attuale</option>
            )}
            {(column.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : column.type === 'variable' ? (
          <select
            aria-label={`Valore predefinito per ${column.header}`}
            value={value}
            onChange={(event) => update(event.target.value)}
          >
            <option value="">Nessun default</option>
            {value && !availableVariables.some((variable) => `{${variable.code}}` === value) && (
              <option value={value}>{value} · valore attuale</option>
            )}
            {availableVariables.map((variable) => (
              <option key={variable.code} value={`{${variable.code}}`}>
                {`{${variable.code}}`} · {variable.replacement}
              </option>
            ))}
          </select>
        ) : column.type === 'longtext' ? (
          <textarea
            rows={2}
            aria-label={`Valore predefinito per ${column.header}`}
            value={value}
            onChange={(event) => update(event.target.value)}
            placeholder="Lascia vuoto per non applicare un default"
          />
        ) : (
          <input
            type={column.type === 'number' ? 'number' : 'text'}
            aria-label={`Valore predefinito per ${column.header}`}
            value={value}
            onChange={(event) => update(event.target.value)}
            placeholder="Lascia vuoto per non applicare un default"
          />
        )}
      </div>
    </details>
  )
}
