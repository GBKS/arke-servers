const nf = new Intl.NumberFormat('en-US')

/** BIP-177: amounts in the base unit, written with the ₿ symbol. */
export const btc = (n: number | null | undefined) => (n == null ? '—' : `₿${nf.format(Math.round(n))}`)

/** A fee range at one amount, e.g. "₿200–500". */
export const btcRange = (lo: number, hi: number) =>
  Math.round(lo) === Math.round(hi) ? btc(lo) : `${btc(lo)}–${nf.format(Math.round(hi))}`

export const pct = (ppm: number) => `${(ppm / 10_000).toLocaleString('en-US', { maximumFractionDigits: 3 })}%`

/** Blocks to whole days, assuming ~144 blocks a day. */
export const days = (blocks: number) => Math.round(blocks / 144)

/** Blocks to whole hours, assuming ~6 blocks an hour. */
export const hours = (blocks: number) => Math.round(blocks / 6)

export function duration(secs: number): string {
  if (secs < 120) return `${secs} s`
  if (secs < 7200) return `${Math.round(secs / 60)} min`
  return `${Math.round(secs / 3600)} h`
}

export function relative(iso: string | null, now: number): string {
  if (!iso) return 'never'
  const diff = Math.round((now - Date.parse(iso)) / 1000)
  const future = diff < 0
  const s = Math.abs(diff)
  const v = s < 60 ? `${s} s` : s < 3600 ? `${Math.round(s / 60)} min` : s < 172800 ? `${Math.round(s / 3600)} h` : `${Math.round(s / 86400)} days`
  return future ? `in ${v}` : `${v} ago`
}

export const shortKey = (hex: string) => (hex.length > 24 ? `${hex.slice(0, 12)}…${hex.slice(-8)}` : hex)

export const serverUrl = (host: string) => `https://${host}`
