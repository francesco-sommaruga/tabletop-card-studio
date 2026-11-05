import path from 'node:path'
import fs from 'node:fs/promises'

/** Writes through a temporary sibling file and a rename, so readers never see a half-written file. */
export async function writeFileAtomically(filePath: string, contents: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.card-studio-${crypto.randomUUID()}.tmp`
  await fs.writeFile(tempPath, contents, 'utf8')
  await fs.rename(tempPath, filePath)
}
