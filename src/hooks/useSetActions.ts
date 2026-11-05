import { useState } from 'react'
import type { Card } from '../types'
import { errorMessage } from './shellContext'
import type { ShellContext } from './shellContext'

/** Card set operations from the sidebar and editor: choose, create, rename, duplicate, delete, move a card. */
export function useSetActions(ctx: ShellContext, onSetCreated: () => void) {
  const { snapshot, setSnapshot, setToast, confirmDiscardFields, setView, setSelected, resetListControls } = ctx
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null)
  const [movingCard, setMovingCard] = useState<Card | null>(null)

  const chooseSet = async (id: string) => {
    if (!confirmDiscardFields()) return
    const result = await window.cardCms.selectSet(id)
    setSnapshot(result)
    resetListControls()
  }
  const createSet = async () => {
    if (!snapshot || !confirmDiscardFields()) return
    const result = await window.cardCms.createSet(`Set ${snapshot.sets.length + 1}`)
    setSnapshot(result)
    onSetCreated()
    setView('cards')
  }
  const startRename = (id: string, name: string) => {
    if (confirmDiscardFields()) setRenameTarget({ id, name })
  }
  const saveSetName = async (name: string) => {
    if (!renameTarget) return
    try {
      const next = await window.cardCms.renameSet(renameTarget.id, name)
      setSnapshot(next)
      setRenameTarget(null)
      setToast('Nome del set aggiornato')
    } catch (error) {
      setToast(errorMessage(error, 'Impossibile rinominare il set'))
    }
  }
  const duplicateSet = async (id: string) => {
    if (!confirmDiscardFields()) return
    try {
      const result = await window.cardCms.duplicateSet(id)
      setSnapshot(result)
      setSelected(null)
      setView('cards')
      resetListControls()
      setToast('Set duplicato con tutte le sue carte')
    } catch (error) {
      setToast(errorMessage(error, 'Impossibile duplicare il set'))
    }
  }
  const deleteSet = async (id: string, name: string, cardCount: number) => {
    if (!snapshot || !confirmDiscardFields()) return
    const detail = cardCount ? ` Contiene ${cardCount} ${cardCount === 1 ? 'carta' : 'carte'}.` : ''
    if (
      !window.confirm(
        `Eliminare il set “${name}”?${detail}\n\nIl set sarà rimosso da Card Studio, ma il file Excel originale resterà nella cartella del progetto.`,
      )
    )
      return
    try {
      const result = await window.cardCms.deleteSet(id)
      setSnapshot(result)
      setSelected(null)
      setView('cards')
      resetListControls()
      setToast(`Set “${name}” eliminato`)
    } catch (error) {
      setToast(errorMessage(error, 'Impossibile eliminare il set'))
    }
  }
  const moveCard = async (card: Card, targetSetId: string) => {
    try {
      const result = await window.cardCms.moveCard(card.id, targetSetId, card)
      setSnapshot(result)
      setSelected(null)
      setMovingCard(null)
      setView('cards')
      resetListControls()
      setToast(`Carta spostata in ${result.sets.find((set) => set.id === result.activeSetId)?.name ?? 'un altro set'}`)
    } catch (error) {
      setToast(errorMessage(error, 'Impossibile spostare la carta'))
    }
  }
  return {
    chooseSet,
    createSet,
    renameTarget,
    setRenameTarget,
    startRename,
    saveSetName,
    duplicateSet,
    deleteSet,
    movingCard,
    setMovingCard,
    moveCard,
  }
}

export type SetActions = ReturnType<typeof useSetActions>
