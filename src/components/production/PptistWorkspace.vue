<script setup>
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import '@lofcz/pptist/embed.css'
import { installPptistChineseLocalization } from '../../services/pptistChineseLocale'
import { pptistViewport } from '../../services/portfolioPptistAdapter'
import { exportPortfolioPdf } from '../../services/portfolioPdfExporter'

const props = defineProps({
  document: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['ready', 'change', 'error'])

const hostRef = ref(null)
const controller = shallowRef(null)
const activeSlideId = ref('')
let destroyed = false
let applyingDocument = false
let unsubscribe = null
let cleanupLocalization = null

const nextId = (prefix) => {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const applyViewport = async () => {
  if (!controller.value) return
  try {
    if (controller.value.deck?.setViewport) {
      await controller.value.deck.setViewport({ size: pptistViewport.size, ratio: pptistViewport.ratio })
      return
    }
    if (controller.value.execute) {
      await controller.value.execute({
        id: nextId('viewport'),
        type: 'deck.setViewport',
        payload: { size: pptistViewport.size, ratio: pptistViewport.ratio }
      })
    }
  } catch (error) {
    emit('error', error)
  }
}

const applyDocument = async (document) => {
  if (!controller.value || !document) return
  applyingDocument = true
  try {
    controller.value.setDocument(document)
    await applyViewport()
  } finally {
    window.setTimeout(() => {
      applyingDocument = false
    }, 0)
  }
}

const currentDocument = () => controller.value?.getDocument?.() || props.document

const pageElements = () => {
  if (!hostRef.value) return []
  const candidates = [
    ...hostRef.value.querySelectorAll('[data-slide-id]'),
    ...hostRef.value.querySelectorAll('.pptist-slide'),
    ...hostRef.value.querySelectorAll('[class*="slide"]')
  ]
  return [...new Set(candidates)].filter((element) => element instanceof HTMLElement && element.getBoundingClientRect().width > 0)
}

const exportPdfBlob = async (fileName) => exportPortfolioPdf({
  pageElements: pageElements(),
  fileName,
  exportedAt: new Date().toISOString(),
  save: false
})

const syncActiveSlideId = () => {
  const slideId = controller.value?.getState?.()?.currentSlideId
  if (slideId) activeSlideId.value = slideId
  return slideId
}

const currentSlideId = () => {
  try {
    return syncActiveSlideId() || activeSlideId.value || controller.value?.slides?.get?.()?.id || currentDocument()?.slides?.[0]?.id
  } catch {
    return activeSlideId.value || currentDocument()?.slides?.[0]?.id
  }
}

const restoreSlide = async (slideId) => {
  if (!controller.value || !slideId) return
  try {
    if (controller.value.view?.goToSlide) {
      await controller.value.view.goToSlide(slideId, { source: 'host', label: 'Keep current slide after asset insert' })
      activeSlideId.value = slideId
      return
    }
    controller.value.goToSlide?.(slideId)
    activeSlideId.value = slideId
  } catch (error) {
    emit('error', error)
  }
}

const upsertElement = async (element) => {
  if (!controller.value) return false
  const slideId = currentSlideId()
  if (!slideId) return false
  try {
    if (controller.value.elements?.create) {
      const result = await controller.value.elements.create({ slideId, element, select: true })
      await restoreSlide(slideId)
      return result?.ok !== false
    }
    const document = currentDocument()
    const slide = document?.slides?.find((item) => item.id === slideId) || document?.slides?.[0]
    if (!slide) return false
    slide.elements.push(element)
    controller.value.setDocument(document)
    await restoreSlide(slideId)
    return true
  } catch (error) {
    emit('error', error)
    return false
  }
}

const insertImage = async (recordOrImage) => {
  const src = recordOrImage?.artwork || recordOrImage?.src
  if (!src) return false
  return upsertElement({
    type: 'image',
    id: nextId('asset-image'),
    name: recordOrImage?.name || `素材-${recordOrImage?.id || 'image'}`,
    left: 590,
    top: 160,
    width: 260,
    height: 190,
    rotate: 0,
    fixedRatio: false,
    src,
    radius: 2,
    shadow: { h: 6, v: 8, blur: 16, color: 'rgba(20, 35, 30, 0.16)' },
    outline: { style: 'solid', width: 1, color: 'rgba(22, 40, 34, 0.12)' }
  })
}

const insertText = async (content, name = '素材文字') => {
  if (!content) return false
  return upsertElement({
    type: 'text',
    id: nextId('asset-text'),
    name,
    left: 600,
    top: 380,
    width: 300,
    height: 90,
    rotate: 0,
    content: `<p><span style="font-size: 18px; line-height: 1.45;">${String(content).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span></p>`,
    defaultFontName: 'Microsoft YaHei',
    defaultColor: '#24352f',
    lineHeight: 1.45
  })
}

defineExpose({
  insertImage,
  insertText,
  getDocument: currentDocument,
  exportPdfBlob
})

const mount = async () => {
  if (!hostRef.value) return
  try {
    const { mountPptist } = await import('@lofcz/pptist/embed')
    const result = await mountPptist(hostRef.value, {
      locale: 'en',
      document: props.document,
      loadMockOnEmpty: false,
      showLoadingData: false,
      onChangeDebounceMs: 300,
      onChange: (document) => {
        if (!applyingDocument) emit('change', document)
      },
      exportTabs: {
        pptx: true,
        pdf: true,
        image: false,
        json: false,
        pptist: false
      }
    })
    if (destroyed) {
      result.controller.destroy()
      return
    }
    controller.value = result.controller
    cleanupLocalization = installPptistChineseLocalization(hostRef.value)
    activeSlideId.value = controller.value.getState?.()?.currentSlideId || props.document?.slides?.[0]?.id || ''
    unsubscribe = controller.value.subscribe?.((event) => {
      const slideId = event?.data?.currentSlideId || controller.value?.getState?.()?.currentSlideId
      if (slideId) activeSlideId.value = slideId
    })
    await applyViewport()
    emit('ready', result.controller)
  } catch (error) {
    emit('error', error)
  }
}

watch(
  () => props.document,
  (document) => {
    if (controller.value && document) applyDocument(document)
  }
)

onMounted(mount)

onBeforeUnmount(() => {
  destroyed = true
  cleanupLocalization?.()
  cleanupLocalization = null
  unsubscribe?.()
  unsubscribe = null
  controller.value?.destroy?.()
  controller.value = null
})
</script>

<template>
  <div ref="hostRef" class="pptist-workspace"></div>
</template>
