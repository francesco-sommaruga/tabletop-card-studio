import { Plus } from 'lucide-react'
import type { Card, ProjectSnapshot } from '../../types'
import type { SetSummary } from '../../hooks/useProjectSession'
import type { CardFilters } from '../../hooks/useCardFilters'
import type { TableColumns } from '../../hooks/useTableColumns'
import { CardsOverview } from './CardsOverview'
import { CardsToolbar } from './CardsToolbar'
import { CardsTable } from './CardsTable'

/** The active set's cards page: heading, stats strip, archive toolbar and table. */
export function CardsView({
  snapshot,
  activeSet,
  filters,
  table,
  onAddCard,
  onImport,
  onSaveField,
  onOpenCard,
}: {
  snapshot: ProjectSnapshot
  activeSet: SetSummary
  filters: CardFilters
  table: TableColumns
  onAddCard: () => void
  onImport: () => void
  onSaveField: (card: Card, fieldId: string, value: string) => void
  onOpenCard: (card: Card) => void
}) {
  const { cards } = snapshot
  return (
    <div className="page-content">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            SET · {activeSet.name.toLocaleUpperCase()}
          </div>
          <h1>
            Le tue carte<span className="heading-period">.</span>
          </h1>
          <p>
            {activeSet.nativeSetFile
              ? `Collegato al set nativo data/sets/${activeSet.nativeSetFile}.`
              : activeSet.sourceFile
                ? `Importate da ${activeSet.sourceFile}.`
                : 'Un tavolo ordinato per le idee in movimento.'}
          </p>
        </div>
        <button className="button button-primary add-button" onClick={onAddCard}>
          <Plus size={17} />
          Nuova carta
        </button>
      </div>
      <CardsOverview cards={cards} setCount={snapshot.sets.length} workbookCount={snapshot.workbooks.length} />
      <CardsToolbar filters={filters} table={table} totalCount={cards.length} />
      <CardsTable
        table={table}
        filters={filters}
        totalCount={cards.length}
        project={{
          columns: snapshot.columns,
          assets: snapshot.assets,
          variables: snapshot.variables,
          projectPath: snapshot.projectPath,
        }}
        onSaveField={onSaveField}
        onOpenCard={onOpenCard}
        onAddCard={onAddCard}
        onImport={onImport}
      />
      <footer className="page-foot">
        <span>
          <span className="live-dot" />
          SALVATAGGIO AUTOMATICO
        </span>
        <span>{snapshot.projectPath}</span>
      </footer>
    </div>
  )
}
