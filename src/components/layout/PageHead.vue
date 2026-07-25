<script setup>
defineProps({
  eyebrow: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    required: true
  }
})
</script>

<template>
  <header class="page-head">
    <div>
      <span v-if="eyebrow">{{ eyebrow }}</span>
      <h1>{{ title }}</h1>
    </div>
    <slot />
  </header>
</template>
