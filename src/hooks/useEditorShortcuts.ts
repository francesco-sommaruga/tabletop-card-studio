import { useEffect, useRef } from 'react'
import { editorShortcut, isOtherModalOpen } from '../lib/keyboard'

interface EditorShortcutHandlers {
  onSave: () => void
  /** Undefined at the start of the list. */
  onPrevious?: () => void
  /** Undefined at the end of the list. */
  onNext?: () => void
}

/**
 * Card editor shortcuts while the editor is mounted: Ctrl/Cmd+S saves, Alt+↑/↓ moves to the previous/next
 * card. They also work while typing; Alt+arrows are left to native selects. Ignored under another dialog.
 */
export function useEditorShortcuts(handlers: EditorShortcutHandlers) {
  const latest = useRef(handlers)
  latest.current = handlers
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = editorShortcut(event)
      if (!shortcut || event.defaultPrevented || isOtherModalOpen()) return
      if (shortcut !== 'save' && event.target instanceof HTMLSelectElement) return
      event.preventDefault()
      const { onSave, onPrevious, onNext } = latest.current
      if (shortcut === 'save') onSave()
      else (shortcut === 'previous' ? onPrevious : onNext)?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
