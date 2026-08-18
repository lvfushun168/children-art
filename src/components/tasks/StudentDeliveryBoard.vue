<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import ProtectedMedia from '../common/ProtectedMedia.vue'
import { sameId } from '../../services/mappers'

const props = defineProps({
  state: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['drawer-state'])

const artworkStudentId = ref(null)
const commentStudentId = ref(null)
const batchOpen = ref(false)
const mobileStudentId = ref(null)

const studentFor = (studentId) => {
  const student = props.state.students.find((item) => sameId(item.id, studentId))
  if (student) return student
  const row = props.state.sessionStudents.find((item) => sameId(item.studentId, studentId))
  return row ? { name: row.studentName || '学生', parent: row.parent || '' } : { name: '学生', parent: '' }
}

const imageTemplateOptions = computed(() =>
  props.state.templates.image.map((template, index) => ({
    label: template.name,
    value: index,
    description: `${template.ratio || '默认比例'} · ${template.brightness || ''} · ${template.watermark || ''}`
  }))
)

const commentTemplateOptions = computed(() =>
  props.state.templates.comment.map((template, index) => ({
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

const selectedImageMode = (row) => {
  if (!row) return 'original'
  if (row.selectedVersionId && row.processedVersionId && sameId(row.selectedVersionId, row.processedVersionId)) return 'processed'
  if (!row.selectedVersionId && row.image === row.processedImage && row.processedImage) return 'processed'
  return 'original'
}

const selectedImageAsset = (row) => imageAsset(row, selectedImageMode(row))

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
  artworkStudentId.value = null
  setDrawerState(false)
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
}

const closeMobileStudent = () => {
  mobileStudentId.value = null
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
  await props.state.retryCurrentImageProcess()
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

const selectImage = async (row, mode) => {
  if (!hasImage(imageAsset(row, mode))) {
    props.state.notify(mode === 'processed' ? '当前学生还没有处理图' : '当前学生还没有原图')
    return
  }
  setActive(row)
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
  nextStudent(row)
  return true
}

watch(() => props.state.activeTask.id, () => {
  artworkStudentId.value = null
  commentStudentId.value = null
  batchOpen.value = false
  mobileStudentId.value = null
  setDrawerState(false)
})

watch(
  () => props.state.attendingRows.map((row) => String(row.studentId)).join(','),
  () => {
    const rows = props.state.attendingRows
    if (rows.length && !rows.some((row) => sameId(row.studentId, props.state.activeStudentId))) setActive(rows[0])
    if (mobileStudentId.value !== null && !rows.some((row) => sameId(row.studentId, mobileStudentId.value))) mobileStudentId.value = null
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
              <th>处理后作品</th>
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
                <span v-else class="delivery-empty">尚未上传作品</span>
                <span :class="row.imageMatched ? 'ok-text' : 'missing-text'">{{ row.imageMatched ? `已上传 ${workImages(row).length || 1} 张` : '待上传' }}</span>
                <div class="delivery-cell-actions">
                  <label class="file-button compact-file-button">{{ row.imageMatched ? '继续上传' : '上传作品' }}<input type="file" accept="image/*" multiple @change="state.updateImage($event, row)" /></label>
                </div>
              </td>
              <td class="delivery-record-cell">
                <textarea v-model="row.record" rows="4" placeholder="记录孩子今天的课堂表现……" @input="row.confirmed = false" />
                <div class="delivery-cell-actions">
                  <button type="button" class="ghost" :disabled="state.isProcessing" @click="state.activeStudentId = row.studentId; state.simulateVoice()">🎙 语音</button>
                  <button type="button" class="ghost" :disabled="state.isProcessing || !row.record?.trim()" @click="saveRecord(row)">保存记录</button>
                  <button type="button" class="secondary" :disabled="!row.imageMatched" @click="openArtwork(row)">作品处理</button>
                  <button type="button" class="secondary" :disabled="!row.record?.trim()" @click="openComment(row)">家长课评</button>
                </div>
              </td>
              <td class="delivery-processed-cell">
                <button v-if="hasImage(imageAsset(row, 'processed'))" type="button" class="delivery-processed-preview" @click="openArtwork(row)">
                  <ProtectedMedia :file-id="imageAsset(row, 'processed').fileId" :src="imageAsset(row, 'processed').src" :alt="`${studentFor(row.studentId).name}处理后作品`" />
                </button>
                <span v-else class="delivery-empty">{{ row.imageMatched ? '尚未处理' : '等待上传' }}</span>
                <span :class="row.imageConfirmed ? 'ok-text' : 'missing-text'">{{ row.imageConfirmed ? `已采用${selectedImageMode(row) === 'processed' ? '处理图' : '原图'}` : row.imageProcessStatus || '待确认' }}</span>
              </td>
              <td class="delivery-comment-cell">
                <span class="delivery-comment-status" :class="row.comment?.trim() ? 'ok-text' : 'missing-text'">{{ row.confirmed ? '已确认' : row.comment?.trim() ? '已生成，待确认' : '尚未生成' }}</span>
                <p class="delivery-comment-preview">{{ row.comment?.trim() || '先录入课堂记录，再从抽屉生成家长课评。' }}</p>
              </td>
              <td class="delivery-status-cell">
                <span class="delivery-status" :class="statusClassFor(row)">{{ statusFor(row) }}</span>
                <button type="button" class="primary" :disabled="state.isProcessing || !canConfirm(row)" @click="saveAndConfirm(row)">保存并确认</button>
              </td>
            </tr>
            <tr v-if="!state.attendingRows.length">
              <td colspan="6" class="student-delivery-empty-state">当前没有到课学生，请先在第 1 步确认出勤。</td>
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

        <section class="mobile-student-detail-card">
          <header><strong>作品</strong><span>{{ mobileStudent.imageMatched ? '已上传' : '待上传' }}</span></header>
          <div class="mobile-student-work-preview">
            <div v-if="hasImage(selectedImageAsset(mobileStudent))" class="mobile-student-selected-image">
              <ProtectedMedia :file-id="selectedImageAsset(mobileStudent).fileId" :src="selectedImageAsset(mobileStudent).src" alt="当前采用的作品" />
            </div>
            <div v-else class="delivery-empty">尚未上传作品</div>
            <div class="mobile-student-work-actions">
              <label class="file-button">{{ mobileStudent.imageMatched ? '继续上传' : '上传作品' }}<input type="file" accept="image/*" multiple @change="state.updateImage($event, mobileStudent)" /></label>
              <button type="button" class="secondary" :disabled="!mobileStudent.imageMatched" @click="openArtwork(mobileStudent)">查看与处理</button>
            </div>
          </div>
        </section>

        <section class="mobile-student-detail-card">
          <header><strong>课堂记录</strong><span>{{ mobileStudent.record?.trim() ? '已记录' : '待补' }}</span></header>
          <textarea v-model="mobileStudent.record" rows="6" placeholder="记录孩子今天的课堂表现、作品特点，以及可以继续提升的地方……" @input="mobileStudent.confirmed = false" />
          <div class="mobile-detail-actions">
            <button type="button" class="ghost" :disabled="state.isProcessing" @click="state.activeStudentId = mobileStudent.studentId; state.simulateVoice()">🎙 语音转文字</button>
            <button type="button" class="secondary" :disabled="state.isProcessing || !mobileStudent.record?.trim()" @click="saveRecord(mobileStudent)">保存记录</button>
            <button type="button" class="secondary" :disabled="!mobileStudent.imageMatched" @click="openArtwork(mobileStudent)">作品处理</button>
            <button type="button" class="secondary" :disabled="!mobileStudent.record?.trim()" @click="openComment(mobileStudent)">家长课评</button>
          </div>
        </section>

        <section class="mobile-student-detail-card">
          <header><strong>家长课评</strong><span>{{ mobileStudent.confirmed ? '已确认' : mobileStudent.comment?.trim() ? '待确认' : '待生成' }}</span></header>
          <p class="mobile-comment-preview">{{ mobileStudent.comment?.trim() || '先录入课堂记录，再从抽屉生成家长课评。' }}</p>
          <div class="mobile-detail-actions mobile-comment-actions">
            <button type="button" class="secondary" :disabled="!mobileStudent.record?.trim()" @click="openComment(mobileStudent)">打开课评抽屉</button>
          </div>
        </section>

        <label class="mobile-student-highlight inline-check"><input type="checkbox" :checked="mobileStudent.highlight" @change="state.toggleHighlight(mobileStudent)" /><span>标记为本节高光作品</span></label>
        <textarea v-if="mobileStudent.highlight" v-model="mobileStudent.highlightNote" class="mobile-highlight-note" rows="3" placeholder="补充高光说明" @blur="state.saveShareDraft?.('更新高光说明')" />

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
              <ProtectedMedia v-if="hasImage(imageAsset(artworkRow, 'original'))" :file-id="imageAsset(artworkRow, 'original').fileId" :src="imageAsset(artworkRow, 'original').src" alt="作品原图" />
              <span v-else class="delivery-empty">尚未上传原图</span>
            </div>
            <div class="artwork-version-copy"><strong>原图</strong><small>AI 处理失败时也可以直接采用</small></div>
            <button type="button" class="secondary" :disabled="state.isProcessing || !hasImage(imageAsset(artworkRow, 'original'))" @click="selectImage(artworkRow, 'original')">采用原图</button>
          </article>
          <article class="artwork-version-card" :class="{ selected: artworkRow.imageConfirmed && selectedImageMode(artworkRow) === 'processed' }">
            <div class="artwork-version-media">
              <ProtectedMedia v-if="hasImage(imageAsset(artworkRow, 'processed'))" :file-id="imageAsset(artworkRow, 'processed').fileId" :src="imageAsset(artworkRow, 'processed').src" alt="作品处理图" />
              <span v-else class="delivery-empty">尚未生成处理图</span>
            </div>
            <div class="artwork-version-copy"><strong>处理图</strong><small>{{ artworkRow.imageProcessError || '可在确认后用于家长展示' }}</small></div>
            <button type="button" class="primary" :disabled="state.isProcessing || !hasImage(imageAsset(artworkRow, 'processed'))" @click="selectImage(artworkRow, 'processed')">采用处理图</button>
          </article>
        </section>

        <footer class="artwork-process-actions">
          <label class="file-button">替换/上传作品<input type="file" accept="image/*" multiple @change="state.updateImage($event, artworkRow)" /></label>
          <button type="button" class="secondary" :disabled="state.isProcessing || !artworkRow.imageMatched" @click="processCurrentImage(artworkRow)">{{ hasProcessedImage(artworkRow) ? '重新处理' : '处理当前作品' }}</button>
        </footer>

        <label class="inline-check artwork-highlight-setting"><input type="checkbox" :checked="artworkRow.highlight" @change="state.toggleHighlight(artworkRow)" /><span>标记为本节高光作品</span></label>
        <textarea v-if="artworkRow.highlight" v-model="artworkRow.highlightNote" rows="3" placeholder="补充高光说明" @blur="state.saveShareDraft?.('更新高光说明')" />
      </aside>
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
