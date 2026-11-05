import { app, nativeImage } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import type { ProjectIconReference } from '../src/types'
import { state } from './state'

let iconCatalogCache: { projectPath: string; roots: string; icons: ProjectIconReference[] } | null = null

function tabletopBuiltInIconRoots(): string[] {
  const home = app.getPath('home')
  const steamRoots = [
    process.env.STEAM_DIR,
    process.env.STEAM_COMPAT_CLIENT_INSTALL_PATH,
    path.join(home, '.local', 'share', 'Steam'),
    path.join(home, '.steam', 'steam'),
    path.join(home, 'Library', 'Application Support', 'Steam'),
    process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)']!, 'Steam') : undefined,
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Steam') : undefined,
  ].filter((item): item is string => Boolean(item))
  const libraries = new Set(steamRoots)
  for (const root of steamRoots) {
    try {
      const config = readFileSync(path.join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8')
      for (const match of config.matchAll(/"path"\s+"([^"]+)"/g)) libraries.add(match[1].replace(/\\\\/g, '\\'))
    } catch {
      /* Steam may be installed outside this location */
    }
  }
  const roots: string[] = []
  for (const library of libraries) {
    for (const folder of ['TabletopCreatorPro', 'Tabletop Creator Pro', 'TabletopCreator']) {
      const game = path.join(library, 'steamapps', 'common', folder)
      roots.push(path.join(game, 'Assets_BuiltIn', 'icons'))
      for (const appName of ['Tabletop Creator Pro.app', 'TabletopCreator.app', 'Tabletop Creator.app']) {
        roots.push(path.join(game, appName, 'Contents', 'Resources', 'Assets_BuiltIn', 'icons'))
      }
    }
  }
  return [...new Set(roots)].filter((root) => existsSync(root))
}

async function collectIcons(root: string, library: ProjectIconReference['library']): Promise<ProjectIconReference[]> {
  const result: ProjectIconReference[] = []
  const supported = new Set(['.png', '.svg', '.webp', '.jpg', '.jpeg'])
  const visit = async (directory: string) => {
    let entries
    try {
      entries = await fs.readdir(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(file)
      else if (entry.isFile() && supported.has(path.extname(entry.name).toLowerCase())) {
        const relative = path.relative(root, file).split(path.sep).join('/')
        const extension = path.extname(relative)
        const name = path.basename(relative, extension)
        const reference = library === 'tabletop' ? relative.slice(0, -extension.length) : relative
        result.push({
          reference,
          name,
          category: path.posix.dirname(relative) === '.' ? '' : path.posix.dirname(relative),
          library,
        })
      }
    }
  }
  await visit(root)
  return result
}

export async function searchAvailableIcons(query: string, library: 'all' | 'tabletop' | 'project') {
  if (!state.activeProject) return { items: [] as ProjectIconReference[], total: 0 }
  const roots = [...tabletopBuiltInIconRoots()]
  const rootKey = roots.join('|')
  if (!iconCatalogCache || iconCatalogCache.projectPath !== state.activeProject || iconCatalogCache.roots !== rootKey) {
    const projectIcons = await collectIcons(path.join(state.activeProject, 'assets', 'icons'), 'project')
    const builtInIcons = (await Promise.all(roots.map((root) => collectIcons(root, 'tabletop')))).flat()
    const deduplicated = new Map<string, ProjectIconReference>()
    for (const item of [...projectIcons, ...builtInIcons])
      deduplicated.set(`${item.library}:${item.reference.toLocaleLowerCase()}`, item)
    iconCatalogCache = {
      projectPath: state.activeProject,
      roots: rootKey,
      icons: [...deduplicated.values()].sort((a, b) =>
        a.reference.localeCompare(b.reference, 'en', { numeric: true, sensitivity: 'base' }),
      ),
    }
  }
  const term = query.trim().toLocaleLowerCase()
  const matching = iconCatalogCache.icons.filter(
    (icon) =>
      (library === 'all' || icon.library === library) &&
      (!term || `${icon.reference} ${icon.name} ${icon.category}`.toLocaleLowerCase().includes(term)),
  )
  return { items: matching.slice(0, 120), total: matching.length }
}

export async function resolveProjectIcon(reference: string): Promise<string | null> {
  const normalized = reference
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\{\s*|\s*\}$/g, '')
  if (!normalized || normalized.split('/').some((part) => part === '..')) return null
  const relative = normalized.replace(/^icons\//i, '')
  const projectRoot = path.join(state.activeProject, 'assets', 'icons')
  const roots = [projectRoot, ...tabletopBuiltInIconRoots()]
  const extensions = path.extname(relative) ? [''] : ['.png', '.svg', '.webp', '.jpg', '.jpeg']
  for (const root of roots) {
    for (const extension of extensions) {
      const file = path.join(root, ...relative.split('/')) + extension
      if (!existsSync(file)) continue
      const ext = path.extname(file).toLowerCase()
      try {
        if (ext === '.svg') return `data:image/svg+xml;base64,${(await fs.readFile(file)).toString('base64')}`
        const image = nativeImage.createFromPath(file)
        if (!image.isEmpty()) return image.resize({ width: 160, height: 160, quality: 'good' }).toDataURL()
      } catch {
        /* an unsupported icon remains identifiable by its name */
      }
    }
  }
  return null
}
