<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { protectedMediaUrl } from '../../services/protectedMediaCache'

const props = defineProps({
  fileId: { type: [String, Number], default: null },
  src: { type: String, default: '' },
  tag: { type: String, default: 'img' },
  alt: { type: String, default: '' }
})

const element = ref(null)
const loadedSrc = ref('')
const loading = ref(false)
let observer = null
let ownedUrl = ''

const renderedSrc = computed(() => loadedSrc.value || (props.fileId ? '' : props.src) || '')

const load = async () => {
  if (loadedSrc.value || !props.fileId || loading.value) return
  loading.value = true
  try {
    const url = await protectedMediaUrl(props.fileId)
    if (url) {
      loadedSrc.value = url
      ownedUrl = url
    }
  } catch {
    // Image loading is best-effort; the surrounding card still exposes metadata.
  } finally {
    loading.value = false
  }
}

const reset = () => {
  loadedSrc.value = ''
  ownedUrl = ''
}

const observe = () => {
  observer?.disconnect()
  observer = null
  if (!props.fileId) return
  if (typeof IntersectionObserver === 'undefined') {
    void load()
    return
  }
  observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      void load()
      observer?.disconnect()
      observer = null
    }
  }, { rootMargin: '160px' })
  if (element.value) observer.observe(element.value)
}

watch(() => props.fileId, () => {
  reset()
  observe()
})

onMounted(() => {
  observe()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  // The shared cache owns object URLs; they are released together on logout.
  ownedUrl = ''
})
</script>

<template>
  <component :is="tag" ref="element" :src="renderedSrc" :alt="alt" v-bind="$attrs" />
</template>
