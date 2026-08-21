<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { api } from '../../services/api'

const RENDERER_VERSION = 'teacher-effect-canvas-v1'
const TITLE_HEIGHT = 112
const OUTER_PADDING = 24
const MAX_OUTPUT_PIXELS = 80_000_000

const props = defineProps({
  title: { type: String, default: '' },
  width: { type: [Number, String], default: 1080 },
  imageGap: { type: [Number, String], default: 24 },
  sources: { type: Array, default: () => [] }
})

const emit = defineEmits(['state'])
const canvas = ref(null)
const status = ref('idle')
const error = ref('')
const outputHeight = ref(0)
const imageCache = new Map()
let renderSequence = 0
let renderPromise = Promise.resolve()

const sourceKey = (source) => String(source?.fileId || source?.image || '')

const loadImage = (url) => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error('图片无法读取'))
  image.src = url
})

const loadSourceImage = async (source) => {
  const key = sourceKey(source)
  if (!key) throw new Error('课效图来源缺少文件')
  if (imageCache.has(key)) return imageCache.get(key).image

  let url = ''
  let ownedUrl = false
  if (source.fileId) {
    const blob = await api.files.content(source.fileId)
    url = URL.createObjectURL(blob)
    ownedUrl = true
  } else {
    url = source.image
  }
  try {
    const image = await loadImage(url)
    imageCache.set(key, { image, url: ownedUrl ? url : '' })
    return image
  } catch (loadError) {
    if (ownedUrl) URL.revokeObjectURL(url)
    throw loadError
  }
}

const titleText = () => {
  const value = String(props.title || '').trim()
  return value ? value.slice(0, 120) : '老师课效图'
}

const scaledHeight = (image, targetWidth) => Math.max(1, Math.round(image.naturalHeight * targetWidth / Math.max(1, image.naturalWidth)))

const draw = async () => {
  const sequence = ++renderSequence
  const width = Number(props.width)
  const gap = Number(props.imageGap)
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(gap) || gap < 0 || !props.sources.length) {
    status.value = 'empty'
    error.value = ''
    outputHeight.value = 0
    emit('state', { status: status.value, error: error.value, width: 0, height: 0 })
    return
  }

  status.value = 'loading'
  error.value = ''
  emit('state', { status: status.value, error: error.value, width: 0, height: 0 })
  try {
    const images = await Promise.all(props.sources.map(loadSourceImage))
    if (sequence !== renderSequence) return
    const targetWidth = Math.max(1, Math.round(width) - OUTER_PADDING * 2)
    const heights = images.map((image) => scaledHeight(image, targetWidth))
    const contentHeight = heights.reduce((sum, value) => sum + value, 0)
    const gaps = Math.max(0, images.length - 1) * gap
    const height = Math.max(1, Math.round(TITLE_HEIGHT + OUTER_PADDING * 2 + contentHeight + gaps))
    if (Math.round(width) * height > MAX_OUTPUT_PIXELS) {
      throw new Error('课效图预计总像素超过机构限制，请减小宽度或减少图片')
    }
    const node = canvas.value
    if (!node) return
    node.width = Math.round(width)
    node.height = height
    const context = node.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, node.width, node.height)
    context.fillStyle = '#20312b'
    context.font = `700 ${Math.max(18, Math.min(36, Math.floor(width / 35)))}px sans-serif`
    context.textBaseline = 'alphabetic'
    context.fillText(titleText(), OUTER_PADDING, 54)
    context.strokeStyle = '#dbe3de'
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(OUTER_PADDING, TITLE_HEIGHT - 20)
    context.lineTo(node.width - OUTER_PADDING, TITLE_HEIGHT - 20)
    context.stroke()
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    let y = TITLE_HEIGHT
    images.forEach((image, index) => {
      const itemHeight = heights[index]
      context.drawImage(image, OUTER_PADDING, y, targetWidth, itemHeight)
      y += itemHeight + gap
    })
    outputHeight.value = height
    status.value = 'ready'
    emit('state', { status: status.value, error: '', width: node.width, height })
  } catch (renderError) {
    if (sequence !== renderSequence) return
    status.value = 'error'
    error.value = renderError?.message || '预览生成失败，请检查图片是否可读取'
    outputHeight.value = 0
    emit('state', { status: status.value, error: error.value, width: 0, height: 0 })
  }
}

const scheduleDraw = () => {
  renderPromise = draw()
  return renderPromise
}

const renderBlob = async () => {
  await renderPromise
  if (status.value !== 'ready' || !canvas.value) throw new Error(error.value || '课效图预览尚未准备好')
  const blob = await new Promise((resolve, reject) => {
    canvas.value.toBlob((value) => value ? resolve(value) : reject(new Error('课效图导出失败')), 'image/png')
  })
  const file = new File([blob], 'teacher-effect.png', { type: 'image/png' })
  return { file, width: canvas.value.width, height: canvas.value.height, rendererVersion: RENDERER_VERSION }
}

watch(
  () => ({ title: props.title, width: props.width, imageGap: props.imageGap, sources: props.sources.map(sourceKey) }),
  scheduleDraw,
  { immediate: true, deep: true }
)

onBeforeUnmount(() => {
  renderSequence += 1
  imageCache.forEach((value) => {
    if (value.url) URL.revokeObjectURL(value.url)
  })
  imageCache.clear()
})

defineExpose({ renderBlob, rendererVersion: RENDERER_VERSION, status, outputHeight })
</script>

<template>
  <section class="teacher-effect-live-preview">
    <header>
      <div>
        <span>本次版本预览</span>
        <small v-if="status === 'ready'">预览内容即保存后的 PNG</small>
        <small v-else-if="status === 'loading'">正在读取图片并更新预览…</small>
        <small v-else-if="status === 'error'">{{ error }}</small>
        <small v-else>选择图片后生成预览</small>
      </div>
      <strong v-if="status === 'ready'">{{ width }} × {{ outputHeight }} px</strong>
    </header>
    <div class="teacher-effect-live-preview-canvas">
      <canvas ref="canvas" aria-label="老师课效长图实时预览"></canvas>
    </div>
  </section>
</template>
