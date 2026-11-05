import { ChevronDown, ChevronUp, Eye, X } from 'lucide-react'

/** Card editor header: title, previous/next card, blueprint preview and close. */
export function CardEditorHeader({
  canPreview,
  onPreview,
  onPrevious,
  onNext,
  onClose,
}: {
  canPreview: boolean
  onPreview: () => void
  /** Undefined at the start of the list (button disabled). */
  onPrevious?: () => void
  /** Undefined at the end of the list (button disabled). */
  onNext?: () => void
  onClose: () => void
}) {
  return (
    <div className="editor-head">
      <div>
        <div className="eyebrow">
          <span className="eyebrow-line" />
          EDITOR CARTA
        </div>
        <h2>Dettagli</h2>
      </div>
      <div className="editor-head-actions">
        {canPreview && (
          <button type="button" className="button button-quiet preview-open-button" onClick={onPreview}>
            <Eye size={14} />
            Anteprima
          </button>
        )}
        <div className="editor-nav" role="group" aria-label="Naviga tra le carte">
          <button
            type="button"
            className="icon-button editor-nav-button"
            onClick={onPrevious}
            disabled={!onPrevious}
            aria-label="Carta precedente"
            title="Carta precedente (Alt+↑)"
          >
            <ChevronUp size={17} />
          </button>
          <button
            type="button"
            className="icon-button editor-nav-button"
            onClick={onNext}
            disabled={!onNext}
            aria-label="Carta successiva"
            title="Carta successiva (Alt+↓)"
          >
            <ChevronDown size={17} />
          </button>
        </div>
        <button className="icon-button close-editor" onClick={onClose} aria-label="Chiudi">
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
