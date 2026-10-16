<script setup>
import AppIcon from './AppIcon.vue'

defineProps({
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  titleId: {
    type: String,
    default: undefined
  },
  closeDisabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])
</script>

<template>
  <header class="drawer-head">
    <div>
      <strong :id="titleId">{{ title }}</strong>
      <small v-if="subtitle">{{ subtitle }}</small>
    </div>
    <div class="drawer-head-actions">
      <slot />
      <button class="icon-button drawer-close" type="button" aria-label="关闭" title="关闭" :disabled="closeDisabled" @click="emit('close')">
        <AppIcon name="close" :size="17" />
      </button>
    </div>
  </header>
</template>
