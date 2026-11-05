import { RefreshCw, TriangleAlert, Upload } from 'lucide-react'

export function NativeSyncBanner({
  setName,
  onReload,
  onOverwrite,
  busy,
}: {
  setName: string
  onReload: () => void
  onOverwrite: () => void
  busy: boolean
}) {
  return (
    <section className="native-sync-banner" role="alert" aria-labelledby="native-sync-banner-title">
      <TriangleAlert className="native-sync-banner-icon" size={17} aria-hidden="true" />
      <div className="native-sync-banner-copy">
        <strong id="native-sync-banner-title">Sincronizzazione con Tabletop Creator in sospeso</strong>
        <p>
          “{setName}” è stato modificato sia in Card Studio sia in Tabletop Creator: scegli quale versione tenere;
          sovrascrivendo, Card Studio salva prima una copia di backup del file di Tabletop Creator.
        </p>
      </div>
      <div className="native-sync-banner-actions">
        <button className="button button-quiet" type="button" disabled={busy} onClick={onReload}>
          <RefreshCw size={14} />
          Ricarica da Tabletop Creator
        </button>
        <button className="button button-primary" type="button" disabled={busy} onClick={onOverwrite}>
          <Upload size={14} />
          Sovrascrivi Tabletop Creator
        </button>
      </div>
    </section>
  )
}
