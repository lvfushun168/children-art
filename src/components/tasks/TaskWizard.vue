<script setup>
import { computed, ref, watch } from 'vue'
import TaskReport from './TaskReport.vue'
import DeliveryPreview from './DeliveryPreview.vue'
import { sameId } from '../../services/mappers'

const props = defineProps({
  state: {
    type: Object,
    required: true
  }
})

defineEmits(['navigate', 'back'])

const generateStage = ref('settings')
const showTemplateChoices = ref(false)
const showResourceDrawer = ref(false)
const showContentSettings = ref(false)
const showArtworkLibrary = ref(false)
const showSharePreview = ref(false)
const resourceSearch = ref('')
const resourceFilter = ref('全部')
const workPreview = ref(null)
const attendanceOptions = ['到课', '请假', '旷课']
const resourceFilterOptions = computed(() => [
  '全部',
  '同主题',
  '最近使用',
  ...Array.from(new Set(props.state.externalLinks.map((link) => link.platform))).filter(Boolean)
])
const studentFor = (studentId) => props.state.students.find((item) => sameId(item.id, studentId)) || { name: '学生', parent: '' }
const filteredExternalResources = computed(() => {
  const keyword = resourceSearch.value.trim().toLowerCase()
  return props.state.externalLinks.filter((link, index) => {
    const filterMatched =
      resourceFilter.value === '全部' ||
      (resourceFilter.value === '同主题' && link.courseIds.some((courseId) => sameId(courseId, props.state.activeCourse.id))) ||
      (resourceFilter.value === '最近使用' && index < 3) ||
      link.platform === resourceFilter.value
    const keywordMatched = !keyword || `${link.title} ${link.note} ${link.platform}`.toLowerCase().includes(keyword)
    return filterMatched && keywordMatched
  })
})
const imageTemplateOptions = computed(() =>
  props.state.templates.image.map((template, index) => ({
    label: template.name,
    value: index,
    description: `${template.ratio} · ${template.brightness} · ${template.watermark}`
  }))
)
const commentTemplateOptions = computed(() =>
  props.state.templates.comment.map((template, index) => ({
    label: template.name,
    value: index,
    description: `${template.tone} · ${template.length}`
  }))
)
const currentRecordIndex = computed(() => props.state.attendingRows.findIndex((row) => sameId(row.studentId, props.state.activeStudentId)))
const currentReviewIndex = computed(() => props.state.attendingRows.findIndex((row) => sameId(row.studentId, props.state.activeStudentId)))

const moveRecordStudent = (direction) => {
  const rows = props.state.attendingRows
  if (!rows.length) return
  const nextIndex = Math.min(rows.length - 1, Math.max(0, currentRecordIndex.value + direction))
  props.state.activeStudentId = rows[nextIndex].studentId
}

const saveRecordAndNext = async () => {
  if (!props.state.activeSessionStudent.record?.trim()) {
    props.state.notify('请先录入当前学生的课堂表现')
    return
  }
  if (props.state.saveSessionRecord && !(await props.state.saveSessionRecord(props.state.activeSessionStudent))) return
  if (currentRecordIndex.value < props.state.attendingRows.length - 1) {
    props.state.notify(`已保存${props.state.activeStudent.name}的课堂记录`)
    moveRecordStudent(1)
  } else {
    props.state.notify('全班课堂记录已保存')
  }
}

watch(() => props.state.currentStep, (step) => {
  if (step === 3 && currentRecordIndex.value < 0 && props.state.attendingRows.length) {
    props.state.activeStudentId = props.state.attendingRows[0].studentId
  }
})

const openWorkPreview = (row, index) => {
  workPreview.value = { row, index }
}

const moveWorkPreview = (direction) => {
  if (!workPreview.value) return
  const images = workPreview.value.row.images || []
  workPreview.value.index = (workPreview.value.index + direction + images.length) % images.length
}

const removePreviewedWork = () => {
  const { row, index } = workPreview.value
  props.state.removeStudentImage(row, index)
  if (!row.images.length) workPreview.value = null
  else workPreview.value.index = Math.min(index, row.images.length - 1)
}

watch(() => props.state.activeTask.id, () => {
  generateStage.value = 'settings'
  showTemplateChoices.value = false
  showResourceDrawer.value = false
  showContentSettings.value = false
  showArtworkLibrary.value = false
  showSharePreview.value = false
  resourceSearch.value = ''
  resourceFilter.value = '全部'
})

