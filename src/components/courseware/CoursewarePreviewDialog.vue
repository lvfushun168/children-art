<script setup>
import { computed, createVNode, defineAsyncComponent, nextTick, onBeforeUnmount, ref, render, watch } from 'vue'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import JSZip from 'jszip'
import 'pptx-vue-viewer/styles'
import AppIcon from '../common/AppIcon.vue'
import { api } from '../../services/api'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const PowerPointViewer = defineAsyncComponent(() => import('pptx-vue-viewer').then(({ PowerPointViewer: component }) => component))

const props = defineProps({
  preview: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' }
})

const emit = defineEmits(['close', 'retry'])
const previewDialog = ref(null)
const officeHost = ref(null)
const officePanel = ref(null)
const officeError = ref('')
const officeLoading = ref(false)
const pptxViewer = ref(null)
const pptxContent = ref(null)
const pptxError = ref('')
const pptxLoading = ref(false)
const pptxPresentationReady = ref(false)
const pptxPresentationRequested = ref(false)
const officeFullscreen = ref(false)
const officeNativeFullscreen = ref(false)
const pdfCanvas = ref(null)
const pdfDocument = ref(null)
const pdfPage = ref(1)
const pdfPageCount = ref(0)
const pdfLoading = ref(false)
const pdfError = ref('')
const contentUrl = ref('')
const contentLoading = ref(false)
const contentError = ref('')
const imageZoom = ref(1)
let officeScript = null
let officeEditor = null
let officeLoadedScriptUrl = ''
let contentRequestId = 0
let pptxRequestId = 0
let pptxPresentationResizeObserver = null
let pptxMediaControlCleanups = []
const officeContainerId = `courseware-office-${Math.random().toString(36).slice(2)}`
const imageZoomPercent = computed(() => `${Math.round(imageZoom.value * 100)}%`)

const mode = computed(() => String(props.preview?.mode || '').toUpperCase())
const office = computed(() => props.preview?.office || {})
const officeConfig = computed(() => office.value.config || office.value)
const itemExtension = computed(() => {
  const item = props.preview?.item || {}
  const fileName = item.extension || item.originalFilename || item.file?.extension || item.file?.originalFilename || ''
  return String(fileName).split('.').pop().toLowerCase()
})
const usesPptxViewer = computed(() => mode.value === 'OFFICE' && ['pptx', 'ppsx'].includes(itemExtension.value))
const pptxFileName = computed(() => props.preview?.item?.originalFilename || props.preview?.item?.file?.originalFilename || `courseware.${itemExtension.value || 'pptx'}`)
const pptxHiddenActions = ['export', 'file', 'print', 'share', 'broadcast']
const officeScriptUrl = computed(() => {
  const base = String(office.value.documentServerUrl || '').replace(/\/$/, '')
  return base ? `${base}/web-apps/apps/api/documents/api.js` : ''
})

const runWithoutPptxAutoFullscreen = async (callback) => {
  const originalRequestFullscreen = Element.prototype.requestFullscreen
  if (typeof originalRequestFullscreen !== 'function') return callback()

  Element.prototype.requestFullscreen = function (...args) {
    if (this?.classList?.contains('pptx-vue-presentation')) return Promise.resolve()
    return originalRequestFullscreen.apply(this, args)
  }
  try {
    return await callback()
  } finally {
    await nextTick()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    Element.prototype.requestFullscreen = originalRequestFullscreen
  }
}

const syncOfficeFullscreen = () => {
  const fullscreenElement = document.fullscreenElement
  const nativeFullscreen = fullscreenElement === previewDialog.value || fullscreenElement === officePanel.value
  const mediaFullscreen = Boolean(
    fullscreenElement
    && officePanel.value?.contains(fullscreenElement)
    && !nativeFullscreen
  )
  if (nativeFullscreen) {
    officeNativeFullscreen.value = true
    officeFullscreen.value = true
  } else if (mediaFullscreen) {
    // 视频自身进入全屏时，不改变课件预览弹窗的全屏状态。
  } else if (officeNativeFullscreen.value) {
    officeNativeFullscreen.value = false
    officeFullscreen.value = false
  }
}

const toggleOfficeFullscreen = async () => {
  const fullscreenTarget = previewDialog.value || officePanel.value
  if (!fullscreenTarget) return
  if (officeFullscreen.value) {
    officeFullscreen.value = false
    officeNativeFullscreen.value = false
    if (document.fullscreenElement === previewDialog.value || document.fullscreenElement === officePanel.value) {
      await document.exitFullscreen()
    }
    return
  }
  officeFullscreen.value = true
  try {
    await fullscreenTarget.requestFullscreen()
    officeNativeFullscreen.value = document.fullscreenElement === fullscreenTarget
  } catch {
    // 浏览器拒绝原生全屏时，使用应用内全屏样式继续播放。
    officeNativeFullscreen.value = false
  }
  if (usesPptxViewer.value) await keepPptxPresentationInsideDialog()
}

