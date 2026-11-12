import {
  STATUS_VERSION,
  type CheckRecord,
  type DayUptime,
  type ServerConfig,
  type ServerInfo,
  type ServerStatus,
  type StatusFile,
  type UptimeWindow,
} from '../../shared/types/status'

const HOUR = 3600
const DAY = 24 * HOUR

const iso = (t: number | null | undefined) => (t ? new Date(t * 1000).toISOString() : null)

export function uptime(records: CheckRecord[], nowSecs: number, windowSecs: number): UptimeWindow {
  const from = nowSecs - windowSecs
  let checks = 0
  let ok = 0
  let since: number | null = null
  for (const r of records) {
    if (r.t < from || r.t > nowSecs) continue
    checks++
    if (r.ok) ok++
    if (since === null || r.t < since) since = r.t
  }
  return {
    pct: checks ? Math.round((ok / checks) * 10000) / 100 : null,
    checks,
    since: iso(since),
  }
}

/** Uptime per UTC day, oldest first, ending with today (so far). */
export function dailyUptime(records: CheckRecord[], nowSecs: number, days = 30): DayUptime[] {
  const today = Math.floor(nowSecs / DAY)
  const first = today - days + 1
  const ok = new Array<number>(days).fill(0)
  const all = new Array<number>(days).fill(0)
  for (const r of records) {
    const d = Math.floor(r.t / DAY) - first
    if (d < 0 || d >= days || r.t > nowSecs) continue
    all[d]!++
    if (r.ok) ok[d]!++
  }
  return all.map((n, d) => ({
    date: new Date((first + d) * DAY * 1000).toISOString().slice(0, 10),
    pct: n ? Math.round((ok[d]! / n) * 10000) / 100 : null,
  }))
}

export interface FreshInfo {
  info: ServerInfo
  observedAt: number
}

/**
 * Builds the status for one server from its check history (any order).
 * `fresh` is the info fetched in this run, if the server was reachable.
 * `previous` is the status from the last run, to carry last-known info forward.
 */
export function serverStatus(
  server: ServerConfig,
  records: CheckRecord[],
  nowSecs: number,
  fresh: FreshInfo | null,
  previous: ServerStatus | undefined,
): ServerStatus {
  const sorted = records.filter(r => r.id === server.id).sort((a, b) => a.t - b.t)
  const latest = sorted.at(-1)
  const lastOk = sorted.findLast(r => r.ok)

  // Only reuse previous info if the server identity hasn't changed in config.
  const carried = previous && previous.host === server.host ? previous : undefined

  return {
    id: server.id,
    name: server.name,
    host: server.host,
    state: !latest ? 'unknown' : latest.ok ? 'online' : 'offline',
    lastCheckedAt: iso(latest?.t),
    lastOnlineAt: iso(lastOk?.t) ?? carried?.lastOnlineAt ?? null,
    latencyMs: latest?.ok ? (latest.ms ?? null) : null,
    error: latest && !latest.ok ? (latest.e ?? 'unknown error') : null,
    uptime: {
      h24: uptime(sorted, nowSecs, DAY),
      d7: uptime(sorted, nowSecs, 7 * DAY),
      d30: uptime(sorted, nowSecs, 30 * DAY),
    },
    daily: dailyUptime(sorted, nowSecs),
    info: fresh?.info ?? carried?.info ?? null,
    infoObservedAt: fresh ? iso(fresh.observedAt) : (carried?.infoObservedAt ?? null),
  }
}

export function buildStatus(
  servers: ServerConfig[],
  records: CheckRecord[],
  nowSecs: number,
  fresh: Map<string, FreshInfo>,
  previous: StatusFile | null,
  checkIntervalSecs: number,
): StatusFile {
  const prevById = new Map((previous?.servers ?? []).map(s => [s.id, s]))
  return {
    version: STATUS_VERSION,
    generatedAt: iso(nowSecs)!,
    checkIntervalSecs,
    servers: servers.map(s => serverStatus(s, records, nowSecs, fresh.get(s.id) ?? null, prevById.get(s.id))),
  }
}
