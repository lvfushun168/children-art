<script setup>
import { computed } from 'vue'
import PageHead from '../components/layout/PageHead.vue'

const props = defineProps({
  group: {
    type: Object,
    default: null
  },
  title: {
    type: String,
    default: ''
  },
  eyebrow: {
    type: String,
    default: ''
  },
  items: {
    type: Array,
    default: null
  }
})

defineEmits(['open'])

const displayTitle = computed(() => props.title || props.group?.label || '')
const displayEyebrow = computed(() => props.eyebrow || props.group?.description || '')
const entries = computed(() => props.items || props.group?.items || [])
const metaFor = (item) => item.description || props.group?.label || ''
</script>

<template>
  <section class="module-hub-view">
    <PageHead :eyebrow="displayEyebrow" :title="displayTitle" />

    <div class="module-hub-grid">
      <button
        v-for="(item, index) in entries"
        :key="item.id"
        type="button"
        class="module-entry-card"
        @click="$emit('open', item.id)"
      >
        <span>{{ item.mark || String(index + 1).padStart(2, '0') }}</span>
        <strong>{{ item.label }}</strong>
        <small>{{ metaFor(item) }}</small>
      </button>
    </div>
  </section>
</template>