const destroyOffice = () => {
  try { officeEditor?.destroyEditor?.() } catch { /* 查看器销毁失败不影响关闭弹窗 */ }
  officeEditor = null
  if (officeScript?.parentNode) officeScript.parentNode.removeChild(officeScript)
  officeScript = null
  officeLoadedScriptUrl = ''
  try { delete globalThis.DocsAPI } catch { globalThis.DocsAPI = undefined }
}

const destroyPptxViewer = () => {
  pptxRequestId += 1
  pptxMediaControlCleanups.forEach((cleanup) => cleanup())
  pptxMediaControlCleanups = []
  pptxPresentationResizeObserver?.disconnect?.()
  pptxPresentationResizeObserver = null
  pptxViewer.value = null
  pptxContent.value = null
  pptxLoading.value = false
  pptxPresentationReady.value = false
  pptxPresentationRequested.value = false
}

const destroyPdf = () => {
  try { pdfDocument.value?.destroy?.() } catch { /* PDF.js 清理失败不影响关闭弹窗 */ }
  pdfDocument.value = null
  pdfPage.value = 1
  pdfPageCount.value = 0
}

const destroyContent = () => {
  contentRequestId += 1
  if (contentUrl.value) URL.revokeObjectURL(contentUrl.value)
  contentUrl.value = ''
  contentLoading.value = false
}

const changeImageZoom = (delta) => {
  imageZoom.value = Math.min(4, Math.max(0.25, Math.round((imageZoom.value + delta) * 100) / 100))
}

const resetImageZoom = () => {
  imageZoom.value = 1
}

const handleImageWheel = (event) => {
  changeImageZoom(event.deltaY < 0 ? 0.1 : -0.1)
}

const loadContent = async () => {
  destroyContent()
  contentError.value = ''
  if (!props.preview?.item?.id || !['IMAGE', 'VIDEO', 'PDF'].includes(mode.value)) return
  const requestId = contentRequestId
  contentLoading.value = true
  try {
    const blob = await api.courseware.previewContent(props.preview.item.id)
    if (requestId !== contentRequestId) return
    contentUrl.value = URL.createObjectURL(blob)
  } catch (error) {
    if (requestId !== contentRequestId) return
    contentError.value = error?.message || '课件内容加载失败，请重试'
  } finally {
    if (requestId === contentRequestId) contentLoading.value = false
  }
}

const renderPdfPage = async () => {
  if (!pdfDocument.value || !pdfCanvas.value) return
  const page = await pdfDocument.value.getPage(pdfPage.value)
  const baseViewport = page.getViewport({ scale: 1 })
  const maxWidth = Math.max(360, (pdfCanvas.value.parentElement?.clientWidth || 960) - 32)
  const scale = Math.min(2, Math.max(0.7, maxWidth / baseViewport.width))
  const viewport = page.getViewport({ scale })
  const canvas = pdfCanvas.value
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
}

const loadPdf = async () => {
  if (mode.value !== 'PDF' || !contentUrl.value) return
  destroyPdf()
  pdfError.value = ''
  pdfLoading.value = true
  try {
    pdfDocument.value = await getDocument({ url: contentUrl.value }).promise
    pdfPageCount.value = pdfDocument.value.numPages
    await nextTick()
    await renderPdfPage()
  } catch (error) {
    pdfError.value = error?.message || 'PDF 预览加载失败，请重试'
  } finally {
    pdfLoading.value = false
  }
}

const changePdfPage = async (offset) => {
  const next = pdfPage.value + offset
  if (next < 1 || next > pdfPageCount.value) return
  pdfPage.value = next
  await renderPdfPage()
}

const loadOfficeScript = () => new Promise((resolve, reject) => {
  if (!officeScriptUrl.value) return reject(new Error('未配置 ONLYOFFICE 查看服务地址'))
  if (globalThis.DocsAPI?.DocEditor && officeLoadedScriptUrl === officeScriptUrl.value) return resolve()
  if (officeScript?.parentNode) officeScript.parentNode.removeChild(officeScript)
  const script = document.createElement('script')
  script.src = officeScriptUrl.value
  script.async = true
  script.onload = () => {
    officeLoadedScriptUrl = officeScriptUrl.value
    resolve()
  }
  script.onerror = () => reject(new Error('ONLYOFFICE 查看服务加载失败'))
  officeScript = script
  document.head.appendChild(script)
})

