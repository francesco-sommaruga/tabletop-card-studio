import { FileImage } from 'lucide-react'
import type { ProjectVariable, TabletopBlueprintPanel, Card, ColumnDefinition, ProjectAsset } from '../../types'
import { VariableTextPreview } from '../fields/VariableTextPreview'
import {
  renderBlueprintText,
  parseBlueprintVector,
  cardPanelValue,
  normalizeBlueprintHorizontalAlignment,
  normalizeBlueprintVerticalAlignment,
} from '../../lib/blueprint'
import { resolvePreviewReference, variableIconTint } from '../../lib/variables'
import { findPreviewAsset, isImageReference } from '../../lib/assets'
import { IconPreview } from '../fields/IconPreview'

function BlueprintTextPanelContent({
  value,
  variables,
  projectPath,
}: {
  value: string
  variables: ProjectVariable[]
  projectPath: string
}) {
  const iconToken = [...value.matchAll(/\{\s*([^{}]+?)\s*\}/g)].some(([, code]) =>
    variables.some(
      (variable) => variable.studioType === 'icon' && variable.code.toLocaleLowerCase() === code.toLocaleLowerCase(),
    ),
  )
  return iconToken ? (
    <VariableTextPreview
      value={value}
      variables={variables}
      projectPath={projectPath}
      className="blueprint-variable-inline"
      inline
    />
  ) : (
    <span className="blueprint-rich-text" dangerouslySetInnerHTML={{ __html: renderBlueprintText(value, variables) }} />
  )
}

export function BlueprintPanelPreview({
  panel,
  card,
  columns,
  assets,
  variables,
  projectPath,
  canvasWidth,
  canvasHeight,
}: {
  panel: TabletopBlueprintPanel
  card: Card
  columns: ColumnDefinition[]
  assets: ProjectAsset[]
  variables: ProjectVariable[]
  projectPath: string
  canvasWidth: number
  canvasHeight: number
}) {
  const data = panel.data ?? {}
  const [x, y] = parseBlueprintVector(data.layout_position, [0, 0])
  const [width, height] = parseBlueprintVector(data.layout_size, [canvasWidth, canvasHeight])
  const top = y
  const panelValue = cardPanelValue(card, columns, panel.name, 'value') ?? data.value ?? ''
  const color = cardPanelValue(card, columns, panel.name, 'color') ?? data.color ?? '#292929FF'
  const backgroundColor =
    cardPanelValue(card, columns, panel.name, 'background_color') ?? data.background_color ?? 'transparent'
  const rotation = Number.parseFloat(data.layout_rotation ?? '0') || 0
  const fontSize = Number.parseFloat(data.text_size ?? '2.5') || 2.5
  const fontFamily = data.text_font || 'sans-serif'
  const uniformRadius = Math.max(0, Number.parseFloat(data.procedural_rectangle_radius ?? '0') || 0)
  const borderWidth = Math.max(0, Number.parseFloat(data.procedural_border ?? '0') || 0)
  const corner = (key: string) =>
    Math.max(0, Number.parseFloat(data[`procedural_rectangle_radius_${key}`] ?? '') || uniformRadius)
  const topLeft = corner('tl'),
    topRight = corner('tr'),
    bottomRight = corner('br'),
    bottomLeft = corner('bl')
  const mediaRadius = `${Number.parseFloat(data.img_mask_radius_tl ?? '0') || 0}px ${Number.parseFloat(data.img_mask_radius_tr ?? '0') || 0}px ${Number.parseFloat(data.img_mask_radius_br ?? '0') || 0}px ${Number.parseFloat(data.img_mask_radius_bl ?? '0') || 0}px`
  const proceduralPath = `M ${x + topLeft} ${top} L ${x + width - topRight} ${top} Q ${x + width} ${top} ${x + width} ${top + topRight} L ${x + width} ${top + height - bottomRight} Q ${x + width} ${top + height} ${x + width - bottomRight} ${top + height} L ${x + bottomLeft} ${top + height} Q ${x} ${top + height} ${x} ${top + height - bottomLeft} L ${x} ${top + topLeft} Q ${x} ${top} ${x + topLeft} ${top} Z`
  const proceduralFill = borderWidth > 0 ? 'transparent' : color
  const panelType = data.panel_type ?? 'text'
  const rotationTransform = rotation ? `rotate(${rotation}, ${x + width / 2}, ${top + height / 2})` : undefined
  const style = { overflow: 'hidden' as const, boxSizing: 'border-box' as const }
  if (panelType === 'text') {
    const horizontal = normalizeBlueprintHorizontalAlignment(data.text_alignment_h)
    const vertical = normalizeBlueprintVerticalAlignment(data.text_alignment_v)
    return (
      <foreignObject x={x} y={top} width={width} height={height} transform={rotationTransform}>
        <div
          className={`blueprint-text-panel align-${horizontal} valign-${vertical}`}
          style={{
            ...style,
            color,
            fontFamily,
            fontSize,
            fontWeight: data.text_bold?.toLowerCase() === 'true' ? 'bold' : 'normal',
            textAlign: horizontal === 'justify' ? 'justify' : horizontal,
            WebkitLineClamp: data.text_autosize?.toLowerCase() === 'true' ? 8 : undefined,
          }}
        >
          <BlueprintTextPanelContent value={panelValue} variables={variables} projectPath={projectPath} />
        </div>
      </foreignObject>
    )
  }
  if (panelType === 'procedural')
    return (
      <g transform={rotationTransform}>
        <path
          d={proceduralPath}
          fill={proceduralFill}
          stroke={borderWidth > 0 ? color : 'none'}
          strokeWidth={borderWidth}
          strokeLinejoin="round"
        />
      </g>
    )
  if (panelType === 'image' || panelType === 'icon') {
    const { reference, variable } = resolvePreviewReference(panelValue, variables)
    const asset = findPreviewAsset(reference, assets)
    const icon =
      panelType === 'icon' ||
      variable?.studioType === 'icon' ||
      (!asset && !isImageReference(reference) && /[/{}]/.test(reference))
    const tint = variable?.studioType === 'icon' ? variableIconTint(variable, color) : color
    return (
      <foreignObject x={x} y={top} width={width} height={height} transform={rotationTransform}>
        <div
          className="blueprint-media-panel"
          style={{ ...style, backgroundColor, borderRadius: mediaRadius }}
          title={reference}
        >
          {icon ? (
            <IconPreview reference={reference} projectPath={projectPath} className="blueprint-panel-icon" tint={tint} />
          ) : asset ? (
            <img
              src={asset.previewUrl}
              alt=""
              style={{ objectFit: data.img_fit_mode === 'fill' ? 'cover' : 'contain' }}
            />
          ) : (
            <span className="blueprint-media-missing">
              <FileImage size={16} />
            </span>
          )}
        </div>
      </foreignObject>
    )
  }
  return (
    <foreignObject x={x} y={top} width={width} height={height}>
      <div className="blueprint-unsupported-panel">{panelType}</div>
    </foreignObject>
  )
}
