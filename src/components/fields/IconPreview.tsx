import { useState, useEffect } from 'react'

const iconPreviewCache = new Map<string, Promise<string | null>>()

export function IconPreview({
  reference,
  projectPath,
  className = '',
  tint,
}: {
  reference: string
  projectPath: string
  className?: string
  tint?: string
}) {
  const [source, setSource] = useState<string | null>(null)
  useEffect(() => {
    let current = true
    const key = `${projectPath}\u0000${reference}`
    let pending = iconPreviewCache.get(key)
    if (!pending) {
      pending = window.cardCms.resolveIcon(reference)
      iconPreviewCache.set(key, pending)
    }
    void pending
      .then((result) => {
        if (current) setSource(result)
      })
      .catch(() => {
        if (current) setSource(null)
      })
    return () => {
      current = false
    }
  }, [projectPath, reference])
  if (!reference.trim()) return null
  if (!source)
    return (
      <span className={`${className} icon-preview-fallback`} title={reference}>
        {reference}
      </span>
    )
  return tint ? (
    <span
      className={className}
      role="img"
      aria-label={`Icona ${reference}`}
      style={{ backgroundColor: tint, maskImage: `url("${source}")`, WebkitMaskImage: `url("${source}")` }}
    />
  ) : (
    <img className={className} src={source} alt={`Icona ${reference}`} />
  )
}
