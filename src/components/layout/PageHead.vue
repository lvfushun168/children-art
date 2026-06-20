<script setup>
defineProps({
  eyebrow: {
    type: String,
    required: true
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
      <span>{{ eyebrow }}</span>
      <h1>{{ title }}</h1>
    </div>
    <slot />
  </header>
</template>
