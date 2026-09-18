<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { protectedMediaUrl } from '../../services/protectedMediaCache'
import { HOMEWORK_FILE_PLACEHOLDER_PREFIX, renderMarkdown } from '../../services/markdown.js'

const props = defineProps({
  content: { type: String, default: '' },
  privateMedia: { type: Boolean, default: false }
})

const root = ref(null)
let loadSequence = 0

const loadPrivateImages = async () => {
  await nextTick()
  if (!props.privateMedia || !root.value) return
  const sequence = ++loadSequence
  const images = [...root.value.querySelectorAll('img')]
    .map((image) => ({ image, source: image.getAttribute('src') || '' }))
    .filter(({ source }) => source.startsWith(HOMEWORK_FILE_PLACEHOLDER_PREFIX))

  await Promise.all(images.map(async ({ image, source }) => {
    const fileId = source.slice(HOMEWORK_FILE_PLACEHOLDER_PREFIX.length).split(/[/?#]/)[0]
    if (!/^\d+$/.test(fileId)) return
    try {
      const protectedUrl = await protectedMediaUrl(fileId, { variant: 'preview', priority: 'high' })
      if (sequence === loadSequence && protectedUrl) image.setAttribute('src', protectedUrl)
    } catch {
      if (sequence === loadSequence) image.setAttribute('alt', `${image.getAttribute('alt') || '图片'}（加载失败）`)
    }
  }))
}

watch(() => [props.content, props.privateMedia], loadPrivateImages, { immediate: true })

onMounted(loadPrivateImages)

onBeforeUnmount(() => {
  loadSequence += 1
})
</script>

<template>
  <div ref="root" class="markdown-content" v-html="renderMarkdown(content)"></div>
</template>
