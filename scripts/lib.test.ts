import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { CheckRecord, ServerStatus } from '../shared/types/status'
import { parseServers } from './lib/config'
import { parseFrames } from './lib/grpcweb'
import { monthsBetween, parseLines } from './lib/history'
import { cleanPsa, normalizeInfo, toHex } from './lib/normalize'
import { buildStatus, serverStatus, uptime } from './lib/status'

const DAY = 86400
const NOW = 1_800_000_000

test('parseServers accepts valid entries', () => {
  const out = parseServers([{ id: 'a-1', name: ' A ', host: 'ark.example.com' }])
  assert.deepEqual(out, [{ id: 'a-1', name: 'A', host: 'ark.example.com' }])
})

test('parseServers rejects anything but a bare public hostname', () => {
  for (const host of [
    'https://ark.example.com',
    'ark.example.com:8080',
    'ark.example.com/path',
    'user@ark.example.com',
    '127.0.0.1',
    'localhost',
    'ark.local',
    'ARK.example.com',
  ]) {
    assert.throws(() => parseServers([{ id: 'a', name: 'A', host }]), undefined, host)
  }
})

test('parseServers rejects duplicate ids', () => {
  const s = { id: 'a', name: 'A', host: 'a.example.com' }
  assert.throws(() => parseServers([s, s]), /duplicate/)
})

test('parseFrames splits data and trailer frames', () => {
  const data = [0, 0, 0, 0, 2, 0x08, 0x01]
  const trailer = new TextEncoder().encode('grpc-status:0\r\ngrpc-message:ok\r\n')
  const buf = new Uint8Array([...data, 0x80, 0, 0, 0, trailer.length, ...trailer])
  const { messages, trailers } = parseFrames(buf)
  assert.deepEqual([...messages[0]!], [0x08, 0x01])
  assert.deepEqual(trailers, { 'grpc-status': '0', 'grpc-message': 'ok' })
})

test('parseFrames rejects truncated input', () => {
  assert.throws(() => parseFrames(new Uint8Array([0, 0, 0, 0, 9, 1])), /truncated/)
})

test('uptime counts only checks inside the window', () => {
  const recs: CheckRecord[] = [
    { t: NOW - 2 * DAY, id: 'a', ok: false },
    { t: NOW - 600, id: 'a', ok: true },
    { t: NOW - 300, id: 'a', ok: false },
    { t: NOW, id: 'a', ok: true },
  ]
  assert.deepEqual(uptime(recs, NOW, DAY), { pct: 66.67, checks: 3, since: new Date((NOW - 600) * 1000).toISOString() })
  assert.equal(uptime(recs, NOW, 7 * DAY).pct, 50)
  assert.deepEqual(uptime([], NOW, DAY), { pct: null, checks: 0, since: null })
})

test('serverStatus distinguishes unknown, online and offline', () => {
  const server = { id: 'a', name: 'A', host: 'a.example.com' }
  assert.equal(serverStatus(server, [], NOW, null, undefined).state, 'unknown')

  const online = serverStatus(server, [{ t: NOW, id: 'a', ok: true, ms: 42 }], NOW, null, undefined)
  assert.equal(online.state, 'online')
  assert.equal(online.latencyMs, 42)

  const offline = serverStatus(
    server,
    [{ t: NOW, id: 'a', ok: false, e: 'timeout' }, { t: NOW - 600, id: 'a', ok: true, ms: 1 }],
    NOW, null, undefined,
  )
  assert.equal(offline.state, 'offline')
  assert.equal(offline.error, 'timeout')
  assert.equal(offline.latencyMs, null)
  assert.equal(offline.lastOnlineAt, new Date((NOW - 600) * 1000).toISOString())
})

test('serverStatus carries last-known info forward only for the same host', () => {
  const server = { id: 'a', name: 'A', host: 'a.example.com' }
  const prev = { host: 'a.example.com', info: { network: 'signet' }, infoObservedAt: 'x', lastOnlineAt: 'y' } as unknown as ServerStatus
  const recs: CheckRecord[] = [{ t: NOW, id: 'a', ok: false, e: 'down' }]
  const kept = serverStatus(server, recs, NOW, null, prev)
  assert.equal(kept.info?.network, 'signet')
  assert.equal(kept.infoObservedAt, 'x')

  const moved = serverStatus({ ...server, host: 'b.example.com' }, recs, NOW, null, prev)
  assert.equal(moved.info, null)
})

test('buildStatus keeps config order and ignores unknown ids in history', () => {
  const servers = [{ id: 'b', name: 'B', host: 'b.example.com' }, { id: 'a', name: 'A', host: 'a.example.com' }]
  const out = buildStatus(servers, [{ t: NOW, id: 'gone', ok: true }], NOW, new Map(), null, 600)
  assert.deepEqual(out.servers.map(s => [s.id, s.state]), [['b', 'unknown'], ['a', 'unknown']])
})

test('monthsBetween spans month and year boundaries', () => {
  const from = Date.UTC(2026, 10, 20) / 1000
  const to = Date.UTC(2027, 0, 5) / 1000
  assert.deepEqual(monthsBetween(from, to), ['2026-11', '2026-12', '2027-01'])
})

test('parseLines skips blank and corrupt lines', () => {
  const out = parseLines('{"t":1,"id":"a","ok":true}\n\nnot json\n{"t":"x","id":"a","ok":true}\n')
  assert.equal(out.length, 1)
})

test('cleanPsa drops the missing-version notice', () => {
  assert.equal(cleanPsa('Your bark client did not identify its version to this Ark server.'), null)
  assert.equal(cleanPsa('  Maintenance tonight  '), 'Maintenance tonight')
  assert.equal(cleanPsa(''), null)
})

test('normalizeInfo maps raw responses', () => {
  const info = normalizeInfo({
    arkInfo: {
      network: 'bitcoin',
      serverPubkey: [2, 255],
      mailboxPubkey: [],
      roundIntervalSecs: 600,
      vtxoLifetime: 0,
      vtxoExpiryDelta: 1008,
      minBoardAmount: '20000',
      tosLink: 'javascript:alert(1)',
      fees: { offboard: { ppmExpiryTable: [{ expiryBlocksThreshold: 432, ppm: '4000' }, { expiryBlocksThreshold: 0, ppm: '0' }] } },
    },
    handshake: { minProtocolVersion: '4', maxProtocolVersion: '5' },
    offboardFeeRate: { satVkb: '2008' },
    nextRoundTime: { timestamp: String(NOW) },
  })
  assert.equal(info.serverPubkey, '02ff')
  assert.equal(info.mailboxPubkey, null)
  assert.equal(info.vtxoLifetimeBlocks, 1008)
  assert.equal(info.minBoardAmountSat, 20000)
  assert.equal(info.maxVtxoAmountSat, null)
  assert.equal(info.tosLink, null)
  assert.deepEqual(info.protocol, { min: 4, max: 5 })
  assert.equal(info.offboardFeeRateSatVkb, 2008)
  assert.equal(info.nextRoundAt, new Date(NOW * 1000).toISOString())
  assert.deepEqual(info.fees?.offboard.ppmByExpiry.map(e => e.expiryBlocksThreshold), [0, 432])
})

test('toHex handles empty input', () => {
  assert.equal(toHex(undefined), '')
  assert.equal(toHex([0, 16]), '0010')
})
