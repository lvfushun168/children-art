<script setup>
import AppIcon from './AppIcon.vue'

defineProps({
  text: {
    type: String,
    required: true
  }
})
</script>

<template>
  <span class="hint-tip" tabindex="0" role="note" :aria-label="text" :data-hint="text">
    <AppIcon name="help" :size="15" />
  </span>
</template>
