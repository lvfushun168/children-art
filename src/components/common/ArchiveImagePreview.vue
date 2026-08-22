<script setup>
import { onBeforeUnmount, watch } from 'vue'
import ProtectedMedia from './ProtectedMedia.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  fileId: { type: [String, Number], default: null },
  src: { type: String, default: '' },
  alt: { type: String, default: '' },
  title: { type: String, default: '' },
  caption: { type: String, default: '' }
})

const emit = defineEmits(['close'])

const close = () => emit('close')
const onKeydown = (event) => {
  if (event.key === 'Escape') close()
}

watch(() => props.open, (open) => {
  if (open) document.addEventListener('keydown', onKeydown)
  else document.removeEventListener('keydown', onKeydown)
}, { immediate: true })

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div v-if="open" class="archive-image-preview-backdrop" @click.self="close">
    <section class="archive-image-preview-modal" role="dialog" aria-modal="true" :aria-label="title || '原图预览'">
      <header class="archive-image-preview-head">
        <div>
          <span>原图预览</span>
          <strong>{{ title || alt || '图片预览' }}</strong>
          <small v-if="caption">{{ caption }}</small>
        </div>
        <button class="ghost" type="button" aria-label="关闭原图预览" @click="close">关闭</button>
      </header>

      <div class="archive-image-preview-stage">
        <ProtectedMedia
          v-if="fileId || src"
          class="archive-image-preview-image"
          :file-id="fileId"
          :src="src"
          :alt="alt || title"
        />
        <div v-else class="file-tile">暂无可预览图片</div>
      </div>

    </section>
  </div>
</template>
