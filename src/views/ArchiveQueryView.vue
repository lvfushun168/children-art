<script setup>
import { computed, reactive, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'
import DateRangeFilter from '../components/archive/DateRangeFilter.vue'
import ProtectedMedia from '../components/common/ProtectedMedia.vue'
import PaginationBar from '../components/common/PaginationBar.vue'
import { sameId } from '../services/mappers'

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

const emit = defineEmits(['backToGroup', 'createPortfolio'])

const archiveTabs = [
  { id: 'studentWorks', label: '学生作品档案' },
  { id: 'lessons', label: '课堂资料档案' },
  { id: 'teacherEffects', label: '老师课效档案' }
]

const activeTab = ref('studentWorks')
const selectedId = ref(null)
const detailRecord = ref(null)
const selectedRecordIds = ref([])
const selectedLessonId = ref(null)
const selectedEffectId = ref(null)
const lessonDetail = ref(null)
const effectDetail = ref(null)
const showWorkDrawer = ref(false)
const showLessonDrawer = ref(false)
const showEffectDrawer = ref(false)
const isEditingWork = ref(false)
const workEditError = ref('')
const initialWorkDraft = ref('')
const lessonFilter = reactive({ classId: 'all', teacher: 'all', dateStart: '', dateEnd: '' })
const effectFilter = reactive({ teacher: 'all', classId: 'all', classTypeId: 'all', status: 'all', dateStart: '', dateEnd: '' })
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
  frameNote: ''
})
const workPage = computed(() => props.state.directoryPages?.archiveRecords || { items: [], page: 1, pageSize: 20, total: 0 })
const lessonPage = computed(() => props.state.directoryPages?.classroomArchives || { items: [], page: 1, pageSize: 20, total: 0 })
const effectPage = computed(() => props.state.directoryPages?.teacherArchives || { items: [], page: 1, pageSize: 20, total: 0 })
const workRecords = computed(() => workPage.value.items || [])
const lessonRecords = computed(() => lessonPage.value.items || [])
const effectRecords = computed(() => effectPage.value.items || [])
const selected = computed(() => detailRecord.value || workRecords.value.find((record) => sameId(record.id, selectedId.value)) || null)
const selectedRecords = computed(() => selectedRecordIds.value.map((id) => workRecords.value.find((record) => sameId(record.id, id))).filter(Boolean))
const selectedWorkLogs = computed(() => (selected.value ? props.state.archiveEditLogsForRecord(selected.value.id) : []))
const canEditSelectedWork = computed(() => {
  if (!selected.value) return false
  if (selected.value.sourceType === 'extraTask') {
    return Boolean(props.state.canEditExtraTaskArtwork?.value ?? props.state.canEditExtraTaskArtwork)
  }
  return props.state.canEditArchiveRecord(selected.value)
})
const hasUnsavedWorkChanges = computed(() => isEditingWork.value && JSON.stringify(workDraft) !== initialWorkDraft.value)
const visibleSelectedCount = computed(() => workRecords.value.filter((record) => selectedRecordIds.value.some((id) => sameId(id, record.id))).length)
const allVisibleSelected = computed(() => workRecords.value.length > 0 && visibleSelectedCount.value === workRecords.value.length)
const singleStudentSelection = computed(() => {
  const ids = [...new Set(selectedRecords.value.map((record) => record.studentId))]
  return ids.length === 1 ? props.state.students.find((student) => sameId(student.id, ids[0])) : null
})
const isWithinDateRange = (value, start, end) =>
  Boolean(value && (!start || value >= start) && (!end || value <= end))

const filteredLessonArchives = computed(() => lessonRecords.value)
const selectedLesson = computed(() => lessonDetail.value || filteredLessonArchives.value.find((lesson) => sameId(lesson.id, selectedLessonId.value)) || null)
const selectedLessonAssets = computed(() => selectedLesson.value?.materials || [])
const selectedLessonWorks = computed(() => selectedLesson.value?.studentWorks || [])

const filteredTeacherEffects = computed(() => effectRecords.value)
const selectedEffect = computed(() => effectDetail.value || filteredTeacherEffects.value.find((effect) => sameId(effect.id, selectedEffectId.value)) || null)