const normalizePptxForPreview = async (blob) => {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  let changed = false
  const presentationProperties = zip.file('ppt/presProps.xml')
  if (presentationProperties) {
    const xml = await presentationProperties.async('text')
    const normalizedXml = xml.replace(/<p:showPr\b([^>]*)>/, (match, attributes) => {
      const withoutTiming = attributes.replace(/\suseTimings\s*=\s*"[^"]*"/i, '')
      return `<p:showPr${withoutTiming} useTimings="0">`
    })
    if (normalizedXml !== xml) {
      zip.file('ppt/presProps.xml', normalizedXml)
      changed = true
    }
  }

  for (const fileName of Object.keys(zip.files)) {
    if (!/^ppt\/slides\/slide\d+\.xml$/i.test(fileName)) continue
    const slideFile = zip.file(fileName)
    if (!slideFile) continue
    const slideXml = await slideFile.async('text')
    if (!/<a:audioFile\b/i.test(slideXml)) continue
    const normalizedSlideXml = slideXml.replace(/<p:timing\b[^>]*\/>|<p:timing\b[^>]*>[\s\S]*?<\/p:timing>/i, '')
    if (normalizedSlideXml === slideXml) continue
    zip.file(fileName, normalizedSlideXml)
    changed = true
  }

  if (!changed) return blob
  const normalizedBytes = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' })
  return new Blob([normalizedBytes], { type: blob.type || 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })
}

const pausePptxMedia = () => {
  const panel = officePanel.value
  if (!panel) return
  panel.querySelectorAll('video, audio').forEach((media) => {
    try {
      media.pause()
    } catch {
      // 浏览器尚未准备好媒体时，忽略暂停失败。
    }
  })
}

const mountPptxIcon = (container, name, size) => {
  const vnode = createVNode(AppIcon, { name, size, strokeWidth: 2 })
  render(vnode, container)
  return () => render(null, container)
}

const stopPptxAudioEvent = (event) => {
  event.stopPropagation()
}

const decoratePptxAudio = (media) => {
  const host = media.closest('.pptx-vue-media')
  if (!host || host.querySelector('.courseware-pptx-audio-ui')) return () => {}

  const previousHostPointerEvents = host.style.getPropertyValue('pointer-events')
  const previousHostPointerEventsPriority = host.style.getPropertyPriority('pointer-events')
  const previousMediaDisplay = media.style.display
  const previousMediaPointerEvents = media.style.pointerEvents
  const hadControlsAttribute = media.hasAttribute('controls')
  const hadControlsListAttribute = media.hasAttribute('controlsList')
  const previousControlsList = media.getAttribute('controlsList')

  host.style.setProperty('pointer-events', 'auto', 'important')
  host.classList.add('courseware-pptx-audio-host')
  media.controls = false
  media.removeAttribute('controls')
  media.style.display = 'none'
  media.style.pointerEvents = 'none'
  media.setAttribute('aria-hidden', 'true')

  const audioUi = document.createElement('div')
  audioUi.className = 'courseware-pptx-audio-ui'
  audioUi.setAttribute('role', 'group')
  audioUi.setAttribute('aria-label', '音频播放控制')

  const speakerButton = document.createElement('button')
  speakerButton.type = 'button'
  speakerButton.className = 'courseware-pptx-audio-button'
  speakerButton.setAttribute('aria-label', '播放音频')
  speakerButton.title = '播放音频'
  const speakerIcon = document.createElement('span')
  speakerIcon.className = 'courseware-pptx-audio-icon'
  speakerButton.appendChild(speakerIcon)

  const controls = document.createElement('div')
  controls.className = 'courseware-pptx-audio-controls'

  const playButton = document.createElement('button')
  playButton.type = 'button'
  playButton.className = 'courseware-pptx-audio-play'
  playButton.setAttribute('aria-label', '播放音频')
  playButton.title = '播放音频'
  const playIcon = document.createElement('span')
  playButton.appendChild(playIcon)

  const progress = document.createElement('input')
  progress.type = 'range'
  progress.className = 'courseware-pptx-audio-progress'
  progress.min = '0'
  progress.max = '0'
  progress.step = '0.01'
  progress.value = '0'
  progress.setAttribute('aria-label', '音频播放进度')

  const volumeIcon = document.createElement('span')
  volumeIcon.className = 'courseware-pptx-audio-volume-icon'
  volumeIcon.setAttribute('aria-hidden', 'true')
  const volume = document.createElement('input')
  volume.type = 'range'
  volume.className = 'courseware-pptx-audio-volume'
  volume.min = '0'
  volume.max = '1'
  volume.step = '0.05'
  volume.value = String(media.volume)
  volume.setAttribute('aria-label', '音量')

  controls.append(playButton, progress, volumeIcon, volume)
  audioUi.append(speakerButton, controls)
  host.appendChild(audioUi)

  const cleanups = [
    mountPptxIcon(speakerIcon, 'volume', 42),
    mountPptxIcon(volumeIcon, 'volume', 15)
  ]

  const setPlayingIcon = (playing) => {
    render(createVNode(AppIcon, { name: playing ? 'pause' : 'play', size: 16, strokeWidth: 2 }), playIcon)
    playButton.setAttribute('aria-label', playing ? '暂停音频' : '播放音频')
    playButton.title = playing ? '暂停音频' : '播放音频'
    speakerButton.setAttribute('aria-label', playing ? '暂停音频' : '播放音频')
    speakerButton.title = playing ? '暂停音频' : '播放音频'
  }

  const updateControls = () => {
    const duration = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : 0
    const currentTime = Number.isFinite(media.currentTime) ? media.currentTime : 0
    progress.max = String(duration)
    progress.value = String(Math.min(currentTime, duration || currentTime))
    progress.disabled = duration <= 0
    volume.value = String(Number.isFinite(media.volume) ? media.volume : 1)
    setPlayingIcon(!media.paused && !media.ended)
  }

  const togglePlayback = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (media.paused || media.ended) {
      if (media.ended) media.currentTime = 0
      media.dataset.coursewareUserPlayback = 'true'
      try {
        await media.play()
      } catch {
        delete media.dataset.coursewareUserPlayback
      }
    } else {
      media.pause()
    }
    updateControls()
  }

  const seekAudio = (event) => {
    event.stopPropagation()
    const nextTime = Number(event.currentTarget.value)
    if (Number.isFinite(nextTime)) media.currentTime = nextTime
  }

  const changeVolume = (event) => {
    event.stopPropagation()
    const nextVolume = Number(event.currentTarget.value)
    if (Number.isFinite(nextVolume)) media.volume = nextVolume
  }

  speakerButton.addEventListener('click', togglePlayback)
  playButton.addEventListener('click', togglePlayback)
  progress.addEventListener('input', seekAudio)
  volume.addEventListener('input', changeVolume)
  audioUi.addEventListener('pointerdown', stopPptxAudioEvent)
  audioUi.addEventListener('click', stopPptxAudioEvent)
  const mediaEvents = ['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata', 'durationchange', 'volumechange']
  mediaEvents.forEach((eventName) => media.addEventListener(eventName, updateControls))
  updateControls()

  cleanups.push(() => render(null, playIcon))
  cleanups.push(() => {
    speakerButton.removeEventListener('click', togglePlayback)
    playButton.removeEventListener('click', togglePlayback)
    progress.removeEventListener('input', seekAudio)
    volume.removeEventListener('input', changeVolume)
    audioUi.removeEventListener('pointerdown', stopPptxAudioEvent)
    audioUi.removeEventListener('click', stopPptxAudioEvent)
    mediaEvents.forEach((eventName) => media.removeEventListener(eventName, updateControls))
  })
  cleanups.push(() => audioUi.remove())

  return () => {
    cleanups.forEach((cleanup) => cleanup())
    media.controls = hadControlsAttribute
    if (hadControlsAttribute) media.setAttribute('controls', '')
    if (hadControlsListAttribute) media.setAttribute('controlsList', previousControlsList || '')
    else media.removeAttribute('controlsList')
    media.style.display = previousMediaDisplay
    media.style.pointerEvents = previousMediaPointerEvents
    media.removeAttribute('aria-hidden')
    host.classList.remove('courseware-pptx-audio-host')
    host.style.removeProperty('pointer-events')
    if (previousHostPointerEvents) host.style.setProperty('pointer-events', previousHostPointerEvents, previousHostPointerEventsPriority)
  }
}

