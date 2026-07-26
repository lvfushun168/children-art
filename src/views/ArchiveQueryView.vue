<script setup>
import { computed, reactive, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'
import DateRangeFilter from '../components/archive/DateRangeFilter.vue'

const props = defineProps({
  state: {
    type: Object,
    required: true
  },
  groupLabel: {
    type: String,
    default: ''
  }
})

defineEmits(['backToGroup'])

const archiveTabs = [
  { id: 'studentWorks', label: '学生作品档案' },
  { id: 'lessons', label: '课堂资料档案' },
  { id: 'teacherEffects', label: '老师课效档案' }
]

const activeTab = ref('home')
const selectedId = ref(props.state.filteredArchiveRecords[0]?.id || null)
const selectedRecordIds = ref([])
const selectedLessonId = ref(props.state.lessonArchiveRecords[0]?.id || null)
const selectedEffectId = ref(props.state.teacherEffectArchiveRecords[0]?.id || null)
const showCollectionModal = ref(false)
const showWorkDrawer = ref(false)
const showLessonDrawer = ref(false)
const showEffectDrawer = ref(false)
const createdCollection = ref(null)
const isEditingWork = ref(false)
const workEditError = ref('')
const initialWorkDraft = ref('')
const wasFramed = ref(false)
const lessonFilter = reactive({ classId: 'all', teacher: 'all', dateStart: '', dateEnd: '' })
const effectFilter = reactive({ teacher: 'all', classId: 'all', dateStart: '', dateEnd: '' })
const workDraft = reactive({
  title: '',
  description: '',
  tagsText: '',
  note: '',
  highlight: false,
  highlightNote: '',
  framed: false,
  framedAt: '',
  frameFee: 0,
  framerKey: '',
  externalFramerName: '',
  frameNote: '',
  changeReason: ''
})
const collectionDraft = reactive({
  type: '学生成长作品集',
  title: '',
  target: '',
  intro: '',
  summary: '',
  teacherMessage: '',
  note: '',
  showDate: true,
  showCourse: true,
  showComment: false,
  showHighlight: true,
  showWatermark: true
})

const selected = computed(() => props.state.filteredArchiveRecords.find((record) => record.id === selectedId.value) || props.state.filteredArchiveRecords[0])
const selectedRecords = computed(() => selectedRecordIds.value.map((id) => props.state.archiveRecords.find((record) => record.id === id)).filter(Boolean))
const selectedCollections = computed(() => (selected.value ? props.state.archiveCollectionsForRecord(selected.value.id) : []))
const selectedWorkLogs = computed(() => (selected.value ? props.state.archiveEditLogsForRecord(selected.value.id) : []))
const canEditSelectedWork = computed(() => props.state.canEditArchiveRecord(selected.value))
const hasUnsavedWorkChanges = computed(() => isEditingWork.value && JSON.stringify(workDraft) !== initialWorkDraft.value)
const selectedFilterStudent = computed(() =>
  props.state.archiveFilter.studentId === 'all' ? null : props.state.students.find((student) => student.id === Number(props.state.archiveFilter.studentId))
)
const visibleSelectedCount = computed(() => props.state.filteredArchiveRecords.filter((record) => selectedRecordIds.value.includes(record.id)).length)
const allVisibleSelected = computed(() => props.state.filteredArchiveRecords.length > 0 && visibleSelectedCount.value === props.state.filteredArchiveRecords.length)
const canCreateStudentGrowth = computed(() =>
  Boolean(selectedFilterStudent.value && selectedRecords.value.length && selectedRecords.value.every((record) => record.studentId === selectedFilterStudent.value.id))
)
const canPublishCollection = computed(() => Boolean(canCreateStudentGrowth.value && collectionDraft.title && collectionDraft.target))
const isWithinDateRange = (value, start, end) =>
  Boolean(value && (!start || value >= start) && (!end || value <= end))

const filteredLessonArchives = computed(() =>
  props.state.lessonArchiveRecords.filter((lesson) => {
    const classOk = lessonFilter.classId === 'all' || lesson.classId === Number(lessonFilter.classId)
    const teacherOk = lessonFilter.teacher === 'all' || lesson.teacher === lessonFilter.teacher
    const dateOk = isWithinDateRange(lesson.dateValue, lessonFilter.dateStart, lessonFilter.dateEnd)
    return classOk && teacherOk && dateOk
  })
)
const selectedLesson = computed(() => filteredLessonArchives.value.find((lesson) => lesson.id === selectedLessonId.value) || filteredLessonArchives.value[0])
const selectedLessonAssets = computed(() => selectedLesson.value?.materials || [])
const selectedLessonWorks = computed(() => selectedLesson.value?.studentWorks || [])

const filteredTeacherEffects = computed(() =>
  props.state.teacherEffectArchiveRecords.filter((effect) => {
    const classOk = effectFilter.classId === 'all' || effect.sourceLesson.classId === Number(effectFilter.classId)
    const teacherOk = effectFilter.teacher === 'all' || effect.teacher === effectFilter.teacher
    const dateOk = isWithinDateRange(effect.dateValue, effectFilter.dateStart, effectFilter.dateEnd)
    return classOk && teacherOk && dateOk
  })
)
const selectedEffect = computed(() => filteredTeacherEffects.value.find((effect) => effect.id === selectedEffectId.value) || filteredTeacherEffects.value[0])

const archiveStats = computed(() => ({
  works: props.state.archiveRecords.length,
  lessons: props.state.lessonArchiveRecords.length,
  effects: props.state.teacherEffectArchiveRecords.length
}))
const activeArchive = computed(() => archiveTabs.find((tab) => tab.id === activeTab.value))
const teacherFilterOptions = computed(() => [
  { label: '全部老师', value: 'all' },
  ...props.state.teachers.filter((item) => item.role === '老师').map((teacher) => ({ label: teacher.name, value: teacher.name }))
])
const classFilterOptions = computed(() => [
  { label: '全部班级', value: 'all' },
  ...props.state.classes.map((klass) => ({ label: klass.name, value: klass.id }))
])
const studentFilterOptions = computed(() => [
  { label: '全部学生', value: 'all' },
  ...props.state.students.map((student) => ({ label: student.name, value: student.id }))
])
const frameStatusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '已装裱', value: 'framed' },
  { label: '未装裱', value: 'unframed' }
]
const framerOptions = computed(() => [
  { label: '请选择', value: '' },
  ...props.state.teachers
    .filter((item) => item.status === '启用')
    .map((staff) => ({ label: `${staff.name} · ${staff.role}`, value: `staff:${staff.id}` })),
  { label: '其他人员或外部机构', value: 'external' }
])

