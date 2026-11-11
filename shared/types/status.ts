// Shape of data/status.json, which is also published as /servers.json.
// Bump STATUS_VERSION when making breaking changes.

export const STATUS_VERSION = 1

export type ServerState = 'online' | 'offline' | 'unknown'

export interface ServerConfig {
  id: string
  name: string
  host: string
}

/** One line in data/history/YYYY-MM.jsonl. */
export interface CheckRecord {
  /** Unix seconds when the check started. */
  t: number
  /** Server id from servers.json. */
  id: string
  ok: boolean
  /** Health check round-trip in milliseconds (only when ok). */
  ms?: number
  /** Short error description (only when not ok). */
  e?: string
}

export interface UptimeWindow {
  /** Percentage of successful checks in the window, or null with no checks. */
  pct: number | null
  checks: number
  /** Timestamp of the oldest check in the window. Later than the window start while tracking is new. */
  since: string | null
}

export interface PpmByExpiry {
  /** Applies when the VTXO expires in at least this many blocks. */
  expiryBlocksThreshold: number
  ppm: number
}

export interface FeeSchedule {
  board: { minFeeSat: number; baseFeeSat: number; ppm: number }
  offboard: { baseFeeSat: number; fixedAdditionalVb: number; ppmByExpiry: PpmByExpiry[] }
  refresh: { baseFeeSat: number; ppmByExpiry: PpmByExpiry[] }
  lightningReceive: { baseFeeSat: number; ppm: number }
  lightningSend: { minFeeSat: number; baseFeeSat: number; ppmByExpiry: PpmByExpiry[] }
}

/** Configuration the server advertises about itself. Not verified. */
export interface ServerInfo {
  network: string
  serverPubkey: string
  mailboxPubkey: string | null
  protocol: { min: number; max: number } | null
  psa: string | null
  tosLink: string | null
  roundIntervalSecs: number
  nextRoundAt: string | null
  vtxoLifetimeBlocks: number
  vtxoExitDeltaBlocks: number
  maxVtxoExitDepth: number
  minBoardAmountSat: number
  maxVtxoAmountSat: number | null
  requiredBoardConfirmations: number
  offboardFeeRateSatVkb: number | null
  fees: FeeSchedule | null
}

export interface ServerStatus {
  id: string
  name: string
  host: string
  state: ServerState
  lastCheckedAt: string | null
  lastOnlineAt: string | null
  latencyMs: number | null
  error: string | null
  uptime: { h24: UptimeWindow; d7: UptimeWindow; d30: UptimeWindow }
  /** Last successfully retrieved info. May be older than lastCheckedAt when offline. */
  info: ServerInfo | null
  infoObservedAt: string | null
}

export interface StatusFile {
  version: number
  generatedAt: string
  /** Approximate interval between checks, in seconds. */
  checkIntervalSecs: number
  servers: ServerStatus[]
}
