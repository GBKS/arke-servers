import type { FeeSchedule, PpmByExpiry, ServerInfo } from '../../shared/types/status'

type Obj = Record<string, any>

// Servers send this PSA to any client that doesn't report a Bark version in
// the handshake. The probe isn't Bark, so it isn't a real announcement.
const NO_VERSION_PSA_PREFIX = 'Your bark client did not identify its version'

const num = (v: unknown): number => (v == null || v === '' ? 0 : Number(v))
const optNum = (v: unknown): number | null => (v == null || v === '' ? null : Number(v))
const optStr = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

export function toHex(bytes: unknown): string {
  if (!bytes) return ''
  return Array.from(bytes as ArrayLike<number>, b => b.toString(16).padStart(2, '0')).join('')
}

function ppmTable(entries: unknown): PpmByExpiry[] {
  if (!Array.isArray(entries)) return []
  return entries
    .map((e: Obj) => ({ expiryBlocksThreshold: num(e.expiryBlocksThreshold), ppm: num(e.ppm) }))
    .sort((a, b) => a.expiryBlocksThreshold - b.expiryBlocksThreshold)
}

export function normalizeFees(f: Obj | null | undefined): FeeSchedule | null {
  if (!f) return null
  return {
    board: {
      minFeeSat: num(f.board?.minFeeSat),
      baseFeeSat: num(f.board?.baseFeeSat),
      ppm: num(f.board?.ppm),
    },
    offboard: {
      baseFeeSat: num(f.offboard?.baseFeeSat),
      fixedAdditionalVb: num(f.offboard?.fixedAdditionalVb),
      ppmByExpiry: ppmTable(f.offboard?.ppmExpiryTable),
    },
    refresh: {
      baseFeeSat: num(f.refresh?.baseFeeSat),
      ppmByExpiry: ppmTable(f.refresh?.ppmExpiryTable),
    },
    lightningReceive: {
      baseFeeSat: num(f.lightningReceive?.baseFeeSat),
      ppm: num(f.lightningReceive?.ppm),
    },
    lightningSend: {
      minFeeSat: num(f.lightningSend?.minFeeSat),
      baseFeeSat: num(f.lightningSend?.baseFeeSat),
      ppmByExpiry: ppmTable(f.lightningSend?.ppmExpiryTable),
    },
  }
}

export function cleanPsa(psa: unknown): string | null {
  const s = optStr(psa)
  if (!s || s.startsWith(NO_VERSION_PSA_PREFIX)) return null
  return s.slice(0, 1000)
}

function safeLink(v: unknown): string | null {
  const s = optStr(v)
  if (!s) return null
  try {
    const u = new URL(s)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

export interface RawResponses {
  arkInfo: Obj
  handshake: Obj | null
  offboardFeeRate: Obj | null
  nextRoundTime: Obj | null
}

export function normalizeInfo(r: RawResponses): ServerInfo {
  const a = r.arkInfo
  const nextTs = optNum(r.nextRoundTime?.timestamp)
  const mailbox = toHex(a.mailboxPubkey)
  const lifetime = num(a.vtxoLifetime) || num(a.vtxoExpiryDelta) // older servers only set the deprecated field
  return {
    network: String(a.network ?? ''),
    serverPubkey: toHex(a.serverPubkey),
    mailboxPubkey: mailbox || null,
    protocol: r.handshake
      ? { min: num(r.handshake.minProtocolVersion), max: num(r.handshake.maxProtocolVersion) }
      : null,
    psa: cleanPsa(r.handshake?.psa),
    tosLink: safeLink(a.tosLink),
    roundIntervalSecs: num(a.roundIntervalSecs),
    nextRoundAt: nextTs ? new Date(nextTs * 1000).toISOString() : null,
    vtxoLifetimeBlocks: lifetime,
    vtxoExitDeltaBlocks: num(a.vtxoExitDelta),
    maxVtxoExitDepth: num(a.maxVtxoExitDepth),
    minBoardAmountSat: num(a.minBoardAmount),
    maxVtxoAmountSat: optNum(a.maxVtxoAmount),
    requiredBoardConfirmations: num(a.requiredBoardConfirmations),
    offboardFeeRateSatVkb: optNum(r.offboardFeeRate?.satVkb),
    fees: normalizeFees(a.fees),
  }
}
