import type { ProjectAsset } from '../types'

export function normalizeAssetReference(value: string) {
  const normalized = value.trim().replace(/\\/g, '/')
  const lower = normalized.toLocaleLowerCase()
  const tabletopReference = (reference: string) =>
    reference.startsWith('images/card-studio/') ? reference.slice('images/'.length) : reference
  const marker = lower.lastIndexOf('/assets/')
  if (marker >= 0) return tabletopReference(normalized.slice(marker + '/assets/'.length))
  if (lower.startsWith('assets/')) return tabletopReference(normalized.slice('assets/'.length))
  if (normalized.startsWith('/') || /^[a-z]:\//i.test(normalized))
    return normalized.split('/').filter(Boolean).pop() ?? ''
  return tabletopReference(normalized.replace(/^\.\//, '').replace(/^\/+/, ''))
}

export function findPreviewAsset(reference: string, assets: ProjectAsset[]) {
  const normalized = normalizeAssetReference(reference).toLocaleLowerCase()
  const filename = normalized.split(/[\\/]/).pop()
  return assets.find(
    (asset) =>
      asset.path.toLocaleLowerCase() === normalized ||
      asset.name.toLocaleLowerCase() === filename ||
      asset.path.toLocaleLowerCase().endsWith(`/${filename}`),
  )
}

export function isImageReference(reference: string) {
  return (
    /\.(?:png|jpe?g|webp|gif|avif|svg)(?:[?#].*)?$/i.test(reference) ||
    /^[a-z]:[\\/]/i.test(reference) ||
    reference.startsWith('/')
  )
}
