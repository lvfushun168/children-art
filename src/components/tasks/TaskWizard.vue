<script setup>
import { ref, watch } from 'vue'
import TaskReport from './TaskReport.vue'
import StateControlPanel from './StateControlPanel.vue'

const props = defineProps({
  state: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['navigate', 'back', 'share-stage'])

const generateStage = ref('settings')
const showTemplateChoices = ref(false)
const shareStage = ref('content')
const showAllCourses = ref(false)
const showContentSettings = ref(false)
const showPublishSettings = ref(false)
const showArtworkLibrary = ref(false)

const setShareStage = (stage) => {
  shareStage.value = stage
  emit('share-stage', stage)
}

watch(() => props.state.activeTask.id, () => {
  generateStage.value = 'settings'
  showTemplateChoices.value = false
  shareStage.value = 'content'
  showAllCourses.value = false
  showContentSettings.value = false
  showPublishSettings.value = false
  showArtworkLibrary.value = false
  emit('share-stage', 'content')
})

watch(() => props.state.currentStep, (step) => {
  if (step !== 4) return
  if (props.state.counts.comments === props.state.counts.attend && props.state.counts.attend > 0) generateStage.value = 'review'
  else if (props.state.counts.comments || props.state.counts.processed) generateStage.value = 'generate'
  else generateStage.value = 'settings'
}, { immediate: true })

watch(() => props.state.currentStep, (step) => {
  if (step === 5) emit('share-stage', shareStage.value)
}, { immediate: true })

const runBatchGeneration = async () => {
  await props.state.processImages()
  await props.state.generateAll()
  generateStage.value = 'review'
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
            <strong>上传、匹配并确认全班作品</strong>
          </div>
          <div class="button-pair">
            <button class="secondary" :disabled="state.isProcessing" @click="state.matchImages">批量匹配</button>
            <button class="primary" @click="state.confirmImages">确认图片</button>
          </div>
        </div>
        <div class="works-grid">
          <article
            v-for="row in state.sessionStudents"
            :key="`${row.lessonId}-${row.studentId}`"
            :class="{ absent: row.attendance !== '到课' }"
            class="work-card"
          >
            <img :src="row.image" :alt="state.students.find((item) => item.id === row.studentId).name" />
            <strong>{{ state.students.find((item) => item.id === row.studentId).name }}</strong>
            <small>{{ row.attendance === '到课' ? state.fileNameFor(row) : '本节课未到课，不生成交付' }}</small>
            <label v-if="row.attendance === '到课'" class="file-button">
              替换作品
              <input type="file" accept="image/*" @change="state.updateImage($event, row)" />
            </label>
            <em>{{ row.imageConfirmed ? '已确认' : row.imageMatched ? '待确认' : '缺作品' }}</em>
          </article>
        </div>
      </section>

      <section v-if="state.currentStep === 3" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 4 步</span>
            <strong>录入课堂记录和个性化关键词</strong>
          </div>
          <button class="secondary" :disabled="state.isProcessing" @click="state.simulateVoice">模拟语音识别</button>
        </div>
        <div class="record-layout">
          <article>
            <label>
              批量记录
              <textarea v-model="state.bulkRecord" rows="12" />
            </label>
            <button class="primary" @click="state.parseBulkRecord">解析到学生</button>
          </article>
          <article class="record-table">
            <label v-for="row in state.attendingRows" :key="`${row.lessonId}-${row.studentId}`">
              {{ state.students.find((item) => item.id === row.studentId).name }} · 关注点
              <select v-model="row.focus">
                <option>色彩</option>
                <option>想象力</option>
                <option>构图</option>
                <option>细节</option>
              </select>
              <input v-model="row.record" />
            </label>
          </article>
        </div>
      </section>

      <section v-if="state.currentStep === 4" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 5 步</span>
            <strong>生成并确认全班图文课评</strong>
          </div>
        </div>

        <nav class="generate-subnav">
          <button :class="{ active: generateStage === 'settings' }" @click="generateStage = 'settings'">
            <b>1</b><span><strong>生成设置</strong><small>确认图片与课评风格</small></span>
          </button>
          <button :class="{ active: generateStage === 'generate' }" @click="generateStage = 'generate'">
            <b>2</b><span><strong>批量生成</strong><small>{{ state.counts.comments }}/{{ state.counts.attend }} 已生成</small></span>
          </button>
          <button :class="{ active: generateStage === 'review' }" @click="generateStage = 'review'">
            <b>3</b><span><strong>逐个确认</strong><small>{{ state.counts.confirmed }}/{{ state.counts.attend }} 已确认</small></span>
          </button>
        </nav>

        <section v-if="generateStage === 'settings'" class="generate-stage-panel">
          <div class="stage-copy">
            <span>当前采用课程默认设置</span>
            <strong>如果没有特殊要求，可以直接继续生成</strong>
          </div>
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
          <div class="stage-actions"><button class="primary" @click="generateStage = 'generate'">设置没问题，继续</button></div>
        </section>

        <section v-if="generateStage === 'generate'" class="generate-stage-panel batch-generate-panel">
          <div class="stage-copy">
            <span>批量处理全班 {{ state.counts.attend }} 名学生</span>
            <strong>{{ state.counts.comments === state.counts.attend && state.counts.processed === state.counts.attend ? '图文内容已经生成' : '准备生成作品处理图和 1v1 课评' }}</strong>
          </div>
          <div class="batch-progress-grid">
            <article><span>作品图片</span><strong>{{ state.counts.processed }}/{{ state.counts.attend }}</strong><div class="progress-track slim"><i :style="{ width: `${state.counts.attend ? state.counts.processed / state.counts.attend * 100 : 0}%` }"></i></div></article>
            <article><span>学生课评</span><strong>{{ state.counts.comments }}/{{ state.counts.attend }}</strong><div class="progress-track slim"><i :style="{ width: `${state.counts.attend ? state.counts.comments / state.counts.attend * 100 : 0}%` }"></i></div></article>
          </div>
          <button class="primary batch-main-action" :disabled="state.isProcessing" @click="runBatchGeneration">{{ state.counts.comments ? '重新生成全班图文' : '生成全班图文' }}</button>
          <small class="batch-note">生成完成后仍需老师逐个确认，系统不会直接发布给家长。</small>
          <details class="advanced-state batch-advanced">
            <summary>需要单独处理图片或课评？</summary>
            <div class="button-pair">
              <button class="secondary" :disabled="state.isProcessing" @click="state.processImages">只处理全班图片</button>
              <button class="secondary" :disabled="state.isProcessing" @click="state.generateAll">只生成全班课评</button>
            </div>
          </details>
          <div v-if="state.counts.comments" class="stage-actions"><button class="primary" @click="generateStage = 'review'">开始逐个确认</button></div>
        </section>

        <section v-if="generateStage === 'review'" class="generate-stage-panel">
          <article class="comment-editor review-editor">
            <div class="student-tabs">
              <button
                v-for="row in state.attendingRows"
                :key="`${row.lessonId}-${row.studentId}`"
                :class="{ selected: row.studentId === state.activeStudentId }"
                @click="state.activeStudentId = row.studentId"
              >
                {{ state.students.find((item) => item.id === row.studentId).name }}
              </button>
            </div>
            <label>
              当前学生课评
              <textarea v-model="state.activeSessionStudent.comment" rows="7" />
            </label>
            <div class="image-review" v-if="state.activeSessionStudent">
              <div>
                <span>原图</span>
                <img :src="state.activeSessionStudent.originalImage || state.activeSessionStudent.image" alt="原图" />
              </div>
              <div>
                <span>处理图</span>
                <img :src="state.activeSessionStudent.processedImage || state.activeSessionStudent.image" alt="处理图" />
              </div>
              <article>
                <strong>{{ state.activeSessionStudent.imageProcessStatus }}</strong>
                <small v-if="state.activeSessionStudent.imageProcessError">{{ state.activeSessionStudent.imageProcessError }}</small>
                <small v-else>{{ state.activeSessionStudent.processedImage ? '处理图已生成，需老师确认后进入展示页。' : '尚未生成处理图，家长页仍使用原图。' }}</small>
                <div class="button-pair">
                  <button class="ghost" @click="state.failCurrentImageProcess">模拟失败</button>
                  <button class="secondary" :disabled="state.isProcessing" @click="state.retryCurrentImageProcess">重试当前图片</button>
                </div>
              </article>
            </div>
            <div class="button-pair">
              <button
                class="secondary"
                :disabled="state.isProcessing"
                @click="state.generateOne(state.activeSessionStudent); state.pulseComment(); state.notify('已重写当前学生课评')"
              >
                重写当前学生
              </button>
              <button class="secondary" @click="state.confirmImages">确认全部处理图</button>
              <button class="primary" @click="state.confirmAll">确认全部课评</button>
            </div>
          </article>
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
            <strong>准备并发布家长展示</strong>
          </div>
        </div>

        <nav class="generate-subnav share-subnav">
          <button :class="{ active: shareStage === 'content' }" @click="setShareStage('content')"><b>1</b><span><strong>准备内容</strong><small>课后任务与延伸课程</small></span></button>
          <button :class="{ active: shareStage === 'review' }" @click="setShareStage('review')"><b>2</b><span><strong>检查学生</strong><small>逐个查看最终展示</small></span></button>
          <button :class="{ active: shareStage === 'publish' }" @click="setShareStage('publish')"><b>3</b><span><strong>发布分享</strong><small>{{ state.sharePage.status }}</small></span></button>
        </nav>

        <section v-if="shareStage === 'content'" class="generate-stage-panel share-content-stage">
          <div class="stage-copy"><span>本次课后延伸</span><strong>准备家长需要看到的任务和课程链接</strong></div>
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
          <details class="advanced-state content-settings" :open="showContentSettings" @toggle="showContentSettings = $event.target.open">
            <summary>调整展示内容 <span>已使用机构默认设置</span></summary>
            <div class="switch-row">
              <label><input v-model="state.displayConfig.showMaterials" type="checkbox" /> 展示范画步骤</label>
              <label><input v-model="state.displayConfig.showHomework" type="checkbox" /> 展示课后任务</label>
              <label><input v-model="state.displayConfig.showHighlight" type="checkbox" /> 展示高光说明</label>
              <label><input v-model="state.displayConfig.showLessonType" type="checkbox" /> 展示课次类型</label>
            </div>
          </details>
          <div class="stage-actions"><button class="primary" @click="setShareStage('review')">内容准备好了，检查学生</button></div>
        </section>

        <section v-if="shareStage === 'review'" class="generate-stage-panel share-review-stage">
          <div class="stage-copy"><span>逐个检查 {{ state.counts.attend }} 名学生</span><strong>确认作品、课评和高光说明是否适合发送</strong></div>
          <article class="comment-editor review-editor">
            <div class="student-tabs">
              <button
                v-for="row in state.attendingRows"
                :key="`${row.lessonId}-${row.studentId}`"
                :class="{ selected: row.studentId === state.activeStudentId }"
                @click="state.activeStudentId = row.studentId"
              >
                {{ state.students.find((item) => item.id === row.studentId).name }}{{ row.confirmed && row.imageConfirmed ? ' ✓' : '' }}
              </button>
            </div>
            <div class="student-share-summary">
              <img :src="state.activeSessionStudent.image" :alt="state.activeStudent.name" />
              <div><span>当前学生</span><strong>{{ state.activeStudent.name }}</strong><small>{{ state.activeSessionStudent.imageConfirmed ? '作品已确认' : '作品待确认' }} · {{ state.activeSessionStudent.confirmed ? '课评已确认' : '课评待确认' }}</small></div>
            </div>
            <label class="inline-check">
              <input type="checkbox" :checked="state.activeSessionStudent.highlight" @change="state.toggleHighlight(state.activeSessionStudent)" />
              <span>标记当前学生作品为高光</span>
            </label>
            <label>
              高光说明
              <textarea v-model="state.activeSessionStudent.highlightNote" rows="4" />
            </label>
          </article>
          <div class="stage-actions"><button class="primary" @click="setShareStage('publish')">学生内容没问题，继续发布</button></div>
        </section>

        <section v-if="shareStage === 'publish'" class="generate-stage-panel publish-stage">
          <div class="stage-copy"><span>发布前最后确认</span><strong>{{ state.counts.confirmed === state.counts.attend && state.counts.imageConfirmed === state.counts.attend ? '全班内容已准备完成' : '还有学生内容需要确认' }}</strong></div>
          <div class="publish-check-grid">
            <article><span>作品</span><strong>{{ state.counts.imageConfirmed }}/{{ state.counts.attend }}</strong><small>已确认</small></article>
            <article><span>课评</span><strong>{{ state.counts.confirmed }}/{{ state.counts.attend }}</strong><small>已确认</small></article>
            <article><span>分享状态</span><strong>{{ state.sharePage.status }}</strong><small>V{{ state.sharePage.status === '草稿' ? state.sharePage.draftVersion : state.sharePage.publishedVersion }}</small></article>
          </div>
          <div class="publish-defaults"><div><span>访问方式</span><strong>{{ state.displayConfig.accessPolicy }}</strong></div><div><span>链接有效期</span><strong>{{ state.displayConfig.expiresInDays }} 天</strong></div><div><span>家长转发</span><strong>{{ state.displayConfig.allowForward ? '允许' : '不允许' }}</strong></div><button class="ghost" @click="showPublishSettings = !showPublishSettings">修改</button></div>
          <div v-if="showPublishSettings" class="publish-settings">
            <label>访问策略<select v-model="state.displayConfig.accessPolicy"><option>链接密钥访问</option><option>密码访问</option><option>公开访问</option></select></label>
            <label>有效期（天）<input v-model.number="state.displayConfig.expiresInDays" type="number" /></label>
            <label class="inline-check"><input v-model="state.displayConfig.allowForward" type="checkbox" /><span>允许转发后继续访问</span></label>
          </div>
          <button class="primary publish-main-action" :disabled="state.isProcessing || state.counts.confirmed !== state.counts.attend || state.counts.imageConfirmed !== state.counts.attend" @click="state.generateSharePages">{{ state.sharePage.publishedVersion ? '发布新版本' : '生成家长链接和二维码' }}</button>
          <small class="batch-note">发布后由老师复制链接或二维码，人工发送给家长。</small>
          <div v-if="state.sharePage.status === '已发布'" class="publish-result">
            <div class="qr-code">{{ state.qrText }}</div>
            <div><span>家长展示已发布</span><strong>{{ state.parentShareUrl }}</strong><small>V{{ state.sharePage.publishedVersion }} · {{ state.sharePage.publishedAt }}</small></div>
            <button class="secondary" @click="state.copyExport">{{ state.copied ? '链接已复制' : '复制家长链接' }}</button>
          </div>
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
            <div class="button-pair">
              <button class="secondary" @click="state.confirmImages">确认全部图片</button>
              <button class="secondary" @click="state.confirmAll">确认全部课评</button>
              <button class="secondary" @click="state.generateSharePages">发布展示页</button>
            </div>
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
        <button v-if="state.currentStep < state.steps.length - 1" class="primary" @click="state.nextStep">下一步</button>
        <button v-else class="primary" :disabled="state.isProcessing || state.currentWarnings.length" @click="state.archiveAll">完成本班交付</button>
      </footer>
    </template>
  </section>
</template>
