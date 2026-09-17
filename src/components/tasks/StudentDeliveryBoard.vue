<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ProtectedMedia from '../common/ProtectedMedia.vue'
import { sameId } from '../../services/mappers'
import { imageTemplateSummary, isClientCanvasTemplate, renderArtworkFile } from '../../services/imageTemplateRenderer'

const props = defineProps({
  state: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['drawer-state', 'mobile-detail-state'])

const artworkStudentId = ref(null)
const commentStudentId = ref(null)
const batchOpen = ref(false)
const mobileStudentId = ref(null)
const mobileSection = ref(null)
const aiPromptOpen = ref(false)
const aiPrompt = ref('')
const aiPromptError = ref('')

const studentFor = (studentId) => {
  const student = props.state.students.find((item) => sameId(item.id, studentId))
  if (student) return student
  const row = props.state.sessionStudents.find((item) => sameId(item.studentId, studentId))
  return row ? { name: row.studentName || '学生', parent: row.parent || '' } : { name: '学生', parent: '' }
}

const templateIsEnabled = (template) => String(template?.status || 'ENABLED').toUpperCase() !== 'DISABLED'

const imageTemplateOptions = computed(() =>
  props.state.templates.image.map((template, index) => ({ template, index })).filter(({ template }) => templateIsEnabled(template)).map(({ template, index }) => ({
    label: template.name,
    value: index,
    description: template.summary || imageTemplateSummary(template)
  }))
)

const commentTemplateOptions = computed(() =>
  props.state.templates.comment.map((template, index) => ({ template, index })).filter(({ template }) => templateIsEnabled(template)).map(({ template, index }) => ({
    label: template.name,
    value: index,
    description: `${template.tone || ''} · ${template.length || ''}`
  }))
)

const artworkRow = computed(() =>
  props.state.attendingRows.find((row) => sameId(row.studentId, artworkStudentId.value)) || null
)
const artworkItems = computed(() => Array.isArray(artworkRow.value?.artworks) ? artworkRow.value.artworks : [])
const artworkItem = computed(() => {
  const activeId = props.state.activeArtworkId
  return artworkItems.value.find((artwork) => sameId(artwork.artworkId || artwork.id, activeId))
    || artworkItems.value[0]
    || (artworkRow.value?.artworkId ? artworkRow.value : null)
})

const artworkNameDraft = ref('')
const artworkNameSaving = ref(false)

const syncArtworkNameDraft = (row = artworkItem.value) => {
  if (artworkNameSaving.value) return
  artworkNameDraft.value = String(row?.artworkTitle || '').trim()
}

watch(
  () => `${artworkItem.value?.artworkId || ''}:${artworkItem.value?.artworkTitle || artworkItem.value?.title || ''}`,
  () => syncArtworkNameDraft(),
  { immediate: true }
)

const cancelArtworkNameEdit = () => syncArtworkNameDraft()

const saveArtworkName = async () => {
  const row = artworkItem.value
  if (!row?.artworkId || artworkNameSaving.value) return false
  const originalTitle = String(row.artworkTitle || '').trim()
  const nextTitle = artworkNameDraft.value.trim()
  if (!nextTitle) {
    props.state.notify('作品名称不能为空')
    artworkNameDraft.value = originalTitle
    return false
  }
  if (nextTitle.length > 255) {
    props.state.notify('作品名称不能超过 255 个字符')
    artworkNameDraft.value = originalTitle
    return false
  }
  if (nextTitle === originalTitle) return true
  if (typeof props.state.renameArtwork !== 'function') {
    props.state.notify('作品名称保存功能暂不可用，请稍后重试')
    artworkNameDraft.value = originalTitle
    return false
  }
  artworkNameSaving.value = true
  try {
    const saved = await props.state.renameArtwork(row, nextTitle)
    if (saved !== false) {
      artworkNameDraft.value = nextTitle
      return true
    }
    artworkNameDraft.value = originalTitle
    return false
  } finally {
    artworkNameSaving.value = false
  }
}

const commentRow = computed(() =>
  props.state.attendingRows.find((row) => sameId(row.studentId, commentStudentId.value)) || null
)

const mobileStudent = computed(() =>
  props.state.attendingRows.find((row) => sameId(row.studentId, mobileStudentId.value)) || null
)

const mobileStudentIndex = computed(() =>
  props.state.attendingRows.findIndex((row) => sameId(row.studentId, mobileStudentId.value))
)

const mobileSectionTitle = computed(() => ({
  studentRecords: '学生记录',
  record: '课堂记录',
  comment: '学生补充课评'
}[mobileSection.value] || '学生事项'))

const workImages = (row) => {
  const artworks = Array.isArray(row?.artworks) ? row.artworks.filter((artwork) => artwork?.imageMatched !== false) : []
  if (artworks.length) return artworks.map((artwork, index) => ({
    artworkId: artwork.artworkId || artwork.id,
    fileId: artwork.displayFileId || artwork.fileId || null,
    src: artwork.image || artwork.originalImage || '',
    highlight: Boolean(artwork.highlight),
    title: artwork.artworkTitle || artwork.title || `作品${index + 1}`
  }))
  const fileIds = Array.isArray(row?.imageFileIds) ? row.imageFileIds.filter(Boolean) : []
  if (fileIds.length) return fileIds.map((fileId, index) => ({ fileId, src: row.images?.[index] || '' }))
  return (row?.images || (row?.image ? [row.image] : [])).map((src) => ({ fileId: null, src }))
}

const artworkForImage = (row, image) => (row?.artworks || []).find((artwork) => sameId(artwork.artworkId || artwork.id, image?.artworkId)) || null

const imageAsset = (row, mode) => {
  if (!row) return { fileId: null, src: '' }
  if (mode === 'processed') {
    return { fileId: row.processedFileId || null, src: row.processedImage || '' }
  }
  return {
    fileId: row.originalFileId || row.imageFileIds?.[0] || null,
    src: row.originalImage || row.images?.[0] || row.image || ''
  }
}

const hasImage = (asset) => Boolean(asset?.fileId || asset?.src)

const hasProcessedImage = (row) => hasImage(imageAsset(row, 'processed'))

const selectedImageTemplate = computed(() => {
  const selected = props.state.templates.image[Number(props.state.selectedImageTemplate)]
  return selected && templateIsEnabled(selected) ? selected : props.state.templates.image.find(templateIsEnabled) || null
})
const artworkPreviewUrl = ref('')
const artworkPreviewLoading = ref(false)
let artworkPreviewObjectUrl = ''
let artworkPreviewRequest = 0

const hasProcessedCandidate = (row) => Boolean(
  hasProcessedImage(row) ||
  (sameId(artworkItem.value?.artworkId, row?.artworkId) && artworkPreviewUrl.value)
)

const showPersistedProcessedImage = (row) => {
  if (!hasProcessedImage(row)) return false
  if (!artworkPreviewUrl.value) return true
  const selectedKey = String(selectedImageTemplate.value?.templateKey || '').trim().toLowerCase()
  const processedKey = String(row?.processedTemplateKey || '').trim().toLowerCase()
  // A processed version with a known template key is the authoritative image
  // when it belongs to the currently selected template. If the teacher has
  // selected another client template, keep the live Canvas preview visible
  // until that new result is adopted.
  if (processedKey && selectedKey) return processedKey === selectedKey
  // Legacy artwork versions did not expose templateSnapshot. The original
  // template is also the AI prompt source marker, so prefer its persisted
  // result; other templates can still show their live preview.
  return selectedKey === 'original'
}

const clearArtworkPreview = () => {
  if (artworkPreviewObjectUrl) URL.revokeObjectURL(artworkPreviewObjectUrl)
  artworkPreviewObjectUrl = ''
  artworkPreviewUrl.value = ''
}

const refreshArtworkPreview = async () => {
  const requestId = ++artworkPreviewRequest
  clearArtworkPreview()
  artworkPreviewLoading.value = false
  const row = artworkItem.value
  const template = selectedImageTemplate.value
  const original = imageAsset(row, 'original')
  if (!row || !template || !hasImage(original)) return
  if (!isClientCanvasTemplate(template)) return
  artworkPreviewLoading.value = true
  try {
    const rendered = await renderArtworkFile(original, template, {
      campusName: props.state.school?.campus || props.state.school?.name || '',
      schoolName: props.state.school?.name || props.state.school?.campus || '',
      studentName: studentFor(row.studentId).name
    }, { maxDimension: 900 })
    if (requestId !== artworkPreviewRequest) return
    artworkPreviewObjectUrl = URL.createObjectURL(rendered.blob)
    artworkPreviewUrl.value = artworkPreviewObjectUrl
  } catch {
    // Preview failure should not compete with the primary artwork actions.
  } finally {
    if (requestId === artworkPreviewRequest) artworkPreviewLoading.value = false
  }
}

const clientTemplateSelected = computed(() => Boolean(selectedImageTemplate.value && isClientCanvasTemplate(selectedImageTemplate.value)))
const processActionLabel = computed(() => {
  return hasProcessedImage(artworkItem.value) ? '重新处理' : '处理当前作品'
})

watch(
  () => `${artworkItem.value?.originalFileId || artworkItem.value?.originalImage || ''}:${artworkItem.value?.artworkId || ''}:${selectedImageTemplate.value?.id || selectedImageTemplate.value?.name || ''}:${selectedImageTemplate.value?.templateVersion || ''}:${selectedImageTemplate.value?.version || ''}`,
  () => { void refreshArtworkPreview() },
  { immediate: true }
)

onBeforeUnmount(() => clearArtworkPreview())

const selectedImageMode = (row) => {
  if (!row) return 'original'
  if (row.selectedVersionId && row.processedVersionId && sameId(row.selectedVersionId, row.processedVersionId)) return 'processed'
  if (row.selectedVersionId && row.originalVersionId && sameId(row.selectedVersionId, row.originalVersionId)) return 'original'
  // A processed candidate is not selected until the server records the
  // teacher's confirmation. Keep the original card selected while the
  // candidate is waiting for review.
  if (!row.selectedVersionId && row.image === row.processedImage && row.processedImage) return 'processed'
  return 'original'
}

const artworkVersionStatus = (row) => {
  return props.state.artworkStatusFor?.(row) || (!row?.imageMatched ? '待上传' : '待准备')
}

const artworkVersionStatusClass = (row) => artworkVersionStatus(row) === '已准备' ? 'ok-text' : 'missing-text'

const feedbackProgress = (row) => props.state.jobProgressFor?.(row, 'FEEDBACK') || null
const artworkTargetsFor = (row) => {
  const artworks = Array.isArray(row?.artworks) ? row.artworks.filter((artwork) => artwork?.artworkId) : []
  return artworks.length ? artworks : row?.artworkId ? [row] : []
}
const artworkProgress = (row) => {
  const targets = artworkTargetsFor(row)
  if (targets.length <= 1) return props.state.jobProgressFor?.(targets[0] || row, 'ARTWORK') || null
  const values = targets.map((target) => props.state.jobProgressFor?.(target, 'ARTWORK')).filter(Boolean)
  if (!values.length) return null
  const terminalStatuses = ['SUCCEEDED', 'FAILED', 'CANCELED']
  const done = values.filter((value) => terminalStatuses.includes(value.status)).length
  const status = values.some((value) => !terminalStatuses.includes(value.status))
    ? 'RUNNING'
    : values.some((value) => value.status === 'FAILED')
      ? 'FAILED'
      : values.some((value) => value.status === 'CANCELED')
        ? 'CANCELED'
        : 'SUCCEEDED'
  const percentages = values.map((value) => Number(value.progressPercent)).filter(Number.isFinite)
  return {
    ...values[0],
    status,
    progressPercent: percentages.length ? Math.round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length) : undefined,
    message: `${done}/${targets.length} 张作品已完成`
  }
}
const jobIsActive = (progress) => Boolean(progress && !['SUCCEEDED', 'FAILED', 'CANCELED'].includes(progress.status))
const jobProgressLabel = (progress) => {
  if (!progress) return ''
  const percent = Number.isFinite(Number(progress.progressPercent)) ? ` ${Number(progress.progressPercent)}%` : ''
  return `${progress.message || progress.stage || '处理中'}${percent}`
}
const feedbackJobActive = (row) => jobIsActive(feedbackProgress(row))
const artworkJobActive = (row) => jobIsActive(artworkProgress(row))
const batchJobProgressText = (type) => {
  const rows = props.state.attendingRows || []
  const targets = type === 'ARTWORK'
    ? rows.flatMap((row) => artworkTargetsFor(row))
    : rows.filter((row) => row.record?.trim())
  const values = targets.map((row) => type === 'ARTWORK' ? artworkProgress(row) : feedbackProgress(row)).filter(Boolean)
  if (!values.length) return ''
  const done = type === 'ARTWORK'
    ? values.reduce((total, value) => total + (value.message?.match(/^(\d+)\//)?.[1] ? Number(value.message.match(/^(\d+)\//)[1]) : ['SUCCEEDED', 'FAILED', 'CANCELED'].includes(value.status) ? 1 : 0), 0)
    : values.filter((value) => ['SUCCEEDED', 'FAILED', 'CANCELED'].includes(value.status)).length
  return `${done}/${targets.length} 已完成`
}

const artworkStatusFor = (row) => props.state.artworkStatusFor?.(row) || (!row?.imageMatched ? '待上传' : '待准备')
const recordStatusFor = (row) => props.state.recordStatusFor?.(row) || (row?.record?.trim() ? '已保存' : '待补')
const commentStatusFor = (row) => props.state.commentStatusFor?.(row) || (row?.comment?.trim() ? '已保存' : '待生成')
const totalFeedbackStatus = () => props.state.totalFeedbackStatusFor?.() || '待填写'
const totalFeedbackDraftStatus = () => props.state.totalFeedbackDraftStatusFor?.() || 'SAVED'
const totalFeedbackDraftError = () => props.state.totalFeedbackDraftErrorFor?.() || ''
const totalFeedbackBusy = () => ['润色中', '保存中'].includes(totalFeedbackStatus())
const studentRecordsFor = (row) => Array.isArray(row?.studentRecords) ? row.studentRecords : []
const studentRecordCountFor = (row) => studentRecordsFor(row).length
const studentRecordIsVideo = (record) => String(record?.assetType || record?.file?.mediaType || '').toUpperCase() === 'STUDENT_RECORD_VIDEO'
  || String(record?.file?.mediaType || record?.mediaType || '').toLowerCase().startsWith('video/')
const studentRecordFileId = (record) => record?.fileId || record?.file?.id || null
const studentRecordName = (record, index = 0) => record?.title || record?.file?.originalFilename || `学生记录${index + 1}`
const statusFor = (row) => props.state.studentDeliveryStatusFor?.(row) || (
  row?.imageMatched && row?.record?.trim() && row?.comment?.trim() ? '已完成' : '未完成'
)

const statusClassFor = (row) => statusFor(row) === '已完成' ? 'done' : 'pending'
const draftStatusTextFor = (row, field = '') => {
  const status = props.state.studentDraftStatusFor?.(row) || 'SAVED'
  if (field && !String(row?.[field] || '').trim() && status === 'SAVED') return ''
  if (status === 'SAVING' || status === 'DIRTY' || status === 'CONFIRMING') return '保存中'
  if (status === 'ERROR') return '保存失败，点击重试'
  return '已保存'
}
const markDraftDirty = (row) => props.state.markStudentDraftDirty?.(row)
const flushDraft = (row) => props.state.flushStudentDraft?.(row)
const retryDraft = (row) => flushDraft(row)

const uploadStudentRecords = async (event, row) => {
  if (!row) return
  setActive(row)
  await props.state.uploadStudentRecord?.(event, row)
}

const replaceStudentRecord = async (event, row, record) => {
  if (!row || !record) return
  setActive(row)
  await props.state.replaceStudentRecord?.(event, row, record)
}

const removeStudentRecord = async (row, record) => {
  if (!row || !record || !confirmDestructiveAction(`确定删除学生记录“${studentRecordName(record)}”吗？`)) return
  setActive(row)
  await props.state.removeStudentRecord?.(record, row)
}

const renameStudentRecord = async (event, row, record) => {
  const input = event.target
  const originalTitle = String(record?.title || '').trim()
  const nextTitle = String(input.value || '').trim()
  if (!nextTitle) {
    input.value = originalTitle
    props.state.notify('学生记录名称不能为空')
    return
  }
  if (nextTitle === originalTitle) return
  setActive(row)
  const saved = await props.state.renameStudentRecord?.(record, row, nextTitle)
  if (saved === false) input.value = originalTitle
}

const setActive = (row) => {
  if (row?.studentId !== undefined && row?.studentId !== null) props.state.activeStudentId = row.studentId
}

const setDrawerState = (open) => emit('drawer-state', open)

const openArtwork = (row, artwork = null) => {
  setActive(row)
  artworkStudentId.value = row?.studentId ?? null
  props.state.activeArtworkId = artwork?.artworkId || artwork?.id || row?.artworks?.[0]?.artworkId || row?.artworkId || null
  syncArtworkNameDraft(artwork || row?.artworks?.[0] || row)
  setDrawerState(true)
}

const switchArtwork = (step) => {
  const items = artworkItems.value
  if (items.length < 2) return
  const currentIndex = Math.max(0, items.findIndex((item) => sameId(item.artworkId, artworkItem.value?.artworkId)))
  const nextIndex = (currentIndex + step + items.length) % items.length
  props.state.activeArtworkId = items[nextIndex].artworkId
  syncArtworkNameDraft(items[nextIndex])
}

const closeArtwork = () => {
  aiPromptOpen.value = false
  artworkNameDraft.value = ''
  artworkStudentId.value = null
  props.state.activeArtworkId = null
  setDrawerState(false)
}

const openAiPrompt = () => {
  if (!artworkItem.value) return
  if (!hasImage(imageAsset(artworkItem.value, 'original'))) {
    props.state.notify('请先上传当前学生的原图')
    return
  }
  aiPrompt.value = ''
  aiPromptError.value = ''
  aiPromptOpen.value = true
}

const closeAiPrompt = () => {
  if (props.state.isProcessing) return
  aiPromptOpen.value = false
  aiPromptError.value = ''
}

const submitAiPrompt = async () => {
  const prompt = aiPrompt.value.trim()
  if (!prompt) {
    aiPromptError.value = '请输入 AI 处理提示词'
    return
  }
  if (!artworkItem.value) return
  setActive(artworkItem.value || artworkRow.value)
  const process = props.state.processImageWithPrompt
  if (typeof process !== 'function') {
    aiPromptError.value = 'AI 图片处理服务暂不可用，请稍后重试'
    return
  }
  const submitted = await process(prompt, artworkItem.value)
  if (submitted) {
    aiPromptOpen.value = false
    aiPromptError.value = ''
  }
}

const openComment = (row) => {
  setActive(row)
  commentStudentId.value = row?.studentId ?? null
  setDrawerState(true)
}

const closeComment = async () => {
  const row = commentRow.value
  if (row) await flushDraft(row)
  commentStudentId.value = null
  setDrawerState(false)
}

const openBatch = () => {
  batchOpen.value = true
  setDrawerState(true)
}

const closeBatch = () => {
  batchOpen.value = false
  setDrawerState(false)
}

const openMobileStudent = async (row) => {
  if (mobileStudent.value && !sameId(mobileStudent.value.studentId, row?.studentId)) await flushDraft(mobileStudent.value)
  setActive(row)
  mobileStudentId.value = row?.studentId ?? null
  mobileSection.value = null
  emit('mobile-detail-state', true)
}

const closeMobileStudent = async () => {
  if (mobileStudent.value) await flushDraft(mobileStudent.value)
  mobileStudentId.value = null
  mobileSection.value = null
  emit('mobile-detail-state', false)
}

const openMobileSection = (section) => {
  if (!mobileStudent.value) return
  if (section === 'artwork') {
    openArtwork(mobileStudent.value)
    return
  }
  mobileSection.value = section
}

const closeMobileSection = async () => {
  if (mobileStudent.value) await flushDraft(mobileStudent.value)
  mobileSection.value = null
}

const updateImageTemplate = (index) => {
  props.state.selectedImageTemplate = Number(index)
  props.state.notify(`已选择作品处理模板：${props.state.templates.image[index]?.name || '默认模板'}`)
}

const updateCommentTemplate = (index) => {
  props.state.selectedCommentTemplate = Number(index)
  props.state.notify(`已选择课评模板：${props.state.templates.comment[index]?.name || '默认模板'}`)
}

const processAll = async () => {
  await props.state.processImages()
}

const generateAll = async () => {
  await props.state.generateAll()
}

const processCurrentImage = async (row) => {
  if (!row?.imageMatched) {
    props.state.notify('请先上传当前学生的作品')
    return
  }
  if (artworkJobActive(row)) return
  setActive(row)
  if (selectedImageTemplate.value && isClientCanvasTemplate(selectedImageTemplate.value)) {
    if (String(selectedImageTemplate.value.templateKey || '').toLowerCase() === 'original') {
      props.state.notify('已保留原图')
    } else {
      await props.state.renderCurrentImage?.(row)
    }
    return
  }
  await props.state.retryCurrentImageProcess()
}

const confirmDestructiveAction = (message) => typeof window === 'undefined' || window.confirm(message)

const replaceOriginalImage = async (event, row) => {
  if (!row) return
  setActive(row)
  const replace = props.state.replaceStudentImage || props.state.updateImage
  await replace?.(event, row)
}

const removeOriginalArtwork = async (row) => {
  if (!row || !confirmDestructiveAction('移除后将删除这张作品及其处理结果，确定继续吗？')) return
  setActive(row)
  const remove = props.state.removeArtwork || props.state.removeStudentImage
  const removed = await remove?.(row)
  if (removed !== false) props.state.notify(`${studentFor(row.studentId).name}的作品已移除`)
}

const removeProcessedArtwork = async (row) => {
  if (!row || !hasProcessedImage(row) || !confirmDestructiveAction('确定删除这张处理图吗？原图会保留。')) return
  setActive(row)
  const removed = await props.state.removeArtworkVersion?.(row)
  if (removed !== false) props.state.notify('处理图已删除，请重新确认原图或重新处理')
}

const regenerateComment = async (row) => {
  if (!row) return
  if (feedbackJobActive(row)) return
  setActive(row)
  if (!(await flushDraft(row))) return
  const generated = await props.state.generateOne(row)
  if (generated) {
    props.state.pulseComment?.()
    props.state.notify(`已重新生成${studentFor(row.studentId).name}的课评`)
  }
}

watch(() => props.state.activeTask.id, () => {
  artworkStudentId.value = null
  commentStudentId.value = null
  batchOpen.value = false
  aiPromptOpen.value = false
  aiPromptError.value = ''
  mobileStudentId.value = null
  mobileSection.value = null
  setDrawerState(false)
  emit('mobile-detail-state', false)
})

watch(
  () => props.state.attendingRows.map((row) => String(row.studentId)).join(','),
  () => {
    const rows = props.state.attendingRows
    if (rows.length && !rows.some((row) => sameId(row.studentId, props.state.activeStudentId))) setActive(rows[0])
    if (mobileStudentId.value !== null && !rows.some((row) => sameId(row.studentId, mobileStudentId.value))) {
      mobileStudentId.value = null
      mobileSection.value = null
      emit('mobile-detail-state', false)
    }
  },
  { immediate: true }
)

onMounted(() => {
  void props.state.loadTemplates?.()
})
</script>

<template>
  <section class="student-delivery-workspace">
    <header class="student-delivery-head">
      <div>
        <span>第 3 步</span>
      <h2>按学生准备作品、学生记录、课堂记录、个人课评与本节总课评</h2>
      </div>
      <div class="student-delivery-head-actions">
        <button type="button" class="secondary" @click="openBatch">批量操作</button>
        <strong>{{ state.counts.studentDeliveryCompleted }}/{{ state.counts.attend }} 位已完成</strong>
      </div>
    </header>

    <div class="student-delivery-summary">
      <span>到课 {{ state.counts.attend }} 人</span>
      <span>学生作品 {{ state.counts.matched }}/{{ state.counts.attend }} 人</span>
      <span>作品 {{ state.counts.artworkCount }} 张</span>
      <span>课堂记录 {{ state.counts.records }}/{{ state.counts.attend }}</span>
      <span>个人课评 {{ state.counts.comments }}/{{ state.counts.attend }}（选填）</span>
      <span :class="state.counts.totalFeedbackReady ? 'ok-text' : 'missing-text'">总课评：{{ totalFeedbackStatus() }}</span>
    </div>

    <section class="student-delivery-desktop">
      <div class="student-delivery-table-wrap">
        <table class="student-delivery-table">
          <thead>
            <tr>
              <th>学生</th>
              <th>作品</th>
              <th>学生记录</th>
              <th>课堂记录</th>
              <th>学生补充课评</th>
              <th>状态</th>
              <th>总课评</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) in state.attendingRows" :key="`${row.lessonId}-${row.studentId}`" :class="{ 'delivery-row-done': statusFor(row) === '已完成' }">
              <td class="delivery-student-cell">
                <strong>{{ studentFor(row.studentId).name }}<em v-if="row.studentArchived" class="archived-reference">（已归档）</em></strong>
                <small>{{ studentFor(row.studentId).parent || '家长未填写' }}</small>
              </td>
              <td class="delivery-artwork-cell">
                <div v-if="workImages(row).length" class="delivery-thumb-strip">
                  <button v-for="(image, index) in workImages(row)" :key="`${image.artworkId || image.fileId || image.src}-${index}`" type="button" class="delivery-thumb" :class="{ 'delivery-thumb-highlight': image.highlight }" @click="openArtwork(row, artworkForImage(row, image))">
                    <ProtectedMedia :file-id="image.fileId" :src="image.src" :alt="`${studentFor(row.studentId).name}作品${index + 1}`" />
                    <span v-if="image.highlight" class="delivery-highlight-badge">高光</span>
                  </button>
                </div>
                <button v-else type="button" class="delivery-empty delivery-empty-action" @click="openArtwork(row)">尚未上传作品，点击上传</button>
                <label class="delivery-add-artwork">
                  ＋添加作品
                  <input type="file" accept="image/*" multiple @change="state.updateImage($event, row)" />
                </label>
                <div class="delivery-artwork-meta">
                  <span :class="row.imageMatched ? 'ok-text' : 'missing-text'">{{ row.imageMatched ? `已上传 ${row.artworkCount || workImages(row).length || 1} 张` : '待上传' }}</span>
                  <span v-if="row.highlightCount" class="ok-text">{{ row.highlightCount }} 个高光</span>
                  <span v-if="row.imageMatched" class="delivery-artwork-version-status" :class="artworkVersionStatusClass(row)">{{ artworkVersionStatus(row) }}</span>
                  <span v-if="artworkProgress(row)" class="delivery-job-progress" :class="{ 'delivery-job-failed': artworkProgress(row).status === 'FAILED' }">{{ jobProgressLabel(artworkProgress(row)) }}</span>
                </div>
                <div v-if="row.uploadFailures?.length" class="delivery-upload-failures">
                  <small>上传失败：{{ row.uploadFailures.map((item) => item.name).join('、') }}</small>
                  <button type="button" class="ghost" @click="state.retryArtworkUploads?.(row)">重试</button>
                </div>
              </td>
              <td class="delivery-student-record-cell">
                <div v-if="studentRecordsFor(row).length" class="student-record-list">
                  <article v-for="(record, index) in studentRecordsFor(row)" :key="`${record.id || record.fileId}-${index}`" class="student-record-card">
                    <div class="student-record-media">
                      <ProtectedMedia
                        :file-id="studentRecordFileId(record)"
                        :tag="studentRecordIsVideo(record) ? 'video' : 'img'"
                        :src="record.image || record.file?.downloadUrl || ''"
                        :alt="studentRecordName(record, index)"
                        controls
                        preload="metadata"
                        muted
                      />
                      <label class="student-record-replace" title="点击媒体或“替换”重新上传" aria-label="替换学生记录">
                        <span aria-hidden="true">替换</span>
                        <input type="file" accept="image/*,video/*" @change="replaceStudentRecord($event, row, record)" />
                      </label>
                    </div>
                    <input
                      class="student-record-name"
                      :value="studentRecordName(record, index)"
                      :aria-label="`学生记录名称${index + 1}`"
                      @blur="renameStudentRecord($event, row, record)"
                      @keydown.enter.prevent="renameStudentRecord($event, row, record)"
                    />
                    <button type="button" class="student-record-remove" :disabled="state.isProcessing" @click="removeStudentRecord(row, record)">删除</button>
                  </article>
                </div>
                <div v-else class="student-record-empty">暂无学生记录</div>
                <label class="delivery-add-student-record">
                  选择文件
                  <input type="file" accept="image/*,video/*" multiple @change="uploadStudentRecords($event, row)" />
                </label>
                <small class="student-record-count">{{ studentRecordCountFor(row) }} 个文件</small>
              </td>
              <td class="delivery-record-cell">
                <span class="delivery-field-status" :class="recordStatusFor(row) === '已保存' ? 'ok-text' : 'muted-text'">课堂记录（选填）：{{ recordStatusFor(row) === '待补' ? '未填写' : recordStatusFor(row) }}</span>
                <textarea v-model="row.record" rows="4" placeholder="记录孩子今天的课堂表现……" @input="markDraftDirty(row)" @blur="flushDraft(row)" />
                <div class="delivery-cell-actions">
                  <button type="button" class="ghost" :disabled="state.isProcessing" @click="state.activeStudentId = row.studentId; state.simulateVoice()">🎙语音转文字</button>
                  <span v-if="draftStatusTextFor(row, 'record')" class="delivery-autosave-status" :class="{ saving: ['DIRTY', 'SAVING', 'CONFIRMING'].includes(state.studentDraftStatusFor?.(row)), error: state.studentDraftStatusFor?.(row) === 'ERROR' }" :title="state.studentDraftErrorFor?.(row) || ''" @click="state.studentDraftStatusFor?.(row) === 'ERROR' && retryDraft(row)">{{ draftStatusTextFor(row, 'record') }}</span>
                </div>
              </td>
              <td class="delivery-comment-cell">
                <span class="delivery-comment-status" :class="commentStatusFor(row) === '已保存' ? 'ok-text' : 'muted-text'">个人课评（选填）：{{ commentStatusFor(row) === '待生成' ? '未填写' : commentStatusFor(row) }}</span>
                <p class="delivery-comment-preview">{{ row.comment?.trim() || '可补充只针对这名学生的课评。' }}</p>
                <span v-if="feedbackProgress(row)" class="delivery-job-progress" :class="{ 'delivery-job-failed': feedbackProgress(row).status === 'FAILED' }">{{ jobProgressLabel(feedbackProgress(row)) }}</span>
                <div class="delivery-cell-actions">
                  <button type="button" class="secondary" :disabled="state.isProcessing || feedbackJobActive(row) || !row.record?.trim()" @click="openComment(row)">生成课评</button>
                  <span v-if="draftStatusTextFor(row, 'comment')" class="delivery-autosave-status" :class="{ saving: ['DIRTY', 'SAVING', 'CONFIRMING'].includes(state.studentDraftStatusFor?.(row)), error: state.studentDraftStatusFor?.(row) === 'ERROR' }" :title="state.studentDraftErrorFor?.(row) || ''" @click="state.studentDraftStatusFor?.(row) === 'ERROR' && retryDraft(row)">{{ draftStatusTextFor(row, 'comment') }}</span>
                </div>
              </td>
              <td class="delivery-status-cell">
                <span class="delivery-status" :class="statusClassFor(row)">{{ statusFor(row) }}</span>
              </td>
              <td v-if="rowIndex === 0" class="delivery-total-feedback-cell" :rowspan="state.attendingRows.length">
                <div class="delivery-total-feedback-editor">
                  <span class="delivery-field-status" :class="state.counts.totalFeedbackReady ? 'ok-text' : 'missing-text'">总课评：{{ totalFeedbackStatus() }}</span>
                  <textarea
                    v-model="state.totalFeedback.content"
                    rows="12"
                    required
                    aria-label="本节课总课评"
                    @input="state.markTotalFeedbackDirty?.()"
                    @blur="state.flushTotalFeedback?.()"
                  />
                    <div class="delivery-cell-actions delivery-total-feedback-actions">
                      <button type="button" class="ghost" :disabled="state.isProcessing || totalFeedbackBusy() || !state.totalFeedback.content?.trim()" @click="state.polishTotalFeedback?.()">{{ totalFeedbackStatus() === '润色中' ? '润色中…' : 'AI 润色' }}</button>
                    </div>
                  <span v-if="totalFeedbackDraftStatus() === 'ERROR'" class="delivery-autosave-status error" @click="state.flushTotalFeedback?.()">{{ totalFeedbackDraftError() || '总课评自动保存失败，点击重试' }}</span>
                  <span v-else-if="['DIRTY', 'SAVING'].includes(totalFeedbackDraftStatus())" class="delivery-autosave-status saving">总课评自动保存中</span>
                </div>
              </td>
            </tr>
            <tr v-if="!state.attendingRows.length">
              <td colspan="7" class="student-delivery-empty-state">当前没有到课学生，请先在第 1 步确认出勤。</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="student-delivery-mobile">
      <section class="mobile-total-feedback-card">
        <header>
          <div>
            <span>本节课</span>
            <strong>总课评（必填）</strong>
          </div>
          <span class="delivery-status" :class="state.counts.totalFeedbackReady ? 'done' : 'pending'">{{ totalFeedbackStatus() }}</span>
        </header>
        <textarea
          v-model="state.totalFeedback.content"
          rows="7"
          required
          aria-label="本节课总课评"
          placeholder="填写本节课面向所有家长的总课评……"
          @input="state.markTotalFeedbackDirty?.()"
          @blur="state.flushTotalFeedback?.()"
        />
        <small>总课评独立于某个学生，内容会自动保存并作为新家长页面的主课评。</small>
        <div class="mobile-student-editor-actions">
          <button type="button" class="ghost" :disabled="state.isProcessing || totalFeedbackBusy() || !state.totalFeedback.content?.trim()" @click="state.polishTotalFeedback?.()">{{ totalFeedbackStatus() === '润色中' ? '润色中…' : 'AI 润色' }}</button>
        </div>
        <span v-if="totalFeedbackDraftStatus() === 'ERROR'" class="delivery-autosave-status error" @click="state.flushTotalFeedback?.()">{{ totalFeedbackDraftError() || '总课评自动保存失败，点击重试' }}</span>
      </section>
      <template v-if="!mobileStudent">
        <div class="student-delivery-mobile-list">
          <button v-for="row in state.attendingRows" :key="`${row.lessonId}-${row.studentId}`" type="button" class="student-delivery-mobile-card" @click="openMobileStudent(row)">
            <span class="mobile-student-avatar">{{ studentFor(row.studentId).name.slice(0, 1) }}</span>
            <span class="mobile-student-copy">
              <strong>{{ studentFor(row.studentId).name }}<em v-if="row.studentArchived" class="archived-reference">（已归档）</em></strong>
              <small>{{ studentFor(row.studentId).parent || '家长未填写' }}</small>
              <span class="mobile-student-flags"><i :class="artworkStatusFor(row) === '已准备' ? 'done' : 'pending'">作品 {{ artworkStatusFor(row) }}</i><i>学生记录 {{ studentRecordCountFor(row) }}</i><i :class="recordStatusFor(row) === '已保存' ? 'done' : 'pending'">课堂记录 {{ recordStatusFor(row) === '待补' ? '选填' : recordStatusFor(row) }}</i><i :class="commentStatusFor(row) === '已保存' ? 'done' : 'pending'">个人课评 {{ commentStatusFor(row) === '待生成' ? '选填' : commentStatusFor(row) }}</i></span>
            </span>
            <span class="mobile-student-status">{{ statusFor(row) }}<b>›</b></span>
          </button>
          <div v-if="!state.attendingRows.length" class="student-delivery-empty-state">当前没有到课学生，请先在第 1 步确认出勤。</div>
        </div>
      </template>

      <template v-else>
        <header class="mobile-student-detail-head">
          <button type="button" class="ghost" @click="closeMobileStudent">← 返回学生列表</button>
          <div>
            <span>第 {{ mobileStudentIndex + 1 }}/{{ state.attendingRows.length }} 位</span>
            <strong>{{ studentFor(mobileStudent.studentId).name }}</strong>
            <small>{{ studentFor(mobileStudent.studentId).parent || '家长未填写' }}</small>
          </div>
          <span class="delivery-status" :class="statusClassFor(mobileStudent)">{{ statusFor(mobileStudent) }}</span>
        </header>

        <template v-if="!mobileSection">
          <nav class="mobile-student-section-list" aria-label="学生交付事项">
            <button type="button" class="mobile-student-section-row" @click="openMobileSection('artwork')">
              <span class="mobile-section-icon">作</span>
              <span class="mobile-section-copy">
                <strong>作品</strong>
                <small>{{ artworkStatusFor(mobileStudent) === '已准备' ? '已有可交付版本' : artworkStatusFor(mobileStudent) }}</small>
              </span>
              <span class="mobile-section-status"><span>{{ artworkStatusFor(mobileStudent) }}</span><b>›</b></span>
            </button>

            <button type="button" class="mobile-student-section-row" @click="openMobileSection('studentRecords')">
              <span class="mobile-section-icon">拍</span>
              <span class="mobile-section-copy">
                <strong>学生记录</strong>
                <small>{{ studentRecordCountFor(mobileStudent) ? `已上传 ${studentRecordCountFor(mobileStudent)} 个文件` : '可上传照片或视频' }}</small>
              </span>
              <span class="mobile-section-status"><span>{{ studentRecordCountFor(mobileStudent) }} 个</span><b>›</b></span>
            </button>

            <button type="button" class="mobile-student-section-row" @click="openMobileSection('record')">
              <span class="mobile-section-icon">记</span>
              <span class="mobile-section-copy">
                <strong>课堂记录（选填）</strong>
                <small>{{ recordStatusFor(mobileStudent) === '已保存' ? '已记录课堂表现' : '未填写也可以发布' }}</small>
              </span>
              <span class="mobile-section-status"><span>{{ recordStatusFor(mobileStudent) }}</span><b>›</b></span>
            </button>

            <button type="button" class="mobile-student-section-row" @click="openMobileSection('comment')">
              <span class="mobile-section-icon">评</span>
              <span class="mobile-section-copy">
                <strong>个人课评（选填）</strong>
                <small>{{ commentStatusFor(mobileStudent) === '已保存' ? '已填写学生补充课评' : '未填写也可以发布' }}</small>
              </span>
              <span class="mobile-section-status"><span>{{ commentStatusFor(mobileStudent) }}</span><b>›</b></span>
            </button>

          </nav>
        </template>

        <section v-else-if="mobileSection === 'studentRecords'" class="mobile-student-subpage">
          <div class="mobile-student-subpage-head">
            <button type="button" class="ghost" @click="closeMobileSection">← 返回学生事项</button>
            <strong>学生记录</strong>
          </div>
          <article class="mobile-student-editor-card student-record-mobile-card">
            <header><strong>学生记录</strong><span>{{ studentRecordCountFor(mobileStudent) }} 个文件</span></header>
            <div v-if="studentRecordsFor(mobileStudent).length" class="student-record-mobile-list">
              <article v-for="(record, index) in studentRecordsFor(mobileStudent)" :key="`${record.id || record.fileId}-${index}`" class="student-record-mobile-item">
                <ProtectedMedia
                  class="student-record-mobile-media"
                  :file-id="studentRecordFileId(record)"
                  :tag="studentRecordIsVideo(record) ? 'video' : 'img'"
                  :src="record.image || record.file?.downloadUrl || ''"
                  :alt="studentRecordName(record, index)"
                  controls
                  preload="metadata"
                  muted
                />
                <input
                  class="student-record-name"
                  :value="studentRecordName(record, index)"
                  :aria-label="`学生记录名称${index + 1}`"
                  @blur="renameStudentRecord($event, mobileStudent, record)"
                  @keydown.enter.prevent="renameStudentRecord($event, mobileStudent, record)"
                />
                <div class="student-record-mobile-actions">
                  <label class="ghost">
                    重新上传
                    <input type="file" accept="image/*,video/*" @change="replaceStudentRecord($event, mobileStudent, record)" />
                  </label>
                  <button type="button" class="ghost danger-text" :disabled="state.isProcessing" @click="removeStudentRecord(mobileStudent, record)">删除</button>
                </div>
              </article>
            </div>
            <div v-else class="student-record-empty">还没有学生记录，可上传照片或视频。</div>
            <label class="delivery-add-student-record mobile-student-record-upload">
              选择文件
              <input type="file" accept="image/*,video/*" multiple @change="uploadStudentRecords($event, mobileStudent)" />
            </label>
          </article>
        </section>

        <section v-else-if="mobileSection === 'record'" class="mobile-student-subpage">
          <div class="mobile-student-subpage-head">
            <button type="button" class="ghost" @click="closeMobileSection">← 返回学生事项</button>
            <strong>{{ mobileSectionTitle }}</strong>
          </div>
          <article class="mobile-student-editor-card">
            <header><strong>课堂记录（选填）</strong><span>{{ recordStatusFor(mobileStudent) === '待补' ? '未填写' : recordStatusFor(mobileStudent) }}</span></header>
            <textarea v-model="mobileStudent.record" rows="8" placeholder="记录孩子今天的课堂表现、作品特点，以及可以继续提升的地方……" @input="markDraftDirty(mobileStudent)" @blur="flushDraft(mobileStudent)" />
            <div class="mobile-student-editor-actions">
              <button type="button" class="ghost" :disabled="state.isProcessing" @click="state.activeStudentId = mobileStudent.studentId; state.simulateVoice()">🎙 语音转文字</button>
              <span v-if="draftStatusTextFor(mobileStudent, 'record')" class="delivery-autosave-status" :class="{ saving: ['DIRTY', 'SAVING', 'CONFIRMING'].includes(state.studentDraftStatusFor?.(mobileStudent)), error: state.studentDraftStatusFor?.(mobileStudent) === 'ERROR' }" @click="state.studentDraftStatusFor?.(mobileStudent) === 'ERROR' && retryDraft(mobileStudent)">{{ draftStatusTextFor(mobileStudent, 'record') }}</span>
            </div>
          </article>
        </section>

        <section v-else-if="mobileSection === 'comment'" class="mobile-student-subpage">
          <div class="mobile-student-subpage-head">
            <button type="button" class="ghost" @click="closeMobileSection">← 返回学生事项</button>
            <strong>{{ mobileSectionTitle }}</strong>
          </div>
          <article class="mobile-student-editor-card">
            <header><strong>个人课评（选填）</strong><span>{{ commentStatusFor(mobileStudent) === '待生成' ? '未填写' : commentStatusFor(mobileStudent) }}</span></header>
            <p class="mobile-comment-preview">{{ mobileStudent.comment?.trim() || '可补充只针对这名学生的课评。' }}</p>
            <textarea v-model="mobileStudent.comment" rows="9" placeholder="填写学生补充课评（选填）……" @input="markDraftDirty(mobileStudent)" @blur="flushDraft(mobileStudent)" />
            <div class="mobile-student-editor-actions">
              <small v-if="feedbackProgress(mobileStudent)" class="delivery-job-progress" :class="{ 'delivery-job-failed': feedbackProgress(mobileStudent).status === 'FAILED' }">{{ jobProgressLabel(feedbackProgress(mobileStudent)) }}</small>
              <button type="button" class="secondary" :disabled="state.isProcessing || feedbackJobActive(mobileStudent) || !mobileStudent.record?.trim()" @click="regenerateComment(mobileStudent)">{{ feedbackJobActive(mobileStudent) ? '生成中…' : '重新生成' }}</button>
              <span v-if="draftStatusTextFor(mobileStudent, 'comment')" class="delivery-autosave-status" :class="{ saving: ['DIRTY', 'SAVING', 'CONFIRMING'].includes(state.studentDraftStatusFor?.(mobileStudent)), error: state.studentDraftStatusFor?.(mobileStudent) === 'ERROR' }" @click="state.studentDraftStatusFor?.(mobileStudent) === 'ERROR' && retryDraft(mobileStudent)">{{ draftStatusTextFor(mobileStudent, 'comment') }}</span>
            </div>
          </article>
        </section>

        <footer class="mobile-student-detail-actions">
          <button type="button" class="secondary" :disabled="mobileStudentIndex <= 0" @click="openMobileStudent(state.attendingRows[mobileStudentIndex - 1])">上一位</button>
          <button v-if="mobileStudentIndex < state.attendingRows.length - 1" type="button" class="primary" @click="openMobileStudent(state.attendingRows[mobileStudentIndex + 1])">下一位</button>
          <button v-else type="button" class="primary" @click="closeMobileStudent">返回学生列表</button>
        </footer>
      </template>
    </section>

    <div v-if="artworkRow" class="drawer-backdrop" @click.self="closeArtwork">
      <aside class="library-drawer artwork-process-drawer">
        <header class="drawer-head">
          <div>
            <span>作品处理</span>
            <strong>{{ studentFor(artworkRow.studentId).name }}</strong>
            <small>{{ artworkItem ? (jobProgressLabel(artworkProgress(artworkItem)) || artworkItem.imageProcessStatus || '尚未处理') : '尚未上传作品' }}</small>
          </div>
          <button type="button" class="ghost" @click="closeArtwork">关闭</button>
        </header>

        <div v-if="artworkItems.length > 1" class="artwork-drawer-switcher">
          <button type="button" class="ghost" @click="switchArtwork(-1)">‹ 上一张</button>
          <span>第 {{ artworkItems.findIndex((item) => sameId(item.artworkId, artworkItem?.artworkId)) + 1 }}/{{ artworkItems.length }} 张</span>
          <button type="button" class="ghost" @click="switchArtwork(1)">下一张 ›</button>
        </div>
        <label class="drawer-add-artwork">
          ＋ 添加作品（可多选）
          <input type="file" accept="image/*" multiple @change="state.updateImage($event, artworkRow)" />
        </label>

        <label class="drawer-field artwork-name-field">
          <span>作品名称</span>
          <input
            v-model="artworkNameDraft"
            class="artwork-name-input"
            maxlength="255"
            :disabled="!artworkItem?.artworkId || artworkNameSaving"
            :placeholder="artworkItem?.artworkId ? '请输入作品名称' : '请先上传作品后命名'"
            @keydown.enter.prevent="saveArtworkName"
            @keydown.esc.prevent="cancelArtworkNameEdit"
            @blur="saveArtworkName"
          />
          <small>{{ artworkNameSaving ? '正在保存作品名称…' : artworkItem?.artworkId ? '失焦或回车保存，Esc 取消；名称会用于新建网盘归档。' : '上传作品后可编辑业务名称。' }}</small>
        </label>

        <label v-if="artworkItem" class="drawer-field">
          <span>作品处理模板</span>
          <AdaptiveSelect
            :model-value="state.selectedImageTemplate"
            :options="imageTemplateOptions"
            placeholder="选择作品处理模板"
            @update:model-value="updateImageTemplate"
          />
        </label>

        <template v-if="artworkItem">
        <section class="artwork-version-list">
          <article class="artwork-version-card" :class="{ selected: selectedImageMode(artworkItem) === 'original' && hasImage(imageAsset(artworkItem, 'original')) }">
            <div class="artwork-version-media">
              <label class="artwork-media-upload" :class="{ empty: !hasImage(imageAsset(artworkItem, 'original')) }" title="点击替换原图">
                <ProtectedMedia v-if="hasImage(imageAsset(artworkItem, 'original'))" :file-id="imageAsset(artworkItem, 'original').fileId" :src="imageAsset(artworkItem, 'original').src" alt="作品原图" />
                <span v-else class="delivery-empty">尚未上传原图，点击上传</span>
                <span v-if="hasImage(imageAsset(artworkItem, 'original'))" class="artwork-media-hover-hint">点击替换原图</span>
                <input type="file" accept="image/*" @change="replaceOriginalImage($event, artworkItem)" />
              </label>
              <button v-if="hasImage(imageAsset(artworkItem, 'original'))" type="button" class="artwork-remove-button" :disabled="state.isProcessing" title="移除作品" aria-label="移除作品" @click.stop="removeOriginalArtwork(artworkItem)">×</button>
            </div>
            <div class="artwork-version-copy"><strong>原图</strong></div>
          </article>
          <article class="artwork-version-card" :class="{ selected: selectedImageMode(artworkItem) === 'processed' && hasProcessedCandidate(artworkItem) }">
            <div class="artwork-version-media">
              <button
                type="button"
                class="artwork-ai-entry"
                :disabled="state.isProcessing || artworkJobActive(artworkItem) || !hasImage(imageAsset(artworkItem, 'original'))"
                title="输入提示词，生成 AI 处理图"
                @click.stop="openAiPrompt"
              >AI处理✨</button>
              <ProtectedMedia v-if="showPersistedProcessedImage(artworkItem)" :file-id="imageAsset(artworkItem, 'processed').fileId" :src="imageAsset(artworkItem, 'processed').src" alt="作品处理图" />
              <img v-else-if="artworkPreviewUrl" :src="artworkPreviewUrl" alt="作品处理预览" class="artwork-live-preview" />
              <span v-else-if="artworkPreviewLoading" class="delivery-empty">正在生成实时预览…</span>
              <span v-else class="delivery-empty">尚未生成处理图</span>
              <button v-if="hasImage(imageAsset(artworkItem, 'processed'))" type="button" class="artwork-remove-button" :disabled="state.isProcessing" title="删除处理图" aria-label="删除处理图" @click.stop="removeProcessedArtwork(artworkItem)">×</button>
            </div>
            <div class="artwork-version-copy">
              <strong>处理图</strong>
            </div>
          </article>
        </section>

        <footer v-if="!clientTemplateSelected" class="artwork-process-actions">
          <small v-if="artworkProgress(artworkItem)" class="delivery-job-progress" :class="{ 'delivery-job-failed': artworkProgress(artworkItem).status === 'FAILED' }">{{ jobProgressLabel(artworkProgress(artworkItem)) }}</small>
          <button type="button" class="secondary" :disabled="state.isProcessing || artworkJobActive(artworkItem) || !artworkItem.imageMatched" @click="processCurrentImage(artworkItem)">{{ artworkJobActive(artworkItem) ? '处理中…' : processActionLabel }}</button>
        </footer>

        <label class="inline-check artwork-highlight-setting"><input type="checkbox" :checked="artworkItem.highlight" @change="state.toggleHighlight(artworkItem)" /><span>标记为本节高光作品</span></label>
        <textarea v-if="artworkItem.highlight" v-model="artworkItem.highlightNote" rows="3" maxlength="2000" placeholder="补充高光说明" @blur="state.saveArtworkHighlight?.(artworkItem)" />
        </template>
        <div v-else class="drawer-empty-artwork">还没有作品，请使用上方“添加作品”一次选择一张或多张图片。</div>
      </aside>
    </div>

    <div v-if="aiPromptOpen && artworkItem" class="modal-backdrop ai-image-prompt-backdrop" @click.self="closeAiPrompt">
      <section class="ai-image-prompt-modal" role="dialog" aria-modal="true" aria-labelledby="ai-image-prompt-title">
        <header class="modal-head">
          <div>
            <strong id="ai-image-prompt-title">AI处理✨</strong>
            <small>{{ studentFor(artworkItem.studentId).name }} · {{ artworkItem.artworkTitle || '当前作品' }} · 输入提示词生成处理图</small>
          </div>
          <button type="button" class="ghost" :disabled="state.isProcessing" @click="closeAiPrompt">关闭</button>
        </header>


        <label class="drawer-field">
          <span>处理提示词</span>
          <textarea
            v-model="aiPrompt"
            rows="6"
            maxlength="500"
            autofocus
            placeholder="例如：保留儿童原作笔触，增强色彩层次，适度提亮，不改变主体构图。"
            @keydown.esc="closeAiPrompt"
            @keydown.ctrl.enter.prevent="submitAiPrompt"
            @keydown.meta.enter.prevent="submitAiPrompt"
          />
          <small v-if="aiPromptError" class="missing-text">{{ aiPromptError }}</small>
          <small v-else>提示：Ctrl/⌘ + Enter 可直接提交。</small>
        </label>

        <footer class="modal-actions">
          <button type="button" class="ghost" :disabled="state.isProcessing" @click="closeAiPrompt">取消</button>
          <button type="button" class="primary" :disabled="state.isProcessing || artworkJobActive(artworkItem)" @click="submitAiPrompt">{{ artworkJobActive(artworkItem) ? '处理中…' : '开始 AI 处理' }}</button>
        </footer>
      </section>
    </div>

    <div v-if="commentRow" class="drawer-backdrop" @click.self="closeComment">
      <aside class="library-drawer comment-review-drawer">
        <header class="drawer-head">
          <div>
            <span>学生补充课评</span>
            <strong>{{ studentFor(commentRow.studentId).name }}</strong>
            <small>{{ jobProgressLabel(feedbackProgress(commentRow)) || '可生成或编辑当前课评，编辑内容会自动保存。' }}</small>
          </div>
          <button type="button" class="ghost" @click="closeComment">关闭</button>
        </header>

        <div class="comment-review-body">
          <section class="drawer-context-card">
            <span>课堂记录</span>
            <p>{{ commentRow.record?.trim() || '尚未录入课堂记录。' }}</p>
          </section>

          <label class="drawer-field">
            <span>学生补充课评模板</span>
            <AdaptiveSelect
              :model-value="state.selectedCommentTemplate"
              :options="commentTemplateOptions"
              placeholder="选择课评模板"
              @update:model-value="updateCommentTemplate"
            />
          </label>

          <label class="drawer-field comment-editor-field">
            <span>课评内容</span>
            <textarea v-model="commentRow.comment" rows="10" placeholder="先录入课堂记录，再生成学生补充课评……" @input="markDraftDirty(commentRow)" @blur="flushDraft(commentRow)" />
          </label>
        </div>

        <footer class="drawer-action-bar">
          <button type="button" class="secondary" :disabled="state.isProcessing || feedbackJobActive(commentRow) || !commentRow.record?.trim()" @click="regenerateComment(commentRow)">{{ feedbackJobActive(commentRow) ? '生成中…' : '重新生成' }}</button>
          <span v-if="draftStatusTextFor(commentRow, 'comment')" class="delivery-autosave-status" :class="{ saving: ['DIRTY', 'SAVING', 'CONFIRMING'].includes(state.studentDraftStatusFor?.(commentRow)), error: state.studentDraftStatusFor?.(commentRow) === 'ERROR' }" @click="state.studentDraftStatusFor?.(commentRow) === 'ERROR' && retryDraft(commentRow)">{{ draftStatusTextFor(commentRow, 'comment') }}</span>
        </footer>
      </aside>
    </div>

    <div v-if="batchOpen" class="drawer-backdrop" @click.self="closeBatch">
      <aside class="library-drawer batch-operations-drawer">
        <header class="drawer-head">
          <div>
            <span>批量操作</span>
            <strong>一次处理多个学生</strong>
            <small>批量处理当前课次的作品和课评内容。</small>
          </div>
          <button type="button" class="ghost" @click="closeBatch">关闭</button>
        </header>

        <div class="batch-operations-body">
          <section class="batch-operation-card">
            <div>
              <strong>批量处理作品</strong>
              <small>已上传 {{ state.counts.artworkCount }} 张作品（{{ state.counts.matched }} 位学生），可统一使用同一作品处理模板。</small>
            </div>
            <label class="drawer-field">
              <span>作品处理模板</span>
              <AdaptiveSelect
                :model-value="state.selectedImageTemplate"
                :options="imageTemplateOptions"
                placeholder="选择作品处理模板"
                @update:model-value="updateImageTemplate"
              />
            </label>
            <small v-if="batchJobProgressText('ARTWORK')" class="delivery-job-progress">{{ batchJobProgressText('ARTWORK') }}</small>
            <button type="button" class="secondary" :disabled="state.isProcessing || !state.counts.matched" @click="processAll">{{ state.isProcessing ? '处理中…' : '批量处理作品' }}</button>
          </section>

          <section class="batch-operation-card">
            <div>
              <strong>批量生成课评</strong>
              <small>已录入 {{ state.counts.records }} 人课堂记录，可生成学生补充课评草稿。</small>
            </div>
            <label class="drawer-field">
              <span>学生补充课评模板</span>
              <AdaptiveSelect
                :model-value="state.selectedCommentTemplate"
                :options="commentTemplateOptions"
                placeholder="选择课评模板"
                @update:model-value="updateCommentTemplate"
              />
            </label>
            <small v-if="batchJobProgressText('FEEDBACK')" class="delivery-job-progress">{{ batchJobProgressText('FEEDBACK') }}</small>
            <button type="button" class="secondary" :disabled="state.isProcessing || !state.counts.records" @click="generateAll">{{ state.isProcessing ? '生成中…' : '批量生成课评' }}</button>
          </section>
        </div>
      </aside>
    </div>
  </section>
</template>
