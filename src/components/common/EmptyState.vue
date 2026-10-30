<script setup>
import AppIcon from './AppIcon.vue'

defineProps({
  icon: {
    type: String,
    default: 'file'
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  // 嵌在小卡片、抽屉里的紧凑版本
  compact: {
    type: Boolean,
    default: false
  }
})
</script>

<template>
  <div class="empty-state" :class="{ 'is-compact': compact }">
    <span class="empty-state-icon" aria-hidden="true"><AppIcon :name="icon" :size="compact ? 20 : 26" /></span>
    <strong class="empty-state-title">{{ title }}</strong>
    <p v-if="description" class="empty-state-text">{{ description }}</p>
    <div v-if="$slots.default" class="empty-state-actions"><slot /></div>
  </div>
</template>
