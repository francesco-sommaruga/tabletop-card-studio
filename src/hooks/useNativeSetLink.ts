import { useState } from 'react'
import type { ProjectSnapshot } from '../types'
import { slug } from '../lib/format'
import { errorMessage } from './shellContext'
import type { ShellContext } from './shellContext'

/** Ensures there is an active set to link to, creating one if needed. Returns its id. */
async function ensureActiveSet(snapshot: ProjectSnapshot, setSnapshot: ShellContext['setSnapshot']) {
  let setId = snapshot.activeSetId
  if (!setId) {
    const created = await window.cardCms.createSet('Nuovo set')
    setSnapshot(created)
    setId = created.activeSetId
  }
  return setId
}

const generatedColumns = (fieldHeaders: string[]) =>
  fieldHeaders.map((header) => ({
    id: `column_${slug(header)}`,
    header,
    fieldId: slug(header),
    type: /color/i.test(header)
      ? ('color' as const)
      : /image|icon/i.test(header)
        ? ('image' as const)
        : ('text' as const),
  }))

/** Linking a CMS set to a Tabletop Creator (native) set: dialog state, link, create, unlink. */
export function useNativeSetLink(ctx: ShellContext) {
  const { snapshot, setSnapshot, setToast, confirmDiscardFields, setView, setSelected, resetListControls } = ctx
  const [nativeLinkOpen, setNativeLinkOpen] = useState(false)
  const [newSetFlow, setNewSetFlow] = useState(false)

  const startNewSetFlow = () => {
    setNewSetFlow(true)
    setNativeLinkOpen(true)
  }
  const linkNativeSet = async (file: string, index: number) => {
    if (!snapshot) return
    try {
      const setId = await ensureActiveSet(snapshot, setSnapshot)
      if (!setId) return
      const result = await window.cardCms.linkNativeSet(setId, file, index)
      setSnapshot(result)
      setNativeLinkOpen(false)
      setSelected(null)
      resetListControls()
      setView('cards')
      setToast(`Set collegato: ${result.columns.length} campi importati dal blueprint e dai dati nativi`)
    } catch (error) {
      setToast(errorMessage(error, 'Impossibile collegare il set nativo'))
    }
  }
  const createNativeSet = async (name: string, blueprintName: string, fieldHeaders: string[] = []) => {
    if (!snapshot) return
    try {
      const setId = await ensureActiveSet(snapshot, setSnapshot)
      if (!setId) return
      const blueprintPeers = snapshot.sets.filter((set) => set.blueprintName === blueprintName)
      if (!blueprintPeers.length && fieldHeaders.length)
        await window.cardCms.saveColumns(generatedColumns(fieldHeaders))
      const result = await window.cardCms.createNativeSet(setId, name, blueprintName)
      setSnapshot(result)
      setNativeLinkOpen(false)
      setSelected(null)
      resetListControls()
      setView('cards')
      setToast('Nuovo set Tabletop Creator creato e collegato alle carte CMS')
    } catch (error) {
      setToast(errorMessage(error, 'Impossibile creare il set nativo'))
    }
  }
  const openNativeLink = async (setId: string) => {
    if (!snapshot || !confirmDiscardFields()) return
    const target = snapshot.sets.find((set) => set.id === setId)
    if (!target) return
    if (target.nativeSetFile) {
      setToast('Scollega prima il set nativo dalle impostazioni di progetto')
      return
    }
    try {
      const result = await window.cardCms.selectSet(setId)
      setSnapshot(result)
      setNewSetFlow(false)
      setNativeLinkOpen(true)
    } catch (error) {
      setToast(errorMessage(error, 'Impossibile aprire i collegamenti'))
    }
  }
  const unlinkNativeSet = async (setId: string, setName: string) => {
    if (!confirmDiscardFields()) return
    if (
      !window.confirm(
        `Scollegare “${setName}” dal set Tabletop Creator associato? I due set e i loro file restano intatti; viene rimossa solo l’associazione.`,
      )
    )
      return
    try {
      const result = await window.cardCms.unlinkNativeSet(setId)
      setSnapshot(result)
      setToast(`Collegamento di “${setName}” rimosso`)
    } catch (error) {
      setToast(errorMessage(error, 'Impossibile scollegare il set'))
    }
  }
  return {
    nativeLinkOpen,
    setNativeLinkOpen,
    newSetFlow,
    startNewSetFlow,
    linkNativeSet,
    createNativeSet,
    openNativeLink,
    unlinkNativeSet,
  }
}

export type NativeSetLink = ReturnType<typeof useNativeSetLink>
