import { useState } from 'react'
import { X } from 'lucide-react'
import type { Card, ColumnDefinition, TabletopBlueprint, ProjectAsset, ProjectVariable } from '../../types'
import { blueprintGroups, parseBlueprintVector, cardPanelValue } from '../../lib/blueprint'
import { resolvePreviewReference } from '../../lib/variables'
import { isImageReference, findPreviewAsset } from '../../lib/assets'
import { BlueprintPanelPreview } from './BlueprintPanelPreview'

export function CardBlueprintPreview({
  card,
  columns,
  blueprints,
  blueprintName,
  assets,
  variables,
  projectPath,
  onClose,
}: {
  card: Card
  columns: ColumnDefinition[]
  blueprints: TabletopBlueprint[]
  blueprintName: string
  assets: ProjectAsset[]
  variables: ProjectVariable[]
  projectPath: string
  onClose: () => void
}) {
  const blueprint = blueprints.find((item) => item.name === blueprintName)
  const [side, setSide] = useState<'front' | 'back'>('front')
  const groups = blueprint ? blueprintGroups(blueprint, side) : []
  const panels = groups.flatMap((group) => group.panels ?? [])
  const [width, height] = parseBlueprintVector(blueprint?.layout_size_mm, [63.5, 88.9])
  const radius = Number.parseFloat(blueprint?.shape_settings?.radius ?? '3') || 3
  const hasBack = Boolean(blueprint && blueprintGroups(blueprint, 'back').length)
  const missingImages = panels
    .filter((panel) => panel.data.panel_type === 'image')
    .filter((panel) => {
      const value = cardPanelValue(card, columns, panel.name, 'value') ?? panel.data.value ?? ''
      if (!value) return false
      const { reference, variable } = resolvePreviewReference(value, variables)
      return variable?.studioType !== 'icon' && isImageReference(reference) && !findPreviewAsset(reference, assets)
    })
    .map((panel) => panel.name)
  const unsupported = [
    ...new Set(
      panels
        .map((panel) => panel.data.panel_type)
        .filter((type) => type && !['text', 'image', 'icon', 'procedural'].includes(type)),
    ),
  ]
  return (
    <>
      <button className="scrim blueprint-preview-scrim" aria-label="Chiudi anteprima carta" onClick={onClose} />
      <section
        className="blueprint-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="blueprint-preview-title"
      >
        <header className="preview-modal-head">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />
              ANTEPRIMA TABLETOP CREATOR
            </div>
            <h2 id="blueprint-preview-title">{card.title}</h2>
          </div>
          <button className="icon-button close-editor" onClick={onClose} aria-label="Chiudi anteprima">
            <X size={18} />
          </button>
        </header>
        <div className="preview-modal-toolbar">
          <div className="preview-blueprint-lock">
            <span>BLUEPRINT DEL SET</span>
            <strong>{blueprint?.name ?? 'Nessun blueprint assegnato'}</strong>
          </div>
          {hasBack && (
            <div className="preview-side-toggle" role="group" aria-label="Lato carta">
              <button className={side === 'front' ? 'active' : ''} onClick={() => setSide('front')}>
                Fronte
              </button>
              <button className={side === 'back' ? 'active' : ''} onClick={() => setSide('back')}>
                Retro
              </button>
            </div>
          )}
        </div>
        <div className="preview-card-stage">
          {blueprint ? (
            <svg
              className="blueprint-card-svg"
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={`Anteprima ${side === 'front' ? 'fronte' : 'retro'} di ${card.title}`}
            >
              <defs>
                <clipPath id="blueprint-preview-clip">
                  <rect x="0" y="0" width={width} height={height} rx={radius} ry={radius} />
                </clipPath>
              </defs>
              <rect x="0" y="0" width={width} height={height} fill="#e6dfd3" rx={radius} ry={radius} />
              <g clipPath="url(#blueprint-preview-clip)">
                {[...panels].reverse().map((panel, index) => (
                  <BlueprintPanelPreview
                    key={`${panel.name}-${index}`}
                    panel={panel}
                    card={card}
                    columns={columns}
                    assets={assets}
                    variables={variables}
                    projectPath={projectPath}
                    canvasWidth={width}
                    canvasHeight={height}
                  />
                ))}
              </g>
              <rect
                x="0.2"
                y="0.2"
                width={width - 0.4}
                height={height - 0.4}
                fill="none"
                stroke="#30271f38"
                strokeWidth="0.4"
                rx={radius}
                ry={radius}
              />
            </svg>
          ) : (
            <span>
              {blueprintName
                ? `Blueprint “${blueprintName}” non trovato nel progetto.`
                : 'Assegna un blueprint al set nelle Impostazioni progetto.'}
            </span>
          )}
        </div>
        <footer className="preview-modal-foot">
          <span>
            <strong>{blueprint?.name}</strong> · {width} × {height} mm · {panels.length} pannelli
            {unsupported.length ? ` · non supportati: ${unsupported.join(', ')}` : ''}
          </span>
          {missingImages.length > 0 && (
            <small className="preview-missing-assets">
              Immagini non trovate: {missingImages.join(', ')}. Assegna un’immagine della libreria per visualizzarla.
            </small>
          )}
          <small>Rendering ricostruito dai dati del progetto; verifica i dettagli in Tabletop Creator.</small>
        </footer>
      </section>
    </>
  )
}
