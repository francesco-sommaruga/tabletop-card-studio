import { useState, useEffect } from 'react'
import { X, Search } from 'lucide-react'
import type { ProjectIconReference } from '../../types'
import { IconPreview } from '../fields/IconPreview'

export function IconLibraryDialog({
  projectPath,
  onClose,
  onChoose,
}: {
  projectPath: string
  onClose: () => void
  onChoose: (reference: string) => void
}) {
  const [query, setQuery] = useState('')
  const [library, setLibrary] = useState<'all' | 'tabletop' | 'project'>('all')
  const [result, setResult] = useState<{ items: ProjectIconReference[]; total: number }>({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const timer = setTimeout(
      () => {
        setLoading(true)
        setError('')
        void window.cardCms
          .searchIcons(query, library)
          .then((response) => {
            if (active) setResult(response)
          })
          .catch((reason) => {
            if (active) setError(reason instanceof Error ? reason.message : 'Impossibile caricare le icone.')
          })
          .finally(() => {
            if (active) setLoading(false)
          })
      },
      query ? 180 : 0,
    )
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query, library, projectPath])
  return (
    <>
      <button className="scrim icon-library-scrim" aria-label="Chiudi libreria icone" onClick={onClose} />
      <section className="icon-library-modal" role="dialog" aria-modal="true" aria-labelledby="icon-library-title">
        <header className="icon-library-head">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />
              LIBRERIA ICONE
            </div>
            <h2 id="icon-library-title">Scegli una sostituzione</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Chiudi">
            <X size={18} />
          </button>
        </header>
        <div className="icon-library-tools">
          <label className="icon-library-search">
            <Search size={15} />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === 'Escape' && onClose()}
              placeholder="Cerca per nome o percorso…"
            />
            <span>{loading ? '…' : result.total}</span>
          </label>
          <div className="icon-library-tabs" role="group" aria-label="Origine delle icone">
            <button className={library === 'all' ? 'active' : ''} onClick={() => setLibrary('all')}>
              Tutte
            </button>
            <button className={library === 'tabletop' ? 'active' : ''} onClick={() => setLibrary('tabletop')}>
              Tabletop Creator
            </button>
            <button className={library === 'project' ? 'active' : ''} onClick={() => setLibrary('project')}>
              Asset del progetto
            </button>
          </div>
        </div>
        <div className="icon-library-results">
          {error ? (
            <div className="icon-library-message error">{error}</div>
          ) : loading && !result.items.length ? (
            <div className="icon-library-message">Carico la libreria…</div>
          ) : result.items.length ? (
            <div className="icon-library-grid">
              {result.items.map((icon) => (
                <button
                  type="button"
                  key={`${icon.library}:${icon.reference}`}
                  className="icon-library-option"
                  onClick={() => onChoose(icon.reference)}
                  title={icon.reference}
                >
                  <span className="icon-library-art">
                    <IconPreview
                      reference={icon.reference}
                      projectPath={projectPath}
                      className="icon-library-preview"
                      tint="#51483D"
                    />
                  </span>
                  <strong>{icon.name}</strong>
                  <small>
                    {icon.category || (icon.library === 'tabletop' ? 'Tabletop Creator' : 'Asset del progetto')}
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <div className="icon-library-message">
              {query ? 'Nessuna icona corrisponde alla ricerca.' : 'Nessuna icona trovata per questa origine.'}
            </div>
          )}
          {result.total > result.items.length && (
            <div className="icon-library-limit">
              Mostrate {result.items.length} di {result.total} risultati. Affina la ricerca per trovare le altre icone.
            </div>
          )}
        </div>
        <footer className="icon-library-foot">
          <span>
            {result.total} icone disponibili
            {library !== 'all' ? ` · ${library === 'tabletop' ? 'Tabletop Creator' : 'asset del progetto'}` : ''}
          </span>
          <button type="button" className="button button-quiet" onClick={onClose}>
            Annulla
          </button>
        </footer>
      </section>
    </>
  )
}