const archiveStats = computed(() => ({
  works: workPage.value.total,
  lessons: lessonPage.value.total,
  effects: effectPage.value.total
}))
const activeArchive = computed(() => archiveTabs.find((tab) => tab.id === activeTab.value))
const archiveReferencesLoaded = ref(false)
const teacherFilterOptions = computed(() => [
  { label: '全部老师', value: 'all' },
  ...props.state.teachers.filter((item) => item.role === '老师' || item.name).map((teacher) => ({ label: teacher.name, value: teacher.id }))
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
const sourceTypeOptions = [
  { label: '全部来源', value: 'all' },
  { label: '课堂作品', value: 'lesson' },
  { label: '课外作品', value: 'extraTask' }
]
const effectStatusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '已生成', value: 'GENERATED' }, { label: '已确认', value: 'CONFIRMED' },
  { label: '已跳过', value: 'SKIPPED' }, { label: '失败', value: 'FAILED' }
]
const classTypeOptions = computed(() => [
  { label: '全部班型', value: 'all' },
  ...(props.state.classTypes || []).map((item) => ({ label: item.name, value: item.id }))
])
const framerOptions = computed(() => [
  { label: '请选择', value: '' },
  ...props.state.teachers
    .filter((item) => item.status === '启用')
    .map((staff) => ({ label: `${staff.name} · ${staff.role}`, value: `staff:${staff.id}` })),
  { label: '其他人员或外部机构', value: 'external' }
])

const sourceParam = (value) => ({ all: 'ALL', lesson: 'LESSON', extraTask: 'EXTRA_TASK' }[value] || 'ALL')
const mountingParam = (value) => ({ all: undefined, framed: 'MOUNTED', unframed: 'UNMOUNTED' }[value])
const loadStudentWorks = async (page = 1) => {
  selectedId.value = null
  detailRecord.value = null
  selectedRecordIds.value = []
  await props.state.loadDirectoryPage?.('archiveRecords', {
    page,
    pageSize: 20,
    sourceType: sourceParam(props.state.archiveFilter.sourceType),
    studentId: props.state.archiveFilter.studentId === 'all' ? undefined : props.state.archiveFilter.studentId,
    classId: props.state.archiveFilter.classId === 'all' ? undefined : props.state.archiveFilter.classId,
    teacherId: props.state.archiveFilter.teacher === 'all' ? undefined : props.state.archiveFilter.teacher,
    dateFrom: props.state.archiveFilter.dateStart || undefined,
    dateTo: props.state.archiveFilter.dateEnd || undefined,
    highlight: props.state.archiveFilter.highlightOnly ? true : undefined,
    mountingStatus: mountingParam(props.state.archiveFilter.frameStatus)
  })
}
const loadLessonArchives = async (page = 1) => {
  selectedLessonId.value = null
  lessonDetail.value = null
  await props.state.loadDirectoryPage?.('classroomArchives', {
    page,
    pageSize: 20,
    status: 'COMPLETED',
    archived: true,
    classId: lessonFilter.classId === 'all' ? undefined : lessonFilter.classId,
    teacherId: lessonFilter.teacher === 'all' ? undefined : lessonFilter.teacher,
    dateFrom: lessonFilter.dateStart || undefined,
    dateTo: lessonFilter.dateEnd || undefined
  })
}
const loadTeacherEffects = async (page = 1) => {
  selectedEffectId.value = null
  effectDetail.value = null
  await props.state.loadDirectoryPage?.('teacherArchives', {
    page,
    pageSize: 20,
    teacherId: effectFilter.teacher === 'all' ? undefined : effectFilter.teacher,
    classId: effectFilter.classId === 'all' ? undefined : effectFilter.classId,
    classTypeId: effectFilter.classTypeId === 'all' ? undefined : effectFilter.classTypeId,
    status: effectFilter.status === 'all' ? undefined : effectFilter.status,
    dateFrom: effectFilter.dateStart || undefined,
    dateTo: effectFilter.dateEnd || undefined
  })
}
const selectFirstIfMissing = () => loadStudentWorks(1)

const toggleRecord = (record) => {
  selectedId.value = record.id
  selectedRecordIds.value = selectedRecordIds.value.some((id) => sameId(id, record.id))
    ? selectedRecordIds.value.filter((id) => !sameId(id, record.id))
    : [...selectedRecordIds.value, record.id]
}

