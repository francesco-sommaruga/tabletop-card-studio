import { useEffect, useRef } from 'react'
import type { ProjectSnapshot } from '../types'

/**
 * Receives snapshots pushed by the main process when native Tabletop Creator files change outside a
 * renderer request (automatic reloads, new conflicts or sync errors). The latest callback is always used.
 */
export function useNativeSyncEvents(onSnapshot: (snapshot: ProjectSnapshot) => void) {
  const callbackRef = useRef(onSnapshot)
  useEffect(() => {
    callbackRef.current = onSnapshot
  }, [onSnapshot])
  useEffect(() => window.cardCms.onSnapshot((snapshot) => callbackRef.current(snapshot)), [])
}
