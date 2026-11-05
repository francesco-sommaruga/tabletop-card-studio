import { useState } from 'react'
import type { Card } from '../types'
import type { View } from '../lib/view'

/** Current view and the card open in the editor. `navigateView` asks before leaving unsaved drafts. */
export function useAppNavigation(confirmDiscardFields: () => boolean) {
  const [view, setView] = useState<View>('cards')
  const [selected, setSelected] = useState<Card | null>(null)
  const navigateView = (nextView: View) => {
    if (nextView === view || confirmDiscardFields()) setView(nextView)
  }
  return { view, setView, navigateView, selected, setSelected }
}
