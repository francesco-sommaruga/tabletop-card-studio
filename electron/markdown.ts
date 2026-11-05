import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { MarkdownDocument } from '../src/types'
import { state } from './state'
import { writeFileAtomically } from './store'

function markdownPath(file: string) {
  const blocked = new Set([
    '.git',
    'node_modules',
    'dist',
    'renderer-dist',
    '.tabletop-card-studio',
    'build',
    'coverage',
  ])
  if (
    !state.activeProject ||
    typeof file !== 'string' ||
    !file.toLocaleLowerCase().endsWith('.md') ||
    path.isAbsolute(file) ||
    file.split(/[\\/]/).some((part) => !part || part === '.' || part === '..' || blocked.has(part.toLocaleLowerCase()))
  )
    throw new Error('Percorso Markdown non valido.')
  const root = path.resolve(state.activeProject)
  const target = path.resolve(root, file)
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error('Il file deve restare all’interno del progetto.')
  return target
}

export async function listMarkdownFiles() {
  if (!state.activeProject) return []
  const found: string[] = []
  const ignored = new Set([
    '.git',
    'node_modules',
    'dist',
    'renderer-dist',
    '.tabletop-card-studio',
    'build',
    'coverage',
  ])
  const visit = async (directory: string): Promise<void> => {
    let entries
    try {
      entries = await fs.readdir(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        if (!ignored.has(entry.name)) await visit(absolute)
      } else if (entry.isFile() && entry.name.toLocaleLowerCase().endsWith('.md'))
        found.push(path.relative(state.activeProject, absolute).split(path.sep).join('/'))
    }
  }
  await visit(state.activeProject)
  return found.sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }))
}

export async function readMarkdownFile(file: string) {
  const target = markdownPath(file)
  const stat = await fs.lstat(target)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2_000_000)
    throw new Error('Il file Markdown non è valido o supera 2 MB.')
  return { path: file, content: await fs.readFile(target, 'utf8') }
}

export async function saveMarkdownFile(file: string, content: string) {
  const target = markdownPath(file)
  const stat = await fs.lstat(target)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('È possibile modificare solo file Markdown esistenti.')
  if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > 2_000_000)
    throw new Error('Il contenuto supera il limite di 2 MB.')
  await writeFileAtomically(target, content)
  return { path: file, content }
}

export async function createMarkdownFile(fileName: string): Promise<MarkdownDocument> {
  const name = String(fileName ?? '').trim()
  if (!name || /[\\/]/.test(name)) throw new Error('Inserisci un nome file senza cartelle.')
  const file = name.toLocaleLowerCase().endsWith('.md') ? name : `${name}.md`
  const target = markdownPath(file)
  await fs.writeFile(target, '', { flag: 'wx' })
  return { path: file, content: '' }
}

export async function renameMarkdownFile(file: string, newName: string): Promise<MarkdownDocument> {
  const source = markdownPath(file)
  const name = String(newName ?? '').trim()
  if (!name || /[\\/]/.test(name)) throw new Error('Inserisci un nuovo nome file senza cartelle.')
  const normalizedName = name.toLocaleLowerCase().endsWith('.md') ? name : `${name}.md`
  const relative = path.join(path.dirname(file), normalizedName)
  const target = markdownPath(relative)
  const stat = await fs.lstat(source)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('È possibile rinominare solo file Markdown.')
  if (existsSync(target)) throw new Error('Esiste già un file con questo nome.')
  const content = await fs.readFile(source, 'utf8')
  await fs.rename(source, target)
  return { path: relative.split(path.sep).join('/'), content }
}

export async function deleteMarkdownFile(file: string) {
  const target = markdownPath(file)
  const stat = await fs.lstat(target)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('È possibile eliminare solo file Markdown.')
  await fs.unlink(target)
}
