import type { Card, ProjectSnapshot } from '../types'
import type { ProjectSession } from '../hooks/useProjectSession'
import type { CardMutations } from '../hooks/useCardMutations'
import type { ImportFlow } from '../hooks/useImportFlow'
import type { ExportFlow } from '../hooks/useExport'
import type { NativeSetLink } from '../hooks/useNativeSetLink'
import type { SetActions } from '../hooks/useSetActions'
import type { ProjectActions } from '../hooks/useProjectActions'
import { CardEditor } from '../components/cards/CardEditor'
import { ImportWizard } from '../components/import/ImportWizard'
import { MergeWizard } from '../components/import/MergeWizard'
import { ExportChoiceDialog } from '../components/dialogs/ExportChoiceDialog'
import { NativeSetLinkDialog } from '../components/dialogs/NativeSetLinkDialog'
import { RenameSetDialog } from '../components/dialogs/RenameSetDialog'
import { NativeNameConflictDialog } from '../components/dialogs/NativeNameConflictDialog'
import { MoveCardDialog } from '../components/dialogs/MoveCardDialog'

/** First linked set whose CMS name differs from its Tabletop Creator name. */
function findNameConflict(snapshot: ProjectSnapshot) {
  return snapshot.sets
    .map((set) => ({
      set,
      native: snapshot.nativeSets.find((item) => item.file === set.nativeSetFile && item.index === set.nativeSetIndex),
    }))
    .find((item) => item.native && item.native.name !== item.set.name)
}

export interface AppDialogsProps {
  session: ProjectSession
  selected: Card | null
  filteredCards: Card[]
  onCloseEditor: () => void
  mutations: CardMutations
  importFlow: ImportFlow
  exportFlow: ExportFlow
  native: NativeSetLink
  sets: SetActions
  project: ProjectActions
}

/** Overlays rendered above the shell: card editor, import/merge wizards and dialogs. */
export function AppDialogs(props: AppDialogsProps) {
  const { session, selected, mutations, importFlow, exportFlow, native, sets } = props
  const { renameTarget, movingCard } = sets
  const { snapshot, activeSet, cards, columns } = session
  const conflict = snapshot ? findNameConflict(snapshot) : undefined
  return (
    <>
      {selected && snapshot && (
        <CardEditor
          card={selected}
          columns={columns}
          assets={snapshot.assets}
          variables={snapshot.variables}
          blueprints={snapshot.blueprints}
          blueprintName={activeSet?.blueprintName ?? ''}
          projectPath={snapshot.projectPath}
          canMove={snapshot.sets.length > 1}
          onMove={sets.setMovingCard}
          onClose={props.onCloseEditor}
          onSave={mutations.saveCard}
          onDelete={() => mutations.deleteCard(selected)}
        />
      )}
      {importFlow.importOpen && snapshot && (
        <ImportWizard
          workbooks={snapshot.workbooks}
          sets={snapshot.sets}
          onRefresh={importFlow.rescanWorkbooks}
          onClose={() => importFlow.setImportOpen(false)}
          onImport={importFlow.finishImport}
          onMerge={importFlow.openMergePreview}
        />
      )}
      {importFlow.mergePreview && (
        <MergeWizard
          preview={importFlow.mergePreview}
          onPreview={(file, setId, matchFieldId, fieldIds, restoreFieldIds) =>
            window.cardCms.previewWorkbookMerge(file, setId, matchFieldId, fieldIds, restoreFieldIds)
          }
          onClose={() => importFlow.setMergePreview(null)}
          onApply={importFlow.applyMerge}
        />
      )}
      {exportFlow.exportOpen && (
        <ExportChoiceDialog
          filteredCount={props.filteredCards.length}
          totalCount={cards.length}
          exporting={exportFlow.exporting}
          onClose={() => exportFlow.setExportOpen(false)}
          onExportView={() => void exportFlow.performExport(props.filteredCards.map((card) => card.id))}
          onExportAll={() => void exportFlow.performExport()}
        />
      )}
      {native.nativeLinkOpen && snapshot && (
        <NativeSetLinkDialog
          nativeSets={session.availableNativeSets}
          blueprints={snapshot.blueprints}
          sets={snapshot.sets}
          preferCreate={native.newSetFlow}
          targetName={activeSet?.name ?? 'Nuovo set'}
          alreadyLinked={Boolean(activeSet?.nativeSetFile)}
          onClose={() => native.setNativeLinkOpen(false)}
          onLink={native.linkNativeSet}
          onCreate={native.createNativeSet}
        />
      )}
      {renameTarget && (
        <RenameSetDialog
          name={renameTarget.name}
          onClose={() => sets.setRenameTarget(null)}
          onSave={sets.saveSetName}
        />
      )}
      {conflict && (
        <NativeNameConflictDialog
          cmsName={conflict.set.name}
          nativeName={conflict.native!.name}
          onResolve={(resolution) => props.project.resolveNameConflict(conflict.set.id, resolution)}
        />
      )}
      {movingCard && snapshot && (
        <MoveCardDialog
          card={movingCard}
          sets={snapshot.sets}
          activeSetId={snapshot.activeSetId}
          onClose={() => sets.setMovingCard(null)}
          onMove={(targetSetId) => sets.moveCard(movingCard, targetSetId)}
        />
      )}
    </>
  )
}
