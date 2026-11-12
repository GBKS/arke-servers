<script setup lang="ts">
import type { ServerInfo, ServerStatus } from '~~/shared/types/status'

const props = defineProps<{ servers: ServerStatus[] }>()
const withInfo = computed(() => props.servers.filter(s => s.info))

const ROWS: [string, (i: ServerInfo) => string][] = [
  ['VTXOs last', i => `~${days(i.vtxoLifetimeBlocks)} days`],
  ['Rounds every', i => duration(i.roundIntervalSecs)],
  ['Smallest board', i => btc(i.minBoardAmountSat)],
  ['Largest VTXO', i => (i.maxVtxoAmountSat == null ? 'No limit' : btc(i.maxVtxoAmountSat))],
  ['Board confirmations', i => String(i.requiredBoardConfirmations)],
  ['Emergency exit', i => `~${hours(i.vtxoExitDeltaBlocks)} h`],
]
</script>

<template>
  <section aria-labelledby="diff-title">
    <div class="section-head">
      <h2 id="diff-title">Other differences</h2>
      <p>Fixed settings that don't depend on your coins, so they compare directly.</p>
    </div>
    <div class="card scroll-x">
      <table class="difftable num">
        <thead>
          <tr>
            <td />
            <th v-for="s in withInfo" :key="s.id" scope="col"><ServerName :id="s.id" :name="s.name" /></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="[label, value] in ROWS" :key="label">
            <th scope="row">{{ label }}</th>
            <td v-for="s in withInfo" :key="s.id">{{ value(s.info!) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
