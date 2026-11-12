<script setup lang="ts">
import type { ServerStatus } from '~~/shared/types/status'

const props = defineProps<{ servers: ServerStatus[] }>()
const AMOUNTS = [10_000, 100_000, 1_000_000]
const amount = ref(100_000)

const plots = computed(() => {
  const withFees = props.servers.filter(s => s.info?.fees)
  return ACTIONS.map(a => {
    const rows = withFees.map(s => {
      const r = feeRule(a.kind, s.info!.fees!)
      const [lo, hi] = feeRange(r, amount.value)
      const free = isFree(r)
      return { s, lo, hi, free, text: free ? 'Free' : btcRange(lo, hi) }
    })
    const top = Math.max(1, ...rows.map(r => r.hi))
    return {
      ...a,
      rows: rows.map(r => ({
        ...r,
        left: (r.lo / top) * 100,
        width: ((r.hi - r.lo) / top) * 100,
      })),
    }
  })
})
</script>

<template>
  <section aria-labelledby="compare-title">
    <div class="compare-head">
      <div class="section-head">
        <h2 id="compare-title">Fee comparison</h2>
        <p>
          Many fees depend on how long the VTXO you spend has left before it expires, and that depends on the coins
          in your wallet. So each bar shows the lowest and highest fee a server charges.
        </p>
      </div>
      <div class="picker">
        <span id="amount-label" class="picker-label">Payment amount</span>
        <div class="chips" role="group" aria-labelledby="amount-label">
          <button
            v-for="a in AMOUNTS" :key="a" type="button" class="chip"
            :aria-pressed="amount === a" @click="amount = a"
          >{{ btc(a) }}</button>
        </div>
      </div>
    </div>
    <div class="card">
      <div v-for="p in plots" :key="p.kind" class="plot">
        <div><h3>{{ p.label }}</h3><p>{{ p.sub }}</p></div>
        <div class="lanes" role="list" :aria-label="p.label">
          <div v-for="r in p.rows" :key="r.s.id" class="lane" role="listitem">
            <ServerName :id="r.s.id" :name="r.s.name" />
            <div class="track" aria-hidden="true">
              <span class="bar" :class="{ free: r.free }" :style="{ left: `min(${r.left}%, calc(100% - 10px))`, width: `${r.width}%` }" />
            </div>
            <span class="v num" :class="{ free: r.free }">{{ r.text }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