const refreshPptxMediaControls = async () => {
  await nextTick()
  pptxMediaControlCleanups.forEach((cleanup) => cleanup())
  pptxMediaControlCleanups = []
  const panel = officePanel.value
  if (!panel) return

  panel.querySelectorAll('video, audio').forEach((media) => {
    const isVideo = media instanceof HTMLVideoElement
    if (isVideo) media.controls = true
    media.style.pointerEvents = 'auto'
    media.autoplay = false
    media.removeAttribute('autoplay')
    media.setAttribute('controlsList', 'nodownload noplaybackrate')
    media.setAttribute('disableRemotePlayback', '')
    if (isVideo) {
      media.disablePictureInPicture = true
      media.setAttribute('playsinline', '')
    }

    if (pptxPresentationReady.value) {
      const markUserPlayback = () => {
        media.dataset.coursewareUserPlayback = 'true'
      }
      const originalPlay = media.play
      const guardedPlay = (...args) => {
        if (media.dataset.coursewareUserPlayback === 'true') {
          delete media.dataset.coursewareUserPlayback
          return originalPlay.apply(media, args)
        }
        media.pause()
        return Promise.resolve()
      }
      media.play = guardedPlay
      const events = [
        ['pointerdown', markUserPlayback, true],
        ['click', markUserPlayback, true],
        ['keydown', markUserPlayback, true]
      ]
      events.forEach(([eventName, handler, capture]) => media.addEventListener(eventName, handler, capture))
      const cleanupPlaybackGuard = () => {
        events.forEach(([eventName, handler, capture]) => media.removeEventListener(eventName, handler, capture))
        if (media.play === guardedPlay) media.play = originalPlay
        delete media.dataset.coursewareUserPlayback
      }
      pptxMediaControlCleanups.push(cleanupPlaybackGuard)
    }

    if (!isVideo) {
      pptxMediaControlCleanups.push(decoratePptxAudio(media))
    }
  })
  pausePptxMedia()
}