const archiveCountFor = (id) => {
  if (id === 'studentWorks') return `${archiveStats.value.works} 条学生作品`
  if (id === 'lessons') return `${archiveStats.value.lessons} 节课堂档案`
  return `${archiveStats.value.effects} 张课效长图`
}

watch(filteredLessonArchives, (records) => {
  if (!records.some((record) => record.id === selectedLessonId.value)) selectedLessonId.value = records[0]?.id || null
}, { immediate: true })

watch(filteredTeacherEffects, (records) => {
  if (!records.some((record) => record.id === selectedEffectId.value)) selectedEffectId.value = records[0]?.id || null
}, { immediate: true })

const selectFirstIfMissing = () => {
  if (!props.state.filteredArchiveRecords.some((record) => record.id === selectedId.value)) {
    selectedId.value = props.state.filteredArchiveRecords[0]?.id || null
  }
  const visibleIds = props.state.filteredArchiveRecords.map((record) => record.id)
  selectedRecordIds.value = selectedRecordIds.value.filter((id) => visibleIds.includes(id))
}

const toggleRecord = (record) => {
  selectedId.value = record.id
  selectedRecordIds.value = selectedRecordIds.value.includes(record.id)
    ? selectedRecordIds.value.filter((id) => id !== record.id)
    : [...selectedRecordIds.value, record.id]
}

const toggleAllVisible = () => {
  const visibleIds = props.state.filteredArchiveRecords.map((record) => record.id)
  if (allVisibleSelected.value) {
    selectedRecordIds.value = selectedRecordIds.value.filter((id) => !visibleIds.includes(id))
    return
  }
  selectedRecordIds.value = [...new Set([...selectedRecordIds.value, ...visibleIds])]
}

const openWorkDrawer = (record) => {
  selectedId.value = record.id
  isEditingWork.value = false
  workEditError.value = ''
  showWorkDrawer.value = true
}

const loadWorkDraft = () => {
  if (!selected.value) return
  const record = selected.value
  Object.assign(workDraft, {
    title: record.title || `${record.studentName}的${record.course}`,
    description: record.description || '',
    tagsText: (record.tags || []).join('、'),
    note: record.note || '',
    highlight: Boolean(record.highlight),
    highlightNote: record.highlightNote || '',
    framed: Boolean(record.framed),
    framedAt: record.framedAt || '',
    frameFee: record.frameFee ?? 0,
    framerKey: record.framerId ? `staff:${record.framerId}` : record.framerName ? 'external' : '',
    externalFramerName: record.framerId ? '' : record.framerName || '',
    frameNote: record.frameNote || '',
    changeReason: ''
  })
  wasFramed.value = Boolean(record.framed)
  initialWorkDraft.value = JSON.stringify(workDraft)
  workEditError.value = ''
}

