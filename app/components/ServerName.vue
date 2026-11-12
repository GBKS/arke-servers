<script setup lang="ts">
defineProps<{ id: string; name: string }>()
</script>

<template>
  <span class="who"><ServerLogo :id="id" :name="name" small /><span>{{ name }}</span></span>
</template>