const keepPptxPresentationInsideDialog = async () => {
  await nextTick()
  const presentation = document.querySelector('.pptx-vue-presentation')
  if (!presentation || !officePanel.value) return
  if (presentation.parentElement !== officePanel.value) officePanel.value.appendChild(presentation)
  presentation.classList.add('courseware-pptx-presentation')
  const syncScale = () => {
    const stage = presentation.querySelector('.pptx-vue-stage')
    const frame = presentation.querySelector('.pptx-vue-presentation-frame')
    const canvasWidth = Number.parseFloat(stage?.style.width) || stage?.offsetWidth || 1280
    const canvasHeight = Number.parseFloat(stage?.style.height) || stage?.offsetHeight || 720
    const panelWidth = officePanel.value.clientWidth
    const panelHeight = officePanel.value.clientHeight
    if (!panelWidth || !panelHeight) return
    const scale = Math.min(panelWidth / canvasWidth, panelHeight / canvasHeight)
    const frameWidth = Math.round(canvasWidth * scale)
    const frameHeight = Math.round(canvasHeight * scale)
    presentation.style.setProperty('--courseware-pptx-frame-width', `${frameWidth}px`)
    presentation.style.setProperty('--courseware-pptx-frame-height', `${frameHeight}px`)
    presentation.style.setProperty('--courseware-pptx-scale', String(Math.max(0.1, scale)))
    if (frame) frame.style.setProperty('transform', 'none', 'important')
  }
  syncScale()
  pptxPresentationResizeObserver?.disconnect?.()
  pptxPresentationResizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncScale)
  pptxPresentationResizeObserver?.observe(officePanel.value)
}

const handlePptxSlideChange = () => {
  void refreshPptxMediaControls()
}

const handlePptxSlideCountChange = (count) => {
  if (!count) return
  pptxLoading.value = false
  if (!pptxPresentationRequested.value) void enterPptxPresentation()
  else void refreshPptxMediaControls()
}

const handlePptxModeChange = async (nextMode) => {
  if (nextMode === 'present') {
    await keepPptxPresentationInsideDialog()
    pptxLoading.value = false
    pptxPresentationReady.value = true
    void refreshPptxMediaControls()
    return
  }
  pptxPresentationReady.value = false
  pptxPresentationResizeObserver?.disconnect?.()
  pptxPresentationResizeObserver = null
  void refreshPptxMediaControls()
  if (pptxPresentationRequested.value) {
    void nextTick(() => enterPptxPresentation())
  }
}

const enterPptxPresentation = async () => {
  if (!usesPptxViewer.value || !pptxViewer.value || pptxPresentationReady.value) return
  pptxPresentationRequested.value = true
  await runWithoutPptxAutoFullscreen(() => pptxViewer.value?.setMode?.('present'))
  await keepPptxPresentationInsideDialog()
}

const openPptxViewer = async () => {
  if (!usesPptxViewer.value || !props.preview) return
  const requestId = ++pptxRequestId
  pptxError.value = ''
  pptxLoading.value = true
  pptxContent.value = null
  pptxPresentationReady.value = false
  pptxPresentationRequested.value = false
  try {
    const blob = await api.courseware.previewContent(props.preview.item.id)
    if (requestId !== pptxRequestId) return
    const normalizedBlob = await normalizePptxForPreview(blob)
    if (requestId !== pptxRequestId) return
    pptxContent.value = new Uint8Array(await normalizedBlob.arrayBuffer())
  } catch (error) {
    if (requestId === pptxRequestId) {
      pptxError.value = error?.message || 'PPTX 预览加载失败，请重试'
      pptxLoading.value = false
    }
  }
}

const openOffice = async () => {
  if (mode.value !== 'OFFICE' || usesPptxViewer.value || !props.preview) return
  officeError.value = ''
  officeLoading.value = true
  destroyOffice()
  try {
    await loadOfficeScript()
    await nextTick()
    if (!officeHost.value || !globalThis.DocsAPI?.DocEditor) throw new Error('ONLYOFFICE 查看器不可用')
    officeEditor = new globalThis.DocsAPI.DocEditor(officeContainerId, {
      ...officeConfig.value,
      width: '100%',
      height: '100%'
    })
  } catch (error) {
    officeError.value = error?.message || '课件预览加载失败，请重试'
  } finally {
    officeLoading.value = false
  }
}

const loadPreview = async () => {
  destroyOffice()
  destroyPptxViewer()
  destroyPdf()
  destroyContent()
  contentError.value = ''
  pptxError.value = ''
  resetImageZoom()
  if (usesPptxViewer.value) await openPptxViewer()
  else if (mode.value === 'OFFICE') await openOffice()
  if (['IMAGE', 'VIDEO', 'PDF'].includes(mode.value)) {
    await loadContent()
    if (mode.value === 'PDF' && !contentError.value) await loadPdf()
  }
}

watch(() => props.preview, () => { void loadPreview() }, { immediate: true })
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', syncOfficeFullscreen)
  if (document.fullscreenElement === previewDialog.value || document.fullscreenElement === officePanel.value) {
    try { void document.exitFullscreen().catch(() => {}) } catch { /* 页面销毁时全屏状态变化不影响关闭预览 */ }
  }
  destroyOffice(); destroyPptxViewer(); destroyPdf(); destroyContent()
})
document.addEventListener('fullscreenchange', syncOfficeFullscreen)
</script>

