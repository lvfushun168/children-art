<script setup>
import { computed, ref, watch } from 'vue'
import TaskReport from './TaskReport.vue'
import DeliveryPreview from './DeliveryPreview.vue'
import StudentDeliveryBoard from './StudentDeliveryBoard.vue'
import ProtectedMedia from '../common/ProtectedMedia.vue'
import { sameId } from '../../services/mappers'
import { MATERIAL_CATEGORIES } from '../../services/materialTypes'

const props = defineProps({
  state: {
    type: Object,
    required: true
  }
})

defineEmits(['navigate', 'back'])

const showResourceDrawer = ref(false)
const showContentSettings = ref(false)
const showArtworkLibrary = ref(false)
const artworkLibraryCategory = ref(MATERIAL_CATEGORIES.DEMO)
const materialReplaceInput = ref(null)
const replaceTarget = ref(null)
const showSharePreview = ref(false)
const studentDeliveryDrawerOpen = ref(false)
const studentDeliveryMobileDetailOpen = ref(false)
const resourceSearch = ref('')
const resourceFilter = ref('全部')
const attendanceOptions = ['到课', '请假', '旷课']
const resolveStateValue = (value) => value?.value ?? value
const materialSections = computed(() => {
  const materials = resolveStateValue(props.state.materials) || []
  return [
    {
      key: 'demo',
      title: '范画',
      description: '本节课的示范作品',
      category: MATERIAL_CATEGORIES.DEMO,
      uploadLabel: '上传范画',
      accept: 'image/*',
      empty: '尚未上传范画',
      kind: 'image',
      library: true,
      materials: materials.filter((item) => item.type === '范画')
    },
    {
      key: 'step',
      title: '步骤图',
      description: '本节课的绘画步骤',
      category: MATERIAL_CATEGORIES.STEP,
      uploadLabel: '上传步骤图',
      accept: 'image/*',
      empty: '尚未上传步骤图',
      kind: 'image',
      library: true,
      materials: materials.filter((item) => item.type === '步骤图')
    },
    {
      key: 'classroom',
      title: '课堂记录',
      description: '课堂照片和课堂视频',
      category: MATERIAL_CATEGORIES.CLASSROOM,
      uploadLabel: '添加课堂记录',
      accept: 'image/*,video/*',
      empty: '尚未添加课堂记录',
      kind: 'media',
      library: false,
      materials: materials.filter((item) => ['课堂照片', '课堂视频'].includes(item.type))
    },
    {
      key: 'courseware',
      title: '课件',
      description: '仅内部归档，供后续复用',
      category: MATERIAL_CATEGORIES.COURSEWARE,
      uploadLabel: '上传课件',
      accept: '',
      empty: '尚未上传课件',
      kind: 'file',
      library: false,
      materials: materials.filter((item) => item.type === '课件')
    }
  ]
})
const filteredArtworkLibrary = computed(() => {
  const library = resolveStateValue(props.state.artworkLibrary) || []
  return library.filter((item) => item.type === artworkLibraryCategory.value)
})
const replaceAccept = computed(() => replaceTarget.value?.category === MATERIAL_CATEGORIES.CLASSROOM ? 'image/*,video/*' : 'image/*')
const resourceFilterOptions = computed(() => [
  '全部',
  '同主题',
  '最近使用',
  ...Array.from(new Set(props.state.externalLinks.map((link) => link.platform))).filter(Boolean)
])
const studentFor = (studentId) => {
  const activeStudent = props.state.students.find((item) => sameId(item.id, studentId))
  if (activeStudent) return activeStudent
  const sessionStudent = props.state.sessionStudents?.find((item) => sameId(item.studentId, studentId))
  return sessionStudent ? { name: sessionStudent.studentName || '学生', parent: sessionStudent.parent || '' } : { name: '学生', parent: '' }
}
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
const openArtworkLibrary = (category) => {
  artworkLibraryCategory.value = category
  showArtworkLibrary.value = true
}
const openMaterialReplace = (material, category) => {
  replaceTarget.value = { material, category }
  const trigger = () => materialReplaceInput.value?.click()
  if (typeof window !== 'undefined' && window.requestAnimationFrame) window.requestAnimationFrame(trigger)
  else trigger()
}
const handleMaterialReplace = async (event) => {
  const file = event.target.files?.[0]
  const target = replaceTarget.value
  event.target.value = ''
  replaceTarget.value = null
  if (!file || !target) return
  await props.state.replaceLessonMaterial(target.material, file, target.category)
}
watch(() => props.state.activeTask.id, () => {
  showResourceDrawer.value = false
  showContentSettings.value = false
  showArtworkLibrary.value = false
  artworkLibraryCategory.value = MATERIAL_CATEGORIES.DEMO
  replaceTarget.value = null
  showSharePreview.value = false
  resourceSearch.value = ''
  resourceFilter.value = '全部'
  studentDeliveryDrawerOpen.value = false
  studentDeliveryMobileDetailOpen.value = false
})

