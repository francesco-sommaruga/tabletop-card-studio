export function VariableTagPicker({
  tags,
  selected,
  onChange,
  className = '',
}: {
  tags: string[]
  selected: string[]
  onChange: (next: string[]) => void
  className?: string
}) {
  const toggle = (tag: string) =>
    onChange(selected.includes(tag) ? selected.filter((item) => item !== tag) : [...selected, tag])
  return (
    <div className={`variable-tag-picker ${className}`}>
      <span className="variable-tag-picker-label">
        TAG VARIABILI <small>{selected.length ? `${selected.length} selezionati` : 'tutte le variabili'}</small>
      </span>
      {tags.length ? (
        <div className="variable-tag-chips">
          {tags.map((tag) => (
            <button
              type="button"
              key={tag}
              className={selected.includes(tag) ? 'selected' : ''}
              aria-pressed={selected.includes(tag)}
              onClick={() => toggle(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      ) : (
        <span className="variable-tag-empty">Assegna tag alle variabili per poterle filtrare qui.</span>
      )}
    </div>
  )
}
