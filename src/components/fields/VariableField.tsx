import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ProjectVariable } from '../../types'
import { IconPreview } from './IconPreview'
import { variableIconTint } from '../../lib/variables'

export function VariableField({
  variables,
  tags,
  value,
  projectPath,
  hasRules = false,
  onChange,
}: {
  variables: ProjectVariable[]
  tags: string[]
  value: string
  projectPath: string
  hasRules?: boolean
  onChange?: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const available = tags.length
    ? variables.filter((variable) =>
        (variable.studioTags ?? []).some((tag) =>
          tags.some((chosen) => chosen.toLocaleLowerCase() === tag.toLocaleLowerCase()),
        ),
      )
    : variables
  const storedCode = value.match(/^\{\s*(.*?)\s*\}$/)?.[1] ?? value
  const current = variables.find((variable) => variable.code.toLocaleLowerCase() === storedCode.toLocaleLowerCase())
  const currentAvailable =
    current && available.some((variable) => variable.code.toLocaleLowerCase() === current.code.toLocaleLowerCase())
  const choose = (code: string) => {
    onChange?.(code ? `{${code}}` : '')
    setOpen(false)
  }
  const selectedLabel =
    current?.studioType === 'icon'
      ? 'Icona selezionata'
      : current
        ? `{${current.code}} · ${current.replacement}`
        : storedCode
          ? `${storedCode} · variabile non trovata`
          : 'Seleziona una variabile…'
  return (
    <div className="variable-field">
      {hasRules ? (
        <div className="variable-field-readonly" title={current?.studioType === 'icon' ? current.code : undefined}>
          {current?.studioType === 'icon' ? (
            <IconPreview
              reference={current.replacement}
              projectPath={projectPath}
              className="variable-selected-icon"
              tint={variableIconTint(current, '#51483D')}
            />
          ) : (
            <span className="variable-field-token">
              {current ? `{${current.code}}` : value || 'Nessuna regola attiva'}
            </span>
          )}
          {current?.studioType !== 'icon' && current?.replacement && <small>{current.replacement}</small>}
        </div>
      ) : (
        <div className="variable-field-select">
          <button
            type="button"
            className="variable-field-trigger"
            title={current?.code}
            aria-label="Variabile assegnata"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen((isOpen) => !isOpen)}
          >
            {current?.studioType === 'icon' && (
              <IconPreview
                reference={current.replacement}
                projectPath={projectPath}
                className="variable-selected-icon"
                tint={variableIconTint(current, '#51483D')}
              />
            )}
            <span>{selectedLabel}</span>
            <ChevronDown size={14} />
          </button>
          {open && (
            <div className="variable-field-options" role="listbox" aria-label="Variabili disponibili">
              <button type="button" role="option" aria-selected={!current && !storedCode} onClick={() => choose('')}>
                Nessuna variabile
              </button>
              {!current && storedCode && (
                <button type="button" role="option" aria-selected="true" onClick={() => choose(storedCode)}>
                  {storedCode} · non trovata nel progetto
                </button>
              )}
              {current && !currentAvailable && (
                <button type="button" role="option" aria-selected="true" onClick={() => choose(current.code)}>
                  {current.studioType === 'icon' && (
                    <IconPreview
                      reference={current.replacement}
                      projectPath={projectPath}
                      className="variable-selected-icon"
                      tint={variableIconTint(current, '#51483D')}
                    />
                  )}
                  {current.studioType === 'icon' ? current.code : `{${current.code}} · fuori dai tag scelti`}
                </button>
              )}
              {available.map((variable) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={current?.code === variable.code}
                  key={variable.code}
                  onClick={() => choose(variable.code)}
                >
                  {variable.studioType === 'icon' && (
                    <IconPreview
                      reference={variable.replacement}
                      projectPath={projectPath}
                      className="variable-selected-icon"
                      tint={variableIconTint(variable, '#51483D')}
                    />
                  )}
                  <span>
                    {variable.studioType === 'icon' ? variable.code : `{${variable.code}} · ${variable.replacement}`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <small>
        {hasRules
          ? `Calcolata automaticamente${tags.length ? ` · tag: ${tags.join(', ')}` : ''}`
          : tags.length
            ? `Scegli una variabile con tag: ${tags.join(', ')}`
            : 'Scegli una variabile dal progetto.'}
      </small>
      {current && !currentAvailable && (
        <small className="variable-field-empty">La variabile attuale non rientra nei tag scelti.</small>
      )}
    </div>
  )
}