<template>
  <div v-if="preview || loading" class="preview-backdrop" @click.self="emit('close')">
    <section ref="previewDialog" class="preview-dialog" :class="{ 'preview-dialog-fullscreen': officeFullscreen && mode === 'OFFICE' }" role="dialog" aria-modal="true" aria-label="课件预览">
      <header class="preview-head">
        <div>
          <span>课件预览</span>
          <strong>{{ preview?.item?.title || '正在准备…' }}</strong>
        </div>
        <div class="preview-head-actions">
          <button
            v-if="mode === 'OFFICE'"
            class="preview-head-action"
            type="button"
            :aria-label="officeFullscreen ? '退出全屏' : '全屏播放'"
            :title="officeFullscreen ? '退出全屏' : '全屏播放'"
            @click="toggleOfficeFullscreen"
          >
            <AppIcon :name="officeFullscreen ? 'fullscreen-exit' : 'fullscreen'" :size="17" />
            <span>{{ officeFullscreen ? '退出全屏' : '全屏' }}</span>
          </button>
          <button class="preview-close" type="button" aria-label="关闭预览" @click="emit('close')"><AppIcon name="close" :size="18" /></button>
        </div>
      </header>

      <main class="preview-body">
        <div v-if="loading" class="preview-state">正在准备预览，请稍候…</div>
        <template v-else-if="preview">
          <div v-if="contentLoading" class="preview-state">正在加载课件内容…</div>
          <div v-else-if="contentError" class="preview-error">
            <strong>{{ contentError }}</strong>
            <button type="button" class="primary" @click="loadPreview"><AppIcon name="retry" :size="15" />重新加载</button>
          </div>
          <div v-else-if="mode === 'IMAGE'" class="image-preview-panel">
            <div class="image-viewport" @wheel.prevent="handleImageWheel">
              <img
                class="image-preview"
                :src="contentUrl"
                :alt="preview.item?.title || '课件图片'"
                :style="{ transform: `scale(${imageZoom})` }"
              />
            </div>
            <div class="image-toolbar" aria-label="图片缩放工具">
              <button class="image-tool-button" type="button" aria-label="缩小图片" title="缩小" :disabled="imageZoom <= 0.25" @click="changeImageZoom(-0.25)">
                <AppIcon name="zoom-out" :size="16" />
              </button>
              <span class="image-zoom-value">{{ imageZoomPercent }}</span>
              <button class="image-tool-button" type="button" aria-label="放大图片" title="放大" :disabled="imageZoom >= 4" @click="changeImageZoom(0.25)">
                <AppIcon name="zoom-in" :size="16" />
              </button>
              <button class="image-fit-button" type="button" @click="resetImageZoom"><AppIcon name="reset" :size="15" />适应窗口</button>
            </div>
          </div>
          <video v-else-if="mode === 'VIDEO'" class="video-preview" :src="contentUrl" controls controlslist="nodownload" playsinline preload="metadata">
            当前浏览器不支持视频播放
          </video>
          <div v-else-if="mode === 'PDF'" class="pdf-preview">
            <div class="pdf-canvas-wrap"><canvas ref="pdfCanvas"></canvas></div>
            <div v-if="pdfLoading" class="pdf-overlay preview-state">正在加载 PDF…</div>
            <div v-else-if="pdfError" class="pdf-overlay preview-error">
              <strong>{{ pdfError }}</strong>
              <button type="button" class="primary" @click="loadPdf"><AppIcon name="retry" :size="15" />重新加载</button>
            </div>
            <div v-else class="pdf-toolbar">
              <button class="ghost" type="button" :disabled="pdfPage <= 1" @click="changePdfPage(-1)"><AppIcon name="back" :size="15" />上一页</button>
              <span>第 {{ pdfPage }} / {{ pdfPageCount }} 页</span>
              <button class="ghost" type="button" :disabled="pdfPage >= pdfPageCount" @click="changePdfPage(1)">下一页<AppIcon name="next" :size="15" /></button>
            </div>
          </div>
          <div
            v-else-if="mode === 'OFFICE' && usesPptxViewer"
            ref="officePanel"
            class="office-preview pptx-viewer-preview"
          >
            <PowerPointViewer
              v-if="pptxContent"
              ref="pptxViewer"
              class="pptx-courseware-viewer"
              :content="pptxContent"
              :file-name="pptxFileName"
              :can-edit="false"
              :autosave="false"
              :hidden-actions="pptxHiddenActions"
              default-locale="zh-CN"
              @slide-count-change="handlePptxSlideCountChange"
              @active-slide-change="handlePptxSlideChange"
              @mode-change="handlePptxModeChange"
            />
            <div v-if="pptxLoading" class="office-overlay preview-state">正在加载 PPTX 课件…</div>
            <div v-else-if="pptxError" class="office-overlay preview-error">
              <strong>{{ pptxError }}</strong>
              <button type="button" class="primary" @click="loadPreview"><AppIcon name="retry" :size="15" />重新加载</button>
            </div>
          </div>
          <div v-else-if="mode === 'OFFICE'" ref="officePanel" class="office-preview">
            <div :id="officeContainerId" ref="officeHost" class="office-host"></div>
            <div v-if="officeLoading" class="office-overlay preview-state">正在加载办公文件查看器…</div>
            <div v-else-if="officeError" class="office-overlay preview-error">
              <strong>{{ officeError }}</strong>
              <button type="button" class="primary" @click="emit('retry')"><AppIcon name="retry" :size="15" />重新加载</button>
            </div>
          </div>
          <div v-else class="preview-error">
            <strong>该课件格式暂不支持预览</strong>
            <button type="button" class="primary" @click="emit('retry')"><AppIcon name="retry" :size="15" />重试</button>
          </div>
        </template>
        <div v-else class="preview-error">
          <strong>{{ error || '课件预览加载失败，请重试' }}</strong>
          <button type="button" class="primary" @click="emit('retry')"><AppIcon name="retry" :size="15" />重新加载</button>
        </div>
      </main>
      <footer class="preview-foot">
        <button type="button" class="ghost" @click="emit('close')"><AppIcon name="close" :size="15" />关闭</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.preview-backdrop { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; padding: 20px; background: color-mix(in srgb, var(--color-heading) 42%, transparent); }
