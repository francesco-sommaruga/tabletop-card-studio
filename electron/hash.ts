import { createHash } from 'node:crypto'

export function sha256(data: string | Buffer) {
  return createHash('sha256').update(data).digest('hex')
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function nativeDocumentHash(data: string | Buffer) {
  const parsed = JSON.parse(Buffer.isBuffer(data) ? data.toString('utf8') : data)
  return sha256(stableJson(parsed))
}
