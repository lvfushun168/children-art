<script setup>
import { computed } from 'vue'
import AppIcon from '../components/common/AppIcon.vue'
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
  items: {
    type: Array,
    default: null
  }
})

defineEmits(['open'])

const displayTitle = computed(() => props.title || props.group?.label || '')
const entries = computed(() => props.items || props.group?.items || [])
const metaFor = (item) => item.description || ''
</script>

<template>
  <section class="module-hub-view">
    <PageHead :title="displayTitle" />

    <div class="module-hub-grid">
      <button
        v-for="item in entries"
        :key="item.id"
        type="button"
        class="module-entry-card"
        @click="$emit('open', item.id)"
      >
        <span class="module-entry-icon">
          <AppIcon :name="item.icon || group?.icon || 'brand'" :size="24" />
        </span>
        <span class="module-entry-copy">
          <strong>{{ item.label }}</strong>
          <small v-if="metaFor(item)">{{ metaFor(item) }}</small>
        </span>
      </button>
    </div>
  </section>
</template>
