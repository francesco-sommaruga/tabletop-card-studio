import { useState, useMemo } from 'react'
import { FileImage, Images, X, Search, Check } from 'lucide-react'
import type { ProjectAsset } from '../../types'
import { normalizeAssetReference } from '../../lib/assets'

export function ImageField({
  assets,
  value,
  onChange,
  fieldName,
}: {
  assets: ProjectAsset[]
  value: string
  onChange: (value: string) => void
  fieldName: string
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = assets.find((asset) => asset.path === normalizeAssetReference(value))
  const filteredAssets = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    return assets.filter((asset) => !term || `${asset.name} ${asset.path}`.toLocaleLowerCase().includes(term))
  }, [assets, query])
  const closePicker = () => {
    setPickerOpen(false)
    setQuery('')
  }
  const chooseAsset = (asset: ProjectAsset) => {
    onChange(asset.path)
    closePicker()
  }
  const displayName = selected?.name ?? (value ? value.split(/[\\/]/).filter(Boolean).pop() : '')
  return (
    <div className="image-picker">
      <div className="image-picker-current">
        {selected?.previewUrl ? (
          <img className="image-picker-preview" src={selected.previewUrl} alt={`Anteprima: ${selected.name}`} />
        ) : (
          <div className="image-picker-preview image-picker-placeholder">
            <FileImage size={22} />
            <span>{value ? 'Immagine non trovata' : 'Nessuna immagine'}</span>
          </div>
        )}
        <div className="image-picker-current-details">
          <strong title={selected?.path ?? value}>{displayName || 'Assegna un’immagine'}</strong>
          <small>
            {selected
              ? 'Libreria immagini del progetto'
              : assets.length
                ? 'Scegli dalla libreria del progetto'
                : 'La libreria non contiene immagini'}
          </small>
          <div className="image-picker-actions">
            <button type="button" className="image-picker-open" onClick={() => setPickerOpen((open) => !open)}>
              <Images size={14} />
              {pickerOpen ? 'Chiudi libreria' : selected ? 'Cambia immagine' : 'Scegli immagine'}
            </button>
            {value && (
              <button
                type="button"
                className="image-picker-clear"
                onClick={() => {
                  onChange('')
                  closePicker()
                }}
              >
                <X size={13} />
                Rimuovi
              </button>
            )}
          </div>
        </div>
      </div>
      {pickerOpen && (
        <div className="image-picker-panel">
          <label className="image-picker-search">
            <Search size={15} />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === 'Escape' && closePicker()}
              placeholder="Cerca per nome o percorso…"
              aria-label={`Cerca immagini per ${fieldName}`}
            />
            <span>
              {filteredAssets.length} / {assets.length}
            </span>
          </label>
          {filteredAssets.length ? (
            <div className="image-picker-grid" aria-label="Risultati nella libreria immagini">
              {filteredAssets.map((asset) => {
                const isSelected = normalizeAssetReference(value) === asset.path
                return (
                  <button
                    type="button"
                    key={asset.path}
                    className={`image-picker-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => chooseAsset(asset)}
                    title={asset.path}
                    aria-pressed={isSelected}
                  >
                    {asset.previewUrl ? (
                      <img src={asset.previewUrl} alt="" />
                    ) : (
                      <span className="image-picker-option-placeholder">
                        <FileImage size={18} />
                      </span>
                    )}
                    <span className="image-picker-option-name">{asset.name}</span>
                    {isSelected && <Check size={14} />}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="image-picker-empty">
              {assets.length
                ? 'Nessuna immagine corrisponde alla ricerca.'
                : 'Aggiungi prima le immagini nella sezione Asset di progetto.'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
