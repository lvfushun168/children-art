<script setup>
import AppIcon from './AppIcon.vue'

defineProps({
  size: {
    type: [Number, String],
    default: 14
  },
  label: {
    type: String,
    default: '高光作品'
  }
})
</script>

<template>
  <span class="highlight-mark" role="img" :aria-label="label" :title="label">
    <AppIcon name="highlight" :size="size" />
  </span>
</template>
