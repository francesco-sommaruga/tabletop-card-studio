import { useState } from 'react'
import { X, FileSpreadsheet, Check, ChevronDown, RefreshCw } from 'lucide-react'
import type { WorkbookInfo, ProjectSnapshot, ImportPlan, ColumnDefinition } from '../../types'
import { guessType } from '../../lib/tableColumns'

export function ImportWizard({
  workbooks,
  sets,
  onRefresh,
  onClose,
  onImport,
  onMerge,
}: {
  workbooks: WorkbookInfo[]
  sets: ProjectSnapshot['sets']
  onRefresh: () => Promise<WorkbookInfo[]>
  onClose: () => void
  onImport: (plans: ImportPlan[]) => void
  onMerge: (file: string, setId: string) => void
}) {
  const [found, setFound] = useState(workbooks)
  const [chosen, setChosen] = useState<Set<string>>(
    () =>
      new Set(workbooks.filter((book) => !sets.some((set) => set.sourceFile === book.file)).map((book) => book.file)),
  )
  const [expanded, setExpanded] = useState(
    workbooks.find((book) => !sets.some((set) => set.sourceFile === book.file))?.file ?? '',
  )
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(workbooks.map((book) => [book.file, book.file.replace(/\.xlsx$/i, '')])),
  )
  const [fields, setFields] = useState<
    Record<
      string,
      Array<{ header: string; keep: boolean; type: NonNullable<ColumnDefinition['type']>; options: string }>
    >
  >(() =>
    Object.fromEntries(
      workbooks.map((book) => [
        book.file,
        book.headers.map((header) => ({ header, keep: true, type: guessType(header), options: '' })),
      ]),
    ),
  )
  const toggleBook = (file: string) =>
    setChosen((current) => {
      const next = new Set(current)
      next.has(file) ? next.delete(file) : next.add(file)
      return next
    })
  const updateField = (
    file: string,
    header: string,
    patch: Partial<{ keep: boolean; type: NonNullable<ColumnDefinition['type']>; options: string }>,
  ) =>
    setFields((current) => ({
      ...current,
      [file]: current[file].map((field) => (field.header === header ? { ...field, ...patch } : field)),
    }))
  const refresh = async () => {
    const next = await onRefresh()
    setFound(next)
    setNames((current) => ({
      ...current,
      ...Object.fromEntries(next.map((book) => [book.file, current[book.file] ?? book.file.replace(/\.xlsx$/i, '')])),
    }))
    setFields((current) => ({
      ...current,
      ...Object.fromEntries(
        next
          .filter((book) => !current[book.file])
          .map((book) => [
            book.file,
            book.headers.map((header) => ({ header, keep: true, type: guessType(header), options: '' })),
          ]),
      ),
    }))
  }
  const plans = [...chosen]
    .map((file) => ({
      file,
      name: names[file] || file.replace(/\.xlsx$/i, ''),
      fields: (fields[file] ?? [])
        .filter((field) => field.keep)
        .map(({ header, type, options }) => ({
          header,
          type,
          options:
            type === 'select'
              ? options
                  .split(',')
                  .map((item) => item.trim())
                  .filter(Boolean)
              : undefined,
        })),
    }))
    .filter((plan) => plan.fields.length)
  return (
    <>
      <button className="scrim" aria-label="Chiudi importazione" onClick={onClose} />
      <section className="import-panel">
        <div className="editor-head">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />
              IMPORTAZIONE GUIDATA
            </div>
            <h2>Un file, un set.</h2>
          </div>
          <button className="icon-button close-editor" onClick={onClose} aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>
        <div className="import-panel-intro">
          <p>
            Importa un nuovo set oppure confronta un foglio già collegato e unisci gli aggiornamenti senza perdere le
            modifiche al set.
          </p>
          <div className="import-file-summary">
            <FileSpreadsheet size={16} />
            <strong>{found.length}</strong> file Excel rilevati{' '}
            <button className="text-button" onClick={() => void refresh()}>
              Aggiorna elenco
            </button>
          </div>
        </div>
        <div className="import-workbook-list">
          {found.length ? (
            found.map((book) => {
              const importedSet = sets.find((set) => set.sourceFile === book.file)
              const already = Boolean(importedSet)
              const selected = chosen.has(book.file)
              return (
                <article className={`import-workbook ${selected ? 'is-selected' : ''}`} key={book.file}>
                  <div className="workbook-row">
                    <label className="check-wrap">
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={already}
                        onChange={() => toggleBook(book.file)}
                      />
                      <span className="custom-check">
                        <Check size={12} />
                      </span>
                    </label>
                    <button
                      className="workbook-summary"
                      onClick={() => setExpanded(expanded === book.file ? '' : book.file)}
                    >
                      <span className="workbook-file-icon">
                        <FileSpreadsheet size={17} />
                      </span>
                      <span>
                        <strong>{book.file}</strong>
                        <small>
                          {book.rowCount} righe · {book.headers.length} colonne
                        </small>
                      </span>
                      <ChevronDown size={15} />
                    </button>
                    {already && (
                      <>
                        <span className="imported-badge">GIÀ IMPORTATO</span>
                        <button
                          type="button"
                          className="button button-quiet reimport-button"
                          onClick={() => onMerge(book.file, importedSet!.id)}
                        >
                          <RefreshCw size={13} />
                          Confronta e unisci
                        </button>
                      </>
                    )}
                  </div>
                  {selected && expanded === book.file && (
                    <div className="workbook-config">
                      <label className="set-name-input">
                        <span>NOME DEL SET</span>
                        <input
                          value={names[book.file] ?? ''}
                          onChange={(event) => setNames({ ...names, [book.file]: event.target.value })}
                        />
                      </label>
                      <div className="field-choice-heading">
                        <span>CAMPI DA TENERE</span>
                        <span>TIPO DI CAMPO</span>
                      </div>
                      <div className="field-choice-list">
                        {(fields[book.file] ?? []).map((field) => (
                          <div className="field-choice" key={field.header}>
                            <label>
                              <input
                                type="checkbox"
                                checked={field.keep}
                                onChange={(event) =>
                                  updateField(book.file, field.header, { keep: event.target.checked })
                                }
                              />
                              <span>{field.header}</span>
                            </label>
                            <select
                              value={field.type}
                              onChange={(event) =>
                                updateField(book.file, field.header, {
                                  type: event.target.value as NonNullable<ColumnDefinition['type']>,
                                })
                              }
                            >
                              <option value="text">Testo</option>
                              <option value="longtext">Testo lungo</option>
                              <option value="number">Numero</option>
                              <option value="select">Select</option>
                              <option value="image">Immagine</option>
                              <option value="variable">Variabile</option>
                              <option value="color">Colore</option>
                              <option
                                value="id"
                                disabled={[
                                  'title',
                                  'titolo',
                                  'name',
                                  'nome',
                                  '[item amount]',
                                  'amount',
                                  'quantità',
                                  'quantita',
                                ].includes(field.header.trim().toLocaleLowerCase())}
                              >
                                ID automatico
                              </option>
                            </select>
                            {field.type === 'select' && (
                              <input
                                className="choice-options"
                                value={field.options}
                                onChange={(event) =>
                                  updateField(book.file, field.header, { options: event.target.value })
                                }
                                placeholder="opzioni separate da virgola"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              )
            })
          ) : (
            <div className="import-no-files">
              <FileSpreadsheet size={22} />
              <strong>Nessun file Excel trovato</strong>
              <span>Metti i fogli `.xlsx` nella cartella del progetto e aggiorna l’elenco.</span>
            </div>
          )}
        </div>
        <div className="import-panel-footer">
          <span>
            {plans.length} set · {plans.reduce((sum, plan) => sum + plan.fields.length, 0)} campi selezionati
          </span>
          <button className="button button-primary" disabled={!plans.length} onClick={() => onImport(plans)}>
            <Check size={15} />
            Importa {plans.length ? `${plans.length} set` : ''}
          </button>
        </div>
      </section>
    </>
  )
}
