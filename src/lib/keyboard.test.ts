import { describe, expect, it } from 'vitest'
import { editorShortcut, isTextEntry, undoShortcut } from './keyboard'

const key = (
  value: string,
  modifiers: Partial<Record<'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey', boolean>> = {},
) => ({
  key: value,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...modifiers,
})

describe('undoShortcut', () => {
  it('maps Ctrl/Cmd+Z to undo', () => {
    expect(undoShortcut(key('z', { ctrlKey: true }))).toBe('undo')
    expect(undoShortcut(key('z', { metaKey: true }))).toBe('undo')
  })

  it('maps Ctrl/Cmd+Shift+Z and Ctrl+Y to redo', () => {
    expect(undoShortcut(key('Z', { ctrlKey: true, shiftKey: true }))).toBe('redo')
    expect(undoShortcut(key('Z', { metaKey: true, shiftKey: true }))).toBe('redo')
    expect(undoShortcut(key('y', { ctrlKey: true }))).toBe('redo')
  })

  it('ignores other combinations', () => {
    expect(undoShortcut(key('z'))).toBeNull()
    expect(undoShortcut(key('z', { ctrlKey: true, altKey: true }))).toBeNull()
    expect(undoShortcut(key('y', { metaKey: true }))).toBeNull()
    expect(undoShortcut(key('s', { ctrlKey: true }))).toBeNull()
  })
})

describe('editorShortcut', () => {
  it('maps Ctrl/Cmd+S to save and Alt+arrows to navigation', () => {
    expect(editorShortcut(key('s', { ctrlKey: true }))).toBe('save')
    expect(editorShortcut(key('S', { metaKey: true }))).toBe('save')
    expect(editorShortcut(key('ArrowUp', { altKey: true }))).toBe('previous')
    expect(editorShortcut(key('ArrowDown', { altKey: true }))).toBe('next')
  })

  it('ignores plain arrows and extra modifiers', () => {
    expect(editorShortcut(key('ArrowDown'))).toBeNull()
    expect(editorShortcut(key('ArrowDown', { altKey: true, ctrlKey: true }))).toBeNull()
    expect(editorShortcut(key('s', { ctrlKey: true, shiftKey: true }))).toBeNull()
  })
})

describe('isTextEntry', () => {
  const element = (tagName: string, extra: Record<string, unknown> = {}) => ({ tagName, ...extra })

  it('treats text fields, selects and contenteditable as text entry', () => {
    expect(isTextEntry(element('INPUT', { type: 'text' }))).toBe(true)
    expect(isTextEntry(element('INPUT', { type: 'number' }))).toBe(true)
    expect(isTextEntry(element('TEXTAREA'))).toBe(true)
    expect(isTextEntry(element('SELECT'))).toBe(true)
    expect(isTextEntry(element('DIV', { isContentEditable: true }))).toBe(true)
  })

  it('does not treat buttons, checkboxes or plain elements as text entry', () => {
    expect(isTextEntry(element('BUTTON'))).toBe(false)
    expect(isTextEntry(element('INPUT', { type: 'checkbox' }))).toBe(false)
    expect(isTextEntry(element('DIV'))).toBe(false)
    expect(isTextEntry(null)).toBe(false)
  })
})
