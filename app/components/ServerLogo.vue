<script setup lang="ts">
const props = defineProps<{ id: string; name: string; small?: boolean }>()
const logo = computed(() => brandLogo(props.id))
</script>

<template>
  <span class="logo" :class="{ sm: props.small }" :style="{ background: brandColor(props.id) }" aria-hidden="true">
    <img v-if="logo" :src="logo" alt="" :class="{ fill: !logo.endsWith('.svg') }">
    <template v-else>{{ props.name[0] }}</template>
  </span>
</template>
