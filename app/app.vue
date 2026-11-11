<script setup lang="ts">
import statusJson from '~~/data/status.json'
import type { ServerStatus, StatusFile } from '~~/shared/types/status'

const status = statusJson as StatusFile

const NETWORKS: { key: string; label: string }[] = [
  { key: 'bitcoin', label: 'Mainnet' },
  { key: 'signet', label: 'Signet (test network)' },
]

const groups = computed(() => {
  const known = new Set(NETWORKS.map(n => n.key))
  const out = NETWORKS.map(n => ({ ...n, servers: status.servers.filter(s => s.info?.network === n.key) }))
  const other = status.servers.filter(s => s.info && !known.has(s.info.network))
  if (other.length) out.push({ key: 'other', label: 'Other networks', servers: other })
  const pending = status.servers.filter(s => !s.info)
  if (pending.length) out.push({ key: 'pending', label: 'No data yet', servers: pending })
  return out.filter(g => g.servers.length)
})

// Times are relative to build time during prerender, then to the
// visitor's clock once mounted.
const now = ref(Date.parse(status.generatedAt))
onMounted(() => {
  now.value = Date.now()
  const timer = setInterval(() => (now.value = Date.now()), 30_000)
  onBeforeUnmount(() => clearInterval(timer))
})

const stale = computed(() => now.value - Date.parse(status.generatedAt) > status.checkIntervalSecs * 3 * 1000)

const stateLabel = (s: ServerStatus) =>
  s.state === 'online' ? 'Online' : s.state === 'offline' ? 'Offline' : 'Not checked yet'
</script>

<template>
  <main>
    <header>
      <h1>Ark servers</h1>
      <p>
        Public Ark servers you can use with <a href="https://arke.cash">Arké</a>.
        Each one is checked about every {{ Math.round(status.checkIntervalSecs / 60) }} minutes from a single location.
      </p>
      <p class="muted">
        Uptime is what we observed, not a guarantee of future availability. Fees and limits are what each
        server reports about itself and are not verified.
        <a href="/servers.json">JSON</a> ·
        <a href="https://github.com/gbks/arke-servers">Source and full history</a>
      </p>
      <p v-if="stale" class="warning">
        This data was last updated {{ relative(status.generatedAt, now) }} and may be out of date.
      </p>
    </header>

    <section v-for="group in groups" :key="group.key">
      <h2>{{ group.label }}</h2>

      <article v-for="s in group.servers" :key="s.id" class="server">
        <div class="head">
          <h3>{{ s.name }}</h3>
          <span class="state" :class="s.state">{{ stateLabel(s) }}</span>
        </div>
        <p class="host">{{ s.host }}</p>
        <p v-if="s.info?.psa" class="psa">Server message: {{ s.info.psa }}</p>
        <p v-if="s.state === 'offline'" class="muted">
          Last error: {{ s.error }}. Last seen online {{ relative(s.lastOnlineAt, now) }}.
        </p>

        <dl>
          <div>
            <dt>Uptime 24 h / 7 d / 30 d</dt>
            <dd>
              {{ uptimePct(s.uptime.h24) }} / {{ uptimePct(s.uptime.d7) }} / {{ uptimePct(s.uptime.d30) }}
              <span v-if="s.uptime.d30.since && Date.parse(s.uptime.d30.since) > now - 29 * 86400_000" class="muted">
                (tracking since {{ new Date(s.uptime.d30.since).toISOString().slice(0, 10) }})
              </span>
            </dd>
          </div>
          <div>
            <dt>Last checked</dt>
            <dd>{{ relative(s.lastCheckedAt, now) }}<template v-if="s.latencyMs"> · {{ s.latencyMs }} ms</template></dd>
          </div>
          <template v-if="s.info">
            <div><dt>Rounds every</dt><dd>{{ duration(s.info.roundIntervalSecs) }}</dd></div>
            <div><dt>VTXO lifetime</dt><dd>{{ blocks(s.info.vtxoLifetimeBlocks) }}</dd></div>
            <div><dt>Minimum board</dt><dd>{{ sats(s.info.minBoardAmountSat) }}</dd></div>
            <div><dt>Maximum VTXO</dt><dd>{{ s.info.maxVtxoAmountSat == null ? 'No limit' : sats(s.info.maxVtxoAmountSat) }}</dd></div>
            <div v-if="s.info.tosLink"><dt>Terms</dt><dd><a :href="s.info.tosLink" rel="nofollow noopener">{{ s.info.tosLink }}</a></dd></div>
          </template>
        </dl>

        <details v-if="s.info?.fees">
          <summary>Fees</summary>
          <table>
            <tbody>
              <tr>
                <th>Board</th>
                <td>{{ fee(s.info.fees.board.baseFeeSat, ppm(s.info.fees.board.ppm), s.info.fees.board.minFeeSat) }}</td>
              </tr>
              <tr>
                <th>Refresh</th>
                <td>{{ fee(s.info.fees.refresh.baseFeeSat, ppmRange(s.info.fees.refresh.ppmByExpiry)) }}</td>
              </tr>
              <tr>
                <th>Offboard</th>
                <td>
                  {{ fee(s.info.fees.offboard.baseFeeSat, ppmRange(s.info.fees.offboard.ppmByExpiry), 0, 'on-chain cost') }}<template v-if="s.info.offboardFeeRateSatVkb != null"> ({{ s.info.offboardFeeRateSatVkb / 1000 }} sat/vB now)</template>
                </td>
              </tr>
              <tr>
                <th>Lightning receive</th>
                <td>{{ fee(s.info.fees.lightningReceive.baseFeeSat, ppm(s.info.fees.lightningReceive.ppm)) }}</td>
              </tr>
              <tr>
                <th>Lightning send</th>
                <td>{{ fee(s.info.fees.lightningSend.baseFeeSat, ppmRange(s.info.fees.lightningSend.ppmByExpiry), s.info.fees.lightningSend.minFeeSat) }}</td>
              </tr>
            </tbody>
          </table>
          <p class="muted">
            Where a range is shown, the rate depends on how long until the VTXO expires. Newer VTXOs pay the higher rate.
          </p>
        </details>

        <details v-if="s.info">
          <summary>Technical details</summary>
          <dl>
            <div><dt>Server pubkey</dt><dd><code :title="s.info.serverPubkey">{{ shortKey(s.info.serverPubkey) }}</code></dd></div>
            <div v-if="s.info.protocol"><dt>Protocol versions</dt><dd>{{ s.info.protocol.min }}–{{ s.info.protocol.max }}</dd></div>
            <div><dt>Exit delta</dt><dd>{{ blocks(s.info.vtxoExitDeltaBlocks) }}</dd></div>
            <div><dt>Board confirmations</dt><dd>{{ s.info.requiredBoardConfirmations }}</dd></div>
            <div v-if="s.infoObservedAt"><dt>Info retrieved</dt><dd>{{ relative(s.infoObservedAt, now) }}</dd></div>
          </dl>
        </details>
      </article>
    </section>
  </main>
