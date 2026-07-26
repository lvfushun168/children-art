<script setup>
import PageHead from '../components/layout/PageHead.vue'

defineProps({
  group: {
    type: Object,
    required: true
  }
})

defineEmits(['open'])
</script>

<template>
  <section class="module-hub-view">
    <PageHead :eyebrow="group.description" :title="group.label" />

    <div class="module-hub-grid">
      <button
        v-for="(item, index) in group.items"
        :key="item.id"
        type="button"
        class="module-entry-card"
        @click="$emit('open', item.id)"
      >
        <span>{{ item.mark || String(index + 1).padStart(2, '0') }}</span>
        <strong>{{ item.label }}</strong>
        <small>{{ group.label }}</small>
      </button>
    </div>
  </section>
</template>
