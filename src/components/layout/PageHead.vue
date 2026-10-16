<script setup>
defineProps({
  title: {
    type: String,
    required: true
  }
})
</script>

<template>
  <header class="page-head">
    <div>
      <h1>{{ title }}</h1>
    </div>
    <slot />
  </header>
</template>
