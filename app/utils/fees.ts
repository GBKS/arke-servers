import type { FeeSchedule, PpmByExpiry, ServerInfo } from '~~/shared/types/status'

export type FeeKind = 'lnSend' | 'lnRecv' | 'refresh' | 'board' | 'offboard'

export const ACTIONS: { kind: FeeKind; label: string; sub: string }[] = [
  { kind: 'lnSend', label: 'Lightning send', sub: 'Paying an invoice. Routing included' },
  { kind: 'lnRecv', label: 'Lightning receive', sub: 'Getting paid' },
  { kind: 'refresh', label: 'Refresh', sub: 'Renewing VTXOs before they expire' },
  { kind: 'board', label: 'Board', sub: 'Moving bitcoin onto Ark. Plus mining fee' },
  { kind: 'offboard', label: 'Offboard', sub: 'Moving bitcoin back on-chain. Plus mining fee' },
]

/** One fee as advertised: base + ppm (a range when it depends on VTXO age), with a minimum. */
export interface FeeRule {
  base: number
  min: number
  ppm: [number, number]
  byAge: boolean
}

const span = (t: PpmByExpiry[]): [number, number] => {
  const v = t.map(e => e.ppm)
  return v.length ? [Math.min(...v), Math.max(...v)] : [0, 0]
}

export function feeRule(kind: FeeKind, f: FeeSchedule): FeeRule {
  switch (kind) {
    case 'board': return { base: f.board.baseFeeSat, min: f.board.minFeeSat, ppm: [f.board.ppm, f.board.ppm], byAge: false }
    case 'lnRecv': return { base: f.lightningReceive.baseFeeSat, min: 0, ppm: [f.lightningReceive.ppm, f.lightningReceive.ppm], byAge: false }
    case 'lnSend': return { base: f.lightningSend.baseFeeSat, min: f.lightningSend.minFeeSat, ppm: span(f.lightningSend.ppmByExpiry), byAge: true }
    case 'refresh': return { base: f.refresh.baseFeeSat, min: 0, ppm: span(f.refresh.ppmByExpiry), byAge: true }
    case 'offboard': return { base: f.offboard.baseFeeSat, min: 0, ppm: span(f.offboard.ppmByExpiry), byAge: true }
  }
}

export const isFree = (r: FeeRule) => !r.base && !r.min && !r.ppm[1]
export const variesByAge = (r: FeeRule) => r.byAge && r.ppm[0] !== r.ppm[1]

const feeAt = (r: FeeRule, amount: number, ppm: number) => Math.max(r.min, r.base + (ppm * amount) / 1e6)
export const feeRange = (r: FeeRule, amount: number): [number, number] => [feeAt(r, amount, r.ppm[0]), feeAt(r, amount, r.ppm[1])]

export function ruleText(r: FeeRule): string {
  if (isFree(r)) return 'Free'
  const parts: string[] = []
  if (r.base) parts.push(btc(r.base))
  if (r.ppm[1]) parts.push(r.ppm[0] === r.ppm[1] ? pct(r.ppm[0]) : `${pct(r.ppm[0])}–${pct(r.ppm[1])}`)
  let s = parts.join(' + ') || '₿0'
  if (r.min) s += `, min ${btc(r.min)}`
  return s
}

/** Context for each fee beyond the advertised numbers. */
export function feeNotes(kind: FeeKind, r: FeeRule, i: ServerInfo): string[] {
  const n: string[] = []
  if (kind === 'lnSend') n.push('Includes Lightning routing')
  if (kind === 'lnRecv') n.push('The sender pays their own routing')
  if (kind === 'refresh') n.push('Happens automatically before VTXOs expire')
  if (kind === 'board') {
    const c = i.requiredBoardConfirmations
    n.push(`Plus the mining fee for your deposit. Usable after ${c} confirmation${c === 1 ? '' : 's'}`)
  }
  if (kind === 'offboard') {
    const rate = i.offboardFeeRateSatVkb
    n.push(`Plus a Bitcoin mining fee${rate ? `, currently ${(rate / 1000).toLocaleString('en-US')} sat/vB` : ''}`)
  }
  if (variesByAge(r)) n.push('Higher when you spend a newer VTXO')
  return n
}
