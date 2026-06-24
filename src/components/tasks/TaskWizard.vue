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
            <small>{{ state.currentStep === index ? step.hint : (step.done === step.total && step.total > 0 ? '已完成' : `${step.done}/${step.total}`) }}</small>
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
          <span>{{ state.activeTask.exceptionType || '数据异常' }} · {{ state.activeTask.exceptionReason || '请展开课次记录查看并处理' }}</span>
        </div>
        <div class="attendance-intro">
          <div>
            <span>本班 {{ state.sessionStudents.length }} 名学生</span>
            <strong>{{ state.counts.attend }} 人到课</strong>
          </div>
          <small>请确认本节实际出勤情况，修改后会自动保存。</small>
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
            <strong>上传本节课的范画</strong>
          </div>
          <div class="button-pair">
            <label class="file-button material-upload-button">上传范画<input type="file" accept="image/*" @change="state.uploadLessonMaterial($event, '范画')" /></label>
            <button class="secondary" @click="showArtworkLibrary = !showArtworkLibrary">{{ showArtworkLibrary ? '收起范画库' : '从范画库选择' }}</button>
          </div>
        </div>
        <div class="material-intro">
          <strong>{{ state.counts.artworks ? `已上传 ${state.counts.artworks} 张范画` : '请至少上传 1 张范画' }}</strong>
          <small>步骤图为可选内容；范画和步骤图都可以决定是否展示给家长。</small>
        </div>
        <section v-if="showArtworkLibrary" class="lesson-library-picker">
          <div class="mini-head"><div><span>老师共享范画库</span><strong>选择后会复制到本节课</strong></div><small>{{ state.artworkLibrary.length }} 项可用素材</small></div>
          <div class="library-picker-grid">
            <article v-for="item in state.artworkLibrary" :key="item.id">
              <img :src="item.image" :alt="item.title" />
              <div><span>{{ item.type }} · {{ item.theme }}</span><strong>{{ item.title }}</strong><small>{{ item.uploader }} · 已使用 {{ item.usage }} 次</small></div>
              <button class="ghost" @click="state.useArtworkFromLibrary(item)">选择</button>
            </article>
          </div>
        </section>
        <div class="material-gallery">
          <article v-for="material in state.materials" :key="material.id" :class="{ hidden: !material.visible }">
            <img :src="material.image" :alt="material.title" />
            <div>
              <span>{{ material.type }}</span>
              <strong>{{ material.title }}</strong>
              <small>{{ material.visible ? '家长展示页可见' : '仅保存到内部档案' }}</small>
            </div>
            <div class="material-card-actions">
              <button class="ghost" @click="state.toggleMaterialVisible(material)">{{ material.visible ? '设为不展示' : '展示给家长' }}</button>
              <button v-if="!material.libraryId" class="ghost" @click="state.saveMaterialToLibrary(material)">保存到范画库</button>
            </div>
          </article>
        </div>
        <label class="file-button optional-step-upload">＋ 可选：上传步骤图<input type="file" accept="image/*" @change="state.uploadLessonMaterial($event, '步骤图')" /></label>
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
          <small>每位到课学生至少上传 1 张作品，传错后可直接删除或替换。</small>
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
            <div v-else class="work-absent-note">本节无需上传</div>
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
          <small>语音内容会直接添加到 {{ state.activeStudent.name }} 名下，不需要再次解析学生姓名。</small>
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
          <span :class="{ active: generateStage === 'settings', done: generateStage === 'review' }"><b>1</b><span><strong>生成设置</strong><small>批量生成全班图文</small></span></span>
          <i></i>
          <span :class="{ active: generateStage === 'review' }"><b>2</b><span><strong>逐个确认</strong><small>{{ state.counts.confirmed }}/{{ state.counts.attend }} 已完成</small></span></span>
        </div>

        <section v-if="generateStage === 'settings'" class="generate-stage-panel">
          <div class="setting-summary-grid">
            <article>
              <span>作品图片</span>
              <strong>{{ state.activeImageTemplate.name }}</strong>
              <small>{{ state.activeImageTemplate.ratio }} · {{ state.activeImageTemplate.brightness }} · {{ state.activeImageTemplate.watermark }}</small>
            </article>
            <article>
              <span>家长课评</span>
              <strong>{{ state.activeCommentTemplate.name }}</strong>
              <small>{{ state.activeCommentTemplate.tone }} · {{ state.activeCommentTemplate.length }} · {{ state.activeCommentTemplate.rule }}</small>
            </article>
          </div>
          <button class="ghost change-settings" @click="showTemplateChoices = !showTemplateChoices">{{ showTemplateChoices ? '收起其他设置' : '更换设置' }}</button>
          <div v-if="showTemplateChoices" class="generate-layout template-choices">
            <article class="template-picker">
              <div class="mini-head"><span>图片效果</span><strong>{{ state.activeImageTemplate.name }}</strong></div>
              <button v-for="(template, index) in state.templates.image" :key="template.name" :class="{ selected: state.selectedImageTemplate === index }" @click="state.chooseImageTemplate(index)">
                <strong>{{ template.name }}</strong><span>{{ template.ratio }} · {{ template.brightness }}</span><small>{{ template.border }} · {{ template.watermark }}</small>
              </button>
            </article>
            <article class="template-picker">
              <div class="mini-head"><span>课评风格</span><strong>{{ state.activeCommentTemplate.name }}</strong></div>
              <button v-for="(template, index) in state.templates.comment" :key="template.name" :class="{ selected: state.selectedCommentTemplate === index }" @click="state.chooseCommentTemplate(index)">
                <strong>{{ template.name }}</strong><span>{{ template.tone }} · {{ template.length }}</span><small>{{ template.rule }}</small>
              </button>
            </article>
          </div>
          <div class="generation-action-summary">将处理 {{ state.counts.matched }} 张作品，并根据课堂记录生成 {{ state.counts.attend }} 条课评。</div>
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
              <div><span>高光作品</span><strong>{{ state.activeSessionStudent.highlight ? '已标记为本节高光' : '普通作品' }}</strong><small>高光说明会随当前学生的家长展示页一起发布。</small></div>
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
            <div><span>链接有效期</span><strong>{{ state.displayConfig.expiresInDays }} 天</strong><small>每位学生会生成一个独立访问凭证</small></div>
            <label>有效期（天）<input v-model.number="state.displayConfig.expiresInDays" type="number" min="1" /></label>
          </div>
          <details class="advanced-state content-settings" :open="showContentSettings" @toggle="showContentSettings = $event.target.open">
            <summary>调整家长页展示内容 <span>默认展示范画、任务和高光说明</span></summary>
            <div class="switch-row"><label><input v-model="state.displayConfig.showMaterials" type="checkbox" /> 展示范画步骤</label><label><input v-model="state.displayConfig.showHomework" type="checkbox" /> 展示课后任务</label><label><input v-model="state.displayConfig.showHighlight" type="checkbox" /> 展示高光说明</label><label><input v-model="state.displayConfig.showLessonType" type="checkbox" /> 展示课次类型</label></div>
          </details>
          <button class="primary publish-main-action" :disabled="state.isProcessing || state.counts.confirmed !== state.counts.attend || state.counts.imageConfirmed !== state.counts.attend" @click="state.generateSharePages">{{ state.sharePage.publishedVersion ? '更新全班家长链接' : '生成全班家长链接' }}</button>
          <small class="batch-note">将为 {{ state.counts.attend }} 名到课学生分别生成独立链接和二维码。</small>

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
            <strong>发送前检查、归档并生成小麦留痕</strong>
          </div>
          <button class="primary" :disabled="state.isProcessing || state.currentWarnings.length" @click="state.archiveAll">
            完成本班交付
          </button>
        </div>
        <div class="delivery-layout">
          <article class="checklist">
            <strong>发送前检查</strong>
            <span v-if="!state.currentWarnings.length" class="ok-text">全部学生材料、展示页和任务已准备完成</span>
            <small v-for="warning in state.currentWarnings" :key="warning">{{ warning }}</small>
          </article>
          <article class="channel-stack">
            <div>
              <strong>家长展示页</strong>
              <span>{{ state.counts.shareReady }}/{{ state.counts.attend }} 已生成</span>
              <small>复制链接或二维码后，由老师人工发送给家长</small>
            </div>
            <div>
              <strong>系统作品档案</strong>
              <span>{{ state.counts.archived }}/{{ state.counts.attend }} 已归档</span>
              <small>保存作品、课评、高光、范画、课后任务和展示配置</small>
            </div>
            <div>
              <strong>小麦留痕待办</strong>
              <span>{{ state.activeTask.wheatStatus }}</span>
              <small>归档后生成待办，教务回小麦人工处理后再标记</small>
            </div>
          </article>
        </div>
      </section>

      <footer class="wizard-actions">
        <button class="ghost" :disabled="state.currentStep === 0" @click="state.prevStep">上一步</button>
        <button v-if="state.currentStep < state.steps.length - 1" class="primary" :disabled="state.currentStep === 4 && (state.counts.confirmed < state.counts.attend || state.counts.imageConfirmed < state.counts.attend)" @click="state.nextStep">下一步</button>
        <button v-else class="primary" :disabled="state.isProcessing || state.currentWarnings.length" @click="state.archiveAll">完成本班交付</button>
      </footer>
    </template>
  </section>
</template>
