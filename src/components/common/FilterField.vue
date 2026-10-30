<script setup>
defineProps({
  label: { type: String, required: true },
  // search：关键词框，占剩余宽度；range：日期范围，需要更宽
  kind: { type: String, default: 'default', validator: (value) => ['default', 'search', 'range'].includes(value) }
})
</script>

<template>
  <label class="filter-field" :class="`filter-field-${kind}`">
    <span class="filter-field-label">{{ label }}</span>
    <slot />
  </label>
</template>
