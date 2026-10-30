<script setup>
defineProps({
  rows: {
    type: Number,
    default: 4
  },
  // list：头像 + 两行文字 + 右侧标签；table：整行细条，适合表格
  variant: {
    type: String,
    default: 'list'
  },
  label: {
    type: String,
    default: '加载中'
  }
})
</script>

<template>
  <div class="skeleton-list" :class="`is-${variant}`" role="status" aria-busy="true" aria-live="polite">
    <span class="skeleton-sr">{{ label }}…</span>
    <div v-for="index in rows" :key="index" class="skeleton-row" aria-hidden="true">
      <template v-if="variant === 'table'">
        <span class="skeleton-block w-22"></span>
        <span class="skeleton-block w-30"></span>
        <span class="skeleton-block w-16"></span>
        <span class="skeleton-block w-12"></span>
      </template>
      <template v-else>
        <span class="skeleton-block skeleton-avatar"></span>
        <div class="skeleton-lines">
          <span class="skeleton-block w-40"></span>
          <span class="skeleton-block w-70"></span>
        </div>
        <span class="skeleton-block skeleton-pill"></span>
      </template>
    </div>
  </div>
</template>
