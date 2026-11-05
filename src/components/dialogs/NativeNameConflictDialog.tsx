import { useState } from 'react'
import { CircleAlert, ArrowRight } from 'lucide-react'

export function NativeNameConflictDialog({
  cmsName,
  nativeName,
  onResolve,
}: {
  cmsName: string
  nativeName: string
  onResolve: (resolution: 'card-studio' | 'tabletop') => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const resolve = (choice: 'card-studio' | 'tabletop') => {
    setBusy(true)
    void onResolve(choice).finally(() => setBusy(false))
  }
  return (
    <>
      <div className="scrim conflict-scrim" />
      <section
        className="native-set-link-panel name-conflict-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-conflict-title"
      >
        <div className="editor-head">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />
              NOMI SET NON ALLINEATI
            </div>
            <h2 id="name-conflict-title">Quale nome teniamo?</h2>
          </div>
          <span className="native-link-icon">
            <CircleAlert size={18} />
          </span>
        </div>
        <p>Il set collegato ha due nomi. Scegli quale usare: l’altro verrà sincronizzato.</p>
        <div className="name-conflict-values">
          <div>
            <small>CARD STUDIO</small>
            <strong>{cmsName}</strong>
          </div>
          <ArrowRight size={16} />
          <div>
            <small>TABLETOP CREATOR</small>
            <strong>{nativeName}</strong>
          </div>
        </div>
        <footer className="native-link-footer">
          <button className="button button-quiet" disabled={busy} onClick={() => resolve('tabletop')}>
            Usa “{nativeName}”
          </button>
          <button className="button button-primary" disabled={busy} onClick={() => resolve('card-studio')}>
            Usa “{cmsName}”
          </button>
        </footer>
      </section>
    </>
  )
}
