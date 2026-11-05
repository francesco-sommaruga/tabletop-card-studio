import { Plus, Images, FileImage } from 'lucide-react'
import type { ProjectAsset } from '../types'

export function AssetsPage({ assets, onAdd }: { assets: ProjectAsset[]; onAdd: () => void }) {
  return (
    <div className="page-content assets-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            LIBRERIA DEL PROGETTO
          </div>
          <h1>
            Asset<span className="heading-period">.</span>
          </h1>
          <p>Immagini raccolte nella cartella `assets` e pronte da assegnare alle carte.</p>
        </div>
        <button className="button button-primary add-button" onClick={onAdd}>
          <Plus size={16} />
          Aggiungi immagini
        </button>
      </div>
      <div className="asset-library-meta">
        <div>
          <Images size={17} />
          <strong>{assets.length}</strong>
          <span>immagini disponibili</span>
        </div>
        <span>Le nuove immagini vengono copiate in `assets/images/card-studio`</span>
      </div>
      {assets.length ? (
        <div className="asset-grid">
          {assets.map((asset) => (
            <article className="asset-card" key={asset.path}>
              <div className="asset-preview">
                {asset.previewUrl ? <img src={asset.previewUrl} alt={asset.name} /> : <FileImage size={28} />}
              </div>
              <div className="asset-card-info">
                <strong title={asset.name}>{asset.name}</strong>
                <small title={asset.path}>{asset.path}</small>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="asset-empty">
          <Images size={24} />
          <strong>La libreria è vuota.</strong>
          <span>Aggiungi illustrazioni, icone o altri file immagine del progetto.</span>
          <button className="button button-quiet" onClick={onAdd}>
            <Plus size={15} />
            Aggiungi il primo asset
          </button>
        </div>
      )}
    </div>
  )
}