const startWorkEdit = () => {
  if (!canEditSelectedWork.value) return
  loadWorkDraft()
  isEditingWork.value = true
}

const cancelWorkEdit = () => {
  if (hasUnsavedWorkChanges.value && !window.confirm('尚有未保存的修改，确定放弃吗？')) return
  isEditingWork.value = false
  workEditError.value = ''
}

const closeWorkDrawer = () => {
  if (hasUnsavedWorkChanges.value && !window.confirm('尚有未保存的修改，确定关闭吗？')) return
  isEditingWork.value = false
  workEditError.value = ''
  showWorkDrawer.value = false
}

const saveWorkEdit = () => {
  workEditError.value = ''
  if (!workDraft.title.trim()) {
    workEditError.value = '请填写作品标题。'
    return
  }
  if (workDraft.framed) {
    if (!workDraft.framedAt) {
      workEditError.value = '请填写装裱日期。'
      return
    }
    if (workDraft.frameFee === '' || Number(workDraft.frameFee) < 0) {
      workEditError.value = '请填写有效的装裱费用，费用可以为 0。'
      return
    }
    if (!workDraft.framerKey) {
      workEditError.value = '请选择装裱人。'
      return
    }
    if (workDraft.framerKey === 'external' && !workDraft.externalFramerName.trim()) {
      workEditError.value = '请填写外部装裱人或机构名称。'
      return
    }
  }
  if (wasFramed.value && !workDraft.framed && !workDraft.changeReason.trim()) {
    workEditError.value = '取消既有装裱状态时必须填写更正原因。'
    return
  }

  const staffId = workDraft.framerKey.startsWith('staff:') ? Number(workDraft.framerKey.split(':')[1]) : null
  const staff = props.state.teachers.find((item) => item.id === staffId)
  const saved = props.state.updateArchiveRecord(selected.value.id, {
    title: workDraft.title,
    description: workDraft.description,
    tags: workDraft.tagsText.split(/[，,、]/),
    note: workDraft.note,
    highlight: workDraft.highlight,
    highlightNote: workDraft.highlightNote,
    framed: workDraft.framed,
    framedAt: workDraft.framedAt,
    frameFee: workDraft.frameFee,
    framerId: staffId,
    framerName: staff?.name || workDraft.externalFramerName,
    frameNote: workDraft.frameNote,
    changeReason: workDraft.changeReason
  })
  if (!saved) return
  isEditingWork.value = false
  initialWorkDraft.value = ''
}

const openLessonDrawer = (lesson) => {
  selectedLessonId.value = lesson.id
  showLessonDrawer.value = true
}

const openEffectDrawer = (effect) => {
  selectedEffectId.value = effect.id
  showEffectDrawer.value = true
}

const openCollectionModal = () => {
  if (!canCreateStudentGrowth.value) return
  const first = selectedRecords.value[0]
  collectionDraft.type = '学生成长作品集'
  collectionDraft.title = `${first.studentName} · 高光成长作品集`
  collectionDraft.target = `${first.studentName}家长`
  collectionDraft.intro = `这是${first.studentName}这段时间在美术课上的高光作品记录。`
  collectionDraft.summary = ''
  collectionDraft.teacherMessage = '继续保持这份观察和表达的热情，期待下个阶段看到更多属于自己的画面。'
  collectionDraft.note = ''
  collectionDraft.showDate = true
  collectionDraft.showCourse = true
  collectionDraft.showComment = false
  collectionDraft.showHighlight = true
  collectionDraft.showWatermark = true
  createdCollection.value = null
  showCollectionModal.value = true
}

const generateCollectionCopy = () => {
  if (!selectedRecords.value.length) return
  const first = selectedRecords.value[0]
  const courses = [...new Set(selectedRecords.value.map((record) => record.course))]
  const highlights = selectedRecords.value.map((record) => record.highlightNote).filter(Boolean)
  collectionDraft.intro = `${first.studentName}这段时间完成了 ${selectedRecords.value.length} 件值得记录的作品，老师把其中最能体现成长变化的部分整理成这份作品集。`
  collectionDraft.summary = `从${courses.join('、')}等主题中可以看到，${first.studentName}在画面组织、色彩表达和细节完整度上都有持续积累。${highlights[0] || '作品中保留了清晰的课堂目标和个人表达。'}`
  collectionDraft.teacherMessage = '谢谢家长一直配合课堂后的观察和鼓励，接下来我们会继续关注画面层次、表达完整度和孩子自己的创作想法。'
}

