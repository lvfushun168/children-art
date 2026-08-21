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
  record: '课堂记录',
  comment: '家长课评'
}[mobileSection.value] || '学生事项'))

const workImages = (row) => {
  const fileIds = Array.isArray(row?.imageFileIds) ? row.imageFileIds.filter(Boolean) : []
  if (fileIds.length) return fileIds.map((fileId, index) => ({ fileId, src: row.images?.[index] || '' }))
  return (row?.images || (row?.image ? [row.image] : [])).map((src) => ({ fileId: null, src }))
}

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

const clearArtworkPreview = () => {
  if (artworkPreviewObjectUrl) URL.revokeObjectURL(artworkPreviewObjectUrl)
  artworkPreviewObjectUrl = ''
  artworkPreviewUrl.value = ''
}

const refreshArtworkPreview = async () => {
  const requestId = ++artworkPreviewRequest
  clearArtworkPreview()
  artworkPreviewLoading.value = false
  const row = artworkRow.value
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
  return hasProcessedImage(artworkRow.value) ? '重新处理' : '处理当前作品'
})

watch(
  () => `${artworkRow.value?.originalFileId || artworkRow.value?.originalImage || ''}:${selectedImageTemplate.value?.id || selectedImageTemplate.value?.name || ''}:${selectedImageTemplate.value?.templateVersion || ''}:${selectedImageTemplate.value?.version || ''}`,
  () => { void refreshArtworkPreview() },
  { immediate: true }
)

onBeforeUnmount(() => clearArtworkPreview())

const selectedImageMode = (row) => {
  if (!row) return 'original'
  if (row.selectedVersionId && row.processedVersionId && sameId(row.selectedVersionId, row.processedVersionId)) return 'processed'
  if (!row.selectedVersionId && row.image === row.processedImage && row.processedImage) return 'processed'
  return 'original'
}

const artworkVersionStatus = (row) => {
  if (!row?.imageMatched) return '待上传'
  if (row.imageConfirmed) return `已采用${selectedImageMode(row) === 'processed' ? '处理图' : '原图'}`

  const processStatus = String(row.imageProcessStatus || '').toUpperCase()
  if (processStatus === '失败' || processStatus === 'FAILED') return '处理失败，可采用原图'
  if (processStatus === '处理中' || processStatus === 'PROCESSING') return '处理中'
  if (hasProcessedImage(row) || processStatus === '成功' || processStatus === 'SUCCEEDED') return '处理图已生成，待确认'
  return '未生成处理图'
}

const artworkVersionStatusClass = (row) => row?.imageConfirmed ? 'ok-text' : 'missing-text'

const statusFor = (row) => {
  if (!row?.imageMatched) return '作品待上传'
  if (!row.imageConfirmed) return hasProcessedImage(row) ? '作品待确认' : '原图待确认'
  if (!row.record?.trim()) return '课堂记录待补'
  if (!row.comment?.trim()) return '课评待生成'
  if (!row.confirmed) return '课评待确认'
  return '已完成'
}

const statusClassFor = (row) => statusFor(row) === '已完成' ? 'done' : 'pending'

const canConfirm = (row) => Boolean(row?.imageMatched && row.record?.trim() && row.comment?.trim())

const setActive = (row) => {
  if (row?.studentId !== undefined && row?.studentId !== null) props.state.activeStudentId = row.studentId
}

const setDrawerState = (open) => emit('drawer-state', open)

const openArtwork = (row) => {
  setActive(row)
  artworkStudentId.value = row?.studentId ?? null
  setDrawerState(true)
}

const closeArtwork = () => {
  aiPromptOpen.value = false
  artworkStudentId.value = null
  setDrawerState(false)
}

