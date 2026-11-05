import { Sparkles, EyeOff } from 'lucide-react'
import type { ColumnDefinition } from '../../types'

export function AutomationSummary({ columns }: { columns: ColumnDefinition[] }) {
  const automaticFields = columns.filter((column) => column.rules?.length)
  const automaticRuleCount = automaticFields.reduce((sum, column) => sum + (column.rules?.length ?? 0), 0)
  const hiddenFieldCount = columns.filter((column) => column.hidden).length
  if (!(automaticRuleCount > 0 || hiddenFieldCount > 0)) return null
  return (
    <section className="automation-summary" aria-label="Riepilogo automazioni e visibilità">
      <span className="automation-summary-icon">
        <Sparkles size={16} />
      </span>
      <span className="automation-summary-copy">
        <strong>
          {automaticRuleCount > 0
            ? `${automaticRuleCount} ${automaticRuleCount === 1 ? 'regola automatica' : 'regole automatiche'} in ${automaticFields.length} ${automaticFields.length === 1 ? 'campo' : 'campi'}`
            : `${hiddenFieldCount} ${hiddenFieldCount === 1 ? 'campo nascosto' : 'campi nascosti'}`}
        </strong>
        <small>
          {hiddenFieldCount > 0
            ? `${hiddenFieldCount} ${hiddenFieldCount === 1 ? 'campo nascosto nell’editor carte' : 'campi nascosti nell’editor carte'}`
            : 'I campi automatici si aggiornano quando cambiano le sorgenti.'}
        </small>
      </span>
      {hiddenFieldCount > 0 && (
        <span className="automation-summary-hidden">
          <EyeOff size={12} />
          {hiddenFieldCount} nascosti
        </span>
      )}
    </section>
  )
}
