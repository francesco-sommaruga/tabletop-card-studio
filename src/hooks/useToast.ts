import { useEffect, useState } from 'react'

/** Transient status message: auto-hides after 2.8 s and also shows notices pushed by the main process. */
export function useToast() {
  const [toast, setToast] = useState('')
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 2800)
      return () => clearTimeout(timer)
    }
  }, [toast])
  useEffect(() => window.cardCms.onNotice((message) => setToast(message)), [])
  return { toast, setToast }
}
