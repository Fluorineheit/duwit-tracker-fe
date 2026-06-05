import type { Expense } from '@/api/types'

export interface SourceBadge {
  label: string
  severity: 'info' | 'success' | 'secondary' | 'warn'
}

const badges: Record<Expense['source'], SourceBadge> = {
  manual: { label: 'Manual', severity: 'info' },
  telegram: { label: 'Telegram', severity: 'success' },
  import: { label: 'Import', severity: 'secondary' },
  ai: { label: 'AI', severity: 'warn' },
}

const fallbackBadge: SourceBadge = { label: 'Unknown', severity: 'secondary' }

/** Resolve a PrimeVue Tag descriptor for an expense source value. */
export function sourceBadge(source: string | null | undefined): SourceBadge {
  if (source && source in badges) {
    return badges[source as Expense['source']]
  }
  return fallbackBadge
}
