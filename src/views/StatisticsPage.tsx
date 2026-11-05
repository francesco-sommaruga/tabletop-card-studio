import { useState, useMemo } from 'react'
import { ChevronDown, BarChart3 } from 'lucide-react'
import type { Card, ColumnDefinition } from '../types'
import { internalFieldName } from '../lib/tableColumns'
import { makeDistribution } from '../lib/stats'

export function StatisticsPage({ cards, columns }: { cards: Card[]; columns: ColumnDefinition[] }) {
  const dimensions = [
    { id: 'meta_tags', label: 'Tag delle carte', type: 'tags' },
    { id: 'meta_status', label: 'Stato di lavorazione', type: 'category' },
    { id: 'meta_quantity', label: 'Quantità per carta', type: 'number' },
    ...columns
      .filter(
        (column) =>
          !['meta_title', 'meta_quantity', 'meta_status', 'meta_tags'].includes(column.fieldId) &&
          column.type !== 'image',
      )
      .filter((column, index, all) => all.findIndex((item) => item.fieldId === column.fieldId) === index)
      .map((column) => ({
        id: column.fieldId,
        label: internalFieldName(column),
        type: column.type === 'number' ? 'number' : 'category',
      })),
  ]
  const [fieldId, setFieldId] = useState('meta_tags')
  const [groupBy, setGroupBy] = useState('')
  const [measure, setMeasure] = useState<'cards' | 'copies'>('cards')
  const dimension = dimensions.find((item) => item.id === fieldId) ?? dimensions[0]
  const groupDimension = dimensions.find((item) => item.id === groupBy && item.id !== fieldId)
  const distribution = useMemo(
    () => makeDistribution(cards, fieldId, dimension?.type ?? 'tags', groupDimension?.id, groupDimension?.type),
    [cards, fieldId, dimension?.type, groupDimension?.id, groupDimension?.type],
  )
  const totalCopies = cards.reduce((sum, card) => sum + (Number.isFinite(card.quantity) ? card.quantity : 0), 0)
  const uniqueTags = new Set(cards.flatMap((card) => card.tags)).size
  const maximum = Math.max(...distribution.map((item) => (measure === 'cards' ? item.count : item.copies)), 1)
  const denominator = measure === 'cards' ? cards.length : totalCopies
  const visible = distribution.slice(0, 12)
  return (
    <div className="page-content stats-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            ANALISI DEL SET
          </div>
          <h1>
            Statistiche<span className="heading-period">.</span>
          </h1>
          <p>Esplora tag e proprietà delle {cards.length} carte del set attivo.</p>
        </div>
        <div className="stats-controls">
          <label className="stats-dimension-select">
            <span>ANALIZZA PER</span>
            <div>
              <select value={fieldId} onChange={(event) => setFieldId(event.target.value)}>
                {dimensions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </div>
          </label>
          <label className="stats-dimension-select">
            <span>INCROCIA CON</span>
            <div>
              <select value={groupDimension?.id ?? ''} onChange={(event) => setGroupBy(event.target.value)}>
                <option value="">Nessun incrocio</option>
                {dimensions
                  .filter((item) => item.id !== fieldId)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
              </select>
              <ChevronDown size={14} />
            </div>
          </label>
        </div>
      </div>
      <section className="stats-summary">
        <div>
          <span className="metric-label">CARTE NEL SET</span>
          <strong>{cards.length}</strong>
        </div>
        <div>
          <span className="metric-label">COPIE TOTALI</span>
          <strong>{totalCopies}</strong>
        </div>
        <div>
          <span className="metric-label">TAG UNICI</span>
          <strong>{uniqueTags}</strong>
        </div>
        <div className="stats-summary-note">
          <BarChart3 size={17} />
          <span>
            Distribuzione basata sui dati
            <br />
            delle carte salvate nel set.
          </span>
        </div>
      </section>
      <section className="distribution-panel">
        <div className="distribution-heading">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />
              DISTRIBUZIONE
            </div>
            <h2>
              {dimension?.label ?? 'Valori'}
              {groupDimension ? ` × ${groupDimension.label}` : ''}
            </h2>
            <p>
              {groupDimension
                ? `Incrocio tra ${dimension?.label.toLowerCase()} e ${groupDimension.label.toLowerCase()}. `
                : ''}
              {fieldId === 'meta_tags'
                ? 'Una carta con più tag compare in ogni tag assegnato.'
                : dimension?.type === 'number' && !groupDimension
                  ? 'Le proprietà numeriche sono raggruppate per valore o intervallo.'
                  : 'Conteggio delle carte per ciascun valore.'}{' '}
              La misura selezionata considera {measure === 'cards' ? 'carte uniche' : 'copie (quantità delle carte)'}.
            </p>
          </div>
          <div className="distribution-tools">
            <div className="stats-measure-toggle" role="group" aria-label="Misura del grafico">
              <button className={measure === 'cards' ? 'active' : ''} onClick={() => setMeasure('cards')}>
                Carte uniche
              </button>
              <button className={measure === 'copies' ? 'active' : ''} onClick={() => setMeasure('copies')}>
                Copie
              </button>
            </div>
            <span className="distribution-total">
              {distribution.length} {distribution.length === 1 ? 'valore' : 'valori'}
            </span>
          </div>
        </div>
        {visible.length ? (
          <div className="distribution-chart">
            {visible.map((item) => (
              <div className="distribution-row" key={item.label}>
                <span className="distribution-label" title={item.label}>
                  {item.label}
                </span>
                <div className="distribution-track">
                  <span
                    style={{
                      width: `${Math.max(((measure === 'cards' ? item.count : item.copies) / maximum) * 100, (measure === 'cards' ? item.count : item.copies) ? 1.5 : 0)}%`,
                    }}
                  />
                </div>
                <strong>{measure === 'cards' ? item.count : item.copies}</strong>
                <small>
                  {denominator
                    ? `${Math.round(((measure === 'cards' ? item.count : item.copies) / denominator) * 100)}%`
                    : '0%'}
                </small>
              </div>
            ))}
            {distribution.length > visible.length && (
              <div className="chart-overflow">Mostrati i primi 12 di {distribution.length} valori</div>
            )}
          </div>
        ) : (
          <div className="stats-empty">
            <BarChart3 size={21} />
            <strong>Nessun dato da rappresentare.</strong>
            <span>Compila questo campo in una o più carte per generare il grafico.</span>
          </div>
        )}
      </section>
      <div className="stats-foot">
        <span>
          <span className="live-dot" />
          DATI DEL SET ATTIVO
        </span>
        <span>Le modifiche alle carte aggiornano automaticamente queste statistiche.</span>
      </div>
    </div>
  )
}
