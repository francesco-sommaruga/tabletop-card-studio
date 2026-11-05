import { useState, useEffect } from 'react'
import { X, Braces, Check } from 'lucide-react'
import type { NativeSetInfo, ProjectSnapshot } from '../../types'
import { fieldsForBlueprint } from '../../lib/blueprint'

export function NativeSetLinkDialog({
  nativeSets,
  blueprints,
  sets,
  targetName,
  alreadyLinked,
  preferCreate,
  onClose,
  onLink,
  onCreate,
}: {
  nativeSets: NativeSetInfo[]
  blueprints: ProjectSnapshot['blueprints']
  sets: ProjectSnapshot['sets']
  targetName: string
  alreadyLinked: boolean
  preferCreate: boolean
  onClose: () => void
  onLink: (file: string, index: number) => Promise<void>
  onCreate: (name: string, blueprintName: string, fields: string[]) => Promise<void>
}) {
  const [mode, setMode] = useState<'link' | 'create'>(() => (preferCreate || !nativeSets.length ? 'create' : 'link'))
  const [closed, setClosed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selection, setSelection] = useState<NativeSetInfo | null>(null)
  const [newName, setNewName] = useState(targetName)
  const [blueprintName, setBlueprintName] = useState(
    () => blueprints.find((blueprint) => blueprint.name === 'blueprint_001')?.name ?? blueprints[0]?.name ?? '',
  )
  const chosenBlueprint = blueprints.find((blueprint) => blueprint.name === blueprintName)
  const firstForBlueprint = Boolean(blueprintName && !sets.some((set) => set.blueprintName === blueprintName))
  const candidates = chosenBlueprint ? fieldsForBlueprint(chosenBlueprint) : []
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  useEffect(() => {
    setSelectedFields(
      fieldsForBlueprint(blueprints.find((blueprint) => blueprint.name === blueprintName) ?? { name: '' }).map(
        (field) => field.header,
      ),
    )
  }, [blueprintName, blueprints])
  const closeAfter = (action: () => Promise<void>) => {
    setBusy(true)
    void action().finally(() => setBusy(false))
  }
  return (
    <>
      <button className="scrim" aria-label="Chiudi collegamento set nativo" onClick={onClose} />
      <section className="native-set-link-panel" role="dialog" aria-modal="true" aria-labelledby="native-link-title">
        <div className="editor-head">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />
              TABLETOP CREATOR · DATA/SETS
            </div>
            <h2 id="native-link-title">{mode === 'create' ? 'Crea un set.' : 'Collega un set.'}</h2>
          </div>
          <button type="button" className="icon-button close-editor" onClick={onClose} aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>
        <div className="native-link-intro">
          <p>
            {mode === 'create' ? (
              <>
                Scegli il blueprint per <strong>{targetName}</strong>. I set che usano lo stesso blueprint condividono
                la struttura dei campi.
              </>
            ) : (
              <>
                Collega <strong>{targetName}</strong> a un set Tabletop Creator esistente. Le carte verranno lette dal
                suo JSON nativo.
              </>
            )}
            {alreadyLinked && mode === 'link' && <span>Il collegamento attuale verrà sostituito.</span>}
          </p>
          <label>
            <input type="checkbox" checked={closed} onChange={(event) => setClosed(event.target.checked)} />
            <span>Ho chiuso Tabletop Creator per evitare conflitti di salvataggio.</span>
          </label>
        </div>
        {!alreadyLinked && (
          <div className="native-link-modes" role="tablist" aria-label="Modalità set">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'link'}
              className={mode === 'link' ? 'active' : ''}
              onClick={() => setMode('link')}
            >
              Collega set esistente
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'create'}
              className={mode === 'create' ? 'active' : ''}
              onClick={() => setMode('create')}
            >
              Crea nuovo set
            </button>
          </div>
        )}
        {mode === 'link' ? (
          <div className="native-link-list">
            {nativeSets.length ? (
              nativeSets.map((item) => (
                <button
                  type="button"
                  key={`${item.file}:${item.index}`}
                  className={`native-link-option ${selection?.file === item.file && selection.index === item.index ? 'selected' : ''}`}
                  onClick={() => setSelection(item)}
                  disabled={busy}
                >
                  <span className="native-link-icon">
                    <Braces size={16} />
                  </span>
                  <span className="native-link-copy">
                    <strong>{item.name}</strong>
                    <small>
                      {item.blueprintName || 'Blueprint non assegnato'} · {item.itemCount}{' '}
                      {item.itemCount === 1 ? 'carta' : 'carte'} · data/sets/{item.file}
                    </small>
                  </span>
                  {selection?.file === item.file && selection.index === item.index && <Check size={15} />}
                </button>
              ))
            ) : (
              <div className="native-link-empty">Non ho trovato set nativi disponibili.</div>
            )}
          </div>
        ) : (
          <div className="native-create-form">
            <label>
              <span>NOME DEL SET</span>
              <input
                autoFocus
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="es. set_006"
              />
            </label>
            <label>
              <span>BLUEPRINT</span>
              <select value={blueprintName} onChange={(event) => setBlueprintName(event.target.value)}>
                <option value="">Scegli un blueprint…</option>
                {blueprints.map((blueprint) => (
                  <option key={blueprint.name} value={blueprint.name}>
                    {blueprint.name} · {blueprint.type ?? 'componente'}
                  </option>
                ))}
              </select>
            </label>
            {blueprintName &&
              (firstForBlueprint ? (
                <>
                  <p>
                    Primo set con questo blueprint: scegli i campi ricavati dai pannelli del blueprint. Potrai
                    modificarli dopo.
                  </p>
                  <div className="field-choice-list">
                    {candidates.map((field) => (
                      <label className="field-choice" key={field.header}>
                        <input
                          type="checkbox"
                          checked={selectedFields.includes(field.header)}
                          onChange={(event) =>
                            setSelectedFields((current) =>
                              event.target.checked
                                ? [...current, field.header]
                                : current.filter((name) => name !== field.header),
                            )
                          }
                        />
                        <span>{field.header}</span>
                        <small className="field-choice-group">
                          {field.group} · {field.side === 'front' ? 'fronte' : 'retro'}
                        </small>
                        <small>
                          {field.type === 'image' ? 'Immagine' : field.type === 'color' ? 'Colore' : 'Testo'}
                        </small>
                      </label>
                    ))}
                    {!candidates.length && (
                      <small>
                        Il blueprint non espone campi editabili: potrai aggiungerli dalla sezione Campi e colonne.
                      </small>
                    )}
                  </div>
                </>
              ) : (
                <p>
                  La struttura campi è già condivisa dai{' '}
                  {sets.filter((set) => set.blueprintName === blueprintName).length} set che usano questo blueprint.
                </p>
              ))}
          </div>
        )}
        <footer className="native-link-footer">
          <span>
            {mode === 'create'
              ? `${blueprintName || 'Scegli un blueprint'} · ${newName.trim() || 'Nome richiesto'}`
              : selection
                ? `Collega ${selection.name}`
                : 'Seleziona un set nativo'}
          </span>
          <button type="button" className="button button-quiet" onClick={onClose} disabled={busy}>
            Annulla
          </button>
          {mode === 'create' ? (
            <button
              type="button"
              className="button button-primary"
              disabled={!closed || !newName.trim() || !blueprintName || busy}
              onClick={() => closeAfter(() => onCreate(newName, blueprintName, selectedFields))}
            >
              {busy ? 'Creazione…' : 'Crea e collega'}
            </button>
          ) : (
            <button
              type="button"
              className="button button-primary"
              disabled={!closed || !selection || busy}
              onClick={() => {
                if (selection) closeAfter(() => onLink(selection.file, selection.index))
              }}
            >
              {busy ? 'Collegamento…' : 'Collega al set corrente'}
            </button>
          )}
        </footer>
      </section>
    </>
  )
}
