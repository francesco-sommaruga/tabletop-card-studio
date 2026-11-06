import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import type { UpdateStatus } from '../types'

/** Persistent prompt for a new release; nothing installs until the user confirms. */
export function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    void window.cardCms.getUpdateStatus().then((current) => current && setStatus(current))
    return window.cardCms.onUpdateStatus((next) => {
      setStatus(next)
      setIsDismissed(false)
    })
  }, [])

  if (!status || isDismissed) return null
  const isReady = status.kind === 'ready'
  return (
    <div className="update-banner" role="status">
      <Download size={15} />
      <span>
        {isReady
          ? `Tabletop Card Studio ${status.version} è pronto.`
          : `È disponibile Tabletop Card Studio ${status.version}.`}
      </span>
      <button type="button" className="update-banner-primary" onClick={() => void window.cardCms.applyUpdate()}>
        {isReady ? 'Riavvia e aggiorna' : 'Scarica'}
      </button>
      <button type="button" className="update-banner-secondary" onClick={() => setIsDismissed(true)}>
        Più tardi
      </button>
    </div>
  )
}
