import { BookOpen, Copy, Pencil, Trash2 } from 'lucide-react'
import type { SetSummary } from '../hooks/useProjectSession'
import type { NativeSyncStatus } from '../types'

const syncDotTitle: Record<Exclude<NativeSyncStatus, 'synced'>, string> = {
  conflict: 'Conflitto con Tabletop Creator',
  error: 'Errore di sincronizzazione con Tabletop Creator',
}

export function SidebarSetList({
  sets,
  activeSetId,
  nativeSync,
  onChoose,
  onDuplicate,
  onRename,
  onDelete,
}: {
  sets: SetSummary[]
  activeSetId: string | null
  nativeSync: Record<string, NativeSyncStatus>
  onChoose: (id: string) => void
  onDuplicate: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string, name: string, cardCount: number) => void
}) {
  return (
    <div className="set-list">
      {sets.map((set) => (
        <div className="set-nav-row" key={set.id}>
          <button className={`set-nav ${set.id === activeSetId ? 'active' : ''}`} onClick={() => onChoose(set.id)}>
            <span className="set-nav-icon">
              <BookOpen size={15} />
            </span>
            <span className="set-nav-copy">
              <strong>{set.name}</strong>
              <small>{set.nativeSetFile ? `TC · ${set.nativeSetFile}` : set.sourceFile || 'Creato qui'}</small>
            </span>
            {nativeSync[set.id] && nativeSync[set.id] !== 'synced' && (
              <span
                className={`native-sync-dot ${nativeSync[set.id] === 'error' ? 'is-error' : ''}`}
                title={syncDotTitle[nativeSync[set.id] as Exclude<NativeSyncStatus, 'synced'>]}
              />
            )}
            <span className="set-count">{set.cardCount}</span>
          </button>
          <button
            className="set-nav-duplicate"
            aria-label={`Duplica il set ${set.name}`}
            title={`Duplica ${set.name}`}
            onClick={() => onDuplicate(set.id)}
          >
            <Copy size={12} />
          </button>
          <button
            className="set-nav-rename"
            aria-label={`Rinomina il set ${set.name}`}
            title={`Rinomina ${set.name}`}
            onClick={() => onRename(set.id, set.name)}
          >
            <Pencil size={13} />
          </button>
          <button
            className="set-nav-delete"
            aria-label={`Elimina il set ${set.name}`}
            title={`Elimina ${set.name}`}
            onClick={() => onDelete(set.id, set.name, set.cardCount)}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      {!sets.length && <div className="set-empty-note">Importa un foglio per creare il primo set.</div>}
    </div>
  )
}
