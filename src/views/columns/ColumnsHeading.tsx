import { ArrowDownToLine, Braces } from 'lucide-react'

export function ColumnsHeading({
  blueprintName,
  sharedSetCount,
  fieldCount,
  dirty,
  onExport,
}: {
  blueprintName?: string
  sharedSetCount: number
  fieldCount: number
  dirty: boolean
  onExport: () => void
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            {blueprintName ? `BLUEPRINT · ${blueprintName.toLocaleUpperCase()}` : 'CAMPI DEL SET'}
          </div>
          <h1>
            Campi del set<span className="heading-period">.</span>
          </h1>
          <p>
            Definisci il campo del set Tabletop Creator, il nome mostrato nell’editor Card Studio e il tipo di dato.
          </p>
        </div>
        <button
          className="button button-primary add-button"
          onClick={onExport}
          disabled={dirty}
          title={dirty ? 'Salva i campi prima di esportare' : 'Esporta set'}
        >
          <ArrowDownToLine size={16} />
          Esporta set
        </button>
      </div>
      <section className="schema-intro">
        <div className="schema-icon">
          <Braces size={20} />
        </div>
        <div>
          <strong>
            {blueprintName
              ? `Campi condivisi con ${sharedSetCount} set che usano ${blueprintName}.`
              : 'Questo set ha campi indipendenti.'}
          </strong>
          <p>
            A sinistra indichi il nome del campo nel set Tabletop Creator. A destra scegli il campo e il nome da
            mostrare in Card Studio, poi imposti il tipo di dato.
            {!blueprintName && ' Per condividerli, assegna un blueprint nelle Impostazioni progetto.'}
          </p>
        </div>
        <div className="schema-badge">
          <span className="live-dot" />
          {fieldCount} CAMPI
        </div>
      </section>
    </>
  )
}