watch(() => props.state.currentStep, (step) => {
  if (step !== 2) {
    studentDeliveryDrawerOpen.value = false
    studentDeliveryMobileDetailOpen.value = false
  }
})
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
        <small v-if="state.activeTask.topic" class="lesson-topic-line">本次课题：{{ state.activeTask.topic }}</small>
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
            <strong>{{ studentFor(row.studentId).name }}<em v-if="row.studentArchived" class="archived-reference">（已归档）</em></strong>
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
            <strong>整理本节课的课堂素材</strong>
          </div>
        </div>

        <section class="classroom-materials-board">
          <article
            v-for="section in materialSections"
            :key="section.key"
            class="material-lane material-section-card"
            :class="{ 'material-section-card--wide': section.kind !== 'image' }"
          >
            <header class="material-section-head">
              <div class="material-section-title">
                <div class="material-section-title-row">
                  <div class="material-section-heading">
                    <span>课堂素材</span>
                    <strong>{{ section.title }}</strong>
                  </div>
                  <div class="material-section-actions">
                    <label class="file-button material-upload-button">
                      <span aria-hidden="true">＋</span>{{ section.uploadLabel }}
                      <input type="file" :accept="section.accept || undefined" multiple @change="state.uploadLessonMaterial($event, section.category)" />
                    </label>
                    <button v-if="section.library && state.artworkLibrary.length" class="secondary" type="button" @click="openArtworkLibrary(section.category)">
                      从备课素材库选择
                    </button>
                  </div>
                </div>
                <small>{{ section.materials.length }} 个文件 · {{ section.description }}</small>
              </div>
            </header>

            <div v-if="section.kind === 'file'" class="courseware-list material-file-list">
              <label v-if="!section.materials.length" class="material-add-tile material-add-tile--file">
                <span class="material-add-icon" aria-hidden="true">＋</span>
                <strong>{{ section.uploadLabel }}</strong>
                <small>点击选择文件</small>
                <input type="file" :accept="section.accept || undefined" multiple @change="state.uploadLessonMaterial($event, section.category)" />
              </label>
              <article v-for="material in section.materials" :key="material.id" class="courseware-file-card">
                <span class="courseware-file-type">{{ material.fileExt ? material.fileExt.toUpperCase() : material.file?.extension?.toUpperCase() || '文件' }}</span>
                <div>
                  <strong>{{ material.title || material.file?.originalFilename || '未命名课件' }}</strong>
                  <small>仅内部归档</small>
                </div>
                <button class="material-remove-icon" type="button" :aria-label="`删除${material.title || '课件'}`" @click="state.removeLessonMaterial(material)">×</button>
              </article>
            </div>

            <div v-else class="material-card-grid">
              <label v-if="!section.materials.length" class="material-add-tile">
                <span class="material-add-icon" aria-hidden="true">＋</span>
                <strong>{{ section.uploadLabel }}</strong>
                <small>点击选择文件</small>
                <input type="file" :accept="section.accept || undefined" multiple @change="state.uploadLessonMaterial($event, section.category)" />
              </label>
              <article v-for="material in section.materials" :key="material.id" class="material-media-card" :class="{ hidden: !material.visible }">
                <div class="material-visual">
                  <button v-if="material.type !== '课堂视频'" class="material-replace-trigger" type="button" @click="openMaterialReplace(material, section.category)">
                    <ProtectedMedia :file-id="material.fileId" :src="material.image" :alt="material.title" />
                    <span>点击替换</span>
                  </button>
                  <div v-else class="material-video-frame">
                    <ProtectedMedia tag="video" :file-id="material.fileId" :src="material.image" controls preload="metadata" :aria-label="material.title" />
                    <button class="material-video-replace" type="button" @click="openMaterialReplace(material, section.category)">替换</button>
                  </div>
                  <button class="material-remove-icon" type="button" :aria-label="`删除${material.title || section.title}`" @click="state.removeLessonMaterial(material)">×</button>
                </div>
                <div class="material-card-copy">
                  <div class="material-card-title">
                    <span>{{ material.type }}</span>
                    <strong>{{ material.title || '未命名素材' }}</strong>
                  </div>
                  <label class="material-visibility-switch">
                    <input type="checkbox" :checked="material.visible" @change="state.toggleMaterialVisible(material)" />
                    <span class="switch-track" aria-hidden="true"><span></span></span>
                    <span>家长可见</span>
                  </label>
                  <small>{{ material.visible ? '将显示在家长展示页' : '仅保存到内部档案' }}</small>
                </div>
              </article>
            </div>
          </article>

          <div v-if="!state.counts.classroomMaterials" class="no-material-confirm">
            <button class="ghost" :class="{ selected: state.materialsConfirmedEmpty }" @click="state.confirmNoLessonMaterials">
              {{ state.materialsConfirmedEmpty ? '已确认本节无资料' : '本节无资料' }}
            </button>
          </div>
        </section>

        <input ref="materialReplaceInput" class="visually-hidden" type="file" :accept="replaceAccept" @change="handleMaterialReplace" />

        <div v-if="showArtworkLibrary" class="drawer-backdrop" @click.self="showArtworkLibrary = false">
          <aside class="library-drawer">
            <header class="drawer-head">
              <div>
                <span>备课素材库</span>
                <strong>选择{{ artworkLibraryCategory }}</strong>
                <small>{{ filteredArtworkLibrary.length }} 项素材</small>
              </div>
              <button class="ghost" type="button" @click="showArtworkLibrary = false">关闭</button>
            </header>
            <section class="library-drawer-list">
            <article v-for="item in filteredArtworkLibrary" :key="item.id" :class="{ selected: state.materials.some((material) => sameId(material.libraryId, item.id)) }">
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
              <small v-if="!filteredArtworkLibrary.length" class="empty-note">当前板块暂无可引用的备课素材。</small>
            </section>
          </aside>
        </div>
      </section>

      <section v-if="state.currentStep === 2" class="step-panel">
        <StudentDeliveryBoard
          :state="state"
          @drawer-state="studentDeliveryDrawerOpen = $event"
          @mobile-detail-state="studentDeliveryMobileDetailOpen = $event"
        />
      </section>

      <section v-if="state.currentStep === 3" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 4 步</span>
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
            <div class="switch-row"><label><input v-model="state.displayConfig.showMaterials" type="checkbox" /> 展示课堂素材</label><label><input v-model="state.displayConfig.showHomework" type="checkbox" /> 展示课后任务</label><label><input v-model="state.displayConfig.showHighlight" type="checkbox" /> 展示高光说明</label><label><input v-model="state.displayConfig.showLessonType" type="checkbox" /> 展示课次类型</label></div>
          </details>
        </section>

        <div v-if="showResourceDrawer" class="drawer-backdrop" @click.self="showResourceDrawer = false">
          <aside class="library-drawer resource-drawer">
            <header class="drawer-head">
              <div>
                <span>延伸资源</span>
                <strong>选择课后任务附件</strong>
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
              </div>
              <button class="ghost" @click="showSharePreview = false">关闭</button>
            </header>
            <div class="student-tabs review-student-tabs">
              <button v-for="row in state.attendingRows" :key="`${row.lessonId}-${row.studentId}`" :class="{ selected: sameId(row.studentId, state.activeStudentId) }" @click="state.activeStudentId = row.studentId">
                {{ studentFor(row.studentId).name }}<em v-if="row.studentArchived" class="archived-reference">（已归档）</em>
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

      <section v-if="state.currentStep === 4" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 5 步</span>
            <strong>提交归档与交付收口</strong>
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
                      <strong>{{ studentFor(row.studentId).name }}<em v-if="row.studentArchived" class="archived-reference">（已归档）</em></strong>
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

      <footer v-if="state.currentStep !== 2 || (!studentDeliveryDrawerOpen && !studentDeliveryMobileDetailOpen)" class="wizard-actions">
        <button class="ghost" :disabled="state.currentStep === 0" @click="state.prevStep">上一步</button>
        <button v-if="state.currentStep < state.steps.length - 1" class="primary" :disabled="state.currentStep === 2 && state.counts.studentDeliveryCompleted < state.counts.attend" @click="state.nextStep">下一步</button>
        <button v-else class="primary" :disabled="state.isProcessing || state.currentWarnings.length" @click="state.archiveAll">完成归档交付</button>
      </footer>
    </template>
  </section>
</template>
