import { useState } from 'react'
import type { ShellContext } from './shellContext'
import { errorMessage } from './shellContext'
import { useNativeSyncEvents } from './useNativeSyncEvents'

export type NativeConflictChoice = 'reload' | 'overwrite'

/**
 * Keeps the snapshot in step with Tabletop Creator: applies snapshots pushed by the main process
 * (automatic reloads, new conflicts) and resolves sync conflicts on request.
 */
export function useNativeSync(ctx: Pick<ShellContext, 'setSnapshot' | 'setToast'>) {
  const [isResolving, setIsResolving] = useState(false)
  useNativeSyncEvents(ctx.setSnapshot)

  const resolve = async (setId: string, choice: NativeConflictChoice) => {
    setIsResolving(true)
    try {
      ctx.setSnapshot(await window.cardCms.resolveNativeConflict(setId, choice))
      ctx.setToast(
        choice === 'reload' ? 'Set ricaricato da Tabletop Creator' : 'Tabletop Creator aggiornato (backup salvato)',
      )
    } catch (error) {
      ctx.setToast(errorMessage(error, 'Impossibile risolvere il conflitto di sincronizzazione'))
    } finally {
      setIsResolving(false)
    }
  }

  return { isResolving, resolve }
}

export type NativeSync = ReturnType<typeof useNativeSync>
