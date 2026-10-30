<script setup>
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  size: {
    type: [Number, String],
    default: 22
  },
  label: {
    type: String,
    default: '加载中'
  },
  block: {
    type: Boolean,
    default: false
  },
  // 小尺寸（按钮、行内）默认只显示图标，其余场景把文字也显示出来。
  showLabel: {
    type: Boolean,
    default: undefined
  }
})

const labelVisible = computed(() => props.showLabel ?? Number(props.size) > 16)
</script>

<template>
  <span class="loading-spinner" :class="{ 'is-block': block }" role="status" :aria-label="label" :title="label">
    <AppIcon name="loading" :size="size" />
    <span v-if="labelVisible" class="loading-spinner-label">{{ label }}…</span>
  </span>
</template>
