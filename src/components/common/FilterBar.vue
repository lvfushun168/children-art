<script setup>
import AppIcon from './AppIcon.vue'

// 统一的筛选区：下拉、日期等选择类条件变化即生效，关键词输入回车或停顿后生效（见 useAutoFilter），
// 因此默认只提供“重置”；确实需要手动触发时再打开 showSubmit。
defineProps({
  showReset: { type: Boolean, default: true },
  showSubmit: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  ariaLabel: { type: String, default: '筛选条件' }
})

const emit = defineEmits(['submit', 'reset'])
</script>

<template>
  <form class="filter-bar panel" role="search" :aria-label="ariaLabel" @submit.prevent="emit('submit')">
    <div class="filter-bar-fields">
      <slot />
    </div>
    <div v-if="showReset || showSubmit || $slots.actions" class="filter-bar-actions">
      <slot name="actions" />
      <button v-if="showSubmit" class="secondary" type="submit" :disabled="loading"><AppIcon name="search" :size="15" />查询</button>
      <button v-if="showReset" class="ghost" type="button" @click="emit('reset')"><AppIcon name="reset" :size="15" />重置</button>
    </div>
  </form>
</template>