const toggleAllVisible = () => {
  const visibleIds = workRecords.value.map((record) => record.id)
  if (allVisibleSelected.value) {
    selectedRecordIds.value = selectedRecordIds.value.filter((id) => !visibleIds.some((visibleId) => sameId(visibleId, id)))
    return
  }
  selectedRecordIds.value = [...new Set([...selectedRecordIds.value, ...visibleIds])]
}

const openWorkDrawer = async (record) => {
  selectedId.value = record.id
  detailRecord.value = null
  isEditingWork.value = false
  workEditError.value = ''
  showWorkDrawer.value = true
  try {
    const detail = await props.state.loadDirectoryDetail?.('archiveRecords', record)
    if (sameId(selectedId.value, record.id)) detailRecord.value = { ...record, ...(detail || {}) }
  } catch {
    detailRecord.value = record
  }
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
  })
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

const saveWorkEdit = async () => {
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
  const staffId = workDraft.framerKey.startsWith('staff:') ? workDraft.framerKey.slice('staff:'.length) : null
  const staff = props.state.teachers.find((item) => sameId(item.id, staffId))
  let saved = null
  if (selected.value.sourceType === 'extraTask') {
    await props.state.loadDirectoryExtraTaskWorks?.(selected.value.extraTaskId)
    saved = await props.state.updateExtraTaskWork?.(selected.value.id, {
      title: workDraft.title,
      description: workDraft.description,
      tags: workDraft.tagsText.split(/[，,、]/),
      highlight: workDraft.highlight,
      highlightNote: workDraft.highlightNote,
      version: selected.value.version
    })
  } else {
    saved = await props.state.updateArchiveRecord(selected.value.id, {
      title: workDraft.title,
      description: workDraft.description,
      tags: workDraft.tagsText.split(/[，,、]/),
      note: workDraft.note,
      framed: workDraft.framed,
      framedAt: workDraft.framedAt,
      frameFee: workDraft.frameFee,
      framerId: staffId,
      framerName: staff?.name || workDraft.externalFramerName,
      frameNote: workDraft.frameNote
    })
  }
  if (!saved) return
  isEditingWork.value = false
  initialWorkDraft.value = ''
  await loadStudentWorks(workPage.value.page)
  selectedId.value = saved.id
  detailRecord.value = { ...selected.value, ...saved }
}

const openLessonDrawer = async (lesson) => {
  selectedLessonId.value = lesson.id
  lessonDetail.value = null
  showLessonDrawer.value = true
  try {
    const detail = await props.state.loadDirectoryDetail?.('classroomArchives', lesson)
    if (sameId(selectedLessonId.value, lesson.id)) {
      lessonDetail.value = {
        ...lesson,
        ...(detail || {}),
        materials: detail?.materials || [],
        studentWorks: detail?.studentDeliveries || [],
        worksCount: (detail?.studentDeliveries || []).filter((item) => item.imageMatched).length,
        highlights: (detail?.studentDeliveries || []).filter((item) => item.highlight).length
      }
    }
  } catch {
    lessonDetail.value = lesson
  }
}

const openEffectDrawer = async (effect) => {
  selectedEffectId.value = effect.id
  effectDetail.value = null
  showEffectDrawer.value = true
  try {
    const detail = await props.state.loadDirectoryDetail?.('teacherArchives', effect)
    if (sameId(selectedEffectId.value, effect.id)) effectDetail.value = { ...effect, ...(detail || {}) }
  } catch {
    effectDetail.value = effect
  }
}

const sendSelectionToProduction = () => {
  if (!selectedRecords.value.length) return
  emit('createPortfolio', {
    recordIds: [...selectedRecordIds.value],
    studentId: singleStudentSelection.value?.id || null
  })
}

const switchTab = (tab) => {
  activeTab.value = tab
  if (tab === 'studentWorks') void loadStudentWorks(1)
  if (tab === 'lessons') void loadLessonArchives(1)
  if (tab === 'teacherEffects') void loadTeacherEffects(1)
}

const loadArchiveReferences = async () => {
  if (archiveReferencesLoaded.value) return
  archiveReferencesLoaded.value = true
  try {
    await Promise.all([
      props.state.loadMasterData?.('teachers', { archiveState: 'ACTIVE', force: false }),
      props.state.loadMasterData?.('students', { archiveState: 'ACTIVE', force: false }),
      props.state.loadMasterData?.('classes', { archiveState: 'ACTIVE', force: false }),
      props.state.loadClassTypes?.()
    ])
  } catch {
    archiveReferencesLoaded.value = false
  }
}

