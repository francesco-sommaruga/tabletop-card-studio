import type { ProjectVariable } from '../../types'
import { IconPreview } from './IconPreview'
import { variableIconTint } from '../../lib/variables'

export function VariableTextPreview({
  value,
  variables,
  projectPath,
  className = 'variable-render-preview',
  inline = false,
}: {
  value: string
  variables: ProjectVariable[]
  projectPath: string
  className?: string
  inline?: boolean
}) {
  const normalized = value.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')
  const segments = normalized.split(/(\{[^{}]+\})/g)
  if (!segments.some((segment) => /^\{[^{}]+\}$/.test(segment))) return null
  const Wrapper = inline ? 'span' : 'div'
  return (
    <Wrapper className={className} aria-label="Anteprima testo con variabili">
      {segments.map((segment, index) => {
        const match = segment.match(/^\{\s*(.*?)\s*\}$/)
        if (!match) return <span key={index}>{segment}</span>
        const token = match[1]
        const variable = variables.find((item) => item.code.toLocaleLowerCase() === token.toLocaleLowerCase())
        if (variable?.studioType === 'icon')
          return (
            <IconPreview
              key={index}
              reference={variable.replacement}
              projectPath={projectPath}
              className="inline-variable-icon"
              tint={variableIconTint(variable, 'currentColor')}
            />
          )
        if (variable) return <span key={index}>{variable.replacement}</span>
        if (token.includes('/') || /\.(png|svg|webp|jpe?g)$/i.test(token))
          return (
            <IconPreview key={index} reference={token} projectPath={projectPath} className="inline-variable-icon" />
          )
        return <span key={index}>{segment}</span>
      })}
    </Wrapper>
  )
}
