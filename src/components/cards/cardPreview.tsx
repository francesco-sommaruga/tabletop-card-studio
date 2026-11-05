import type { Card, ColumnDefinition, ProjectAsset, ProjectVariable } from '../../types'
import { VariableTextPreview } from '../fields/VariableTextPreview'

export function preview(
  card: Card,
  columns: ColumnDefinition[],
  assets: ProjectAsset[],
  variables: ProjectVariable[],
  projectPath: string,
) {
  const textColumn = columns.find(
    (column) => /text|effetto|description|descrizione/i.test(column.header) && column.type !== 'image',
  )
  const text = textColumn
    ? card.values[textColumn.fieldId]
    : Object.values(card.values).find((value) => value.trim() && value !== card.title)
  const image = columns.find((column) => column.type === 'image' && card.values[column.fieldId])
  const asset = image ? assets.find((item) => item.path === card.values[image.fieldId]) : undefined
  const plainText =
    text
      ?.replace(/<[^>]*>/g, '')
      .trim()
      .slice(0, 78) ?? ''
  const renderedText = /\{[^{}]+\}/.test(plainText) ? (
    <VariableTextPreview
      value={plainText}
      variables={variables}
      projectPath={projectPath}
      className="row-variable-preview"
      inline
    />
  ) : (
    plainText
  )
  return (
    <>
      {asset && <img className="row-thumb" src={asset.previewUrl} alt="" />}
      {renderedText || (asset ? asset.name : 'Nessuna descrizione aggiunta')}
    </>
  )
}
