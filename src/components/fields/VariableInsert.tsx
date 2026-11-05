import { ChevronDown, ImagePlus, X } from 'lucide-react'
import { useState } from 'react'
import type { ProjectVariable } from '../../types'
import { IconPreview } from './IconPreview'
import { variableIconTint } from '../../lib/variables'

export function VariableInsert({
  variables,
  onInsert,
}: {
  variables: ProjectVariable[]
  onInsert: (token: string) => void
}) {
  if (!variables.length) return null
  return (
    <label className="variable-insert">
      <span>Variabile</span>
      <select
        value=""
        onChange={(event) => {
          if (event.target.value) onInsert(`{${event.target.value}}`)
          event.currentTarget.value = ''
        }}
      >
        <option value="">Inserisci nel campo…</option>
        {variables.map((variable) => (
          <option key={variable.code} value={variable.code}>
            {`{${variable.code}}`} · {variable.replacement}
          </option>
        ))}
      </select>
      <ChevronDown size={12} />
    </label>
  )
}

export function IconVariableInsert({
  variables,
  projectPath,
  onInsert,
}: {
  variables: ProjectVariable[]
  projectPath: string
  onInsert: (token: string) => void
}) {
  const [open, setOpen] = useState(false)
  const icons = variables.filter((variable) => variable.studioType === 'icon')
  if (!icons.length) return null
  return (
    <div className="icon-variable-insert">
      <button
        type="button"
        className="icon-variable-trigger"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ImagePlus size={13} />
        Aggiungi icona
      </button>
      {open && (
        <div className="icon-variable-popover" role="dialog" aria-label="Scegli una variabile icona">
          <div className="icon-variable-popover-head">
            <span>VARIABILI ICONE</span>
            <button type="button" aria-label="Chiudi selezione icone" onClick={() => setOpen(false)}>
              <X size={13} />
            </button>
          </div>
          <div className="icon-variable-options">
            {icons.map((variable) => (
              <button
                type="button"
                className="icon-variable-option"
                key={variable.code}
                onClick={() => {
                  onInsert(`{${variable.code}}`)
                  setOpen(false)
                }}
              >
                <IconPreview
                  reference={variable.replacement}
                  projectPath={projectPath}
                  className="icon-variable-option-preview"
                  tint={variableIconTint(variable, '#51483D')}
                />
                <span>
                  <strong>{variable.code}</strong>
                  <small>{variable.replacement}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