const openAiPrompt = () => {
  if (!artworkRow.value) return
  if (!hasImage(imageAsset(artworkRow.value, 'original'))) {
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
  if (!artworkRow.value) return
  setActive(artworkRow.value)
  const process = props.state.processImageWithPrompt
  if (typeof process !== 'function') {
    aiPromptError.value = 'AI 图片处理服务暂不可用，请稍后重试'
    return
  }
  const submitted = await process(prompt, artworkRow.value.studentId)
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

const closeComment = () => {
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

const openMobileStudent = (row) => {
  setActive(row)
  mobileStudentId.value = row?.studentId ?? null
  mobileSection.value = null
  emit('mobile-detail-state', true)
}

const closeMobileStudent = () => {
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

const closeMobileSection = () => {
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
  setActive(row)
  if (selectedImageTemplate.value && isClientCanvasTemplate(selectedImageTemplate.value)) {
    if (String(selectedImageTemplate.value.templateKey || '').toLowerCase() === 'original') {
      await props.state.confirmCurrentImage('original', row.studentId)
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
  await replace?.(event, row, 0)
}

const removeOriginalArtwork = async (row) => {
  if (!row || !confirmDestructiveAction('移除后将清空该学生本次作品及其处理结果，确定继续吗？')) return
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

const saveRecord = async (row) => {
  if (!row?.record?.trim()) {
    props.state.notify('请先录入当前学生的课堂表现')
    return false
  }
  setActive(row)
  const saved = await props.state.saveSessionRecord?.(row)
  if (saved !== false) props.state.notify(`${studentFor(row.studentId).name}的课堂记录已保存`)
  return saved !== false
}

const regenerateComment = async (row) => {
  if (!row) return
  setActive(row)
  await props.state.generateOne(row)
  props.state.pulseComment?.()
  props.state.notify(`已重新生成${studentFor(row.studentId).name}的课评`)
}

const confirmComment = async (row) => {
  if (!row?.comment?.trim()) {
    props.state.notify('请先生成或录入家长课评')
    return false
  }
  setActive(row)
  const confirmed = await props.state.confirmCurrentComment(row.studentId)
  if (confirmed) closeComment()
  return confirmed
}

const confirmMobileComment = async (row) => {
  if (!row?.comment?.trim()) {
    props.state.notify('请先生成或录入家长课评')
    return false
  }
  setActive(row)
  return props.state.confirmCurrentComment(row.studentId)
}

const selectImage = async (row, mode) => {
  if (!hasImage(imageAsset(row, mode))) {
    props.state.notify(mode === 'processed' ? '当前学生还没有处理图' : '当前学生还没有原图')
    return
  }
  setActive(row)
  if (mode === 'processed' && props.state.adoptCurrentImage) {
    await props.state.adoptCurrentImage(row.studentId)
    return
  }
  await props.state.confirmCurrentImage(mode, row.studentId)
}

const nextStudent = (row) => {
  const index = props.state.attendingRows.findIndex((item) => sameId(item.studentId, row.studentId))
  if (index >= 0 && index < props.state.attendingRows.length - 1) {
    const next = props.state.attendingRows[index + 1]
    setActive(next)
    if (mobileStudentId.value !== null) mobileStudentId.value = next.studentId
    return true
  }
  props.state.notify('全班学生交付内容已处理到最后一位')
  return false
}

const saveAndConfirm = async (row) => {
  if (!canConfirm(row)) {
    props.state.notify(`${studentFor(row.studentId).name}还有作品、课堂记录或课评未补齐`)
    return false
  }
  setActive(row)
  if (!row.imageConfirmed) {
    const mode = hasProcessedImage(row) ? 'processed' : 'original'
    if (!(await props.state.confirmCurrentImage(mode, row.studentId))) return false
  }
  if (!(await props.state.confirmCurrentComment(row.studentId))) return false
  if (sameId(commentStudentId.value, row.studentId)) closeComment()
  if (sameId(artworkStudentId.value, row.studentId)) closeArtwork()
  if (mobileStudentId.value !== null) mobileSection.value = null
  nextStudent(row)
  return true
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
        <h2>按学生完成作品、课堂记录与家长课评</h2>
      </div>
      <div class="student-delivery-head-actions">
        <button type="button" class="secondary" @click="openBatch">批量操作</button>
        <strong>{{ state.counts.studentDeliveryCompleted }}/{{ state.counts.attend }} 位已完成</strong>
      </div>
    </header>

    <div class="student-delivery-summary">
      <span>到课 {{ state.counts.attend }} 人</span>
      <span>作品 {{ state.counts.matched }}/{{ state.counts.attend }}</span>
      <span>课堂记录 {{ state.counts.records }}/{{ state.counts.attend }}</span>
      <span>课评确认 {{ state.counts.confirmed }}/{{ state.counts.attend }}</span>
    </div>

    <section class="student-delivery-desktop">
      <div class="student-delivery-table-wrap">
        <table class="student-delivery-table">
          <thead>
            <tr>
              <th>学生</th>
              <th>作品</th>
              <th>课堂记录</th>
              <th>家长课评</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in state.attendingRows" :key="`${row.lessonId}-${row.studentId}`" :class="{ 'delivery-row-done': statusFor(row) === '已完成' }">
              <td class="delivery-student-cell">
                <strong>{{ studentFor(row.studentId).name }}<em v-if="row.studentArchived" class="archived-reference">（已归档）</em></strong>
                <small>{{ studentFor(row.studentId).parent || '家长未填写' }}</small>
              </td>
              <td class="delivery-artwork-cell">
                <div v-if="workImages(row).length" class="delivery-thumb-strip">
                  <button v-for="(image, index) in workImages(row).slice(0, 3)" :key="`${image.fileId || image.src}-${index}`" type="button" class="delivery-thumb" @click="openArtwork(row)">
                    <ProtectedMedia :file-id="image.fileId" :src="image.src" :alt="`${studentFor(row.studentId).name}作品${index + 1}`" />
                  </button>
                </div>
                <button v-else type="button" class="delivery-empty delivery-empty-action" @click="openArtwork(row)">尚未上传作品，点击上传</button>
                <div class="delivery-artwork-meta">
                  <span :class="row.imageMatched ? 'ok-text' : 'missing-text'">{{ row.imageMatched ? `已上传 ${workImages(row).length || 1} 张` : '待上传' }}</span>
                  <span v-if="row.imageMatched" class="delivery-artwork-version-status" :class="artworkVersionStatusClass(row)">{{ artworkVersionStatus(row) }}</span>
                </div>
              </td>
              <td class="delivery-record-cell">
                <textarea v-model="row.record" rows="4" placeholder="记录孩子今天的课堂表现……" @input="row.confirmed = false" />
                <div class="delivery-cell-actions">
                  <button type="button" class="ghost" :disabled="state.isProcessing" @click="state.activeStudentId = row.studentId; state.simulateVoice()">🎙语音转文字</button>
                  <button type="button" class="ghost" :disabled="state.isProcessing || !row.record?.trim()" @click="saveRecord(row)">保存记录</button>
                </div>
              </td>
              <td class="delivery-comment-cell">
                <span class="delivery-comment-status" :class="row.comment?.trim() ? 'ok-text' : 'missing-text'">{{ row.confirmed ? '已确认' : row.comment?.trim() ? '已生成，待确认' : '尚未生成' }}</span>
                <p class="delivery-comment-preview">{{ row.comment?.trim() || '先录入课堂记录，再从抽屉生成家长课评。' }}</p>
                <div class="delivery-cell-actions">
                  <button type="button" class="secondary" :disabled="!row.record?.trim()" @click="openComment(row)">生成课评</button>
                </div>
              </td>
              <td class="delivery-status-cell">
                <span class="delivery-status" :class="statusClassFor(row)">{{ statusFor(row) }}</span>
                <button type="button" class="primary" :disabled="state.isProcessing || !canConfirm(row)" @click="saveAndConfirm(row)">保存并确认</button>
              </td>
            </tr>
            <tr v-if="!state.attendingRows.length">
              <td colspan="5" class="student-delivery-empty-state">当前没有到课学生，请先在第 1 步确认出勤。</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="student-delivery-mobile">
      <template v-if="!mobileStudent">
        <div class="student-delivery-mobile-list">
          <button v-for="row in state.attendingRows" :key="`${row.lessonId}-${row.studentId}`" type="button" class="student-delivery-mobile-card" @click="openMobileStudent(row)">
            <span class="mobile-student-avatar">{{ studentFor(row.studentId).name.slice(0, 1) }}</span>
            <span class="mobile-student-copy">
              <strong>{{ studentFor(row.studentId).name }}<em v-if="row.studentArchived" class="archived-reference">（已归档）</em></strong>
              <small>{{ studentFor(row.studentId).parent || '家长未填写' }}</small>
              <span class="mobile-student-flags"><i :class="row.imageMatched ? 'done' : 'pending'">作品 {{ row.imageMatched ? '已上传' : '待上传' }}</i><i :class="row.record?.trim() ? 'done' : 'pending'">记录 {{ row.record?.trim() ? '已记' : '待补' }}</i><i :class="row.confirmed ? 'done' : 'pending'">课评 {{ row.confirmed ? '已确认' : row.comment?.trim() ? '待确认' : '待生成' }}</i></span>
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
                <small>{{ mobileStudent.imageConfirmed ? '已确认采用版本' : mobileStudent.imageMatched ? '已上传，待确认' : '待上传作品' }}</small>
              </span>
              <span class="mobile-section-status"><span>{{ mobileStudent.imageConfirmed ? '已完成' : mobileStudent.imageMatched ? '待确认' : '待处理' }}</span><b>›</b></span>
            </button>

            <button type="button" class="mobile-student-section-row" @click="openMobileSection('record')">
              <span class="mobile-section-icon">记</span>
              <span class="mobile-section-copy">
                <strong>课堂记录</strong>
                <small>{{ mobileStudent.record?.trim() ? '已记录课堂表现' : '待补充课堂表现' }}</small>
              </span>
              <span class="mobile-section-status"><span>{{ mobileStudent.record?.trim() ? '已完成' : '待处理' }}</span><b>›</b></span>
            </button>

            <button type="button" class="mobile-student-section-row" @click="openMobileSection('comment')">
              <span class="mobile-section-icon">评</span>
              <span class="mobile-section-copy">
                <strong>家长课评</strong>
                <small>{{ mobileStudent.confirmed ? '已确认发送内容' : mobileStudent.comment?.trim() ? '已生成，待确认' : '待生成课评' }}</small>
              </span>
              <span class="mobile-section-status"><span>{{ mobileStudent.confirmed ? '已完成' : '待处理' }}</span><b>›</b></span>
            </button>

          </nav>
        </template>

        <section v-else-if="mobileSection === 'record'" class="mobile-student-subpage">
          <div class="mobile-student-subpage-head">
            <button type="button" class="ghost" @click="closeMobileSection">← 返回学生事项</button>
            <strong>{{ mobileSectionTitle }}</strong>
          </div>
          <article class="mobile-student-editor-card">
            <header><strong>课堂记录</strong><span>{{ mobileStudent.record?.trim() ? '已记录' : '待补' }}</span></header>
            <textarea v-model="mobileStudent.record" rows="8" placeholder="记录孩子今天的课堂表现、作品特点，以及可以继续提升的地方……" @input="mobileStudent.confirmed = false" />
            <div class="mobile-student-editor-actions">
              <button type="button" class="ghost" :disabled="state.isProcessing" @click="state.activeStudentId = mobileStudent.studentId; state.simulateVoice()">🎙 语音转文字</button>
              <button type="button" class="secondary" :disabled="state.isProcessing || !mobileStudent.record?.trim()" @click="saveRecord(mobileStudent)">保存记录</button>
            </div>
          </article>
        </section>

        <section v-else-if="mobileSection === 'comment'" class="mobile-student-subpage">
          <div class="mobile-student-subpage-head">
            <button type="button" class="ghost" @click="closeMobileSection">← 返回学生事项</button>
            <strong>{{ mobileSectionTitle }}</strong>
          </div>
          <article class="mobile-student-editor-card">
            <header><strong>家长课评</strong><span>{{ mobileStudent.confirmed ? '已确认' : mobileStudent.comment?.trim() ? '待确认' : '待生成' }}</span></header>
            <p class="mobile-comment-preview">{{ mobileStudent.comment?.trim() || '先录入课堂记录，再生成家长课评。' }}</p>
            <textarea v-model="mobileStudent.comment" rows="9" placeholder="先录入课堂记录，再生成家长课评……" @input="mobileStudent.confirmed = false" />
            <div class="mobile-student-editor-actions">
              <button type="button" class="secondary" :disabled="state.isProcessing || !mobileStudent.record?.trim()" @click="regenerateComment(mobileStudent)">{{ state.isProcessing ? '生成中…' : '重新生成' }}</button>
              <button type="button" class="primary" :disabled="state.isProcessing || !mobileStudent.comment?.trim()" @click="confirmMobileComment(mobileStudent)">确认课评</button>
            </div>
          </article>
        </section>

        <footer class="mobile-student-detail-actions">
          <button type="button" class="secondary" :disabled="mobileStudentIndex <= 0" @click="openMobileStudent(state.attendingRows[mobileStudentIndex - 1])">上一位</button>
          <button type="button" class="primary" :disabled="state.isProcessing || !canConfirm(mobileStudent)" @click="saveAndConfirm(mobileStudent)">{{ mobileStudentIndex < state.attendingRows.length - 1 ? '保存并下一位' : '保存并完成当前学生' }}</button>
        </footer>
      </template>
    </section>

    <div v-if="artworkRow" class="drawer-backdrop" @click.self="closeArtwork">
      <aside class="library-drawer artwork-process-drawer">
        <header class="drawer-head">
          <div>
            <span>作品处理</span>
            <strong>{{ studentFor(artworkRow.studentId).name }}</strong>
            <small>{{ artworkRow.imageProcessStatus || '尚未处理' }} · 当前采用：{{ selectedImageMode(artworkRow) === 'processed' ? '处理图' : '原图' }}</small>
          </div>
          <button type="button" class="ghost" @click="closeArtwork">关闭</button>
        </header>

        <label class="drawer-field">
          <span>作品处理模板</span>
          <AdaptiveSelect
            :model-value="state.selectedImageTemplate"
            :options="imageTemplateOptions"
            placeholder="选择作品处理模板"
            @update:model-value="updateImageTemplate"
          />
        </label>

        <section class="artwork-version-list">
          <article class="artwork-version-card" :class="{ selected: artworkRow.imageConfirmed && selectedImageMode(artworkRow) === 'original' }">
            <div class="artwork-version-media">
              <label class="artwork-media-upload" :class="{ empty: !hasImage(imageAsset(artworkRow, 'original')) }" title="点击替换原图">
                <ProtectedMedia v-if="hasImage(imageAsset(artworkRow, 'original'))" :file-id="imageAsset(artworkRow, 'original').fileId" :src="imageAsset(artworkRow, 'original').src" alt="作品原图" />
                <span v-else class="delivery-empty">尚未上传原图，点击上传</span>
                <span v-if="hasImage(imageAsset(artworkRow, 'original'))" class="artwork-media-hover-hint">点击替换原图</span>
                <input type="file" accept="image/*" @change="replaceOriginalImage($event, artworkRow)" />
              </label>
              <button v-if="hasImage(imageAsset(artworkRow, 'original'))" type="button" class="artwork-remove-button" :disabled="state.isProcessing" title="移除原图" aria-label="移除原图" @click.stop="removeOriginalArtwork(artworkRow)">×</button>
            </div>
            <div class="artwork-version-copy"><strong>原图</strong></div>
            <button type="button" class="secondary" :disabled="state.isProcessing || !hasImage(imageAsset(artworkRow, 'original'))" @click="selectImage(artworkRow, 'original')">采用原图</button>
          </article>
          <article class="artwork-version-card" :class="{ selected: artworkRow.imageConfirmed && selectedImageMode(artworkRow) === 'processed' }">
            <div class="artwork-version-media">
              <button
                type="button"
                class="artwork-ai-entry"
                :disabled="state.isProcessing || !hasImage(imageAsset(artworkRow, 'original'))"
                title="输入提示词，生成 AI 处理图"
                @click.stop="openAiPrompt"
              >AI处理✨</button>
              <img v-if="artworkPreviewUrl" :src="artworkPreviewUrl" alt="作品处理预览" class="artwork-live-preview" />
              <span v-else-if="artworkPreviewLoading" class="delivery-empty">正在生成实时预览…</span>
              <ProtectedMedia v-else-if="hasImage(imageAsset(artworkRow, 'processed'))" :file-id="imageAsset(artworkRow, 'processed').fileId" :src="imageAsset(artworkRow, 'processed').src" alt="作品处理图" />
              <span v-else class="delivery-empty">尚未生成处理图</span>
              <button v-if="hasImage(imageAsset(artworkRow, 'processed'))" type="button" class="artwork-remove-button" :disabled="state.isProcessing" title="删除处理图" aria-label="删除处理图" @click.stop="removeProcessedArtwork(artworkRow)">×</button>
            </div>
            <div class="artwork-version-copy">
              <strong>处理图</strong>
            </div>
            <button type="button" class="primary" :disabled="state.isProcessing || artworkPreviewLoading || !hasImage(imageAsset(artworkRow, 'processed')) && !artworkPreviewUrl" @click="selectImage(artworkRow, 'processed')">采用处理图</button>
          </article>
        </section>

        <footer v-if="!clientTemplateSelected" class="artwork-process-actions">
          <button type="button" class="secondary" :disabled="state.isProcessing || !artworkRow.imageMatched" @click="processCurrentImage(artworkRow)">{{ processActionLabel }}</button>
        </footer>

        <label class="inline-check artwork-highlight-setting"><input type="checkbox" :checked="artworkRow.highlight" @change="state.toggleHighlight(artworkRow)" /><span>标记为本节高光作品</span></label>
        <textarea v-if="artworkRow.highlight" v-model="artworkRow.highlightNote" rows="3" placeholder="补充高光说明" @blur="state.saveShareDraft?.('更新高光说明')" />
      </aside>
    </div>

    <div v-if="aiPromptOpen && artworkRow" class="modal-backdrop ai-image-prompt-backdrop" @click.self="closeAiPrompt">
      <section class="ai-image-prompt-modal" role="dialog" aria-modal="true" aria-labelledby="ai-image-prompt-title">
        <header class="modal-head">
          <div>
            <strong id="ai-image-prompt-title">AI处理✨</strong>
            <small>{{ studentFor(artworkRow.studentId).name }} · 输入提示词生成处理图</small>
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
          <button type="button" class="primary" :disabled="state.isProcessing" @click="submitAiPrompt">{{ state.isProcessing ? '处理中…' : '开始 AI 处理' }}</button>
        </footer>
      </section>
    </div>

    <div v-if="commentRow" class="drawer-backdrop" @click.self="closeComment">
      <aside class="library-drawer comment-review-drawer">
        <header class="drawer-head">
          <div>
            <span>家长课评</span>
            <strong>{{ studentFor(commentRow.studentId).name }}</strong>
            <small>课堂记录完成后，在这里生成、编辑并确认课评。</small>
          </div>
          <button type="button" class="ghost" @click="closeComment">关闭</button>
        </header>

        <div class="comment-review-body">
          <section class="drawer-context-card">
            <span>课堂记录</span>
            <p>{{ commentRow.record?.trim() || '尚未录入课堂记录。' }}</p>
          </section>

          <label class="drawer-field">
            <span>家长课评模板</span>
            <AdaptiveSelect
              :model-value="state.selectedCommentTemplate"
              :options="commentTemplateOptions"
              placeholder="选择课评模板"
              @update:model-value="updateCommentTemplate"
            />
          </label>

          <label class="drawer-field comment-editor-field">
            <span>课评内容</span>
            <textarea v-model="commentRow.comment" rows="10" placeholder="先录入课堂记录，再生成家长课评……" @input="commentRow.confirmed = false" />
          </label>
        </div>

        <footer class="drawer-action-bar">
          <button type="button" class="secondary" :disabled="state.isProcessing || !commentRow.record?.trim()" @click="regenerateComment(commentRow)">{{ state.isProcessing ? '生成中…' : '重新生成' }}</button>
          <button type="button" class="primary" :disabled="state.isProcessing || !commentRow.comment?.trim()" @click="confirmComment(commentRow)">确认课评</button>
        </footer>
      </aside>
    </div>

    <div v-if="batchOpen" class="drawer-backdrop" @click.self="closeBatch">
      <aside class="library-drawer batch-operations-drawer">
        <header class="drawer-head">
          <div>
            <span>批量操作</span>
            <strong>一次处理多个学生</strong>
            <small>批量操作仍然作用于当前课次，不替代学生逐项确认。</small>
          </div>
          <button type="button" class="ghost" @click="closeBatch">关闭</button>
        </header>

        <div class="batch-operations-body">
          <section class="batch-operation-card">
            <div>
              <strong>批量处理作品</strong>
              <small>已上传 {{ state.counts.matched }} 人，可统一使用同一作品处理模板。</small>
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
            <button type="button" class="secondary" :disabled="state.isProcessing || !state.counts.matched" @click="processAll">{{ state.isProcessing ? '处理中…' : '批量处理作品' }}</button>
          </section>

          <section class="batch-operation-card">
            <div>
              <strong>批量生成课评</strong>
              <small>已录入 {{ state.counts.records }} 人课堂记录，可统一生成草稿，之后仍需逐个确认。</small>
            </div>
            <label class="drawer-field">
              <span>家长课评模板</span>
              <AdaptiveSelect
                :model-value="state.selectedCommentTemplate"
                :options="commentTemplateOptions"
                placeholder="选择课评模板"
                @update:model-value="updateCommentTemplate"
              />
            </label>
            <button type="button" class="secondary" :disabled="state.isProcessing || !state.counts.records" @click="generateAll">{{ state.isProcessing ? '生成中…' : '批量生成课评' }}</button>
          </section>
        </div>
      </aside>
    </div>
  </section>
</template>