.preview-dialog { display: flex; flex-direction: column; width: min(1180px, 96vw); height: min(820px, 92vh); overflow: hidden; border: 1px solid var(--color-border); border-radius: 18px; background: var(--color-surface); box-shadow: var(--shadow-modal); }
.preview-dialog-fullscreen { width: 100vw; height: 100vh; border-radius: 0; }
.preview-dialog:fullscreen { width: 100vw; height: 100vh; border-radius: 0; }
.preview-head, .preview-foot { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 18px; border-bottom: 1px solid var(--color-border-soft); }
.preview-head-actions { display: inline-flex; align-items: center; gap: 8px; }
.preview-head-action { display: inline-flex; align-items: center; gap: 5px; min-height: 34px; padding: 0 9px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text); cursor: pointer; font-size: 12px; }
.preview-head-action:hover { border-color: var(--color-primary); background: var(--color-primary-soft); color: var(--color-primary); }
.preview-head span { display: block; color: var(--color-muted); font-size: 12px; }
.preview-head strong { display: block; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preview-close { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: 0; border-radius: 7px; background: transparent; color: var(--color-muted); cursor: pointer; }
.preview-close:hover { background: var(--color-primary-soft); color: var(--color-primary); }
.preview-body { display: grid; flex: 1; min-height: 0; place-items: center; background: var(--color-surface-muted); }
.image-preview-panel { position: relative; width: 100%; height: 100%; min-width: 0; min-height: 0; }
.image-viewport { width: 100%; height: 100%; overflow: auto; display: grid; place-items: center; padding: 56px 24px 24px; box-sizing: border-box; }
.image-preview { display: block; max-width: 100%; max-height: 100%; object-fit: contain; transform-origin: center center; transition: transform 120ms ease; }
.image-toolbar { position: absolute; top: 14px; left: 50%; display: inline-flex; align-items: center; gap: 4px; transform: translateX(-50%); padding: 5px; border: 1px solid var(--color-border); border-radius: 10px; background: color-mix(in srgb, var(--color-surface) 94%, transparent); box-shadow: var(--shadow-panel); }
.image-tool-button, .image-fit-button { display: inline-flex; align-items: center; justify-content: center; min-height: 30px; border: 0; border-radius: 7px; background: transparent; color: var(--color-text); cursor: pointer; }
.image-tool-button { width: 30px; }
.image-tool-button:hover:not(:disabled), .image-fit-button:hover { background: var(--color-primary-soft); color: var(--color-primary); }
.image-tool-button:disabled { color: var(--color-border-strong); cursor: not-allowed; }
.image-fit-button { gap: 5px; padding: 0 8px; font-size: 12px; }
.image-zoom-value { min-width: 44px; color: var(--color-muted); font-size: 12px; text-align: center; }
.video-preview { max-width: 100%; max-height: 100%; object-fit: contain; }
.video-preview { width: min(100%, 1080px); }
.pdf-preview, .office-preview, .office-host { width: 100%; height: 100%; border: 0; }
.pdf-preview { position: relative; display: flex; flex-direction: column; min-height: 0; }
.pdf-canvas-wrap { display: grid; flex: 1; min-height: 0; place-items: center; overflow: auto; padding: 16px; }
.pdf-canvas-wrap canvas { max-width: 100%; height: auto; background: var(--color-surface); box-shadow: 0 4px 18px color-mix(in srgb, var(--color-heading) 14%, transparent); }
.pdf-toolbar { display: flex; align-items: center; justify-content: center; gap: 14px; flex: 0 0 auto; padding: 10px; background: var(--color-surface); color: var(--color-muted); font-size: 12px; }
.pdf-overlay { position: absolute; inset: 0; background: color-mix(in srgb, var(--color-surface-muted) 92%, transparent); }
.office-preview { position: relative; background: var(--color-surface); }
.pptx-viewer-preview { overflow: hidden; background: var(--color-surface-muted); }
.pptx-courseware-viewer { width: 100%; height: 100%; min-height: 0; }
.pptx-viewer-preview :deep(.pptx-vue-viewer) { width: 100%; height: 100%; }
.pptx-viewer-preview :deep(.pptx-vue-media video), .pptx-viewer-preview :deep(.pptx-vue-media audio) { pointer-events: auto !important; }
.pptx-viewer-preview :deep(.pptx-vue-ptb-btn--end) { display: none !important; }
:global(.courseware-pptx-presentation) { position: absolute !important; inset: 0 !important; z-index: 1 !important; display: flex !important; align-items: center !important; justify-content: center !important; width: auto !important; height: auto !important; background: var(--color-surface-muted) !important; }
:global(.courseware-pptx-presentation .pptx-vue-presentation-frame) { width: var(--courseware-pptx-frame-width) !important; height: var(--courseware-pptx-frame-height) !important; flex: 0 0 auto !important; }
:global(.courseware-pptx-presentation .pptx-vue-stage) { transform: scale(var(--courseware-pptx-scale, 1)) !important; transform-origin: top left !important; }
:global(.pptx-vue-ptb-btn--end) { display: none !important; }
:global(.courseware-pptx-audio-host) { overflow: visible !important; z-index: 80 !important; }
:global(.courseware-pptx-audio-ui) { position: absolute; inset: 0; z-index: 90; display: flex; align-items: center; justify-content: center; overflow: visible; color: var(--color-text); pointer-events: auto; }
:global(.courseware-pptx-audio-button) { display: inline-flex; align-items: center; justify-content: center; width: 54px; height: 54px; padding: 0; border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent); border-radius: 50%; background: color-mix(in srgb, var(--color-surface) 92%, transparent); color: var(--color-primary); box-shadow: var(--shadow-panel); cursor: pointer; }
:global(.courseware-pptx-audio-button:hover), :global(.courseware-pptx-audio-button:focus-visible) { background: var(--color-primary-soft); color: var(--color-primary); }
:global(.courseware-pptx-audio-icon) { display: inline-flex; align-items: center; justify-content: center; }
:global(.courseware-pptx-audio-controls) { position: absolute; left: 50%; bottom: -42px; display: flex; align-items: center; gap: 7px; width: min(252px, 30vw); min-width: 220px; padding: 7px 9px; border: 1px solid var(--color-border); border-radius: 9px; background: color-mix(in srgb, var(--color-surface) 96%, transparent); box-shadow: var(--shadow-panel); opacity: 0; visibility: hidden; pointer-events: none; transform: translateX(-50%); transition: opacity 120ms ease, visibility 120ms ease; }
:global(.courseware-pptx-audio-host:hover .courseware-pptx-audio-controls), :global(.courseware-pptx-audio-ui:focus-within .courseware-pptx-audio-controls) { opacity: 1; visibility: visible; pointer-events: auto; }
:global(.courseware-pptx-audio-play) { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 6px; background: var(--color-primary-soft); color: var(--color-primary); cursor: pointer; }
:global(.courseware-pptx-audio-play:hover), :global(.courseware-pptx-audio-play:focus-visible) { background: var(--color-primary); color: var(--color-primary-contrast); }
:global(.courseware-pptx-audio-progress), :global(.courseware-pptx-audio-volume) { min-width: 0; accent-color: var(--color-primary); cursor: pointer; }
:global(.courseware-pptx-audio-progress) { flex: 1 1 auto; }
:global(.courseware-pptx-audio-volume) { width: 54px; flex: 0 0 54px; }
:global(.courseware-pptx-audio-volume-icon) { display: inline-flex; align-items: center; justify-content: center; color: var(--color-muted); }
:global(.courseware-pptx-audio-controls input:disabled) { opacity: .45; cursor: not-allowed; }
.office-preview:fullscreen { display: flex; min-height: 100vh; background: var(--color-surface); }
.office-preview:fullscreen .office-host { flex: 1; }
.office-preview:fullscreen .pptx-courseware-viewer { flex: 1; }
.office-overlay { position: absolute; inset: 0; background: color-mix(in srgb, var(--color-surface-muted) 92%, transparent); }
.preview-state, .preview-error { display: grid; place-items: center; gap: 14px; padding: 32px; color: var(--color-muted); text-align: center; }
.preview-error strong { color: var(--color-status-danger-text); }
.preview-foot { justify-content: flex-end; border-top: 1px solid var(--color-border-soft); border-bottom: 0; color: var(--color-muted); font-size: 12px; }
@media (max-width: 680px) { .preview-backdrop { padding: 0; } .preview-dialog { width: 100vw; height: 100vh; border-radius: 0; } }
</style>
