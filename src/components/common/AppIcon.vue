<script setup>
import { computed } from 'vue'
import { resolveIcon } from './iconRegistry.js'

const props = defineProps({
  name: {
    type: String,
    required: true
  },
  size: {
    type: [Number, String],
    default: 18
  },
  strokeWidth: {
    type: [Number, String],
    default: 1.9
  },
  label: {
    type: String,
    default: ''
  }
})

const iconComponent = computed(() => resolveIcon(props.name))
const accessibleLabel = computed(() => String(props.label || '').trim())
const isLabeled = computed(() => Boolean(accessibleLabel.value))
</script>

<template>
  <component
    :is="iconComponent"
    class="app-icon"
    :size="size"
    :stroke-width="strokeWidth"
    :role="isLabeled ? 'img' : undefined"
    :aria-label="isLabeled ? accessibleLabel : undefined"
    :aria-hidden="isLabeled ? undefined : 'true'"
    focusable="false"
  />
</template>
