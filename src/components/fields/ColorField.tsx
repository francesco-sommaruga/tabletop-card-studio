import { useState } from 'react'
import { Palette, X } from 'lucide-react'
import type { ProjectVariable } from '../../types'

export function ColorField({
  value,
  onChange,
  readOnly = false,
  variables = [],
}: {
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  variables?: ProjectVariable[]
}) {
  const [libraryOpen, setLibraryOpen] = useState(false)
  const hexMatch = value.match(/^#([\da-f]{6})([\da-f]{2})?$/i)
  const pickerValue = hexMatch ? `#${hexMatch[1]}` : '#ffffff'
  const alphaHex = hexMatch?.[2] ?? 'FF'
  const alphaValue = parseInt(alphaHex, 16)
  const hasColor = Boolean(value.trim() && CSS.supports('color', value))
  const showTransparency = !hasColor || alphaValue < 255
  const savedColors = variables.filter((variable) => variable.studioType === 'color' && variable.color)
  return (
    <div className={`color-field-control ${readOnly ? 'is-readonly' : ''}`}>
      <div className={`color-field ${readOnly ? 'is-readonly' : ''}`}>
        <span
          className="color-preview"
          style={{
            backgroundColor: hasColor ? value : 'transparent',
            backgroundImage: showTransparency ? undefined : 'none',
          }}
          title={value || 'Nessun colore selezionato'}
        />
        {readOnly ? (
          <span className="color-field-value">{value || 'Nessuna regola attiva'}</span>
        ) : (
          <>
            <input
              aria-label="Scegli colore"
              type="color"
              value={pickerValue}
              onChange={(event) => onChange?.(`${event.target.value}${hexMatch?.[2] ?? ''}`)}
            />
            <input
              aria-label="Valore colore"
              type="text"
              value={value}
              onChange={(event) => onChange?.(event.target.value)}
              placeholder="#RRGGBB o #RRGGBBAA"
            />
            <div className="saved-color-picker">
              <button
                type="button"
                className={`saved-color-trigger ${libraryOpen ? 'active' : ''}`}
                onClick={() => setLibraryOpen((open) => !open)}
                aria-expanded={libraryOpen}
                title="Scegli un colore salvato"
              >
                <Palette size={13} />
                <span>Salvati</span>
              </button>
              {libraryOpen && (
                <div className="saved-color-popover">
                  <div className="saved-color-heading">
                    PALETTE DEL PROGETTO{' '}
                    <button type="button" aria-label="Chiudi palette" onClick={() => setLibraryOpen(false)}>
                      <X size={12} />
                    </button>
                  </div>
                  {savedColors.length ? (
                    savedColors.map((variable) => (
                      <button
                        type="button"
                        className="saved-color-option"
                        key={variable.code}
                        onClick={() => {
                          onChange?.(variable.color!)
                          setLibraryOpen(false)
                        }}
                      >
                        <span className="saved-color-swatch" style={{ backgroundColor: variable.color }} />
                        <span>
                          <strong>{variable.code}</strong>
                          <small>{variable.replacement || variable.color}</small>
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="saved-color-empty">
                      <strong>Palette ancora vuota.</strong>Crea una variabile di tipo “Colore salvato” nella sezione
                      Variabili.
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {!readOnly && (
        <label className="color-alpha-control">
          <span>OPACITÀ</span>
          <input
            aria-label="Opacità colore"
            type="range"
            min="0"
            max="255"
            value={alphaValue}
            disabled={!hexMatch}
            onChange={(event) =>
              onChange?.(`${pickerValue}${Number(event.target.value).toString(16).padStart(2, '0').toUpperCase()}`)
            }
          />
          <output>{hexMatch ? `${Math.round((alphaValue / 255) * 100)}%` : '—'}</output>
        </label>
      )}
    </div>
  )
}
