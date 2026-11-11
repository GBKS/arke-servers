// Checks every server in servers.json once, appends the results to
// data/history/, and rewrites data/status.json. Run on a schedule by
// .github/workflows/probe.yml. A failing server never fails the run.

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { CheckRecord, ServerConfig, StatusFile } from '../shared/types/status'
import { parseServers } from './lib/config'
import { unary } from './lib/grpcweb'
import { readHistory, appendHistory } from './lib/history'
import { normalizeInfo } from './lib/normalize'
import { buildStatus, type FreshInfo } from './lib/status'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const HISTORY_DIR = ROOT + 'data/history'
const STATUS_FILE = ROOT + 'data/status.json'
const SERVERS_FILE = ROOT + 'servers.json'

const CALL_TIMEOUT_MS = 10_000
const ATTEMPTS = 2
const RETRY_DELAY_MS = 3_000
// Keep in sync with the cron schedule in .github/workflows/probe.yml.
const CHECK_INTERVAL_SECS = 600
const HISTORY_WINDOW_SECS = 30 * 24 * 3600

const ARK = 'bark_server.ArkService'

async function checkOnce(host: string): Promise<{ ms: number; fresh: FreshInfo }> {
  const observedAt = Math.floor(Date.now() / 1000)
  const t0 = performance.now()
  const health = await unary<{ status: string }>(
    host, 'grpc.health.v1.Health/Check',
    'grpc.health.v1.HealthCheckRequest', { service: '' },
    'grpc.health.v1.HealthCheckResponse', CALL_TIMEOUT_MS,
  )
  const ms = Math.round(performance.now() - t0)
  if (health.status !== 'SERVING') throw new Error(`health: ${health.status}`)

  const optional = <T>(p: Promise<T>) => p.catch(() => null)
  const [arkInfo, handshake, offboardFeeRate, nextRoundTime] = await Promise.all([
    unary(host, `${ARK}/GetArkInfo`, 'core.Empty', {}, 'bark_server.ArkInfo', CALL_TIMEOUT_MS),
    optional(unary(host, `${ARK}/Handshake`, 'bark_server.HandshakeRequest', {}, 'bark_server.HandshakeResponse', CALL_TIMEOUT_MS)),
    optional(unary(host, `${ARK}/GetOffboardFeeRate`, 'core.Empty', {}, 'bark_server.OffboardFeeRateResponse', CALL_TIMEOUT_MS)),
    optional(unary(host, `${ARK}/NextRoundTime`, 'core.Empty', {}, 'bark_server.NextRoundTimeResponse', CALL_TIMEOUT_MS)),
  ])

  return { ms, fresh: { info: normalizeInfo({ arkInfo, handshake, offboardFeeRate, nextRoundTime }), observedAt } }
}

async function check(server: ServerConfig, t: number): Promise<{ record: CheckRecord; fresh: FreshInfo | null }> {
  let lastError = 'unknown error'
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const { ms, fresh } = await checkOnce(server.host)
      return { record: { t, id: server.id, ok: true, ms }, fresh }
    } catch (err) {
      lastError = String((err as Error).message ?? err).slice(0, 200)
      if (attempt < ATTEMPTS) await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
    }
  }
  return { record: { t, id: server.id, ok: false, e: lastError }, fresh: null }
}

async function readPrevious(): Promise<StatusFile | null> {
  try {
    return JSON.parse(await readFile(STATUS_FILE, 'utf8'))
  } catch {
    return null
  }
}

async function main() {
  const servers = parseServers(JSON.parse(await readFile(SERVERS_FILE, 'utf8')))
  const t = Math.floor(Date.now() / 1000)

  const results = await Promise.all(servers.map(s => check(s, t)))
  const records = results.map(r => r.record)
  await appendHistory(HISTORY_DIR, records)

  const fresh = new Map<string, FreshInfo>()
  results.forEach((r, i) => r.fresh && fresh.set(servers[i]!.id, r.fresh))

  const now = Math.floor(Date.now() / 1000)
  const history = await readHistory(HISTORY_DIR, now - HISTORY_WINDOW_SECS, now)
  const status = buildStatus(servers, history, now, fresh, await readPrevious(), CHECK_INTERVAL_SECS)
  await writeFile(STATUS_FILE, JSON.stringify(status, null, 2) + '\n')

  for (const r of records) {
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.id.padEnd(16)} ${r.ok ? `${r.ms}ms` : r.e}`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
