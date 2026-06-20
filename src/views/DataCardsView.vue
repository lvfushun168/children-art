<script setup>
import PageHead from '../components/layout/PageHead.vue'

defineProps({
  eyebrow: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  actionLabel: {
    type: String,
    default: ''
  },
  items: {
    type: Array,
    required: true
  }
})
</script>

<template>
  <PageHead :eyebrow="eyebrow" :title="title">
    <button v-if="actionLabel" class="primary">{{ actionLabel }}</button>
  </PageHead>

  <section class="data-grid">
    <article v-for="item in items" :key="item.id" class="data-card" :class="item.className">
      <strong>{{ item.title }}</strong>
      <span>{{ item.subtitle }}</span>
      <small>{{ item.meta }}</small>
      <p>{{ item.body }}</p>
      <em>{{ item.footer }}</em>
    </article>
  </section>
</template>
