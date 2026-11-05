import { useState } from 'react'
import { X, Check } from 'lucide-react'

export function RenameSetDialog({
  name,
  onClose,
  onSave,
}: {
  name: string
  onClose: () => void
  onSave: (name: string) => void
}) {
  const [value, setValue] = useState(name)
  const [error, setError] = useState('')
  return (
    <>
      <button className="scrim" aria-label="Chiudi rinomina set" onClick={onClose} />
      <section className="rename-set-panel" role="dialog" aria-modal="true" aria-labelledby="rename-set-title">
        <div className="editor-head">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />
              ORGANIZZAZIONE SET
            </div>
            <h2 id="rename-set-title">Rinomina il set.</h2>
          </div>
          <button className="icon-button close-editor" onClick={onClose} aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const next = value.trim()
            if (!next) {
              setError('Inserisci un nome per il set.')
              return
            }
            onSave(next)
          }}
        >
          <label htmlFor="rename-set-input">NOME DEL SET</label>
          <input
            id="rename-set-input"
            autoFocus
            maxLength={80}
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              setError('')
            }}
          />
          {error && <small className="rename-set-error">{error}</small>}
          <div>
            <button type="button" className="button button-quiet" onClick={onClose}>
              Annulla
            </button>
            <button type="submit" className="button button-primary">
              <Check size={14} />
              Salva nome
            </button>
          </div>
        </form>
      </section>
    </>
  )
}
