import { useState, useEffect } from 'react'
import { FileText, Plus, Pencil, Trash2, Eye, Check, CircleAlert } from 'lucide-react'
import type { MarkdownDocument } from '../../types'
import { MarkdownPreview } from './MarkdownPreview'

export function MarkdownWorkspace({
  onList,
  onRead,
  onSave,
  onCreate,
  onRename,
  onDelete,
  onSaved,
}: {
  onList: () => Promise<string[]>
  onRead: (file: string) => Promise<MarkdownDocument>
  onSave: (file: string, content: string) => Promise<MarkdownDocument>
  onCreate: (file: string) => Promise<MarkdownDocument>
  onRename: (file: string, name: string) => Promise<MarkdownDocument>
  onDelete: (file: string) => Promise<void>
  onSaved: () => Promise<void>
}) {
  const [files, setFiles] = useState<string[]>([])
  const [selected, setSelected] = useState('')
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [mode, setMode] = useState<'preview' | 'edit'>('preview')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dirty = content !== savedContent
  useEffect(() => {
    void onList()
      .then((list) => {
        setFiles(list)
        if (list[0]) setSelected(list[0])
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Non riesco a leggere i file Markdown.'))
  }, [])
  useEffect(() => {
    if (!selected) return
    let active = true
    setBusy(true)
    void onRead(selected)
      .then((doc) => {
        if (active) {
          setContent(doc.content)
          setSavedContent(doc.content)
          setError('')
        }
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Non riesco ad aprire il file.')
      })
      .finally(() => {
        if (active) setBusy(false)
      })
    return () => {
      active = false
    }
  }, [selected])
  const chooseFile = (file: string) => {
    if (dirty && !window.confirm('Hai modifiche non salvate. Scartarle e aprire un altro file?')) return
    setSelected(file)
    setMode('preview')
  }
  const save = async () => {
    if (!selected) return
    setBusy(true)
    try {
      const result = await onSave(selected, content)
      setContent(result.content)
      setSavedContent(result.content)
      setError('')
      await onSaved()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossibile salvare il documento.')
    } finally {
      setBusy(false)
    }
  }
  const createFile = async () => {
    const name = window.prompt('Nome del nuovo file Markdown:')
    if (!name?.trim()) return
    setBusy(true)
    try {
      const doc = await onCreate(name.trim())
      setFiles(await onList())
      setSelected(doc.path)
      setContent(doc.content)
      setSavedContent(doc.content)
      setMode('edit')
      setError('')
      await onSaved()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossibile creare il file.')
    } finally {
      setBusy(false)
    }
  }
  const renameFile = async () => {
    if (!selected) return
    if (dirty && !window.confirm('Hai modifiche non salvate. Scartarle e rinominare il file?')) return
    const currentName = selected.split('/').pop()!.replace(/\.md$/i, '')
    const name = window.prompt('Nuovo nome del file:', currentName)
    if (!name?.trim()) return
    setBusy(true)
    try {
      const doc = await onRename(selected, name.trim())
      setFiles(await onList())
      setSelected(doc.path)
      setContent(doc.content)
      setSavedContent(doc.content)
      setError('')
      await onSaved()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossibile rinominare il file.')
    } finally {
      setBusy(false)
    }
  }
  const deleteFile = async () => {
    if (!selected) return
    if (dirty && !window.confirm('Hai modifiche non salvate. Scartarle ed eliminare il file?')) return
    if (!window.confirm(`Eliminare “${selected}” dal progetto?`)) return
    setBusy(true)
    try {
      await onDelete(selected)
      const nextFiles = await onList()
      setFiles(nextFiles)
      const next = nextFiles[0] ?? ''
      setSelected(next)
      if (!next) {
        setContent('')
        setSavedContent('')
      }
      setError('')
      await onSaved()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossibile eliminare il file.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="markdown-workspace">
      <aside className="markdown-files">
        <div>
          <span className="metric-label">FILE MARKDOWN</span>
          <strong>{files.length} documenti</strong>
        </div>
        {files.map((file) => (
          <button
            type="button"
            key={file}
            className={selected === file ? 'selected' : ''}
            onClick={() => chooseFile(file)}
          >
            <FileText size={14} />
            <span>{file}</span>
            {selected === file && dirty && <i title="Modifiche non salvate" />}
          </button>
        ))}
        {!files.length && <p>Non trovo file .md in questo progetto.</p>}
      </aside>
      <div className="markdown-editor">
        <header>
          <div>
            <strong>{selected || 'Scegli un documento'}</strong>
            {dirty && <small>Modifiche non salvate</small>}
          </div>
          <div className="markdown-actions">
            <button type="button" className="button button-quiet" onClick={() => void createFile()} disabled={busy}>
              <Plus size={13} />
              Nuovo
            </button>
            <button
              type="button"
              className="button button-quiet"
              onClick={() => void renameFile()}
              disabled={busy || !selected}
            >
              <Pencil size={13} />
              Rinomina
            </button>
            <button
              type="button"
              className="button button-quiet markdown-delete"
              onClick={() => void deleteFile()}
              disabled={busy || !selected}
            >
              <Trash2 size={13} />
              Elimina
            </button>
            <div className="markdown-mode">
              <button type="button" className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}>
                <Eye size={13} />
                Anteprima
              </button>
              <button type="button" className={mode === 'edit' ? 'active' : ''} onClick={() => setMode('edit')}>
                <Pencil size={13} />
                Modifica
              </button>
            </div>
            {mode === 'edit' && (
              <button
                type="button"
                className="button button-primary"
                onClick={() => void save()}
                disabled={!dirty || busy}
              >
                <Check size={13} />
                Salva
              </button>
            )}
          </div>
        </header>
        {error && (
          <div className="git-error">
            <CircleAlert size={14} />
            {error}
          </div>
        )}
        {busy ? (
          <div className="markdown-empty">Caricamento…</div>
        ) : mode === 'edit' ? (
          <div className="markdown-edit-grid">
            <textarea
              aria-label="Contenuto Markdown"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              spellCheck={false}
            />
            <article className="markdown-preview">
              <MarkdownPreview content={content} />
            </article>
          </div>
        ) : (
          <article className="markdown-preview markdown-preview-full">
            <MarkdownPreview content={content} />
          </article>
        )}
      </div>
    </section>
  )
}