watch(() => props.state.currentStep, (step) => {
  if (step !== 4) return
  if (props.state.counts.comments === props.state.counts.attend && props.state.counts.attend > 0) generateStage.value = 'review'
  else generateStage.value = 'settings'
}, { immediate: true })

const runBatchGeneration = async () => {
  await props.state.processImages()
  await props.state.generateAll()
  if (props.state.attendingRows.length) props.state.activeStudentId = props.state.attendingRows[0].studentId
  generateStage.value = 'review'
}

const confirmStudentAndNext = () => {
  if (!props.state.activeSessionStudent.imageConfirmed) props.state.confirmCurrentImage('processed')
  if (!props.state.confirmCurrentComment()) return
  const rows = props.state.attendingRows
  if (currentReviewIndex.value < rows.length - 1) props.state.activeStudentId = rows[currentReviewIndex.value + 1].studentId
  else props.state.notify('全班图文已经逐个确认完成')
}

const updateCommentTemplate = (index) => {
  props.state.selectedCommentTemplate = Number(index)
  props.state.pulseComment()
  props.state.notify(`已切换课评模板：${props.state.templates.comment[index]?.name}`)
}
</script>

<template>
  <section class="wizard panel">
    <div v-if="state.isProcessing" class="processing-bar">
      <span></span>
      <strong>{{ state.processingAction }}</strong>
    </div>
    <header class="wizard-head">
      <div>
        <span>{{ state.activeTask.date }} · {{ state.activeTask.time }} · {{ state.activeTask.lessonType }}</span>
        <h2>{{ state.activeClass.name }} · {{ state.activeCourse.title }}</h2>
      </div>

    </header>


    <TaskReport
      v-if="state.showReport"
      :counts="state.counts"
      :report-pulse="state.reportPulse"
      :active-task="state.activeTask"
      @show-archives="$emit('navigate', 'archives')"
      @show-students="$emit('navigate', 'students')"
      @show-wheat="$emit('navigate', 'wheat')"
    />

    <template v-else>
      <nav class="stepper">
        <button
          v-for="(step, index) in state.steps"
          :key="step.title"
          :class="{ active: state.currentStep === index, finished: step.done === step.total && step.total > 0 }"
          @click="state.currentStep = index"
        >
          <b>{{ index + 1 }}</b>
          <span>
            <strong>{{ step.title }}</strong>
            <small>{{ step.done === step.total && step.total > 0 ? '已完成' : `${step.done}/${step.total}` }}</small>
          </span>
        </button>
      </nav>

      <section v-if="state.currentStep === 0" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 1 步</span>
            <strong>确认课次信息和学生出勤</strong>
          </div>
        </div>
        <div v-if="state.activeTask.status === '异常'" class="lesson-warning">
          <strong>这节课的信息需要确认</strong>
          <span>{{ state.activeTask.exceptionType || '数据异常' }} · {{ state.activeTask.exceptionReason || '未填写原因' }}</span>
        </div>
        <div class="attendance-summary">
          <div>
            <span>本班 {{ state.sessionStudents.length }} 名学生</span>
            <strong>{{ state.counts.attend }} 人到课</strong>
          </div>
        </div>
        <div class="roster-table">
          <button
            v-for="row in state.sessionStudents"
            :key="`${row.lessonId}-${row.studentId}`"
            :class="{ active: sameId(row.studentId, state.activeStudentId), absent: row.attendance !== '到课' }"
            @click="state.activeStudentId = row.studentId"
          >
            <strong>{{ studentFor(row.studentId).name }}</strong>
            <span>{{ studentFor(row.studentId).parent }}</span>
            <AdaptiveSelect
              :model-value="row.attendance"
              :options="attendanceOptions"
              @update:model-value="state.setAttendance(row, $event)"
              @click.stop
            />
          </button>
        </div>
      </section>

      <section v-if="state.currentStep === 1" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 2 步</span>
            <strong>上传本节课的课堂资料</strong>
          </div>
        </div>

        <section class="classroom-materials-board">
          <article class="material-lane">
            <header>
              <div>
                <span>范画、步骤与课堂媒体</span>
                <strong>{{ state.counts.referenceMaterials }} 个文件</strong>
              </div>
              <div class="button-pair">
                <label class="file-button material-upload-button">上传范画/步骤图<input type="file" accept="image/*" multiple @change="state.uploadLessonMaterial($event, '范画')" /></label>
                <label class="file-button material-upload-button">上传课堂照片<input type="file" accept="image/*" multiple @change="state.uploadLessonMaterial($event, '课堂照片')" /></label>
                <label class="file-button material-upload-button">上传课堂视频<input type="file" accept="video/*" @change="state.uploadLessonMaterial($event, '课堂视频')" /></label>
                <button v-if="state.artworkLibrary.length" class="secondary" @click="showArtworkLibrary = true">从图库引用</button>
              </div>
            </header>

            <div class="material-gallery compact">
              <article v-for="material in state.referenceMaterials" :key="material.id" :class="{ hidden: !material.visible }">
                <video v-if="material.type === '课堂视频'" :src="material.image" controls preload="metadata" :aria-label="material.title" />
                <img v-else :src="material.image" :alt="material.title" />
                <div>
                  <span>{{ material.type }}</span>
                  <strong>{{ material.title }}</strong>
                  <small>{{ material.visible ? '家长展示页可见' : '仅保存到内部档案' }}</small>
                </div>
                <div class="material-card-actions">
                  <button class="ghost" @click="state.toggleMaterialVisible(material)">{{ material.visible ? '设为不展示' : '展示给家长' }}</button>
                  <button class="ghost danger-action" @click="state.removeLessonMaterial(material)">删除</button>
                </div>
              </article>
              <div v-if="!state.referenceMaterials.length" class="material-empty">
                <strong>尚未上传范画或步骤图</strong>
              </div>
            </div>
          </article>

          <article class="material-lane">
            <header>
              <div>
                <span>课件</span>
                <strong>{{ state.counts.coursewares }} 个文件</strong>
              </div>
              <label class="file-button material-upload-button">上传课件<input type="file" multiple @change="state.uploadLessonMaterial($event, '课件')" /></label>
            </header>
            <div class="courseware-list">
              <span v-for="material in state.coursewareMaterials" :key="material.id" class="courseware-chip">
                <strong>{{ material.title }}</strong>
                <small>{{ material.fileExt ? material.fileExt.toUpperCase() : '文件' }}</small>
                <button class="ghost" @click="state.removeLessonMaterial(material)">删除</button>
              </span>
              <div v-if="!state.coursewareMaterials.length" class="material-empty">
                <strong>尚未上传课件</strong>
              </div>
            </div>
          </article>

          <div v-if="!state.counts.classroomMaterials" class="no-material-confirm">
            <button class="ghost" :class="{ selected: state.materialsConfirmedEmpty }" @click="state.confirmNoLessonMaterials">
              {{ state.materialsConfirmedEmpty ? '已确认本节无资料' : '本节无资料' }}
            </button>
          </div>
        </section>

        <div v-if="showArtworkLibrary" class="drawer-backdrop" @click.self="showArtworkLibrary = false">
          <aside class="library-drawer">
            <header class="drawer-head">
              <div>
                <span>备课素材库</span>
                <strong>从图库引用</strong>
                <small>{{ state.artworkLibrary.length }} 项素材</small>
              </div>
              <button class="ghost" @click="showArtworkLibrary = false">关闭</button>
            </header>
            <section class="library-drawer-list">
            <article v-for="item in state.artworkLibrary" :key="item.id" :class="{ selected: state.materials.some((material) => sameId(material.libraryId, item.id)) }">
                <img :src="item.image" :alt="item.title" />
                <div>
                  <span>{{ item.type }} · {{ item.theme }}</span>
                  <strong>{{ item.title }}</strong>
                  <small>{{ item.uploader }} · 已使用 {{ item.usage }} 次</small>
                </div>
                <button class="secondary" :disabled="state.materials.some((material) => sameId(material.libraryId, item.id))" @click="state.useArtworkFromLibrary(item)">
                  {{ state.materials.some((material) => sameId(material.libraryId, item.id)) ? '已引用' : '引用' }}
                </button>
              </article>
            </section>
          </aside>
        </div>
      </section>

      <section v-if="state.currentStep === 2" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 3 步</span>
            <strong>按学生上传作品</strong>
          </div>
        </div>
        <div class="work-upload-summary">
          <div><span>本节到课</span><strong>{{ state.counts.attend }} 人</strong></div>
          <div><span>已上传</span><strong>{{ state.counts.matched }} 人</strong></div>
          <div><span>待上传</span><strong>{{ state.counts.attend - state.counts.matched }} 人</strong></div>
        </div>
        <div class="student-work-list">
          <article
            v-for="row in state.sessionStudents"
            :key="`${row.lessonId}-${row.studentId}`"
            :class="{ absent: row.attendance !== '到课' }"
            class="student-work-row"
          >
            <div class="student-work-person">
              <strong>{{ studentFor(row.studentId).name }}</strong>
              <small>{{ studentFor(row.studentId).parent }}</small>
              <span>{{ row.attendance }}</span>
            </div>
            <div v-if="row.attendance === '到课'" class="work-thumbnails">
              <button v-for="(image, index) in (row.images || (row.image ? [row.image] : []))" :key="`${image}-${index}`" class="work-thumbnail" @click="openWorkPreview(row, index)">
                <img :src="image" :alt="`${studentFor(row.studentId).name}作品${index + 1}`" />
              </button>
              <span v-if="!row.images?.length" class="work-empty">尚未上传作品</span>
            </div>
            <div v-else class="work-absent-status">本节无需上传</div>
            <div class="student-work-action">
              <strong v-if="row.attendance === '到课'" :class="row.imageMatched ? 'ok-text' : 'missing-text'">{{ row.imageMatched ? `已上传 ${row.images?.length || 1} 张` : '待上传' }}</strong>
              <label v-if="row.attendance === '到课'" class="file-button add-work-button">{{ row.imageMatched ? '继续添加' : '上传作品' }}<input type="file" accept="image/*" multiple @change="state.updateImage($event, row)" /></label>
            </div>
          </article>
        </div>

        <div v-if="workPreview" class="modal-backdrop" @click.self="workPreview = null">
          <section class="work-preview-modal">
            <header class="modal-head">
              <div><span>{{ studentFor(workPreview.row.studentId).name }}</span><strong>作品 {{ workPreview.index + 1 }}/{{ workPreview.row.images.length }}</strong></div>
              <button class="ghost" @click="workPreview = null">关闭</button>
            </header>
            <img :src="workPreview.row.images[workPreview.index]" alt="作品大图预览" />
            <footer class="work-preview-actions">
              <div class="button-pair">
                <button class="ghost" :disabled="workPreview.row.images.length < 2" @click="moveWorkPreview(-1)">上一张</button>
                <button class="ghost" :disabled="workPreview.row.images.length < 2" @click="moveWorkPreview(1)">下一张</button>
              </div>
              <div class="button-pair">
                <button class="ghost danger-action" @click="removePreviewedWork">删除这张</button>
                <label class="secondary file-button">替换这张<input type="file" accept="image/*" @change="state.updateImage($event, workPreview.row, workPreview.index)" /></label>
              </div>
            </footer>
          </section>
        </div>
      </section>

      <section v-if="state.currentStep === 3" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 4 步</span>
            <strong>逐个记录学生课堂表现</strong>
          </div>
        </div>
        <div class="record-student-tabs">
          <button v-for="(row, index) in state.attendingRows" :key="`${row.lessonId}-${row.studentId}`" :class="{ active: sameId(row.studentId, state.activeStudentId), done: row.record?.trim() }" @click="state.activeStudentId = row.studentId">
            <b>{{ index + 1 }}</b><span><strong>{{ studentFor(row.studentId).name }}</strong><small>{{ row.record?.trim() ? '已记录' : '待记录' }}</small></span>
          </button>
        </div>
        <article v-if="state.activeSessionStudent" class="single-record-editor">
          <header>
            <div><span>第 {{ currentRecordIndex + 1 }}/{{ state.attendingRows.length }} 位</span><h2>{{ state.activeStudent.name }}</h2><small>{{ state.activeStudent.parent }}</small></div>
            <button class="secondary voice-record-button" :disabled="state.isProcessing" @click="state.simulateVoice">🎙 {{ state.isProcessing ? '正在识别…' : '语音转文字' }}</button>
          </header>
          <label>
            课堂表现
            <textarea v-model="state.activeSessionStudent.record" rows="9" placeholder="记录孩子今天的课堂表现、作品特点，以及可以继续提升的地方……" />
          </label>
          <footer class="record-editor-actions">
            <button class="ghost" :disabled="currentRecordIndex <= 0" @click="moveRecordStudent(-1)">上一位</button>
            <button class="primary" @click="saveRecordAndNext">{{ currentRecordIndex < state.attendingRows.length - 1 ? '保存并下一位' : '保存记录' }}</button>
          </footer>
        </article>
      </section>

      <section v-if="state.currentStep === 4" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 5 步</span>
            <strong>生成并确认全班图文课评</strong>
          </div>
        </div>

        <div class="generate-flow-status">
          <span :class="{ active: generateStage === 'settings', done: generateStage === 'review' }"><b>1</b><span><strong>生成设置</strong></span></span>
          <i></i>
          <span :class="{ active: generateStage === 'review' }"><b>2</b><span><strong>逐个确认</strong><small>{{ state.counts.confirmed }}/{{ state.counts.attend }} 已完成</small></span></span>
        </div>

        <section v-if="generateStage === 'settings'" class="generate-stage-panel">
          <div class="generation-template-form">
            <article>
              <label>
                作品图片
                <AdaptiveMultiSelect v-model="state.selectedImageTemplates" :options="imageTemplateOptions" placeholder="选择图片处理效果" />
              </label>
              <small>可多选；未选择时生成会使用原图策略。</small>
              <div class="selected-template-tags compact-tags">
                <span v-for="index in state.selectedImageTemplates" :key="index" class="template-static-tag">
                  {{ state.templates.image[index]?.name }}
                </span>
                <span v-if="!state.selectedImageTemplates.length" class="template-empty-tag">未选择图片效果</span>
              </div>
            </article>
            <article>
              <label>
                家长课评
                <AdaptiveSelect :model-value="state.selectedCommentTemplate" :options="commentTemplateOptions" @update:model-value="updateCommentTemplate" />
              </label>
              <small>{{ state.activeCommentTemplate.tone }} · {{ state.activeCommentTemplate.length }}</small>
            </article>
          </div>
          <div class="stage-actions"><button class="primary batch-main-action" :disabled="state.isProcessing" @click="runBatchGeneration">{{ state.isProcessing ? '正在生成…' : '生成全班图文' }}</button></div>
        </section>

        <section v-if="generateStage === 'review'" class="generate-stage-panel">
          <div class="review-stage-head">
            <div><span>第 {{ currentReviewIndex + 1 }}/{{ state.attendingRows.length }} 位</span><strong>{{ state.activeStudent.name }}</strong></div>
            <button class="ghost" @click="generateStage = 'settings'">返回生成设置</button>
          </div>
          <div class="student-tabs review-student-tabs">
            <button v-for="row in state.attendingRows" :key="`${row.lessonId}-${row.studentId}`" :class="{ selected: sameId(row.studentId, state.activeStudentId), reviewed: row.confirmed && row.imageConfirmed }" @click="state.activeStudentId = row.studentId">
              {{ studentFor(row.studentId).name }}{{ row.confirmed && row.imageConfirmed ? ' ✓' : '' }}
            </button>
          </div>
          <div class="generated-result-grid">
            <article class="generated-image-result">
              <div class="result-card-head"><div><span>作品图片</span><strong>{{ state.activeSessionStudent.imageConfirmed ? '已采用' : '待确认' }}</strong></div></div>
              <img :src="state.activeSessionStudent.processedImage || state.activeSessionStudent.originalImage || state.activeSessionStudent.image" alt="生成后的作品图片" />
              <small v-if="state.activeSessionStudent.imageProcessError" class="missing-text">{{ state.activeSessionStudent.imageProcessError }}</small>
              <div class="result-actions">
                <button class="primary" :disabled="!state.activeSessionStudent.processedImage" @click="state.confirmCurrentImage('processed')">使用处理图</button>
                <button class="ghost" @click="state.confirmCurrentImage('original')">使用原图</button>
                <button class="secondary" :disabled="state.isProcessing" @click="state.retryCurrentImageProcess">重新处理</button>
              </div>
            </article>
            <article class="generated-comment-result">
              <div class="result-card-head"><div><span>家长课评</span><strong>{{ state.activeSessionStudent.confirmed ? '已确认' : '待确认' }}</strong></div></div>
              <textarea v-model="state.activeSessionStudent.comment" rows="12" @input="state.activeSessionStudent.confirmed = false" />
              <div class="result-actions">
                <button class="primary" @click="state.confirmCurrentComment">确认课评</button>
                <button class="secondary" :disabled="state.isProcessing" @click="state.generateOne(state.activeSessionStudent); state.pulseComment(); state.notify('已重新生成当前学生课评')">重新生成</button>
              </div>
            </article>
            <article class="highlight-review-card">
              <div><span>高光作品</span><strong>{{ state.activeSessionStudent.highlight ? '已标记为本节高光' : '普通作品' }}</strong></div>
              <label class="inline-check"><input type="checkbox" :checked="state.activeSessionStudent.highlight" @change="state.toggleHighlight(state.activeSessionStudent)" /><span>将当前学生作品标记为高光</span></label>
              <label v-if="state.activeSessionStudent.highlight">高光说明<textarea v-model="state.activeSessionStudent.highlightNote" rows="3" @blur="state.saveShareDraft?.('更新高光说明')" /></label>
            </article>
          </div>
          <div class="review-next-action"><button class="primary" @click="confirmStudentAndNext">{{ currentReviewIndex < state.attendingRows.length - 1 ? '确认并下一位' : '完成当前学生确认' }}</button></div>
        </section>

        <details class="ai-log-details">
          <summary>处理详情与失败记录 <span>{{ state.aiCallLogs.filter((log) => log.status === '失败').length }} 条失败</span></summary>
          <article class="ai-log-panel">
            <div class="mini-head">
              <span>AI 调用记录</span>
              <strong>{{ state.aiCallLogs.length }} 条</strong>
            </div>
            <div v-for="log in state.aiCallLogs.slice(0, 6)" :key="log.id" class="ai-log-row" :class="log.status">
              <strong>{{ log.type }} · {{ log.target }}</strong>
              <span>{{ log.status }} · 重试 {{ log.retry }} · 成本 {{ log.cost }}</span>
              <small>{{ log.time }} · {{ log.message }}</small>
            </div>
          </article>
        </details>
      </section>

      <section v-if="state.currentStep === 5" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 6 步</span>
            <strong>准备课后任务并配置家长展示</strong>
          </div>
          <button class="secondary" @click="showSharePreview = true">家长页预览</button>
        </div>
        <section class="parent-delivery-panel">
          <article class="record-table homework-editor">
            <label>
              课后任务
              <textarea v-model="state.homework.content" rows="4" />
            </label>
            <label>
              交付要求
              <input v-model="state.homework.requirement" />
            </label>
            <label>
              预计回收
              <input v-model="state.homework.dueDate" />
            </label>
          </article>
          <article class="extension-resource-panel">
            <div class="mini-head">
              <div>
                <span>在线课程（可选）</span>
                <strong>{{ state.selectedExternalLinks.length ? `已选 ${state.selectedExternalLinks.length} 个资源` : '未关联在线课程' }}</strong>
              </div>
              <button class="ghost" @click="showResourceDrawer = true">选择资源</button>
            </div>
            <div class="selected-resource-chips">
              <button v-for="link in state.selectedExternalLinks" :key="link.id" class="resource-chip selected" @click="state.toggleHomeworkLink(link.id)">
                <strong>{{ link.title }}</strong>
                <span>×</span>
              </button>
            </div>
          </article>
          <div class="share-expiry-setting">
            <div><span>展示页有效期</span><strong>{{ state.displayConfig.expiresInDays }} 天</strong></div>
            <label>有效期（天）<input v-model.number="state.displayConfig.expiresInDays" type="number" min="1" /></label>
          </div>
          <details class="advanced-state content-settings" :open="showContentSettings" @toggle="showContentSettings = $event.target.open">
            <summary>调整家长页展示内容🔽</summary>
            <div class="switch-row"><label><input v-model="state.displayConfig.showMaterials" type="checkbox" /> 展示范画步骤</label><label><input v-model="state.displayConfig.showHomework" type="checkbox" /> 展示课后任务</label><label><input v-model="state.displayConfig.showHighlight" type="checkbox" /> 展示高光说明</label><label><input v-model="state.displayConfig.showLessonType" type="checkbox" /> 展示课次类型</label></div>
          </details>
        </section>

        <div v-if="showResourceDrawer" class="drawer-backdrop" @click.self="showResourceDrawer = false">
          <aside class="library-drawer resource-drawer">
            <header class="drawer-head">
              <div>
                <span>延伸资源</span>
                <strong>选择课后任务附件</strong>
                <small>可选，不会自动关联；选中的资源会随家长展示页发布。</small>
              </div>
              <button class="ghost" @click="showResourceDrawer = false">关闭</button>
            </header>
            <section class="resource-picker-tools">
              <input v-model="resourceSearch" placeholder="搜索资源名称、平台或备注" />
              <div class="resource-filter-tags">
                <button v-for="filter in resourceFilterOptions" :key="filter" :class="{ selected: resourceFilter === filter }" @click="resourceFilter = filter">{{ filter }}</button>
              </div>
            </section>
            <section class="resource-drawer-list">
              <label v-for="link in filteredExternalResources" :key="link.id" class="resource-choice" :class="{ selected: state.homework.externalLinkIds.some((id) => sameId(id, link.id)) }">
                <input
                  type="checkbox"
                  :checked="state.homework.externalLinkIds.some((id) => sameId(id, link.id))"
                  @change="state.toggleHomeworkLink(link.id)"
                />
                <span>
                  <strong>{{ link.title }}</strong>
                  <small>{{ link.platform }} · {{ link.note }}</small>
                </span>
              </label>
              <small v-if="!filteredExternalResources.length" class="empty-note">没有找到符合条件的资源。</small>
            </section>
            <footer class="drawer-actions">
              <span>已选 {{ state.selectedExternalLinks.length }} 个</span>
              <button class="primary" @click="showResourceDrawer = false">确认选择</button>
            </footer>
          </aside>
        </div>

        <div v-if="showSharePreview" class="drawer-backdrop" @click.self="showSharePreview = false">
          <aside class="library-drawer share-preview-drawer">
            <header class="drawer-head">
              <div>
                <span>家长展示页草稿</span>
                <strong>{{ state.activeStudent?.name || '未选择学生' }}</strong>
                <small>草稿 V{{ state.sharePage.draftVersion }} · 发布与推送在第 7 步归档时执行</small>
              </div>
              <button class="ghost" @click="showSharePreview = false">关闭</button>
            </header>
            <div class="student-tabs review-student-tabs">
              <button v-for="row in state.attendingRows" :key="`${row.lessonId}-${row.studentId}`" :class="{ selected: sameId(row.studentId, state.activeStudentId) }" @click="state.activeStudentId = row.studentId">
                {{ studentFor(row.studentId).name }}
              </button>
            </div>
            <DeliveryPreview
              :active-student="state.activeStudent"
              :active-session-student="state.activeSessionStudent"
              :active-course="state.activeCourse"
              :active-task="state.activeTask"
              :active-image-template="state.activeImageTemplate"
              :materials="state.materials"
              :homework="state.homework"
              :display-config="state.displayConfig"
              :selected-external-links="state.selectedExternalLinks"
              :school="state.school"
              :export-text="state.exportText"
              :copied="state.copied"
              :preview-pulse="state.previewPulse"
              :comment-pulse="state.commentPulse"
              :parent-share-url="state.parentShareUrl"
              :qr-text="state.qrText"
              :file-name-for="state.fileNameFor"
              review-only
            />
          </aside>
        </div>
      </section>

      <section v-if="state.currentStep === 6" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 7 步</span>
            <strong>归档留痕与交付收口</strong>
          </div>
          <button class="primary" :disabled="state.isProcessing || state.currentWarnings.length" @click="state.archiveAll">
            完成本节归档交付
          </button>
        </div>
        <section class="archive-checklist-panel">
          <article class="archive-summary-card">
            <div>
              <span>收口进度</span>
              <strong>{{ state.archiveChecklistProgress.done }}/{{ state.archiveChecklistProgress.total }} 已完成</strong>
            </div>
            <div class="progress-track slim">
              <i :style="{ width: `${state.archiveChecklistProgress.percent}%` }"></i>
            </div>
            <div v-if="state.currentWarnings.length" class="archive-blocker">
              <strong>还有 {{ state.currentWarnings.length }} 项前置内容未完成</strong>
              <small>{{ state.currentWarnings.slice(0, 3).join('、') }}{{ state.currentWarnings.length > 3 ? '……' : '' }}</small>
            </div>
            <div v-else-if="!state.archiveChecklistReady" class="archive-result-status">
              <strong>待完成项</strong>
              <small>{{ state.archiveChecklistPending.join('、') }}；最终是否允许归档以服务端完成检查为准</small>
            </div>
            <div v-else class="archive-result-status">
              <strong>归档交付清单已就绪</strong>
            </div>
          </article>

          <section class="archive-checklist">
            <article
              v-for="item in state.archiveChecklistItems"
              :key="item.key"
              class="archive-check-row"
              :class="{ done: state.isArchiveDone(item.item), working: state.isArchiveWorking(item.item) }"
            >
              <div class="archive-check-mark">{{ state.isArchiveDone(item.item) ? '✓' : '·' }}</div>
              <div class="archive-check-copy">
                <span>{{ item.title }}</span>
                <strong>{{ item.item.status }}</strong>
                <small v-if="item.meta">{{ item.meta }}</small>
                <em v-if="item.item.detail">{{ item.item.detail }}</em>
                <details v-if="item.key === 'parentTouch' && state.sharePage.publishedSnapshot" class="touch-fallback">
                  <summary>学生访问凭证（企微不可用时人工发送兜底）</summary>
                  <div v-for="row in state.attendingRows" :key="`touch-${row.lessonId}-${row.studentId}`" class="touch-fallback-row">
                    <div>
                      <strong>{{ studentFor(row.studentId).name }}</strong>
                      <small>{{ studentFor(row.studentId).parent }} · 展示页 V{{ state.sharePage.publishedVersion }}</small>
                    </div>
                    <span class="credential-status">链接已生成</span>
                    <span class="qr-code mini">QR</span>
                    <button class="ghost" @click="state.manualCopyStudentLink(row)">{{ state.copiedStudentId === row.studentId ? '已复制' : '复制并记录人工发送' }}</button>
                  </div>
                </details>
              </div>
              <div class="archive-check-actions">
                <button v-if="item.key === 'parentTouch'" class="secondary" :disabled="state.isProcessing || state.isArchiveDone(item.item)" @click="state.pushParentTouch">{{ state.isArchiveDone(item.item) ? '已创建触达' : item.action }}</button>
                <button v-if="item.key === 'studentCloudArchive'" class="secondary" :disabled="state.isProcessing || item.item.status === '已同步' || item.item.status === '已跳过'" @click="state.pushArchiveItem(item.key)">{{ item.item.status === '已同步' ? '已同步' : item.action }}</button>
                <template v-if="item.key === 'teacherEffectArchive'">
                  <button v-if="!state.activeWorkspace.teacherEffect || ['DRAFT', 'FAILED'].includes(state.activeWorkspace.teacherEffect.status)" class="secondary" :disabled="state.isProcessing" @click="state.archiveTeacherEffectImage">{{ state.activeWorkspace.teacherEffect?.status === 'FAILED' ? '重新生成' : item.action }}</button>
                  <button v-if="state.activeWorkspace.teacherEffect?.status === 'GENERATED'" class="secondary" :disabled="state.isProcessing" @click="state.confirmTeacherEffect">确认课效图</button>
                  <button v-if="state.activeWorkspace.teacherEffect?.status === 'FAILED'" class="ghost" :disabled="state.isProcessing" @click="state.retryTeacherEffect">重试任务</button>
                  <span v-if="['CONFIRMED', 'SKIPPED'].includes(state.activeWorkspace.teacherEffect?.status)" class="status-pill">{{ item.item.status }}</span>
                </template>
                <button v-if="item.key === 'wheatTrace'" class="secondary" :disabled="state.isProcessing || item.item.status === '已生成'" @click="state.generateWheatTraceTask">{{ item.item.status === '已生成' ? '已生成' : item.action }}</button>
              </div>
            </article>
          </section>

        </section>
      </section>

      <footer class="wizard-actions">
        <button class="ghost" :disabled="state.currentStep === 0" @click="state.prevStep">上一步</button>
        <button v-if="state.currentStep < state.steps.length - 1" class="primary" :disabled="state.currentStep === 4 && (state.counts.confirmed < state.counts.attend || state.counts.imageConfirmed < state.counts.attend)" @click="state.nextStep">下一步</button>
        <button v-else class="primary" :disabled="state.isProcessing || state.currentWarnings.length" @click="state.archiveAll">完成归档交付</button>
      </footer>
    </template>
  </section>
</template>
