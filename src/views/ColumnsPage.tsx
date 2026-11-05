import type { ColumnDefinition, ProjectAsset, ProjectVariable, TabletopBlueprint } from '../types'
import { useColumnDraft } from './columns/useColumnDraft'
import { useBlueprintFields } from './columns/useBlueprintFields'
import { ColumnsHeading } from './columns/ColumnsHeading'
import { BlueprintFieldsSection } from './columns/BlueprintFieldsSection'
import { AutomationSummary } from './columns/AutomationSummary'
import { SchemaTitleRow } from './columns/SchemaTitleRow'
import { SchemaList } from './columns/SchemaList'
import { AddFieldComposer } from './columns/AddFieldComposer'
import { SchemaBottomBar } from './columns/SchemaBottomBar'

export function ColumnsPage({
  columns,
  assets,
  variables,
  blueprintName,
  blueprint,
  sharedSetCount,
  onReloadBlueprints,
  onSave,
  onDirty,
  onExport,
}: {
  columns: ColumnDefinition[]
  assets: ProjectAsset[]
  variables: ProjectVariable[]
  blueprintName?: string
  blueprint?: TabletopBlueprint
  sharedSetCount: number
  onReloadBlueprints: () => Promise<void>
  onSave: (columns: ColumnDefinition[]) => void
  onDirty: (dirty: boolean) => void
  onExport: () => void
}) {
  const { draftColumns, setDraftColumns, dirty, edit, remove, duplicate } = useColumnDraft(columns, onDirty)
  const { blueprintFields, blueprintImportMessage, importBlueprintFields, addBlueprintField } = useBlueprintFields(
    blueprintName,
    blueprint,
    draftColumns,
    setDraftColumns,
  )
  return (
    <div className="page-content columns-content">
      <ColumnsHeading
        blueprintName={blueprintName}
        sharedSetCount={sharedSetCount}
        fieldCount={draftColumns.length}
        dirty={dirty}
        onExport={onExport}
      />
      <BlueprintFieldsSection
        blueprintName={blueprintName}
        fields={blueprintFields}
        message={blueprintImportMessage}
        onAdd={addBlueprintField}
      />
      <AutomationSummary columns={draftColumns} />
      <SchemaTitleRow
        dirty={dirty}
        blueprintName={blueprintName}
        missingBlueprintFieldCount={blueprintFields.length}
        fieldCount={draftColumns.length}
        onReloadBlueprints={onReloadBlueprints}
        onImportBlueprintFields={importBlueprintFields}
      />
      <SchemaList
        columns={draftColumns}
        assets={assets}
        variables={variables}
        onChange={setDraftColumns}
        onEdit={edit}
        onRemove={remove}
        onDuplicate={duplicate}
      />
      <AddFieldComposer
        columns={draftColumns}
        variables={variables}
        onAdd={(column) => setDraftColumns([...draftColumns, column])}
      />
      <SchemaBottomBar
        dirty={dirty}
        onDiscard={() => {
          setDraftColumns(columns)
          onDirty(false)
        }}
        onSave={() => {
          onSave(draftColumns)
          onDirty(false)
        }}
        onExport={onExport}
      />
    </div>
  )
}
