import type { PpmByExpiry, UptimeWindow } from '~~/shared/types/status'

const nf = new Intl.NumberFormat('en-US')

export const sats = (n: number | null | undefined) => (n == null ? '—' : `${nf.format(n)} sats`)

export function ppm(n: number): string {
  const pct = n / 10_000
  return `${pct.toLocaleString('en-US', { maximumFractionDigits: 3 })}%`
}

export function ppmRange(table: PpmByExpiry[]): string {
  if (!table.length) return '0%'
  const values = table.map(e => e.ppm)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  return lo === hi ? ppm(lo) : `${ppm(lo)}–${ppm(hi)}`
}

/** Combines fee parts, leaving out zeros. */
export function fee(baseSat: number, rate: string, minSat = 0, extra = ''): string {
  const parts: string[] = []
  if (baseSat) parts.push(sats(baseSat))
  if (rate !== '0%') parts.push(rate)
  if (extra) parts.push(extra)
  let out = parts.join(' + ') || 'Free'
  if (minSat) out += `, min ${sats(minSat)}`
  return out
}

/** Bitcoin blocks to a rough duration, assuming ~10 minutes per block. */
export function blocks(n: number): string {
  const minutes = n * 10
  if (minutes < 120) return `${n} blocks (~${minutes} min)`
  if (minutes < 48 * 60) return `${n} blocks (~${Math.round(minutes / 60)} h)`
  return `${n} blocks (~${Math.round(minutes / 1440)} days)`
}

export function duration(secs: number): string {
  if (secs < 120) return `${secs} s`
  if (secs < 7200) return `${Math.round(secs / 60)} min`
  return `${Math.round(secs / 3600)} h`
}

export function uptimePct(w: UptimeWindow): string {
  if (w.pct == null) return '—'
  return `${w.pct.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`
}

export function relative(iso: string | null, now: number): string {
  if (!iso) return 'never'
  const diff = Math.round((now - Date.parse(iso)) / 1000)
  const future = diff < 0
  const s = Math.abs(diff)
  const v = s < 60 ? `${s} s` : s < 3600 ? `${Math.round(s / 60)} min` : s < 172800 ? `${Math.round(s / 3600)} h` : `${Math.round(s / 86400)} days`
  return future ? `in ${v}` : `${v} ago`
}

export const shortKey = (hex: string) => (hex.length > 20 ? `${hex.slice(0, 10)}…${hex.slice(-8)}` : hex)