watch(activeTab, (tab) => {
  void loadArchiveReferences()
  if (tab === 'studentWorks' && !workPage.value.total && !props.state.directoryLoading?.archiveRecords) void loadStudentWorks(1)
  if (tab === 'lessons' && !lessonPage.value.total && !props.state.directoryLoading?.classroomArchives) void loadLessonArchives(1)
  if (tab === 'teacherEffects' && !effectPage.value.total && !props.state.directoryLoading?.teacherArchives) void loadTeacherEffects(1)
}, { immediate: true })

const assetMeta = (asset) => {
  if (asset.fileName) return `${asset.fileName}${asset.fileExt ? ` · ${asset.fileExt.toUpperCase()}` : ''}`
  return asset.visible ? '家长展示页可见' : '仅内部归档'
}

const formatFrameFee = (value) => `¥${Number(value || 0).toFixed(2)}`
</script>

<template>
  <button v-if="groupLabel" class="module-back-link" type="button" @click="$emit('backToGroup')">← 返回{{ groupLabel }}</button>

  <PageHead title="档案中心" />

  <section class="archive-tabs panel">
    <button v-for="tab in archiveTabs" :key="tab.id" type="button" :class="{ selected: activeTab === tab.id }" @click="switchTab(tab.id)">
      <strong>{{ tab.label }}</strong>
      <small v-if="tab.id === 'studentWorks'">{{ archiveStats.works }} 条</small>
      <small v-if="tab.id === 'lessons'">{{ archiveStats.lessons }} 节</small>
      <small v-if="tab.id === 'teacherEffects'">{{ archiveStats.effects }} 条</small>
    </button>
  </section>

  <section v-if="activeTab === 'studentWorks'" class="archive-workspace-layout">
    <section class="archive-filter-bar panel">
      <div class="section-head">
        <div>
          <span>学生作品档案</span>
          <strong>{{ workPage.total }} 条记录</strong>
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
          来源
          <AdaptiveSelect v-model="state.archiveFilter.sourceType" :options="sourceTypeOptions" @change="selectFirstIfMissing" />
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
      <DateRangeFilter v-model:start="state.archiveFilter.dateStart" v-model:end="state.archiveFilter.dateEnd" @change="selectFirstIfMissing" />
    </section>

    <section class="archive-results panel">
      <div class="section-head">
        <div>
          <span>归档记录</span>
          <strong>{{ workPage.total }} 条</strong>
        </div>
        <button class="ghost" :disabled="!workRecords.length" @click="toggleAllVisible">
          {{ allVisibleSelected ? '取消全选' : '全选当前结果' }}
        </button>
      </div>
      <div v-if="selectedRecordIds.length" class="archive-selection-bar">
        <span>
          <strong>已选 {{ selectedRecordIds.length }} 件作品</strong>
        </span>
        <div class="archive-selection-actions">
          <button class="primary" @click="sendSelectionToProduction">
            {{ singleStudentSelection ? `去制作中心为${singleStudentSelection.name}成册` : '去制作中心成册' }}
          </button>
        </div>
      </div>
      <article
        v-for="record in workRecords"
        :key="record.id"
        class="archive-row"
        :class="{ active: sameId(selected?.id, record.id), picked: selectedRecordIds.some((id) => sameId(id, record.id)) }"
        @click="openWorkDrawer(record)"
      >
        <label class="archive-pick" @click.stop>
          <input type="checkbox" :checked="selectedRecordIds.some((id) => sameId(id, record.id))" @change="toggleRecord(record)" />
        </label>
        <ProtectedMedia :file-id="record.fileId" :src="record.artwork" :alt="record.studentName" />
        <span>
          <strong>{{ record.title || `${record.studentName} · ${record.course}` }}</strong>
          <small>{{ record.date }} {{ record.time }} · {{ record.className }} · {{ record.teacher }}</small>
          <em v-if="record.sourceType === 'extraTask'">课外作品</em>
          <em v-if="record.highlight">高光作品</em>
          <em v-if="record.framed" class="framed-tag">已装裱</em>
          <em v-if="record.collectionIds?.length" class="collection-tag">已入选作品集</em>
        </span>
      </article>
      <div v-if="state.directoryErrors?.archiveRecords" class="notice-box error-box"><small>{{ state.directoryErrors.archiveRecords }}</small><button class="ghost" type="button" @click="loadStudentWorks(workPage.page)">重试</button></div>
      <div v-else-if="!workRecords.length && !state.directoryLoading?.archiveRecords" class="notice-box"><small>没有符合条件的归档记录。</small></div>
      <PaginationBar :page="workPage.page" :page-size="workPage.pageSize" :total="workPage.total" :loading="state.directoryLoading?.archiveRecords" @change="loadStudentWorks" />
    </section>

  </section>

  <section v-if="activeTab === 'lessons'" class="archive-workspace-layout lesson-archive-layout">
    <section class="archive-filter-bar panel">
      <div class="section-head">
        <div>
          <span>课堂资料档案</span>
          <strong>{{ lessonPage.total }} 节课</strong>
        </div>
      </div>
      <div class="archive-filter-fields compact-archive-filter-fields">
        <label>
          班级
          <AdaptiveSelect v-model="lessonFilter.classId" :options="classFilterOptions" @change="loadLessonArchives(1)" />
        </label>
        <label>
          老师
          <AdaptiveSelect v-model="lessonFilter.teacher" :options="teacherFilterOptions" @change="loadLessonArchives(1)" />
        </label>
      </div>
      <DateRangeFilter
        v-model:start="lessonFilter.dateStart"
        v-model:end="lessonFilter.dateEnd"
        @change="loadLessonArchives(1)"
      />
    </section>

    <section class="archive-results panel">
      <div class="section-head">
        <div>
          <span>课堂记录</span>
          <strong>{{ lessonPage.total }} 节</strong>
        </div>
      </div>
      <button
        v-for="lesson in filteredLessonArchives"
        :key="lesson.id"
        class="lesson-archive-row"
        :class="{ active: sameId(selectedLesson?.id, lesson.id) }"
        @click="openLessonDrawer(lesson)"
      >
        <span>
          <strong>{{ lesson.date }} {{ lesson.time }} · {{ lesson.course }}</strong>
          <small>
            {{ lesson.className }}（{{ lesson.classType }}）
            <em v-if="lesson.classArchived" class="archived-reference">班级已归档</em>
            · {{ lesson.teacher }}
            <em v-if="lesson.teacherArchived" class="archived-reference">老师已归档</em>
            · {{ lesson.lessonType }}
          </small>
        </span>
        <div>
          <em>{{ lesson.materials.length }} 份资料</em>
          <small>{{ lesson.worksCount }} 件作品 · {{ lesson.highlights }} 个高光</small>
        </div>
      </button>
      <div v-if="!filteredLessonArchives.length" class="notice-box">
        <small>没有符合条件的课堂档案。</small>
      </div>
      <div v-if="state.directoryErrors?.classroomArchives" class="notice-box error-box"><small>{{ state.directoryErrors.classroomArchives }}</small><button class="ghost" type="button" @click="loadLessonArchives(lessonPage.page)">重试</button></div>
      <PaginationBar :page="lessonPage.page" :page-size="lessonPage.pageSize" :total="lessonPage.total" :loading="state.directoryLoading?.classroomArchives" @change="loadLessonArchives" />
    </section>

  </section>

  <section v-if="activeTab === 'teacherEffects'" class="archive-workspace-layout teacher-effect-layout">
    <section class="archive-filter-bar panel">
      <div class="section-head">
        <div>
          <span>老师课效档案</span>
          <strong>{{ effectPage.total }} 张长图</strong>
        </div>
      </div>
      <div class="archive-filter-fields compact-archive-filter-fields">
        <label>
          老师
          <AdaptiveSelect v-model="effectFilter.teacher" :options="teacherFilterOptions" @change="loadTeacherEffects(1)" />
        </label>
        <label>
          班级
          <AdaptiveSelect v-model="effectFilter.classId" :options="classFilterOptions" @change="loadTeacherEffects(1)" />
        </label>
        <label>班型<AdaptiveSelect v-model="effectFilter.classTypeId" :options="classTypeOptions" @change="loadTeacherEffects(1)" /></label>
        <label>状态<AdaptiveSelect v-model="effectFilter.status" :options="effectStatusOptions" @change="loadTeacherEffects(1)" /></label>
      </div>
      <DateRangeFilter
        v-model:start="effectFilter.dateStart"
        v-model:end="effectFilter.dateEnd"
        @change="loadTeacherEffects(1)"
      />
    </section>

    <section class="archive-results panel">
      <div class="section-head">
        <div>
          <span>课效长图</span>
          <strong>{{ effectPage.total }} 条</strong>
        </div>
      </div>
      <button
        v-for="effect in filteredTeacherEffects"
        :key="effect.id"
        class="lesson-archive-row"
        :class="{ active: sameId(selectedEffect?.id, effect.id) }"
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
      <div v-if="state.directoryErrors?.teacherArchives" class="notice-box error-box"><small>{{ state.directoryErrors.teacherArchives }}</small><button class="ghost" type="button" @click="loadTeacherEffects(effectPage.page)">重试</button></div>
      <PaginationBar :page="effectPage.page" :page-size="effectPage.pageSize" :total="effectPage.total" :loading="state.directoryLoading?.teacherArchives" @change="loadTeacherEffects" />
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
          <button v-if="!isEditingWork" class="ghost" @click="closeWorkDrawer">关闭</button>
        </div>
      </header>
      <figure class="archive-image-readonly">
        <ProtectedMedia class="archive-main-image" :file-id="selected.fileId" :src="selected.artwork" :alt="selected.studentName" />
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
          <span><small>档案来源</small><strong>{{ selected.sourceType === 'extraTask' ? '课外任务交付作品' : '课堂作品' }}</strong></span>
          <span v-if="selected.sourceType === 'extraTask'"><small>关联任务</small><strong>{{ selected.extraTaskTitle }}</strong></span>
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
          <span>高光信息（归档快照）</span>
          <article class="archive-block highlight">
            <strong>{{ workDraft.highlight ? '高光作品' : '非高光作品' }}</strong>
            <p>{{ workDraft.highlightNote || '当前归档快照没有高光说明。' }}</p>
          </article>
        </section>
        <section v-if="selected.sourceType !== 'extraTask'" class="archive-detail-group archive-edit-section">
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
        <section v-if="selected.sourceType !== 'extraTask'" class="archive-detail-group">
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
          <span>{{ selectedLesson.teacher }}<em v-if="selectedLesson.teacherArchived" class="archived-reference">（已归档）</em></span>
          <span>{{ selectedLesson.className }}（{{ selectedLesson.classType }}）<em v-if="selectedLesson.classArchived" class="archived-reference">（已归档）</em></span>
          <span>{{ selectedLesson.lessonType }}</span>
        </div>
      </section>

      <section v-if="selectedLesson.archiveVersions?.length" class="archive-detail-group">
        <span>归档版本</span>
        <div class="archive-meta">
          <span v-for="version in selectedLesson.archiveVersions" :key="version.id">V{{ version.versionNo }} · {{ version.createdAt }}</span>
        </div>
      </section>

      <section class="archive-detail-group">
        <span>备课与课堂资料</span>
        <div v-if="selectedLessonAssets.length" class="lesson-asset-grid">
          <article v-for="asset in selectedLessonAssets" :key="asset.id">
            <ProtectedMedia v-if="asset.image || asset.fileId" :file-id="asset.fileId" :src="asset.image" :alt="asset.title" />
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
            <ProtectedMedia v-if="work.artwork || work.fileId" :file-id="work.fileId" :src="work.artwork" :alt="work.studentName" />
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
        <ProtectedMedia
          v-if="selectedEffect.cover || selectedEffect.outputFileId || selectedEffect.fileId"
          :file-id="selectedEffect.outputFileId || selectedEffect.fileId"
          :src="selectedEffect.cover"
          :alt="selectedEffect.title"
        />
        <div v-else class="file-tile">
          <strong>{{ selectedEffect.status || '待生成' }}</strong>
          <small>长图尚未生成，请返回课后工作台完成生成。</small>
        </div>
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
        <span>云盘路径</span>
        <article class="archive-block">
          <p>{{ selectedEffect.cloudPath || '暂无云盘路径。' }}</p>
        </article>
      </section>
    </aside>
  </div>

</template>
