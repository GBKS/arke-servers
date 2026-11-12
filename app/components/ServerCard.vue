<script setup lang="ts">
import type { ServerStatus } from '~~/shared/types/status'

const props = defineProps<{ server: ServerStatus; now: number; generatedAt: string }>()
const open = ref(false)
const s = computed(() => props.server)

const stateText = computed(() =>
  s.value.state === 'online' ? 'Online' : s.value.state === 'offline' ? 'Offline' : 'Not checked yet')

// Always 30 days, oldest first. Days without checks (or data from before
// daily buckets existed) render as empty placeholders.
const daily = computed(() => {
  const byDate = new Map((s.value.daily ?? []).map(d => [d.date, d.pct]))
  const end = Math.floor(Date.parse(s.value.lastCheckedAt ?? props.generatedAt) / 86_400_000)
  return Array.from({ length: 30 }, (_, k) => {
    const date = new Date((end - 29 + k) * 86_400_000).toISOString().slice(0, 10)
    return { date, pct: byDate.get(date) ?? null }
  })
})
const todayKey = computed(() => daily.value.at(-1)?.date)
const tickClass = (pct: number | null) =>
  pct == null ? '' : pct >= 100 ? 't100' : pct >= 99 ? 't99' : pct >= 95 ? 't95' : 'tbad'
const tickTitle = (d: { date: string; pct: number | null }) =>
  `${d.date === todayKey.value ? 'Today so far' : d.date}: ${d.pct == null ? 'no checks' : `${d.pct}%`}`

const up = computed(() => s.value.uptime.d30)
const upText = computed(() => (up.value.pct == null ? '—' : `${up.value.pct.toFixed(up.value.pct >= 99.95 ? 0 : 1)}%`))
// Tracking started recently: say so instead of claiming 30 days.
const upLabel = computed(() => {
  const since = up.value.since ? Date.parse(up.value.since) : null
  if (since && since > props.now - 29 * 86_400_000) {
    return `Uptime since ${new Date(since).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`
  }
  return 'Uptime, last 30 days'
})

const fees = computed(() => {
  const i = s.value.info
  if (!i?.fees) return []
  return ACTIONS.map(a => {
    const r = feeRule(a.kind, i.fees!)
    return { ...a, text: ruleText(r), free: isFree(r), notes: feeNotes(a.kind, r, i) }
  })
})

const website = computed(() => brandWebsite(s.value.id))
const websiteLabel = computed(() => website.value?.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, ''))

const copied = ref(false)
async function copy() {
  try {
    await navigator.clipboard.writeText(serverUrl(s.value.host))
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    // Clipboard unavailable: the address is still visible and selectable.
  }
}
</script>

<template>
  <article class="server" :class="{ open }">
    <button type="button" class="row" :aria-expanded="open" :aria-controls="`det-${s.id}`" @click="open = !open">
      <div class="ident">
        <ServerLogo :id="s.id" :name="s.name" />
        <div class="ident-text">
          <div class="name">{{ s.name }}</div>
          <div class="meta"><span class="dot" :class="s.state" />{{ stateText }} · <span class="mono">{{ s.host }}</span></div>
        </div>
      </div>
      <div class="beat">
        <div class="beat-top"><span>{{ upLabel }}</span><b class="num">{{ upText }}</b></div>
        <div class="ticks" role="img" :aria-label="`${upLabel}: ${upText}`">
          <span
            v-for="d in daily" :key="d.date"
            class="tick" :class="[tickClass(d.pct), { today: d.date === todayKey }]" :title="tickTitle(d)"
          />
        </div>
      </div>
      <svg class="chev" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>

    <div v-show="open" :id="`det-${s.id}`" class="details">
      <div class="links">
        <div class="addr">
          <span>Server address</span>
          <code>{{ serverUrl(s.host) }}</code>
          <button type="button" class="copy" :class="{ done: copied }" @click="copy">{{ copied ? 'Copied' : 'Copy' }}</button>
        </div>
        <a v-if="website" class="site" :href="website" rel="noopener" target="_blank">{{ websiteLabel }} <span aria-hidden="true">↗</span></a>
      </div>

      <p v-if="s.state === 'offline'" class="alert">
        Not responding: {{ s.error }}. Last seen online {{ relative(s.lastOnlineAt, now) }}.
      </p>
      <p v-if="s.info?.psa" class="alert">Message from the server: {{ s.info.psa }}</p>

      <template v-if="s.info">
        <div class="tiles">
          <div v-if="fees.length" class="tile">
            <h3>Fees</h3>
            <table class="feetable num">
              <tbody>
                <tr><th>Ark payment</th><td><span class="free">Free</span></td></tr>
                <tr v-for="f in fees" :key="f.kind">
                  <th>{{ f.label }}</th>
                  <td>
                    <span :class="{ free: f.free }">{{ f.text }}</span>
                    <span v-for="n in f.notes" :key="n" class="note">{{ n }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="tile">
            <h3>Server facts</h3>
            <dl class="facts num">
              <div><dt>VTXOs last</dt><dd>About {{ days(s.info.vtxoLifetimeBlocks) }} days<span class="note">Open your wallet at least this often so it can refresh your coins</span></dd></div>
              <div><dt>Rounds every</dt><dd>{{ duration(s.info.roundIntervalSecs) }}<span class="note">Refreshes wait for the next round</span></dd></div>
              <div><dt>Smallest board</dt><dd>{{ btc(s.info.minBoardAmountSat) }}</dd></div>
              <div><dt>Largest VTXO</dt><dd>{{ s.info.maxVtxoAmountSat == null ? 'No limit' : btc(s.info.maxVtxoAmountSat) }}</dd></div>
              <div><dt>Emergency exit</dt><dd>{{ s.info.vtxoExitDeltaBlocks }} blocks, about {{ hours(s.info.vtxoExitDeltaBlocks) }} hours<span class="note">How long an exit without the server's help waits on-chain</span></dd></div>
            </dl>
          </div>
        </div>

        <dl class="tech">
          <div><dt>Server key</dt><dd class="mono" :title="s.info.serverPubkey">{{ shortKey(s.info.serverPubkey) }}</dd></div>
          <div><dt>Protocol versions</dt><dd>{{ s.info.protocol ? `${s.info.protocol.min}–${s.info.protocol.max}` : '—' }}</dd></div>
          <div><dt>Last checked</dt><dd>{{ relative(s.lastCheckedAt, now) }}<template v-if="s.latencyMs">, {{ s.latencyMs }} ms</template></dd></div>
          <div>
            <dt>Terms</dt>
            <dd>
              <a v-if="s.info.tosLink" :href="s.info.tosLink" rel="nofollow noopener">{{ s.info.tosLink.replace(/^https?:\/\//, '') }}</a>
              <template v-else>None published</template>
            </dd>
          </div>
        </dl>
      </template>
      <p v-else class="muted">This server hasn't answered a check yet.</p>
    </div>
  </article>
</template>
