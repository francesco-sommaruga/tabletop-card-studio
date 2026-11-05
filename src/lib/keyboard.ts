/** The parts of a KeyboardEvent the shortcut helpers look at. */
interface KeyChord {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}

/** Ctrl/Cmd+Z → undo; Ctrl/Cmd+Shift+Z and Ctrl+Y → redo. */
export function undoShortcut(event: KeyChord): 'undo' | 'redo' | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null
  const key = event.key.toLowerCase()
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo'
  if (key === 'y' && event.ctrlKey && !event.shiftKey) return 'redo'
  return null
}

/** Card editor: Ctrl/Cmd+S saves, Alt+↑/↓ moves to the previous/next card. */
export function editorShortcut(event: KeyChord): 'save' | 'previous' | 'next' | null {
  if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 's')
    return 'save'
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null
  if (event.key === 'ArrowUp') return 'previous'
  if (event.key === 'ArrowDown') return 'next'
  return null
}

const nonTextInputTypes = new Set(['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'range', 'color'])

/** True when keyboard focus is somewhere with its own text editing (and native undo). */
export function isTextEntry(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false
  const element = target as { tagName?: string; type?: string; isContentEditable?: boolean }
  if (element.isContentEditable) return true
  if (element.tagName === 'INPUT') return !nonTextInputTypes.has(element.type ?? 'text')
  return element.tagName === 'TEXTAREA' || element.tagName === 'SELECT'
}

/** True when a modal dialog other than the card editor drawer is open. */
export const isOtherModalOpen = () =>
  Boolean(document.querySelector('[aria-modal="true"], .scrim:not(.card-editor-scrim), .commit-preview-scrim'))
