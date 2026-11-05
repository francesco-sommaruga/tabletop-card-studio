import type { ReactNode } from 'react'

export function MarkdownPreview({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  const inline = (text: string, keyPrefix: string): ReactNode[] => {
    const tokens = text.split(/(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|~~[^~]+~~|\*[^*]+\*)/g).filter(Boolean)
    return tokens.map((token, index) => {
      const key = `${keyPrefix}-${index}`
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (link) {
        const safe = /^(https?:|mailto:|#|\/)/i.test(link[2])
        return safe ? (
          <a key={key} href={link[2]} target={link[2].startsWith('http') ? '_blank' : undefined} rel="noreferrer">
            {link[1]}
          </a>
        ) : (
          <span key={key}>{link[1]}</span>
        )
      }
      if (token.startsWith('`')) return <code key={key}>{token.slice(1, -1)}</code>
      if (token.startsWith('**')) return <strong key={key}>{token.slice(2, -2)}</strong>
      if (token.startsWith('~~')) return <del key={key}>{token.slice(2, -2)}</del>
      if (token.startsWith('*')) return <em key={key}>{token.slice(1, -1)}</em>
      return <span key={key}>{token}</span>
    })
  }
  for (let index = 0; index < lines.length;) {
    const line = lines[index]
    if (!line.trim()) {
      index += 1
      continue
    }
    if (line.startsWith('```')) {
      const language = line.slice(3).trim()
      index += 1
      const code: string[] = []
      while (index < lines.length && !lines[index].startsWith('```')) code.push(lines[index++])
      index += 1
      blocks.push(
        <pre key={`code-${index}`} data-language={language}>
          <code>{code.join('\n')}</code>
        </pre>,
      )
      continue
    }
    if (line.includes('|') && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) {
      const cells = (row: string) =>
        row
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((cell) => cell.trim())
      const headers = cells(line)
      index += 2
      const rows: string[][] = []
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) rows.push(cells(lines[index++]))
      blocks.push(
        <div className="markdown-table-wrap" key={`table-${index}`}>
          <table>
            <thead>
              <tr>
                {headers.map((cell, i) => (
                  <th key={i}>{inline(cell, `th-${index}-${i}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {headers.map((_, ci) => (
                    <td key={ci}>{inline(row[ci] ?? '', `td-${index}-${ri}-${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const TagName = `h${heading[1].length}` as keyof JSX.IntrinsicElements
      blocks.push(<TagName key={`h-${index}`}>{inline(heading[2], `h-${index}`)}</TagName>)
      index += 1
      continue
    }
    if (/^\s*([-*_])\1\1+\s*$/.test(line)) {
      blocks.push(<hr key={`hr-${index}`} />)
      index += 1
      continue
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: ReactNode[] = []
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        const value = lines[index].replace(/^\s*[-*+]\s+/, '')
        items.push(<li key={`ul-${index}`}>{inline(value, `ul-${index}`)}</li>)
        index += 1
      }
      blocks.push(<ul key={`ul-list-${index}`}>{items}</ul>)
      continue
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: ReactNode[] = []
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        const value = lines[index].replace(/^\s*\d+\.\s+/, '')
        items.push(<li key={`ol-${index}`}>{inline(value, `ol-${index}`)}</li>)
        index += 1
      }
      blocks.push(<ol key={`ol-list-${index}`}>{items}</ol>)
      continue
    }
    if (line.startsWith('> ')) {
      const quote: string[] = []
      while (index < lines.length && lines[index].startsWith('> ')) quote.push(lines[index++].slice(2))
      blocks.push(
        <blockquote key={`quote-${index}`}>
          {quote.map((part, i) => (
            <p key={i}>{inline(part, `q-${index}-${i}`)}</p>
          ))}
        </blockquote>,
      )
      continue
    }
    const paragraph: string[] = []
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,6}\s|```|> |\s*[-*+]\s+|\s*\d+\.\s+)/.test(lines[index])
    )
      paragraph.push(lines[index++])
    blocks.push(
      <p key={`p-${index}`}>
        {paragraph.map((part, i) => (
          <span key={i}>
            {inline(part, `p-${index}-${i}`)}
            {i < paragraph.length - 1 && <br />}
          </span>
        ))}
      </p>,
    )
  }
  return <>{blocks}</>
}
