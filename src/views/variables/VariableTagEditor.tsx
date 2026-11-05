import { useState } from 'react'
import { X } from 'lucide-react'

export function VariableTagEditor({
  value,
  suggestions,
  onChange,
}: {
  value: string[]
  suggestions: string[]
  onChange: (value: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const normalized = query.trim().toLocaleLowerCase()
  const matches = normalized
    ? suggestions.filter(
        (tag) =>
          tag.toLocaleLowerCase().includes(normalized) &&
          !value.some((selected) => selected.toLocaleLowerCase() === tag.toLocaleLowerCase()),
      )
    : []
  const add = (tag: string) => {
    const cleaned = tag.trim()
    if (cleaned && !value.some((selected) => selected.toLocaleLowerCase() === cleaned.toLocaleLowerCase()))
      onChange([...value, cleaned])
    setQuery('')
    setOpen(false)
    setActiveIndex(0)
  }
  const remove = (tag: string) =>
    onChange(value.filter((selected) => selected.toLocaleLowerCase() !== tag.toLocaleLowerCase()))
  return (
    <div className="variable-tags-edit">
      <span>
        TAG DELLA VARIABILE <small>Invio per aggiungere · suggerimenti dai tag esistenti</small>
      </span>
      <div className="variable-tag-composer">
        <div className="variable-tag-chips">
          {value.map((tag) => (
            <span className="variable-tag-chip" key={tag}>
              {tag}
              <button type="button" onClick={() => remove(tag)} aria-label={`Rimuovi tag ${tag}`}>
                <X size={11} />
              </button>
            </span>
          ))}
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
              setActiveIndex(0)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                const exact = matches.find((tag) => tag.toLocaleLowerCase() === normalized)
                add(exact ?? query)
              } else if (event.key === 'ArrowDown' && matches.length) {
                event.preventDefault()
                setOpen(true)
                setActiveIndex((index) => (index + 1) % matches.length)
              } else if (event.key === 'ArrowUp' && matches.length) {
                event.preventDefault()
                setActiveIndex((index) => (index - 1 + matches.length) % matches.length)
              } else if (event.key === 'Escape') setOpen(false)
              else if (event.key === 'Backspace' && !query && value.length) remove(value[value.length - 1])
            }}
            placeholder={value.length ? 'Aggiungi un tag…' : 'es. costo, risorsa, rarità'}
            aria-label="Aggiungi tag alla variabile"
            aria-autocomplete="list"
            aria-expanded={open && matches.length > 0}
          />
        </div>
        {open && matches.length > 0 && (
          <div className="variable-tag-suggestions" role="listbox" aria-label="Tag esistenti">
            {matches.slice(0, 8).map((tag, index) => (
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                key={tag}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => add(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
