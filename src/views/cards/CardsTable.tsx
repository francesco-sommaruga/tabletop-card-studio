import { useEffect, useRef } from 'react'
import { BookOpen, Plus, FileSpreadsheet } from 'lucide-react'
import type { Card, ColumnDefinition, ProjectAsset, ProjectVariable } from '../../types'
import { defaultTableColumnWidth, minimumTableColumnWidth, maximumTableColumnWidth } from '../../lib/tableColumns'
import type { CardFilters } from '../../hooks/useCardFilters'
import type { TableColumns } from '../../hooks/useTableColumns'
import type { CardSelection } from '../../hooks/useCardSelection'
import { useRowNavigation } from '../../hooks/useRowNavigation'
import { CardRow } from './CardRow'

/** Header checkbox: checked when every filtered card is selected, indeterminate when only some are. */
function SelectAllCheckbox({ selection, isDisabled }: { selection: CardSelection; isDisabled: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  const { headerState } = selection
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = headerState === 'some'
  }, [headerState])
  return (
    <span className="col-select">
      <input
        ref={ref}
        type="checkbox"
        className="select-all-checkbox"
        checked={headerState === 'all'}
        disabled={isDisabled}
        onChange={selection.toggleAll}
        aria-label="Seleziona tutte le carte filtrate"
      />
    </span>
  )
}

/** Sortable, resizable, selectable cards table with inline-editable cells, or the empty state. */
export function CardsTable({
  table,
  filters,
  selection,
  totalCount,
  project,
  onSaveField,
  onOpenCard,
  onAddCard,
  onImport,
}: {
  table: TableColumns
  filters: CardFilters
  selection: CardSelection
  totalCount: number
  project: { columns: ColumnDefinition[]; assets: ProjectAsset[]; variables: ProjectVariable[]; projectPath: string }
  onSaveField: (card: Card, fieldId: string, value: string) => void
  onOpenCard: (card: Card) => void
  onAddCard: () => void
  onImport: () => void
}) {
  const { visibleTableColumns, storedTableWidths } = table
  const { filteredCards, sortIndicator } = filters
  const rowNavigation = useRowNavigation(table.cardsTableRef, filteredCards, selection, onOpenCard)
  return (
    <div
      ref={table.cardsTableRef}
      className={`cards-table ${table.isColumnResizing() ? 'is-column-resizing' : ''} ${selection.count ? 'has-selection' : ''}`}
      style={table.tableGridStyle}
    >
      <div className="table-head">
        <SelectAllCheckbox selection={selection} isDisabled={!filteredCards.length} />
        {visibleTableColumns.map((column) => (
          <div key={column.fieldId} className="table-head-cell" data-field-id={column.fieldId}>
            <button
              type="button"
              className={`table-sort ${column.className}`}
              onClick={() => filters.toggleSort(column.fieldId)}
              aria-label={`Ordina per ${column.label}${sortIndicator(column.fieldId)}`}
              title={`Ordina per ${column.label}`}
            >
              {column.header.toLocaleUpperCase()}
              {sortIndicator(column.fieldId)}
            </button>
            <div
              className="table-resize-handle"
              role="separator"
              aria-orientation="vertical"
              aria-label={`Ridimensiona la colonna ${column.label}`}
              aria-valuenow={Math.round(
                storedTableWidths?.[column.fieldId] ?? defaultTableColumnWidth(column.fieldId, column.type),
              )}
              aria-valuemin={minimumTableColumnWidth(column.fieldId)}
              aria-valuemax={maximumTableColumnWidth}
              tabIndex={0}
              title="Trascina per ridimensionare · Frecce per regolare"
              onPointerDown={(event) => table.startColumnResize(column.fieldId, event)}
              onPointerMove={table.moveColumnResize}
              onPointerUp={(event) => table.finishColumnResize(event.pointerId)}
              onPointerCancel={(event) => table.finishColumnResize(event.pointerId)}
              onLostPointerCapture={(event) => table.finishColumnResize(event.pointerId)}
              onKeyDown={(event) => table.onColumnResizeKeyDown(column.fieldId, event)}
            />
          </div>
        ))}
        <span className="col-action" />
      </div>
      {filteredCards.length ? (
        filteredCards.map((card, index) => (
          <CardRow
            key={card.id}
            card={card}
            index={index}
            visibleColumns={visibleTableColumns}
            project={project}
            isSelected={selection.isSelected(card.id)}
            navigation={rowNavigation(card, index)}
            onToggleSelect={(isRange) => selection.toggle(card.id, isRange)}
            onSaveField={onSaveField}
            onOpen={onOpenCard}
          />
        ))
      ) : (
        <div className="empty-list">
          <div className="empty-mark">
            <BookOpen size={21} />
          </div>
          <strong>{filters.hasActiveFilters ? 'Nessuna carta corrisponde.' : 'Il set comincia da qui.'}</strong>
          <span>
            {totalCount
              ? 'Prova a cambiare i filtri oppure aggiungi una carta.'
              : 'Importa un foglio o crea una nuova carta.'}
          </span>
          {!totalCount && (
            <div className="empty-actions">
              <button className="button button-primary" onClick={onAddCard}>
                <Plus size={15} />
                Crea carta
              </button>
              <button className="text-button" onClick={onImport}>
                <FileSpreadsheet size={15} />
                Importa Excel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