const publishCollection = () => {
  if (!canPublishCollection.value) return
  createdCollection.value = props.state.createArchiveCollection({
    ...collectionDraft,
    recordIds: selectedRecordIds.value
  })
}

const assetMeta = (asset) => {
  if (asset.fileName) return `${asset.fileName}${asset.fileExt ? ` · ${asset.fileExt.toUpperCase()}` : ''}`
  return asset.visible ? '家长展示页可见' : '仅内部归档'
}

const formatFrameFee = (value) => `¥${Number(value || 0).toFixed(2)}`
</script>

<template>
  <button v-if="activeTab === 'home' && groupLabel" class="module-back-link" type="button" @click="$emit('backToGroup')">← 返回{{ groupLabel }}</button>

  <PageHead title="档案中心" />

  <section v-if="activeTab === 'home'" class="archive-home panel">
    <button
      v-for="tab in archiveTabs"
      :key="tab.id"
      class="archive-entry-card"
      @click="activeTab = tab.id"
    >
      <span>
        <strong>{{ tab.label }}</strong>
      </span>
      <em>{{ archiveCountFor(tab.id) }}</em>
    </button>
  </section>

  <section v-else class="archive-subpage-head panel">
    <button class="ghost" @click="activeTab = 'home'">返回档案中心</button>
    <div>
      <strong>{{ activeArchive?.label }}</strong>
    </div>
  </section>

  <section v-if="activeTab === 'studentWorks'" class="archive-workspace-layout">
    <section class="archive-filter-bar panel">
      <div class="section-head">
        <div>
          <span>学生作品档案</span>
          <strong>{{ state.filteredArchiveRecords.length }} 条记录</strong>
        </div>
      </div>
      <div class="archive-filter-fields student-work-filter-fields">
        <label>
          学生
          <AdaptiveSelect v-model="state.archiveFilter.studentId" :options="studentFilterOptions" @change="selectFirstIfMissing" />
        </label>
        <label>
          班级
          <AdaptiveSelect v-model="state.archiveFilter.classId" :options="classFilterOptions" @change="selectFirstIfMissing" />
        </label>
        <label>
          老师
          <AdaptiveSelect v-model="state.archiveFilter.teacher" :options="teacherFilterOptions" @change="selectFirstIfMissing" />
        </label>
        <label>
          装裱状态
          <AdaptiveSelect v-model="state.archiveFilter.frameStatus" :options="frameStatusOptions" @change="selectFirstIfMissing" />
        </label>
        <label class="archive-check">
          <input v-model="state.archiveFilter.highlightOnly" type="checkbox" @change="selectFirstIfMissing" />
          <span>只看高光作品</span>
        </label>
      </div>
      <DateRangeFilter
        v-model:start="state.archiveFilter.dateStart"
        v-model:end="state.archiveFilter.dateEnd"
        @change="selectFirstIfMissing"
      />
    </section>

    <section class="archive-results panel">
      <div class="section-head">
        <div>
          <span>归档记录</span>
          <strong>{{ state.filteredArchiveRecords.length }} 条</strong>
        </div>
        <button class="ghost" :disabled="!state.filteredArchiveRecords.length" @click="toggleAllVisible">
          {{ allVisibleSelected ? '取消全选' : '全选当前结果' }}
        </button>
      </div>
      <div v-if="selectedRecordIds.length" class="archive-selection-bar">
        <strong>已选 {{ selectedRecordIds.length }} 件作品</strong>
        <button v-if="canCreateStudentGrowth" class="primary" @click="openCollectionModal">生成{{ selectedFilterStudent.name }}的成长集</button>
      </div>
      <article
        v-for="record in state.filteredArchiveRecords"
        :key="record.id"
        class="archive-row"
        :class="{ active: selected?.id === record.id, picked: selectedRecordIds.includes(record.id) }"
        @click="openWorkDrawer(record)"
      >
        <label class="archive-pick" @click.stop>
          <input type="checkbox" :checked="selectedRecordIds.includes(record.id)" @change="toggleRecord(record)" />
        </label>
        <img :src="record.artwork" :alt="record.studentName" />
        <span>
          <strong>{{ record.title || `${record.studentName} · ${record.course}` }}</strong>
          <small>{{ record.date }} {{ record.time }} · {{ record.className }} · {{ record.teacher }}</small>
          <em v-if="record.highlight">高光作品</em>
          <em v-if="record.framed" class="framed-tag">已装裱</em>
          <em v-if="record.collectionIds?.length" class="collection-tag">已入选作品集</em>
        </span>
      </article>
      <div v-if="!state.filteredArchiveRecords.length" class="notice-box">
        <small>没有符合条件的归档记录。</small>
      </div>
    </section>

  </section>

  <section v-if="activeTab === 'lessons'" class="archive-workspace-layout lesson-archive-layout">
    <section class="archive-filter-bar panel">
      <div class="section-head">
        <div>
          <span>课堂资料档案</span>
          <strong>{{ filteredLessonArchives.length }} 节课</strong>
        </div>
      </div>
      <div class="archive-filter-fields compact-archive-filter-fields">
        <label>
          班级
          <AdaptiveSelect v-model="lessonFilter.classId" :options="classFilterOptions" />
        </label>
        <label>
          老师
          <AdaptiveSelect v-model="lessonFilter.teacher" :options="teacherFilterOptions" />
        </label>
      </div>
      <DateRangeFilter
        v-model:start="lessonFilter.dateStart"
        v-model:end="lessonFilter.dateEnd"
      />
    </section>

    <section class="archive-results panel">
      <div class="section-head">
        <div>
          <span>课堂记录</span>
          <strong>{{ filteredLessonArchives.length }} 节</strong>
        </div>
      </div>
      <button
        v-for="lesson in filteredLessonArchives"
        :key="lesson.id"
        class="lesson-archive-row"
        :class="{ active: selectedLesson?.id === lesson.id }"
        @click="openLessonDrawer(lesson)"
      >
        <span>
          <strong>{{ lesson.date }} {{ lesson.time }} · {{ lesson.course }}</strong>
          <small>{{ lesson.className }}（{{ lesson.classType }}） · {{ lesson.teacher }} · {{ lesson.lessonType }}</small>
        </span>
        <div>
          <em>{{ lesson.materials.length }} 份资料</em>
          <small>{{ lesson.worksCount }} 件作品 · {{ lesson.highlights }} 个高光</small>
        </div>
      </button>
      <div v-if="!filteredLessonArchives.length" class="notice-box">
        <small>没有符合条件的课堂档案。</small>
      </div>
    </section>

  </section>

  <section v-if="activeTab === 'teacherEffects'" class="archive-workspace-layout teacher-effect-layout">
    <section class="archive-filter-bar panel">
      <div class="section-head">
        <div>
          <span>老师课效档案</span>
          <strong>{{ filteredTeacherEffects.length }} 张长图</strong>
        </div>
      </div>
      <div class="archive-filter-fields compact-archive-filter-fields">
        <label>
          老师
          <AdaptiveSelect v-model="effectFilter.teacher" :options="teacherFilterOptions" />
        </label>
        <label>
          班级
          <AdaptiveSelect v-model="effectFilter.classId" :options="classFilterOptions" />
        </label>
      </div>
      <DateRangeFilter
        v-model:start="effectFilter.dateStart"
        v-model:end="effectFilter.dateEnd"
      />
    </section>

    <section class="archive-results panel">
      <div class="section-head">
        <div>
          <span>课效长图</span>
          <strong>{{ filteredTeacherEffects.length }} 条</strong>
        </div>
      </div>
      <button
        v-for="effect in filteredTeacherEffects"
        :key="effect.id"
        class="lesson-archive-row"
        :class="{ active: selectedEffect?.id === effect.id }"
        @click="openEffectDrawer(effect)"
      >
        <span>
          <strong>{{ effect.title }}</strong>
          <small>{{ effect.teacher }} · {{ effect.className }}（{{ effect.classType }}）</small>
        </span>
        <div>
          <em>{{ effect.status }}</em>
          <small>{{ effect.imageCount }} 张图片</small>
        </div>
      </button>
      <div v-if="!filteredTeacherEffects.length" class="notice-box">
        <small>暂无符合条件的老师课效档案。</small>
      </div>
    </section>

  </section>

  <div v-if="showWorkDrawer && selected" class="archive-drawer-backdrop" @click.self="closeWorkDrawer">
    <aside class="archive-drawer" role="dialog" aria-modal="true" aria-label="作品归档详情">
      <header class="archive-drawer-head">
        <div>
          <span>{{ isEditingWork ? '编辑作品档案' : '作品归档详情' }}</span>
          <strong>{{ selected.title || `${selected.studentName} · ${selected.course}` }}</strong>
        </div>
        <div class="archive-drawer-actions">
          <button v-if="!isEditingWork && canEditSelectedWork" class="primary" @click="startWorkEdit">编辑</button>
          <button class="ghost" @click="closeWorkDrawer">关闭</button>
        </div>
      </header>
      <figure class="archive-image-readonly">
        <img class="archive-main-image" :src="selected.artwork" :alt="selected.studentName" />
        <figcaption>归档原图 · 只读</figcaption>
      </figure>
      <section class="archive-detail-group">
        <span>课次信息</span>
        <div class="archive-meta">
          <span><small>学生</small><strong>{{ selected.studentName }}</strong></span>
          <span><small>课程</small><strong>{{ selected.course }}</strong></span>
          <span><small>上课时间</small><strong>{{ selected.date }} {{ selected.time }}</strong></span>
          <span><small>班级</small><strong>{{ selected.className }}</strong></span>
          <span><small>任课老师</small><strong>{{ selected.teacher }}</strong></span>
          <span><small>课次类型</small><strong>{{ selected.lessonType }}</strong></span>
        </div>
      </section>
      <template v-if="isEditingWork">
        <section class="archive-detail-group archive-edit-section">
          <span>作品档案信息</span>
          <div class="form-grid archive-edit-grid">
            <label class="wide">作品标题<input v-model="workDraft.title" /></label>
            <label class="wide">作品说明<textarea v-model="workDraft.description" rows="3" /></label>
            <label class="wide">标签<input v-model="workDraft.tagsText" placeholder="使用逗号或顿号分隔" /></label>
            <label class="wide">档案备注<textarea v-model="workDraft.note" rows="3" /></label>
          </div>
        </section>
        <section class="archive-detail-group archive-edit-section">
          <span>高光信息</span>
          <label class="archive-toggle-row">
            <input v-model="workDraft.highlight" type="checkbox" />
            <span>标记为高光作品</span>
          </label>
          <label v-if="workDraft.highlight">高光说明<textarea v-model="workDraft.highlightNote" rows="3" /></label>
        </section>
        <section class="archive-detail-group archive-edit-section">
          <span>装裱信息</span>
          <label class="archive-toggle-row">
            <input v-model="workDraft.framed" type="checkbox" />
            <span>作品已装裱</span>
          </label>
          <div v-if="workDraft.framed" class="form-grid archive-edit-grid">
            <label>装裱日期<input v-model="workDraft.framedAt" type="date" /></label>
            <label>装裱费用（元）<input v-model="workDraft.frameFee" type="number" min="0" step="0.01" /></label>
            <label class="wide">
              装裱人
              <AdaptiveSelect v-model="workDraft.framerKey" :options="framerOptions" />
            </label>
            <label v-if="workDraft.framerKey === 'external'" class="wide">
              外部装裱人或机构
              <input v-model="workDraft.externalFramerName" />
            </label>
            <label class="wide">装裱备注<textarea v-model="workDraft.frameNote" rows="3" /></label>
          </div>
          <label v-if="wasFramed && !workDraft.framed" class="archive-correction-reason">
            更正原因
            <textarea v-model="workDraft.changeReason" rows="3" placeholder="请说明取消既有装裱状态的原因" />
          </label>
        </section>
      </template>
      <template v-else>
        <section class="archive-detail-group">
          <span>作品档案信息</span>
          <article class="archive-block">
            <strong>{{ selected.title || `${selected.studentName}的${selected.course}` }}</strong>
            <p>{{ selected.description || '暂无作品说明。' }}</p>
            <div v-if="selected.tags?.length" class="archive-tag-list">
              <em v-for="tag in selected.tags" :key="tag">{{ tag }}</em>
            </div>
            <small v-if="selected.note">备注：{{ selected.note }}</small>
          </article>
        </section>
        <section class="archive-detail-group">
          <span>装裱信息</span>
          <article v-if="selected.framed" class="archive-block framed">
            <strong>已装裱</strong>
            <div class="archive-frame-summary">
              <span><small>装裱日期</small><strong>{{ selected.framedAt }}</strong></span>
              <span><small>装裱费用</small><strong>{{ formatFrameFee(selected.frameFee) }}</strong></span>
              <span><small>装裱人</small><strong>{{ selected.framerName }}</strong></span>
            </div>
            <p v-if="selected.frameNote">{{ selected.frameNote }}</p>
          </article>
          <article v-else class="archive-block">
            <strong>未装裱</strong>
            <p>当前作品没有装裱记录。</p>
          </article>
        </section>
      </template>
      <section class="archive-detail-group">
        <span>本次交付内容 · 只读</span>
        <article class="archive-block">
          <strong>课评</strong>
          <p>{{ selected.feedback }}</p>
        </article>
        <article class="archive-block">
          <strong>课后任务</strong>
          <p>{{ selected.homework }}</p>
        </article>
        <article class="archive-block">
          <strong>家长展示页</strong>
          <p>{{ selected.shareUrl }}</p>
        </article>
      </section>
      <section v-if="!isEditingWork" class="archive-detail-group">
        <span>高光与复用</span>
        <article v-if="selected.highlight" class="archive-block highlight">
          <strong>高光说明</strong>
          <p>{{ selected.highlightNote }}</p>
        </article>
        <article v-else class="archive-block">
          <strong>高光状态</strong>
          <p>当前作品未标记为高光。</p>
        </article>
        <div v-if="selectedCollections.length" class="archive-collection-uses">
          <div v-for="collection in selectedCollections" :key="collection.id" class="archive-link-row">
            <strong>{{ collection.title }}</strong>
            <small>{{ collection.createdAt }} · {{ collection.target }}</small>
            <button class="ghost" @click="state.copyArchiveCollectionLink(collection)">复制链接</button>
          </div>
        </div>
      </section>
      <section v-if="!isEditingWork && (selected.updatedAt || selectedWorkLogs.length)" class="archive-detail-group">
        <span>变更记录</span>
        <article v-if="selected.updatedAt" class="archive-update-summary">
          <strong>最近更新</strong>
          <small>{{ selected.updatedBy }} · {{ selected.updatedAt }}</small>
        </article>
        <details v-if="selectedWorkLogs.length" class="archive-history">
          <summary>查看全部 {{ selectedWorkLogs.length }} 次修改</summary>
          <article v-for="log in selectedWorkLogs" :key="log.id">
            <header>
              <strong>{{ log.operator }}</strong>
              <small>{{ log.time }} · {{ log.reason }}</small>
            </header>
            <p v-for="change in log.changes" :key="change.field">
              {{ change.label }}：{{ change.before }} → {{ change.after }}
            </p>
          </article>
        </details>
      </section>
      <footer v-if="isEditingWork" class="archive-edit-actions">
        <p v-if="workEditError">{{ workEditError }}</p>
        <div>
          <button class="ghost" @click="cancelWorkEdit">取消</button>
          <button class="primary" @click="saveWorkEdit">保存修改</button>
        </div>
      </footer>
    </aside>
  </div>

  <div v-if="showLessonDrawer && selectedLesson" class="archive-drawer-backdrop" @click.self="showLessonDrawer = false">
    <aside class="archive-drawer lesson-archive-detail" role="dialog" aria-modal="true" aria-label="课堂完整档案">
      <header class="archive-drawer-head">
        <div>
          <span>课堂完整档案</span>
          <strong>{{ selectedLesson.className }} · {{ selectedLesson.course }}</strong>
        </div>
        <button class="ghost" @click="showLessonDrawer = false">关闭</button>
      </header>

      <section class="archive-overview-grid">
        <article><span>学生作品</span><strong>{{ selectedLesson.worksCount }}/{{ selectedLesson.studentWorks.length }}</strong></article>
        <article><span>资料文件</span><strong>{{ selectedLessonAssets.length }}</strong></article>
        <article><span>高光作品</span><strong>{{ selectedLesson.highlights }}</strong></article>
        <article><span>班级类型</span><strong>{{ selectedLesson.classType }}</strong></article>
      </section>

      <section class="archive-detail-group">
        <span>课次信息</span>
        <div class="archive-meta">
          <span>{{ selectedLesson.date }} {{ selectedLesson.time || '未记录时间' }}</span>
          <span>{{ selectedLesson.teacher }}</span>
          <span>{{ selectedLesson.className }}（{{ selectedLesson.classType }}）</span>
          <span>{{ selectedLesson.lessonType }}</span>
        </div>
      </section>

      <section class="archive-detail-group">
        <span>备课与课堂资料</span>
        <div v-if="selectedLessonAssets.length" class="lesson-asset-grid">
          <article v-for="asset in selectedLessonAssets" :key="asset.id">
            <img v-if="asset.image" :src="asset.image" :alt="asset.title" />
            <div v-else class="file-tile">{{ asset.fileExt || 'FILE' }}</div>
            <span>{{ asset.type }} · {{ asset.archiveRole }}</span>
            <strong>{{ asset.title }}</strong>
            <small>{{ assetMeta(asset) }}</small>
          </article>
        </div>
        <div v-else class="notice-box">
          <small>这节课暂无课堂资料记录。</small>
        </div>
      </section>

      <section class="archive-detail-group">
        <span>学生作品概览</span>
        <div class="lesson-work-grid">
          <article v-for="work in selectedLessonWorks" :key="work.id || work.studentId" :class="{ missing: !work.imageMatched }">
            <img v-if="work.artwork" :src="work.artwork" :alt="work.studentName" />
            <div v-else class="file-tile">缺图</div>
            <strong>{{ work.studentName }}</strong>
            <small>{{ work.course || selectedLesson.course }}</small>
            <em v-if="work.highlight">高光</em>
          </article>
        </div>
      </section>
    </aside>
  </div>

  <div v-if="showEffectDrawer && selectedEffect" class="archive-drawer-backdrop" @click.self="showEffectDrawer = false">
    <aside class="archive-drawer" role="dialog" aria-modal="true" aria-label="课效长图详情">
      <header class="archive-drawer-head">
        <div>
          <span>课效长图详情</span>
          <strong>{{ selectedEffect.teacher }} · {{ selectedEffect.course }}</strong>
        </div>
        <button class="ghost" @click="showEffectDrawer = false">关闭</button>
      </header>
      <section class="teacher-effect-preview">
        <div>
          <strong>{{ selectedEffect.title }}</strong>
        </div>
        <img v-if="selectedEffect.cover" :src="selectedEffect.cover" :alt="selectedEffect.title" />
        <div v-else class="file-tile">长图</div>
      </section>
      <section class="archive-detail-group">
        <span>归档信息</span>
        <div class="archive-meta">
          <span>{{ selectedEffect.date }} {{ selectedEffect.time || '' }}</span>
          <span>{{ selectedEffect.className }}（{{ selectedEffect.classType }}）</span>
          <span>{{ selectedEffect.teacher }}</span>
          <span>{{ selectedEffect.status }}</span>
        </div>
      </section>
      <section class="archive-detail-group">
        <span>百度网盘路径</span>
        <article class="archive-block">
          <p>{{ selectedEffect.cloudPath }}</p>
        </article>
      </section>
    </aside>
  </div>

  <div v-if="showCollectionModal" class="modal-backdrop">
    <section class="import-modal lesson-modal">
      <div class="modal-head">
        <div>
          <span>作品集发布</span>
          <strong>{{ createdCollection ? '链接已生成' : `已选 ${selectedRecords.length} 件作品` }}</strong>
        </div>
        <button class="ghost" @click="showCollectionModal = false">关闭</button>
      </div>
      <template v-if="!createdCollection">
        <section class="collection-context">
          <span>作品集对象</span>
          <strong>{{ selectedFilterStudent?.name }} · {{ selectedRecords.length }} 件作品</strong>
          <small>{{ selectedRecords[0]?.className }} · {{ collectionDraft.target }}</small>
        </section>
        <div class="form-grid">
          <label>发送对象<input v-model="collectionDraft.target" /></label>
          <label class="wide">标题<input v-model="collectionDraft.title" /></label>
          <label class="wide">开场说明<textarea v-model="collectionDraft.intro" rows="3" /></label>
          <label class="wide">成长总结<textarea v-model="collectionDraft.summary" rows="4" /></label>
          <label class="wide">老师寄语<textarea v-model="collectionDraft.teacherMessage" rows="3" /></label>
        </div>
        <div class="collection-copy-actions">
          <button class="ghost" @click="generateCollectionCopy">AI 生成说明</button>
        </div>
        <section class="collection-settings">
          <span>展示设置</span>
          <label><input v-model="collectionDraft.showDate" type="checkbox" /> 展示课程日期</label>
          <label><input v-model="collectionDraft.showCourse" type="checkbox" /> 展示课程主题</label>
          <label><input v-model="collectionDraft.showHighlight" type="checkbox" /> 展示高光说明</label>
          <label><input v-model="collectionDraft.showComment" type="checkbox" /> 展示原课评</label>
          <label><input v-model="collectionDraft.showWatermark" type="checkbox" /> 展示机构水印</label>
        </section>
        <section class="collection-preview-list">
          <article v-for="record in selectedRecords" :key="record.id">
            <img :src="record.artwork" :alt="record.studentName" />
            <div>
              <strong>{{ record.studentName }} · {{ record.course }}</strong>
              <small>{{ record.date }} · {{ record.className }}</small>
              <p>{{ record.highlightNote || record.feedback }}</p>
            </div>
          </article>
        </section>
        <div class="modal-actions">
          <button class="ghost" @click="showCollectionModal = false">取消</button>
          <button class="primary" :disabled="!canPublishCollection" @click="publishCollection">预览通过，发布链接</button>
        </div>
      </template>
      <template v-else>
        <div class="archive-published-link">
          <strong>{{ createdCollection.title }}</strong>
          <p>{{ createdCollection.link }}</p>
          <small v-if="createdCollection.note">{{ createdCollection.note }}</small>
        </div>
        <div class="modal-actions">
          <button class="ghost" @click="state.copyArchiveCollectionLink(createdCollection)">复制链接</button>
          <button class="primary" @click="showCollectionModal = false">完成</button>
        </div>
      </template>
    </section>
  </div>
</template>
