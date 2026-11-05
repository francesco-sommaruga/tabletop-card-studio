export const slug = (value: string) =>
  `field_${
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || 'nuovo_campo'
  }`

export function suggestedGitHubRepoName(projectName: string) {
  return (
    projectName
      .trim()
      .toLocaleLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^[.-]+|[.-]+$/g, '')
      .slice(0, 100) || 'nuovo-progetto'
  )
}

export function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
