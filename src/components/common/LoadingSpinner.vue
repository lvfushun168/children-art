<script setup>
import AppIcon from './AppIcon.vue'

defineProps({
  size: {
    type: [Number, String],
    default: 18
  },
  label: {
    type: String,
    default: '加载中'
  },
  block: {
    type: Boolean,
    default: false
  }
})
</script>

<template>
  <span class="loading-spinner" :class="{ 'is-block': block }" role="status" :aria-label="label" :title="label">
    <AppIcon name="loading" :size="size" />
  </span>
</template>
