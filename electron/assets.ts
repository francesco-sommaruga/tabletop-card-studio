import { dialog, nativeImage } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { ProjectAsset } from '../src/types'
import { state } from './state'

export async function scanAssets(): Promise<ProjectAsset[]> {
  const assetRoot = path.join(state.activeProject, 'assets')
  const found: string[] = []
  const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif'])
  async function walk(dir: string) {
    if (found.length >= 300) return
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(entryPath)
      else if (entry.isFile() && allowed.has(path.extname(entry.name).toLowerCase())) found.push(entryPath)
      if (found.length >= 300) break
    }
  }
  await walk(assetRoot)
  const mimeFor: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.avif': 'image/avif',
  }
  return Promise.all(
    found.map(async (file) => {
      const relative = path
        .relative(assetRoot, file)
        .split(path.sep)
        .join('/')
        .replace(/^images\/card-studio\//, 'card-studio/')
      const ext = path.extname(file).toLowerCase()
      let previewUrl = ''
      try {
        const image = nativeImage.createFromPath(file)
        if (!image.isEmpty()) previewUrl = image.resize({ width: 180, height: 180, quality: 'good' }).toDataURL()
        else if (ext === '.svg')
          previewUrl = `data:image/svg+xml;base64,${(await fs.readFile(file)).toString('base64')}`
      } catch {
        /* an asset without a preview remains assignable by name */
      }
      return { path: relative, name: path.basename(file), mime: mimeFor[ext] ?? 'application/octet-stream', previewUrl }
    }),
  )
}

export async function importAssets() {
  const result = await dialog.showOpenDialog(state.win!, {
    title: 'Aggiungi asset al progetto',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Immagini', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif'] }],
  })
  if (!result.canceled) {
    const targetDir = path.join(state.activeProject, 'assets', 'images', 'card-studio')
    await fs.mkdir(targetDir, { recursive: true })
    for (const source of result.filePaths) {
      const ext = path.extname(source)
      const stem = path.basename(source, ext)
      let target = path.join(targetDir, path.basename(source))
      let suffix = 2
      while (existsSync(target)) target = path.join(targetDir, `${stem}-${suffix++}${ext}`)
      await fs.copyFile(source, target)
    }
    state.assets = await scanAssets()
  }
  return state.assets
}
