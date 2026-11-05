import { useEffect, useState } from 'react'

/**
 * Tracks unsaved field/variable/settings drafts. While dirty, closing the window is blocked and
 * `confirmDiscardFields` asks before any navigation that would lose the draft.
 */
export function useDirtyGuard() {
  const [fieldsDirty, setFieldsDirty] = useState(false)
  useEffect(() => {
    if (!fieldsDirty) return
    const protectDraft = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', protectDraft)
    return () => window.removeEventListener('beforeunload', protectDraft)
  }, [fieldsDirty])
  const confirmDiscardFields = () => {
    if (!fieldsDirty) return true
    const discard = window.confirm('Ci sono modifiche a campi o variabili non salvate. Vuoi scartarle?')
    if (discard) setFieldsDirty(false)
    return discard
  }
  return { fieldsDirty, setFieldsDirty, confirmDiscardFields }
}
