import { useState, useEffect } from 'react'
import { FileText, Settings, BookOpen, Braces, X, ArrowRightLeft, Check, CircleHelp } from 'lucide-react'
import type { ProjectSnapshot, NativeSetInfo } from '../types'

export function ProjectSettingsPage({
  projectName,
  projectPath,
  sets,
  nativeSets,
  blueprints,
  onLink,
  onUnlink,
  onSaveBlueprints,
  onDirty,
  onOpenLog,
}: {
  projectName: string
  projectPath: string
  sets: ProjectSnapshot['sets']
  nativeSets: NativeSetInfo[]
  blueprints: ProjectSnapshot['blueprints']
  onLink: (setId: string) => void
  onUnlink: (setId: string, setName: string) => void
  onSaveBlueprints: (assignments: Record<string, string>) => Promise<void>
  onDirty: (dirty: boolean) => void
  onOpenLog: () => void
}) {
  const [blueprintDraft, setBlueprintDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(sets.map((set) => [set.id, set.blueprintName ?? ''])),
  )
  const [savingBlueprints, setSavingBlueprints] = useState(false)
  const [blueprintError, setBlueprintError] = useState('')
  useEffect(() => {
    setBlueprintDraft(Object.fromEntries(sets.map((set) => [set.id, set.blueprintName ?? ''])))
  }, [sets])
  const blueprintDirty = sets.some((set) => (blueprintDraft[set.id] ?? '') !== (set.blueprintName ?? ''))
  useEffect(() => {
    onDirty(blueprintDirty)
  }, [blueprintDirty, onDirty])
  const cancelBlueprints = () => {
    setBlueprintDraft(Object.fromEntries(sets.map((set) => [set.id, set.blueprintName ?? ''])))
    setBlueprintError('')
    onDirty(false)
  }
  const saveBlueprints = async () => {
    setSavingBlueprints(true)
    setBlueprintError('')
    try {
      await onSaveBlueprints(blueprintDraft)
      onDirty(false)
    } catch (error) {
      setBlueprintError(error instanceof Error ? error.message : 'Impossibile salvare i blueprint')
    } finally {
      setSavingBlueprints(false)
    }
  }
  const linked = (set: ProjectSnapshot['sets'][number]) =>
    nativeSets.find((item) => item.file === set.nativeSetFile && item.index === set.nativeSetIndex)
  const linkedKey = (item: NativeSetInfo) => `${item.file}:${item.index}`
  const assignedNativeKeys = new Set(
    sets
      .filter((set) => set.nativeSetFile && set.nativeSetIndex !== undefined)
      .map((set) => `${set.nativeSetFile}:${set.nativeSetIndex}`),
  )
  const available = nativeSets.filter((item) => !assignedNativeKeys.has(linkedKey(item)))
  const connectedCount = sets.filter((set) => Boolean(set.nativeSetFile)).length
  return (
    <div className="page-content project-settings-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            PROGETTO · IMPOSTAZIONI
          </div>
          <h1>
            Collegamenti<span className="heading-period">.</span>
          </h1>
          <p>Gestisci l’associazione uno a uno tra i set Card Studio e quelli di Tabletop Creator.</p>
        </div>
        <button type="button" className="button button-quiet" onClick={onOpenLog}>
          <FileText size={15} />
          Apri log diagnostico
        </button>
      </div>
      <section className="project-settings-intro">
        <div className="settings-intro-icon">
          <Settings size={18} />
        </div>
        <div>
          <strong>{projectName}</strong>
          <span>{projectPath}</span>
        </div>
        <div className="settings-intro-count">
          <b>{connectedCount}</b>
          <small>COLLEGATI</small>
        </div>
      </section>
      <section className="settings-section">
        <header className="settings-section-head">
          <div>
            <span className="metric-label">ASSOCIAZIONI</span>
            <h2>Set collegati</h2>
          </div>
          <span>
            {connectedCount} / {sets.length}
          </span>
        </header>
        {sets.length ? (
          <div className="set-connection-list">
            {sets.map((set) => {
              const native = linked(set)
              const orphaned = Boolean(set.nativeSetFile && !native)
              const duplicates = native
                ? sets.filter(
                    (candidate) =>
                      candidate.nativeSetFile === set.nativeSetFile && candidate.nativeSetIndex === set.nativeSetIndex,
                  ).length
                : 0
              return (
                <article
                  className={`set-connection-row ${native ? 'is-connected' : orphaned ? 'is-orphaned' : ''}`}
                  key={set.id}
                >
                  <div className="connection-endpoint cms-endpoint">
                    <span className="connection-app-mark cms-mark">
                      <BookOpen size={14} />
                    </span>
                    <span>
                      <small>CARD STUDIO</small>
                      <strong>{set.name}</strong>
                      <em>
                        {set.cardCount} {set.cardCount === 1 ? 'carta' : 'carte'}
                      </em>
                      <label className="connection-blueprint">
                        <span>BLUEPRINT CAMPI</span>
                        <select
                          value={set.nativeSetFile ? (set.blueprintName ?? '') : (blueprintDraft[set.id] ?? '')}
                          disabled={Boolean(set.nativeSetFile)}
                          onChange={(event) => {
                            setBlueprintDraft((current) => ({ ...current, [set.id]: event.target.value }))
                            setBlueprintError('')
                          }}
                        >
                          <option value="">Campi indipendenti</option>
                          {blueprints.map((blueprint) => (
                            <option key={blueprint.name} value={blueprint.name}>
                              {blueprint.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {set.nativeSetFile && <em>Definito dal set nativo collegato</em>}
                    </span>
                  </div>
                  <span className={`connection-link-mark ${native ? 'connected' : ''}`} aria-hidden="true">
                    <span />
                  </span>
                  <div className="connection-endpoint native-endpoint">
                    <span className="connection-app-mark native-mark">
                      <Braces size={14} />
                    </span>
                    {native ? (
                      <span>
                        <small>TABLETOP CREATOR</small>
                        <strong>{native.name}</strong>
                        <em>
                          {native.blueprintName || 'Blueprint non assegnato'} · data/sets/{native.file}
                        </em>
                        {duplicates > 1 && (
                          <b className="connection-warning">
                            Collegamento duplicato presente · scollega le associazioni in eccesso
                          </b>
                        )}
                      </span>
                    ) : orphaned ? (
                      <span>
                        <small>COLLEGAMENTO NON TROVATO</small>
                        <strong>{set.nativeSetFile}</strong>
                        <em>Il set nativo è stato spostato o rimosso.</em>
                      </span>
                    ) : (
                      <span>
                        <small>TABLETOP CREATOR</small>
                        <strong>Nessun set collegato</strong>
                        <em>Collega un set esistente o creane uno nuovo.</em>
                      </span>
                    )}
                  </div>
                  <div className="connection-row-action">
                    {set.nativeSetFile ? (
                      <button
                        type="button"
                        className="button button-quiet connection-unlink"
                        onClick={() => onUnlink(set.id, set.name)}
                      >
                        <X size={13} />
                        Scollega
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button button-primary connection-link-button"
                        onClick={() => onLink(set.id)}
                      >
                        <ArrowRightLeft size={13} />
                        Collega
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="settings-empty">Non ci sono set Card Studio nel progetto.</div>
        )}
      </section>
      <div className="blueprint-assignments-footer">
        <span className={blueprintError ? 'blueprint-save-error' : blueprintDirty ? 'unsaved-note' : ''}>
          {blueprintError ||
            (blueprintDirty
              ? 'Associazioni ai blueprint non salvate'
              : 'I campi associati a un blueprint vengono condivisi tra i set collegati')}
        </span>
        <div>
          <button
            type="button"
            className="text-button"
            onClick={cancelBlueprints}
            disabled={!blueprintDirty || savingBlueprints}
          >
            Annulla
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => void saveBlueprints()}
            disabled={!blueprintDirty || savingBlueprints}
          >
            <Check size={14} />
            {savingBlueprints ? 'Salvataggio…' : 'Salva associazioni'}
          </button>
        </div>
      </div>
      <section className="settings-section unassigned-native-section">
        <header className="settings-section-head">
          <div>
            <span className="metric-label">TABLETOP CREATOR · DATA/SETS</span>
            <h2>Set nativi disponibili</h2>
          </div>
          <span>{available.length}</span>
        </header>
        {available.length ? (
          <div className="unassigned-native-list">
            {available.map((item) => (
              <div className="unassigned-native-row" key={`${item.file}:${item.index}`}>
                <span className="connection-app-mark native-mark">
                  <Braces size={13} />
                </span>
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.blueprintName || 'Blueprint non assegnato'} · {item.itemCount}{' '}
                    {item.itemCount === 1 ? 'carta' : 'carte'} · data/sets/{item.file}
                  </small>
                </span>
                <span className="unassigned-badge">NON COLLEGATO</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="settings-empty">
            Tutti i set nativi trovati sono collegati, oppure la cartella data/sets non contiene set. Puoi creare un set
            nativo dalla riga di un set Card Studio non collegato.
          </div>
        )}
      </section>
      <p className="settings-note">
        <CircleHelp size={14} />
        Scollegare rimuove solo l’associazione in Card Studio. Non elimina né modifica i dati dei due set.
      </p>
    </div>
  )
}
