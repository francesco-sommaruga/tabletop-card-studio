import { Tag, X, Search, ChevronDown } from 'lucide-react'
import { statuses } from '../../lib/tableColumns'
import type { CardFilters } from '../../hooks/useCardFilters'
import type { TableColumns } from '../../hooks/useTableColumns'
import { ColumnsMenu } from './ColumnsMenu'

/** "Archivio" toolbar: result count, active tag chip, search, status/property filters, columns menu. */
export function CardsToolbar({
  filters,
  table,
  totalCount,
}: {
  filters: CardFilters
  table: TableColumns
  totalCount: number
}) {
  const { activeTag, propertyFilterField } = filters
  return (
    <div className="list-toolbar">
      <div className="list-title">
        <h2>Archivio</h2>
        <span>
          {filters.filteredCards.length} di {totalCount} {totalCount === 1 ? 'carta' : 'carte'}
        </span>
        {activeTag && (
          <button className="active-filter" onClick={() => filters.setActiveTag('')}>
            <Tag size={12} />
            {activeTag}
            <X size={12} />
          </button>
        )}
      </div>
      <div className="list-controls">
        <label className="search-box">
          <Search size={15} />
          <input
            value={filters.search}
            onChange={(event) => filters.setSearch(event.target.value)}
            placeholder="Cerca una carta…"
          />
        </label>
        <label className="select-wrap" title="Filtra per stato">
          <select value={filters.filterStatus} onChange={(event) => filters.setFilterStatus(event.target.value)}>
            <option>Tutti gli stati</option>
            {statuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
        <label className="select-wrap" title="Filtra per campo">
          <select
            value={propertyFilterField}
            onChange={(event) => {
              filters.setPropertyFilterField(event.target.value)
              filters.setPropertyFilterValue('')
            }}
          >
            <option value="">Filtra campo…</option>
            <option value="meta_tags">Tag</option>
            {filters.listColumns.map((column) => (
              <option key={column.id} value={column.fieldId}>
                {column.header}
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
        {propertyFilterField && (
          <label className="select-wrap" title="Valore del filtro">
            <select
              value={filters.propertyFilterValue}
              onChange={(event) => filters.setPropertyFilterValue(event.target.value)}
            >
              <option value="">Tutti i valori</option>
              {filters.propertyFilterOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </label>
        )}
        <ColumnsMenu table={table} />
      </div>
    </div>
  )
}
