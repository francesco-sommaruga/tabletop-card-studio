import { useState } from 'react'
import { Images, X } from 'lucide-react'
import type { ProjectVariable } from '../../types'
import { IconPreview } from '../../components/fields/IconPreview'
import { variableIconTint } from '../../lib/variables'
import { VariableTagEditor } from './VariableTagEditor'
import { IconLibraryDialog } from '../../components/dialogs/IconLibraryDialog'

export function VariableEditorCard({
  variable,
  index,
  projectPath,
  tagSuggestions,
  onChange,
  onTags,
  onDelete,
}: {
  variable: ProjectVariable
  index: number
  projectPath: string
  tagSuggestions: string[]
  onChange: (patch: Partial<ProjectVariable>) => void
  onTags: (value: string[]) => void
  onDelete: () => void
}) {
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  return (
    <article className="variable-card">
      <div className="variable-card-index">{String(index + 1).padStart(2, '0')}</div>
      <div className="variable-card-main">
        <div className="variable-card-fields">
          <label>
            <span>CODICE</span>
            <input
              value={variable.code}
              onChange={(event) => onChange({ code: event.target.value })}
              placeholder="es. costo"
            />
          </label>
          <label>
            <span>TIPO CARD STUDIO</span>
            <select
              value={variable.studioType ?? 'text'}
              onChange={(event) =>
                onChange({
                  studioType: event.target.value as ProjectVariable['studioType'],
                  color: event.target.value === 'color' ? variable.color || '#FFFFFFFF' : variable.color,
                })
              }
            >
              <option value="text">Testo</option>
              <option value="color">Colore salvato</option>
              <option value="icon">Icona</option>
            </select>
          </label>
          <label>
            <span>SOSTITUZIONE</span>
            <textarea
              rows={2}
              value={variable.replacement}
              onChange={(event) => onChange({ replacement: event.target.value })}
              placeholder={
                variable.studioType === 'icon'
                  ? 'Percorso icona o file, es. Gui/plain-circle o larva.png'
                  : 'Testo, colore o ID icona Tabletop Creator'
              }
            />
            {variable.studioType === 'icon' && (
              <>
                <button type="button" className="variable-icon-library-trigger" onClick={() => setIconPickerOpen(true)}>
                  <Images size={13} />
                  Scegli icona dalla libreria
                </button>
                <div className="variable-icon-preview">
                  <IconPreview
                    reference={variable.replacement}
                    projectPath={projectPath}
                    className="variable-manager-icon"
                    tint={variableIconTint(variable, '#51483D')}
                  />
                  <span>
                    {variable.replacement
                      ? `Anteprima · ${variable.replacement}`
                      : 'Scegli un’icona Tabletop Creator o da assets/icons'}
                  </span>
                </div>
              </>
            )}
          </label>
        </div>
        <div className="variable-card-settings">
          <label className="variable-force-tint">
            <input
              type="checkbox"
              checked={(variable.force_tint ?? 'False').toLocaleLowerCase() === 'true'}
              onChange={(event) => onChange({ force_tint: event.target.checked ? 'True' : 'False' })}
            />
            <span>Forza tinta</span>
          </label>
          <label className="variable-color">
            <span>COLORE</span>
            <input
              type="color"
              value={/^#[0-9a-f]{6}/i.test(variable.color ?? '') ? variable.color!.slice(0, 7) : '#ffffff'}
              onChange={(event) => {
                const alpha = /^#[0-9a-f]{8}$/i.test(variable.color ?? '') ? variable.color!.slice(7) : 'FF'
                onChange({ color: `${event.target.value}${alpha}` })
              }}
            />
            <input
              value={variable.color ?? ''}
              onChange={(event) => onChange({ color: event.target.value })}
              placeholder="#FFFFFFFF"
              aria-label={`Codice colore per ${variable.code || 'nuova variabile'}`}
            />
          </label>
          <button
            className="icon-button variable-delete"
            onClick={onDelete}
            aria-label={`Rimuovi variabile ${variable.code || index + 1}`}
            title="Rimuovi variabile"
          >
            <X size={15} />
          </button>
        </div>
        <VariableTagEditor value={variable.studioTags ?? []} suggestions={tagSuggestions} onChange={onTags} />
      </div>
      {iconPickerOpen && (
        <IconLibraryDialog
          projectPath={projectPath}
          onClose={() => setIconPickerOpen(false)}
          onChoose={(reference) => {
            onChange({ replacement: reference })
            setIconPickerOpen(false)
          }}
        />
      )}
    </article>
  )
}
