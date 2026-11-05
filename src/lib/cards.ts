import type { ColumnDefinition, Card } from '../types'
import { ensureGeneratedIdValues } from '../generatedIds'

export const blankCard = (columns: ColumnDefinition[] = []): Card =>
  ensureGeneratedIdValues(
    [
      {
        id: `card_${crypto.randomUUID()}`,
        title: 'Nuova carta',
        status: 'Idea',
        tags: [],
        quantity: 1,
        values: {},
        updatedAt: new Date().toISOString(),
      },
    ],
    columns,
    () => crypto.randomUUID(),
  )[0]
