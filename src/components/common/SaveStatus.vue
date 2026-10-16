<script setup>
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  // saving | saved | error
  status: {
    type: String,
    default: 'saved'
  },
  savingLabel: {
    type: String,
    default: '保存中'
  },
  savedLabel: {
    type: String,
    default: '已保存'
  },
  errorLabel: {
    type: String,
    default: '保存失败，点击重试'
  }
})

const emit = defineEmits(['retry'])

const view = computed(() => {
  if (props.status === 'error') return { icon: 'warning', label: props.errorLabel, tone: 'is-error' }
  if (props.status === 'saving') return { icon: 'loading', label: props.savingLabel, tone: 'is-saving' }
  return { icon: 'check', label: props.savedLabel, tone: 'is-saved' }
})
</script>

<template>
  <button
    v-if="status === 'error'"
    type="button"
    class="save-status is-error"
    :aria-label="view.label"
    :title="view.label"
    @click="emit('retry')"
  >
    <AppIcon :name="view.icon" :size="15" />
  </button>
  <span v-else class="save-status" :class="view.tone" role="status" :aria-label="view.label" :title="view.label">
    <AppIcon :name="view.icon" :size="15" />
  </span>
</template>
