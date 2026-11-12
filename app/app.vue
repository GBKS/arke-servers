<script setup lang="ts">
import statusJson from '~~/data/status.json'
import type { StatusFile } from '~~/shared/types/status'

const status = statusJson as StatusFile

const mainnet = status.servers.filter(s => s.info?.network === 'bitcoin')
const signet = status.servers.filter(s => s.info?.network === 'signet')
const other = status.servers.filter(s => s.info && !['bitcoin', 'signet'].includes(s.info.network))
const pending = status.servers.filter(s => !s.info)

// Times are relative to build time during prerender, then to the
// visitor's clock once mounted.
const now = ref(Date.parse(status.generatedAt))
onMounted(() => {
  now.value = Date.now()
  const timer = setInterval(() => (now.value = Date.now()), 30_000)
  onBeforeUnmount(() => clearInterval(timer))
})

const stale = computed(() => now.value - Date.parse(status.generatedAt) > status.checkIntervalSecs * 3 * 1000)
const intervalMin = Math.round(status.checkIntervalSecs / 60)
</script>

<template>
  <div class="wrap">
    <header>
      <h1><em>Ark(é)</em> Servers</h1>
      <p class="lede">
        Public Ark servers you can use with <a href="https://arke.cash">Arké</a> and other
        <a href="https://second.tech">Bark</a> wallets, how reliable they've been,
        and the fees each one advertises.
      </p>
      <div class="top">
        <a class="get" href="https://arke.cash">Get Arké</a>
      </div>
      <p v-if="stale" class="warning">
        This data was last updated {{ relative(status.generatedAt, now) }} and may be out of date.
      </p>
    </header>

    <section v-if="mainnet.length" aria-labelledby="mainnet-title">
      <div class="section-head"><h2 id="mainnet-title">Mainnet</h2></div>
      <div class="servers">
        <ServerCard v-for="s in mainnet" :key="s.id" :server="s" :now="now" :generated-at="status.generatedAt" />
      </div>
    </section>

    <FeeComparison v-if="mainnet.length" :servers="mainnet" />
    <OtherDifferences v-if="mainnet.length" :servers="mainnet" />

    <section v-if="signet.length" aria-labelledby="signet-title">
      <div class="section-head">
        <h2 id="signet-title">Signet</h2>
        <p>Test network for developers. Coins have no value.</p>
      </div>
      <div class="servers">
        <ServerCard v-for="s in signet" :key="s.id" :server="s" :now="now" :generated-at="status.generatedAt" />
      </div>
    </section>

    <section v-if="other.length" aria-labelledby="other-title">
      <div class="section-head"><h2 id="other-title">Other networks</h2></div>
      <div class="servers">
        <ServerCard v-for="s in other" :key="s.id" :server="s" :now="now" :generated-at="status.generatedAt" />
      </div>
    </section>

    <section v-if="pending.length" aria-labelledby="pending-title">
      <div class="section-head">
        <h2 id="pending-title">No data yet</h2>
        <p>Recently added servers that haven't answered a check yet.</p>
      </div>
      <div class="servers">
        <ServerCard v-for="s in pending" :key="s.id" :server="s" :now="now" :generated-at="status.generatedAt" />
      </div>
    </section>

    <footer>
      <h3>About these numbers</h3>
      <ul>
        <li>Fees, limits and round times are what each server reports about itself. They aren't verified.</li>
        <li>Payments between Ark users are free on every server today.</li>
        <li>Lightning send fees include routing. The server pays the Lightning network out of its fee.</li>
        <li>Bitcoin mining fees for boarding and offboarding come on top of the server's fee.</li>
        <li>
          Uptime is what we observed from one location, about every {{ intervalMin }} minutes. It doesn't guarantee
          future availability, and online doesn't mean a server is safe to use.
        </li>
        <li>Amounts use the ₿ symbol for the base unit (BIP-177), so ₿1 is one satoshi.</li>
      </ul>
      <p style="margin: 0">
        <a href="https://github.com/gbks/arke-servers">Source and full history</a> ·
        <a href="/servers.json">JSON</a> ·
        <a href="https://arke.cash">arke.cash</a>
      </p>
    </footer>
  </div>
</template>
