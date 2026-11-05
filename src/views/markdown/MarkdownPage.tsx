import type { MarkdownDocument } from '../../types'
import { MarkdownWorkspace } from './MarkdownWorkspace'

export function MarkdownPage({
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
  return (
    <div className="page-content github-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            DOCUMENTI DEL PROGETTO
          </div>
          <h1>
            Markdown<span className="heading-period">.</span>
          </h1>
          <p>Leggi e modifica README e gli altri documenti Markdown del progetto.</p>
        </div>
      </div>
      <MarkdownWorkspace
        onList={onList}
        onRead={onRead}
        onSave={onSave}
        onCreate={onCreate}
        onRename={onRename}
        onDelete={onDelete}
        onSaved={onSaved}
      />
    </div>
  )
}
