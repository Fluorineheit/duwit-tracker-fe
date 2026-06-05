const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

/** Format a number as Indonesian Rupiah, e.g. "Rp 25.000". */
export function formatIDR(amount: number): string {
  return rupiahFormatter.format(Number(amount))
}

/** Format an ISO/RFC3339 timestamp as "dd MMM yyyy" in id-ID. */
export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso))
}

/** Format a Date as a local YYYY-MM-DD string (no timezone shift). */
export function toDateParam(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** First day of the current month as YYYY-MM-DD. */
export function monthStartISO(): string {
  const now = new Date()
  return toDateParam(new Date(now.getFullYear(), now.getMonth(), 1))
}

/** Today as YYYY-MM-DD. */
export function todayISO(): string {
  return toDateParam(new Date())
}

/** First and last day of the given date's month as YYYY-MM-DD strings. */
export function monthRange(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return { start: toDateParam(start), end: toDateParam(end) }
}

/** First day of the given date's month as YYYY-MM-DD (used for the budget `month` field). */
export function firstOfMonthParam(date: Date): string {
  return toDateParam(new Date(date.getFullYear(), date.getMonth(), 1))
}

const monthFormatter = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })

/** Format an ISO/RFC3339 timestamp as a month + year label, e.g. "Juni 2026". */
export function formatMonth(iso: string): string {
  return monthFormatter.format(new Date(iso))
}
