import { useCallback, useEffect, useState } from 'react'

/** Optional button shown in a toast, e.g. "Ripristina" after an undo. */
export interface ToastAction {
  label: string
  run: () => void
}

export interface Toast {
  message: string
  action?: ToastAction
}

/** Shows a toast; an empty message hides the current one. */
export type ShowToast = (message: string, action?: ToastAction) => void

/**
 * Transient status message: auto-hides after 2.8 s (6 s when it carries an action) and also shows
 * notices pushed by the main process.
 */
export function useToast() {
  const [toast, setToastState] = useState<Toast | null>(null)
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToastState(null), toast.action ? 6000 : 2800)
    return () => clearTimeout(timer)
  }, [toast])
  const setToast: ShowToast = useCallback((message, action) => setToastState(message ? { message, action } : null), [])
  useEffect(() => window.cardCms.onNotice((message) => setToast(message)), [setToast])
  return { toast, setToast, dismissToast: () => setToastState(null) }
}
