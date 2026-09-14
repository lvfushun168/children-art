<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { invalidateProtectedMedia, protectedMediaUrl } from '../../services/protectedMediaCache'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  fileId: { type: [String, Number], default: null },
  src: { type: String, default: '' },
  tag: { type: String, default: 'img' },
  alt: { type: String, default: '' },
  variant: { type: String, default: 'preview' },
  priority: { type: String, default: 'low' },
  observerRoot: { type: Object, default: null },
  rootMargin: { type: String, default: '160px' }
})

const element = ref(null)
const loadedSrc = ref('')
const loading = ref(false)
const status = ref('idle')
let observer = null
let loadSequence = 0

const effectiveVariant = computed(() => props.tag === 'video' ? 'original' : (props.variant === 'original' ? 'original' : 'preview'))
const renderedSrc = computed(() => props.fileId ? loadedSrc.value : props.src || '')
const isError = computed(() => status.value === 'error')
const placeholderText = computed(() => isError.value ? '图片加载失败' : (props.fileId ? '图片加载中…' : '暂无图片'))

const load = async () => {
  if (loadedSrc.value || !props.fileId || loading.value) return
  const sequence = loadSequence
  loading.value = true
  status.value = 'loading'
  try {
    const url = await protectedMediaUrl(props.fileId, {
      variant: effectiveVariant.value,
      priority: props.priority
    })
    if (sequence === loadSequence && url) {
      loadedSrc.value = url
      status.value = 'loaded'
    }
  } catch {
    if (sequence === loadSequence) status.value = 'error'
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

const reset = () => {
  loadSequence += 1
  loadedSrc.value = ''
  loading.value = false
  status.value = 'idle'
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
  }, { root: props.observerRoot || null, rootMargin: props.rootMargin })
  if (element.value) observer.observe(element.value)
}

const scheduleObserve = () => {
  void nextTick(() => observe())
}

const retry = () => {
  if (!isError.value) return
  reset()
  void load()
}

const handleMediaError = () => {
  if (!props.fileId) return
  invalidateProtectedMedia(props.fileId, { variant: effectiveVariant.value })
  loadedSrc.value = ''
  loading.value = false
  status.value = 'error'
}

const handleRetryKeydown = (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    retry()
  }
}

watch(() => [props.fileId, props.variant, props.tag, props.observerRoot, props.rootMargin], () => {
  reset()
  scheduleObserve()
})

onMounted(() => {
  scheduleObserve()
})

onBeforeUnmount(() => {
  observer?.disconnect()
})
</script>

<template>
  <component
    v-if="renderedSrc"
    :is="tag"
    ref="element"
    :src="renderedSrc"
    :alt="alt"
    :data-media-status="status"
    @error="handleMediaError"
    v-bind="$attrs"
  />
  <span
    v-else
    ref="element"
    class="protected-media-placeholder"
    :data-media-status="status"
    :aria-busy="loading"
    :aria-label="alt || placeholderText"
    v-bind="$attrs"
  >
    <span v-if="isError" class="protected-media-retry" role="button" tabindex="0" @click.stop="retry" @keydown="handleRetryKeydown">
      {{ placeholderText }}，重试
    </span>
    <span v-else>{{ placeholderText }}</span>
  </span>
</template>
