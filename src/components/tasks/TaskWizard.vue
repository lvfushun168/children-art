<script setup>
import { computed, ref, watch } from 'vue'
import TaskReport from './TaskReport.vue'
import StateControlPanel from './StateControlPanel.vue'

const props = defineProps({
  state: {
    type: Object,
    required: true
  }
})

defineEmits(['navigate', 'back'])

const generateStage = ref('settings')
const showTemplateChoices = ref(false)
const showAllCourses = ref(false)
const showContentSettings = ref(false)
const showArtworkLibrary = ref(false)
const workPreview = ref(null)
const currentRecordIndex = computed(() => props.state.attendingRows.findIndex((row) => row.studentId === props.state.activeStudentId))
const currentReviewIndex = computed(() => props.state.attendingRows.findIndex((row) => row.studentId === props.state.activeStudentId))

const moveRecordStudent = (direction) => {
  const rows = props.state.attendingRows
  if (!rows.length) return
  const nextIndex = Math.min(rows.length - 1, Math.max(0, currentRecordIndex.value + direction))
  props.state.activeStudentId = rows[nextIndex].studentId
}

const saveRecordAndNext = () => {
  if (!props.state.activeSessionStudent.record?.trim()) {
    props.state.notify('请先录入当前学生的课堂表现')
    return
  }
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
  showAllCourses.value = false
  showContentSettings.value = false
  showArtworkLibrary.value = false
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
      <div class="lesson-status">
        <span>当前课次进度</span>
        <strong>{{ state.taskProgress }}%</strong>
        <div class="progress-track slim">
          <i :style="{ width: `${state.taskProgress}%` }"></i>
        </div>
        <small>{{ state.steps.filter((step) => step.done === step.total && step.total > 0).length }}/{{ state.steps.length }} 步完成</small>
      </div>
      <button class="ghost" @click="state.showReport = !state.showReport">{{ state.showReport ? '继续编辑' : '查看报告' }}</button>
    </header>

    <details class="advanced-state">
      <summary>课次状态与发布记录 <span>{{ state.activeTask.status }} · {{ state.sharePage.status }}</span></summary>
      <StateControlPanel :state="state" />
    </details>

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
            :class="{ active: row.studentId === state.activeStudentId, absent: row.attendance !== '到课' }"
            @click="state.activeStudentId = row.studentId"
          >
            <strong>{{ state.students.find((item) => item.id === row.studentId).name }}</strong>
            <span>{{ state.students.find((item) => item.id === row.studentId).parent }}</span>
            <select :value="row.attendance" @change="state.setAttendance(row, $event.target.value)" @click.stop>
              <option>到课</option>
              <option>请假</option>
              <option>旷课</option>
            </select>
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
        <div class="material-summary">
          <strong>
            {{ state.counts.classroomMaterials ? `已上传 ${state.counts.referenceMaterials} 张范画/步骤图，${state.counts.coursewares} 个课件` : state.materialsConfirmedEmpty ? '已确认本节无课堂资料' : '未上传课堂资料' }}
          </strong>
        </div>

        <section class="classroom-materials-board">
          <article class="material-lane">
            <header>
              <div>
                <span>范画步骤</span>
                <strong>{{ state.counts.referenceMaterials }} 张图片</strong>
              </div>
              <div class="button-pair">
                <label class="file-button material-upload-button">上传图片<input type="file" accept="image/*" multiple @change="state.uploadLessonMaterial($event, '范画')" /></label>
                <button class="secondary" @click="showArtworkLibrary = true">从图库引用</button>
              </div>
            </header>

            <div class="material-gallery compact">
              <article v-for="material in state.referenceMaterials" :key="material.id" :class="{ hidden: !material.visible }">
                <img :src="material.image" :alt="material.title" />
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
              <article v-for="item in state.artworkLibrary" :key="item.id" :class="{ selected: state.materials.some((material) => material.libraryId === item.id) }">
                <img :src="item.image" :alt="item.title" />
                <div>
                  <span>{{ item.type }} · {{ item.theme }}</span>
                  <strong>{{ item.title }}</strong>
                  <small>{{ item.uploader }} · 已使用 {{ item.usage }} 次</small>
                </div>
                <button class="secondary" :disabled="state.materials.some((material) => material.libraryId === item.id)" @click="state.useArtworkFromLibrary(item)">
                  {{ state.materials.some((material) => material.libraryId === item.id) ? '已引用' : '引用' }}
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
              <strong>{{ state.students.find((item) => item.id === row.studentId).name }}</strong>
              <small>{{ state.students.find((item) => item.id === row.studentId).parent }}</small>
              <span>{{ row.attendance }}</span>
            </div>
            <div v-if="row.attendance === '到课'" class="work-thumbnails">
              <button v-for="(image, index) in (row.images || (row.image ? [row.image] : []))" :key="`${image}-${index}`" class="work-thumbnail" @click="openWorkPreview(row, index)">
                <img :src="image" :alt="`${state.students.find((item) => item.id === row.studentId).name}作品${index + 1}`" />
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
              <div><span>{{ state.students.find((item) => item.id === workPreview.row.studentId).name }}</span><strong>作品 {{ workPreview.index + 1 }}/{{ workPreview.row.images.length }}</strong></div>
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
        <div class="record-progress-summary">
          <div><span>本节到课</span><strong>{{ state.counts.attend }} 人</strong></div>
          <div><span>已记录</span><strong>{{ state.counts.records }} 人</strong></div>
          <div><span>待记录</span><strong>{{ state.counts.attend - state.counts.records }} 人</strong></div>
        </div>
        <div class="record-student-tabs">
          <button v-for="(row, index) in state.attendingRows" :key="`${row.lessonId}-${row.studentId}`" :class="{ active: row.studentId === state.activeStudentId, done: row.record?.trim() }" @click="state.activeStudentId = row.studentId">
            <b>{{ index + 1 }}</b><span><strong>{{ state.students.find((item) => item.id === row.studentId).name }}</strong><small>{{ row.record?.trim() ? '已记录' : '待记录' }}</small></span>
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
          <div class="setting-summary-grid">
            <article>
              <span>作品图片</span>
              <strong>{{ state.selectedImageTemplates.length ? `已选 ${state.selectedImageTemplates.length} 个图片效果` : '未选择图片效果' }}</strong>
              <div v-if="state.selectedImageTemplates.length" class="selected-template-tags">
                <button v-for="index in state.selectedImageTemplates" :key="index" type="button" @click="state.removeImageTemplate(index)">
                  {{ state.templates.image[index]?.name }} <b>×</b>
                </button>
              </div>
            </article>
            <article>
              <span>家长课评</span>
              <strong>{{ state.activeCommentTemplate.name }}</strong>
              <div class="selected-template-tags">
                <span class="template-static-tag">{{ state.activeCommentTemplate.name }}</span>
              </div>
              <small>{{ state.activeCommentTemplate.tone }} · {{ state.activeCommentTemplate.length }}</small>
            </article>
          </div>
          <div class="generate-layout template-choices always-open">
            <article class="template-picker">
              <div class="mini-head"><span>图片效果</span><strong>可多选</strong></div>
              <div class="template-scroll-list">
                <button v-for="(template, index) in state.templates.image" :key="template.name" :class="{ selected: state.selectedImageTemplates.includes(index) }" @click="state.chooseImageTemplate(index)">
                  <strong>{{ template.name }}</strong><span>{{ template.ratio }} · {{ template.brightness }}</span><small>{{ template.border }} · {{ template.watermark }}</small>
                </button>
              </div>
            </article>
            <article class="template-picker">
              <div class="mini-head"><span>课评风格</span><strong>{{ state.activeCommentTemplate.name }}</strong></div>
              <div class="template-scroll-list">
                <button v-for="(template, index) in state.templates.comment" :key="template.name" :class="{ selected: state.selectedCommentTemplate === index }" @click="state.chooseCommentTemplate(index)">
                  <strong>{{ template.name }}</strong><span>{{ template.tone }} · {{ template.length }}</span><small>{{ template.rule }}</small>
                </button>
              </div>
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
            <button v-for="row in state.attendingRows" :key="`${row.lessonId}-${row.studentId}`" :class="{ selected: row.studentId === state.activeStudentId, reviewed: row.confirmed && row.imageConfirmed }" @click="state.activeStudentId = row.studentId">
              {{ state.students.find((item) => item.id === row.studentId).name }}{{ row.confirmed && row.imageConfirmed ? ' ✓' : '' }}
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
              <label v-if="state.activeSessionStudent.highlight">高光说明<textarea v-model="state.activeSessionStudent.highlightNote" rows="3" /></label>
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
            <strong>准备课后任务并生成家长链接</strong>
          </div>
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
          <article class="recommended-courses">
            <div class="mini-head"><div><span>推荐延伸课程</span><strong>已根据“{{ state.activeCourse.title }}”自动匹配</strong></div><button class="ghost" @click="showAllCourses = !showAllCourses">{{ showAllCourses ? '只看推荐' : '查看更多课程' }}</button></div>
            <label v-for="link in state.externalLinks.filter((link) => showAllCourses || link.courseIds.includes(state.activeCourse.id))" :key="link.id" class="course-choice">
              <input
                type="checkbox"
                :checked="state.homework.externalLinkIds.includes(link.id)"
                @change="state.toggleHomeworkLink(link.id)"
              />
              <span><strong>{{ link.title }}</strong><small>{{ link.note }}</small></span>
            </label>
          </article>
          <div class="share-expiry-setting">
            <div><span>链接有效期</span><strong>{{ state.displayConfig.expiresInDays }} 天</strong></div>
            <label>有效期（天）<input v-model.number="state.displayConfig.expiresInDays" type="number" min="1" /></label>
          </div>
          <details class="advanced-state content-settings" :open="showContentSettings" @toggle="showContentSettings = $event.target.open">
            <summary>调整家长页展示内容</summary>
            <div class="switch-row"><label><input v-model="state.displayConfig.showMaterials" type="checkbox" /> 展示范画步骤</label><label><input v-model="state.displayConfig.showHomework" type="checkbox" /> 展示课后任务</label><label><input v-model="state.displayConfig.showHighlight" type="checkbox" /> 展示高光说明</label><label><input v-model="state.displayConfig.showLessonType" type="checkbox" /> 展示课次类型</label></div>
          </details>
          <button class="primary publish-main-action" :disabled="state.isProcessing || state.counts.confirmed !== state.counts.attend || state.counts.imageConfirmed !== state.counts.attend" @click="state.generateSharePages">{{ state.sharePage.publishedVersion ? '更新全班家长链接' : '生成全班家长链接' }}</button>

          <section v-if="state.sharePage.status === '已发布'" class="student-share-list">
            <div class="section-head"><div><span>学生独立分享凭证</span><strong>{{ state.counts.shareReady }} 个链接已生成</strong></div></div>
            <article v-for="row in state.attendingRows" :key="row.studentId">
              <div class="student-share-identity"><span>{{ state.students.find((item) => item.id === row.studentId).name.slice(0, 1) }}</span><div><strong>{{ state.students.find((item) => item.id === row.studentId).name }}</strong><small>{{ state.students.find((item) => item.id === row.studentId).parent }}</small></div></div>
              <div class="student-token-link"><strong>{{ state.studentShareUrlFor(row) }}</strong><small>仅可访问该学生本节课内容 · {{ state.displayConfig.expiresInDays }} 天有效</small></div>
              <div class="qr-code">QR · {{ state.students.find((item) => item.id === row.studentId).name }}</div>
              <button class="secondary" @click="state.copyStudentLink(row)">{{ state.copiedStudentId === row.studentId ? '已复制' : '复制链接' }}</button>
            </article>
          </section>
        </section>
      </section>

      <section v-if="state.currentStep === 6" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 7 步</span>
            <strong>归档交付清单</strong>
          </div>
          <button class="primary" :disabled="state.isProcessing || !state.archiveChecklistReady" @click="state.archiveAll">
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
              <small>{{ state.archiveChecklistPending.join('、') }}</small>
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
              :class="{ done: ['已同步', '已上传', '已归档', '已生成', '已跳过'].includes(item.item.status), working: ['推送中', '生成中'].includes(item.item.status) }"
            >
              <div class="archive-check-mark">{{ ['已同步', '已上传', '已归档', '已生成', '已跳过'].includes(item.item.status) ? '✓' : '·' }}</div>
              <div class="archive-check-copy">
                <span>{{ item.title }}</span>
                <strong>{{ item.item.status }}</strong>
                <small v-if="item.meta">{{ item.meta }}</small>
                <em v-if="item.item.detail">{{ item.item.detail }}</em>
              </div>
              <div class="archive-check-actions">
                <button v-if="item.key === 'studentCloudArchive'" class="secondary" :disabled="state.isProcessing || item.item.status === '已同步' || item.item.status === '已跳过'" @click="state.pushArchiveItem(item.key)">{{ item.item.status === '已同步' ? '已同步' : item.action }}</button>
                <template v-if="item.key === 'deliveryVideo'">
                  <label class="secondary file-button archive-video-upload" :class="{ disabled: state.isProcessing }">上传视频<input type="file" accept="video/*" :disabled="state.isProcessing" @change="state.uploadDeliveryVideo" /></label>
                  <button class="ghost" :disabled="state.isProcessing || item.item.status === '已跳过'" @click="state.skipDeliveryVideo">本节无需</button>
                </template>
                <button v-if="item.key === 'teacherEffectArchive'" class="secondary" :disabled="state.isProcessing || item.item.status === '已归档' || item.item.status === '已跳过'" @click="state.archiveTeacherEffectImage">{{ item.item.status === '已归档' ? '已归档' : item.action }}</button>
                <button v-if="item.key === 'wheatTrace'" class="secondary" :disabled="state.isProcessing || item.item.status === '已生成'" @click="state.generateWheatTraceTask">{{ item.item.status === '已生成' ? '已生成' : item.action }}</button>
              </div>
            </article>
          </section>

          <article class="archive-target-card compact-targets">
            <div class="mini-head">
              <div>
                <span>网盘通道</span>
                <strong>{{ state.enabledCloudProviders.length ? '百度网盘已配置' : '尚未启用网盘' }}</strong>
              </div>
              <button v-if="!state.enabledCloudProviders.length" class="ghost" @click="$emit('navigate', 'settings')">去配置网盘</button>
            </div>
            <div class="archive-target-summary">
              <span v-for="provider in state.enabledCloudProviders" :key="provider.id" class="required">
                {{ provider.name }} · {{ provider.tokenStatus || '已配置' }}
              </span>
              <span v-if="!state.enabledCloudProviders.length">未启用网盘，本节外部同步项可跳过</span>
            </div>
          </article>
        </section>
      </section>

      <footer class="wizard-actions">
        <button class="ghost" :disabled="state.currentStep === 0" @click="state.prevStep">上一步</button>
        <button v-if="state.currentStep < state.steps.length - 1" class="primary" :disabled="state.currentStep === 4 && (state.counts.confirmed < state.counts.attend || state.counts.imageConfirmed < state.counts.attend)" @click="state.nextStep">下一步</button>
        <button v-else class="primary" :disabled="state.isProcessing || !state.archiveChecklistReady" @click="state.archiveAll">完成归档交付</button>
      </footer>
    </template>
  </section>
</template>
