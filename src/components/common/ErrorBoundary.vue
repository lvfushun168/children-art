<script setup>
import { computed, onErrorCaptured, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  state: {
    type: Object,
    default: null
  }
})

const route = useRoute()
const error = ref(null)

// 这些场景的错误只影响一次操作，不应该把整页换成错误页：交给提示条告知老师即可。
const RECOVERABLE_SOURCES = /event handler|watcher|directive|transition|scheduler|native event/i

onErrorCaptured((err, _instance, info) => {
  console.error('[ui-error]', info, err)
  if (RECOVERABLE_SOURCES.test(String(info || ''))) {
    props.state?.notify?.('刚才的操作没有完成，请稍后重试', 'error')
    return false
  }
  error.value = err
  return false
})

// 换页后给新页面一次重新渲染的机会。
watch(() => route.fullPath, () => { error.value = null })

const isStaleBuild = computed(() => /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(String(error.value?.message || '')))
const retry = () => { error.value = null }
const reload = () => window.location.reload()
</script>

<template>
  <div v-if="error" class="error-boundary" role="alert">
    <span class="error-boundary-icon" aria-hidden="true"><AppIcon name="warning" :size="28" /></span>
    <h2>{{ isStaleBuild ? '系统刚刚更新过' : '页面出了点问题' }}</h2>
    <p>{{ isStaleBuild ? '请刷新页面加载最新版本，已保存的内容不会丢失。' : '这不是你的操作问题，已保存的内容不会丢失。可以重试，或刷新页面。' }}</p>
    <div class="error-boundary-actions">
      <button v-if="!isStaleBuild" type="button" class="ghost" @click="retry"><AppIcon name="retry" :size="15" />重试</button>
      <button type="button" class="primary" @click="reload">刷新页面</button>
    </div>
  </div>
  <slot v-else />
</template>
