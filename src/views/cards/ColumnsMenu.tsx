import { Columns3 } from 'lucide-react'
import type { TableColumns } from '../../hooks/useTableColumns'

/** "Colonne" popover that toggles which columns the cards table shows. */
export function ColumnsMenu({ table }: { table: TableColumns }) {
  const { columnsMenuOpen, setColumnsMenuOpen, availableTableColumns, visibleTableColumnIds } = table
  return (
    <div className="table-columns-menu">
      <button
        type="button"
        className={`table-columns-trigger ${columnsMenuOpen ? 'active' : ''}`}
        onClick={() => setColumnsMenuOpen((open) => !open)}
        aria-expanded={columnsMenuOpen}
      >
        <Columns3 size={14} />
        Colonne <span>{table.visibleTableColumns.length}</span>
      </button>
      {columnsMenuOpen && (
        <section className="table-columns-popover" aria-label="Colonne visibili">
          <header>
            <strong>Colonne visibili</strong>
            <button type="button" onClick={table.resetTableColumns}>
              Predefinite
            </button>
          </header>
          <div>
            {availableTableColumns.map((column) => (
              <label key={column.fieldId}>
                <input
                  type="checkbox"
                  checked={visibleTableColumnIds.includes(column.fieldId)}
                  onChange={() => table.toggleTableColumn(column.fieldId)}
                />
                <span>{column.label}</span>
              </label>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
