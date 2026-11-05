import { FolderPlus } from 'lucide-react'

export function ChooserHeader({ hasProjects, onAdd }: { hasProjects: boolean; onAdd: () => void }) {
  return (
    <div className="chooser-header">
      <div>
        <div className="eyebrow">
          <span className="eyebrow-line" />
          TABLETOP CARD STUDIO
        </div>
        <h1>
          {hasProjects ? (
            <>
              Scegli il tuo
              <br />
              <em>tavolo di lavoro.</em>
            </>
          ) : (
            <>
              Le idee migliori
              <br />
              meritano <em>ordine.</em>
            </>
          )}
        </h1>
        <p>
          {hasProjects
            ? 'Riprendi un progetto salvato o aggiungine un altro dal computer o da GitHub.'
            : 'Apri una cartella Tabletop Creator o scarica un progetto GitHub per iniziare.'}
        </p>
        <button className="button button-primary welcome-button" onClick={onAdd}>
          <FolderPlus size={17} />
          Aggiungi cartella locale
        </button>
      </div>
      <div className="chooser-art">
        <div className="chooser-sun" />
        <div className="chooser-card chooser-card-back" />
        <div className="chooser-card chooser-card-front">
          <img src="./tabletop-mark.svg" alt="" />
          <span>
            IL PROSSIMO SET
            <br />
            COMINCIA QUI
          </span>
        </div>
      </div>
    </div>
  )
}
