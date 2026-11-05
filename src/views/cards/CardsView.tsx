import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { Plus } from 'lucide-react'
import type { Card, ProjectSnapshot } from '../../types'
import type { SetSummary } from '../../hooks/useProjectSession'
import type { CardFilters } from '../../hooks/useCardFilters'
import type { TableColumns } from '../../hooks/useTableColumns'
import type { CommitCardsOptions } from '../../hooks/useCardMutations'
import { useCardSelection } from '../../hooks/useCardSelection'
import { CardsOverview } from './CardsOverview'
import { CardsToolbar } from './CardsToolbar'
import { CardsTable } from './CardsTable'
import { NativeSyncBanner } from '../../components/sync/NativeSyncBanner'
import type { NativeSync } from '../../hooks/useNativeSync'
import { BulkActionBar } from './BulkActionBar'

/** Ctrl/Cmd+F focuses the search box (after `beforeFocus`), unless a dialog or the card editor is open. */
function useFindShortcut(searchRef: RefObject<HTMLInputElement>, beforeFocus: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isFind =
        (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'f'
      if (!isFind || document.querySelector('.scrim')) return
      event.preventDefault()
      beforeFocus()
      requestAnimationFrame(() => searchRef.current?.select())
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [searchRef, beforeFocus])
}

/** The active set's cards page: heading, stats strip, archive toolbar (or bulk actions) and table. */
export function CardsView({
  snapshot,
  activeSet,
  filters,
  table,
  onAddCard,
  onImport,
  onSaveField,
  onOpenCard,
  sync,
  onCommitCards,
}: {
  snapshot: ProjectSnapshot
  activeSet: SetSummary
  filters: CardFilters
  table: TableColumns
  onAddCard: () => void
  onImport: () => void
  onSaveField: (card: Card, fieldId: string, value: string) => void
  onOpenCard: (card: Card) => void
  sync: NativeSync
  onCommitCards: (next: Card[], options: CommitCardsOptions) => unknown
}) {
  const { cards } = snapshot
  const searchRef = useRef<HTMLInputElement>(null)
  const { search, filterStatus, activeTag, propertyFilterField, propertyFilterValue } = filters
  const resetKey = JSON.stringify([
    snapshot.activeSetId,
    search,
    filterStatus,
    activeTag,
    propertyFilterField,
    propertyFilterValue,
  ])
  const selection = useCardSelection(filters.filteredCards, resetKey)
  useFindShortcut(searchRef, selection.clear)
  return (
    <div className="page-content">
      {snapshot.nativeSync[activeSet.id] === 'conflict' && (
        <NativeSyncBanner
          setName={activeSet.name}
          busy={sync.isResolving}
          onReload={() => void sync.resolve(activeSet.id, 'reload')}
          onOverwrite={() => void sync.resolve(activeSet.id, 'overwrite')}
        />
      )}
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
      <CardsToolbar
        filters={filters}
        table={table}
        totalCount={cards.length}
        searchRef={searchRef}
        bulkBar={
          selection.count > 0 && (
            <BulkActionBar
              cards={cards}
              columns={snapshot.columns}
              variables={snapshot.variables}
              setTags={filters.tags.map(([tag]) => tag)}
              selection={selection}
              onCommit={(next, label) => void onCommitCards(next, { label })}
            />
          )
        }
      />
      <CardsTable
        table={table}
        filters={filters}
        selection={selection}
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
