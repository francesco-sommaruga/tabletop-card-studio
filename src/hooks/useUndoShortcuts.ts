import { useEffect, useRef } from 'react'
import { isOtherModalOpen, isTextEntry, undoShortcut } from '../lib/keyboard'

/**
 * Global Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z and Ctrl+Y (redo) for card changes. Ignored while typing
 * (native text undo wins), while a dialog other than the card editor is open, or when disabled.
 */
export function useUndoShortcuts(actions: { undo: () => void; redo: () => void }, isEnabled: boolean) {
  const latest = useRef({ actions, isEnabled })
  latest.current = { actions, isEnabled }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = undoShortcut(event)
      if (!shortcut || !latest.current.isEnabled || event.defaultPrevented) return
      if (isTextEntry(event.target) || isOtherModalOpen()) return
      event.preventDefault()
      latest.current.actions[shortcut]()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
