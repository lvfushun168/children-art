<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  active: {
    type: Boolean,
    default: false
  },
  label: {
    type: String,
    default: ''
  }
})

// 出现太早会一闪而过，出现后又太快消失同样让人困惑，所以给两端都留缓冲。
const SHOW_DELAY_MS = 300
const MIN_VISIBLE_MS = 600
const SLOW_AFTER_MS = 2000

const visible = ref(false)
const slow = ref(false)
const elapsedSeconds = ref(0)
const shownLabel = ref('')

let showTimer = null
let slowTimer = null
let hideTimer = null
let tickTimer = null
let startedAt = 0
let shownAt = 0

const clearTimers = () => {
  clearTimeout(showTimer)
  clearTimeout(slowTimer)
  clearTimeout(hideTimer)
  clearInterval(tickTimer)
  showTimer = slowTimer = hideTimer = tickTimer = null
}

const reset = () => {
  visible.value = false
  slow.value = false
  elapsedSeconds.value = 0
  shownLabel.value = ''
}

const start = () => {
  clearTimeout(hideTimer)
  hideTimer = null
  if (visible.value || showTimer) return
  startedAt = Date.now()
  showTimer = setTimeout(() => {
    showTimer = null
    visible.value = true
    shownAt = Date.now()
  }, SHOW_DELAY_MS)
  slowTimer = setTimeout(() => {
    slowTimer = null
    slow.value = true
  }, SLOW_AFTER_MS)
  tickTimer = setInterval(() => {
    elapsedSeconds.value = Math.floor((Date.now() - startedAt) / 1000)
  }, 1000)
}

const stop = () => {
  if (showTimer) {
    // 还没来得及显示就结束了，无需出现。
    clearTimers()
    reset()
    return
  }
  const remaining = MIN_VISIBLE_MS - (Date.now() - shownAt)
  const finish = () => {
    clearTimers()
    reset()
  }
  if (remaining > 0) hideTimer = setTimeout(finish, remaining)
  else finish()
}

watch(() => props.active, (active) => {
  if (active) start()
  else stop()
}, { immediate: true })

watch(() => props.label, (label) => {
  if (label) shownLabel.value = label
}, { immediate: true })

onBeforeUnmount(clearTimers)
</script>

<template>
  <Transition name="busy-fade">
    <div v-if="visible" class="busy-layer" role="status" aria-live="polite">
      <div class="busy-card">
        <span class="busy-spinner" aria-hidden="true"></span>
        <div class="busy-copy">
          <strong>{{ shownLabel || '处理中，请稍候…' }}</strong>
          <small v-if="slow">已等待 {{ elapsedSeconds }} 秒，请不要关闭或刷新页面</small>
        </div>
      </div>
    </div>
  </Transition>
</template>
