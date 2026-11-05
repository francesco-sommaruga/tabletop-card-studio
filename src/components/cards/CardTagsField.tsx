import { useState } from 'react'
import { Plus, Tag, X } from 'lucide-react'

/** Card editor tag list: type a tag and press Enter to add it, click a pill to remove it. */
export function CardTagsField({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [tagInput, setTagInput] = useState('')
  const addTag = () => {
    const tag = tagInput.trim()
    if (tag && !tags.includes(tag)) onChange([...tags, tag])
    setTagInput('')
  }
  return (
    <div className="field-group">
      <label>
        TAG <span className="label-hint">· premi Invio per aggiungere</span>
      </label>
      <div className="tag-entry">
        <Tag size={15} />
        <input
          value={tagInput}
          onChange={(event) => setTagInput(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), addTag())}
          placeholder="es. azione, risorsa, raro"
        />
        <button onClick={addTag} aria-label="Aggiungi tag">
          <Plus size={16} />
        </button>
      </div>
      <div className="editor-tags">
        {tags.map((tag) => (
          <button
            key={tag}
            className="tag-pill editable-tag"
            onClick={() => onChange(tags.filter((item) => item !== tag))}
          >
            {tag}
            <X size={11} />
          </button>
        ))}
      </div>
    </div>
  )
}