</template>

<style>
:root {
  --fg: #111;
  --muted: #666;
  --bg: #fff;
  --line: #e5e5e5;
  --ok: #138a36;
  --bad: #c62828;
  --warn-bg: #fff4d6;
}
@media (prefers-color-scheme: dark) {
  :root {
    --fg: #eee;
    --muted: #999;
    --bg: #111;
    --line: #2a2a2a;
    --ok: #4cc870;
    --bad: #ff6b6b;
    --warn-bg: #3a2f10;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font: 16px/1.5 system-ui, -apple-system, sans-serif;
}
main { max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }
a { color: inherit; }
h1 { margin: 0 0 8px; }
h2 { margin: 40px 0 8px; font-size: 1.1rem; }
h3 { margin: 0; font-size: 1.1rem; }
.muted { color: var(--muted); font-size: 0.9rem; }
.warning { background: var(--warn-bg); padding: 8px 12px; border-radius: 6px; }
.server { border-top: 1px solid var(--line); padding: 20px 0; }
.head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.host { margin: 0 0 8px; color: var(--muted); font-family: ui-monospace, monospace; font-size: 0.9rem; }
.state { font-size: 0.9rem; color: var(--muted); }
.state::before { content: '●'; margin-right: 6px; }
.state.online { color: var(--ok); }
.state.offline { color: var(--bad); }
.psa { border-left: 3px solid var(--line); padding-left: 10px; }
dl { margin: 8px 0; display: grid; gap: 4px; }
dl > div { display: grid; grid-template-columns: 200px 1fr; gap: 12px; }
dt { color: var(--muted); }
dd { margin: 0; overflow-wrap: anywhere; }
details { margin-top: 8px; }
summary { cursor: pointer; color: var(--muted); }
table { border-collapse: collapse; margin: 8px 0; width: 100%; }
th, td { text-align: left; vertical-align: top; padding: 4px 12px 4px 0; font-weight: normal; }
th { color: var(--muted); width: 200px; }
@media (max-width: 560px) {
  dl > div { grid-template-columns: 1fr; gap: 0; }
  th { width: auto; }
}
</style>
