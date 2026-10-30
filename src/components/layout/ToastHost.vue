<script setup>
import AppIcon from '../common/AppIcon.vue'

defineProps({
  state: {
    type: Object,
    required: true
  }
})

const iconFor = (type) => ({
  success: 'check',
  error: 'error',
  warning: 'warning',
  info: 'help'
}[type] || 'help')
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <TransitionGroup name="toast-item" tag="div" class="toast-stack">
      <div
        v-for="item in state.toasts"
        :key="item.id"
        class="toast-card"
        :class="`is-${item.type}`"
        :role="item.type === 'error' ? 'alert' : 'status'"
      >
        <span class="toast-icon"><AppIcon :name="iconFor(item.type)" :size="18" /></span>
        <span class="toast-message">{{ item.message }}</span>
        <small v-if="item.count > 1" class="toast-count">×{{ item.count }}</small>
        <button type="button" class="toast-close" aria-label="关闭提示" @click="state.dismissToast(item.id)">
          <AppIcon name="close" :size="14" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
