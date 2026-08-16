<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'
import PaginationBar from '../components/common/PaginationBar.vue'
import { sameId } from '../services/mappers'

const props = defineProps({
  state: {
    type: Object,
    required: true
  },
  entity: {
    type: String,
    required: true
  },
  groupLabel: {
    type: String,
    default: ''
  }
})
const emit = defineEmits(['open-import', 'backToGroup'])

const selectedId = ref(null)
const mode = ref('detail')
const isMobileFlow = ref(false)
const mobileShowingDetail = ref(false)
const studentDetailTab = ref('profile')
const communicationView = ref('list')
const communicationEditingId = ref(null)
const communicationMethodFilter = ref('全部方式')
const communicationFollowFilter = ref('全部记录')
const archiveState = ref('ACTIVE')
const queryInput = ref('')
const statusInput = ref('all')
const teacherInput = ref('all')
const courseInput = ref('all')
const classTypeInput = ref('all')
const classInput = ref('all')
const detailRecord = ref(null)
const detailLoading = ref(false)
const saving = ref(false)
const detailRequestId = ref(0)
const draftBaseline = ref('')
let cleanupMobileMedia = () => {}

const studentProfileSections = [
  {
    title: '家庭画像',
    fields: [
      { key: 'residentialCommunity', label: '现住小区', hint: '教育消费力 & 距离' },
      { key: 'schoolName', label: '就读学校', hint: '教育消费力' },
      { key: 'trainingBrandInterest', label: '培训班品牌-兴趣', hint: '教育消费力 & 时间' }
    ]
  },
  {
    title: '母亲信息',
    fields: [
      { key: 'motherOccupation', label: '母职业职务', hint: '教育消费力 & 决策影响' },
      { key: 'motherSocialCircleEducation', label: '朋友圈-类别-学历', hint: '决策影响' },
      { key: 'motherCompanionTime', label: '陪伴时间 & 情况', hint: '决策影响' }
    ]
  },
  {
    title: '父亲信息',
    fields: [
      { key: 'fatherOccupation', label: '父职业职务', hint: '教育消费力 & 决策影响' },
      { key: 'fatherSocialCircleEducation', label: '朋友圈-类别-学历', hint: '决策影响' },
      { key: 'fatherCompanionTime', label: '陪伴时间 & 情况', hint: '决策影响' }
    ]
  },
  {
    title: '带养与决策',
    fields: [
      { key: 'caregivingMode', label: '代养模式', hint: '决策人和带养人关系' },
      { key: 'siblingRank', label: '家里孩子数量-排行', hint: '决策影响-家庭结构' },
      { key: 'primaryCaregiver', label: '带养人', hint: '直接或间接获取决策人信息' },
      { key: 'householdMembers', label: '现居一起的家庭成员', hint: '长辈、保姆、兄弟姐妹、父母全职自带' },
      { key: 'purchaseDecisionPower', label: '购买决策权', hint: '谁主要决策？谁能阻碍决策？' },
      { key: 'decisionInterviewTime', label: '决策人可面谈时间', hint: '判断面咨或签单时间，是否属于A类' }
    ]
  }
]

const studentProfileBlank = () =>
  Object.fromEntries(studentProfileSections.flatMap((section) => section.fields.map((field) => [field.key, ''])))

const config = computed(() => {
  const map = {
    teachers: { title: '老师管理', action: '新增老师', empty: '暂无老师' },
    students: { title: '学生管理', action: '新增学生', empty: '暂无学生' },
    classes: { title: '班级管理', action: '新增班级', empty: '暂无班级' },
    courses: { title: '课程资料', action: '新增课程', empty: '暂无课程' },
    externalLinks: { title: '外部在线课程信息', action: '新增外部课程', empty: '暂无符合条件的外部课程链接' }
  }
  return map[props.entity]
})

const records = computed(() => {
  return props.state.directoryPages?.[props.entity]?.items || []
})

const activeItems = (items = []) => items.filter((item) => !item.archived)

const selected = computed(() => detailRecord.value || records.value.find((item) => sameId(item.id, selectedId.value)) || null)
const directoryState = computed(() => props.state.directoryPages?.[props.entity] || { page: 1, pageSize: 20, total: 0, items: [] })
const drawerOpen = computed(() => mode.value === 'new' || Boolean(selected.value && (!isMobileFlow.value || mobileShowingDetail.value)))
const canEditMasterData = computed(() => {
  if (typeof props.state.canEditMasterData === 'boolean') return props.state.canEditMasterData
  const permissions = props.state.currentUser?.permissions || []
  return permissions.includes('masterdata.edit')
})
const entityLabel = computed(() => ({ teachers: '老师', students: '学生', classes: '班级', courses: '课程', externalLinks: '外部课程链接' }[props.entity] || '记录'))
const isArchivableEntity = computed(() => props.entity !== 'externalLinks')
const draftSnapshot = (value) => JSON.stringify(value || {})
const isDirty = computed(() => mode.value !== 'detail' && draftBaseline.value !== draftSnapshot(draft.value))
const formReadonly = computed(() => mode.value === 'detail' || detailLoading.value || saving.value || !canEditMasterData.value)
const showMasterActions = computed(() => mode.value !== 'detail' && (props.entity !== 'students' || studentDetailTab.value === 'profile'))
const showCloseAction = computed(() => mode.value === 'detail' || (props.entity === 'students' && studentDetailTab.value === 'communication'))
const statusOptions = computed(() => {
  if (props.entity === 'teachers' || props.entity === 'courses' || props.entity === 'externalLinks') return [{ label: '全部状态', value: 'all' }, { label: '启用', value: 'ENABLED' }, { label: '停用', value: 'DISABLED' }]
  if (props.entity === 'students') return [{ label: '全部状态', value: 'all' }, { label: '在读', value: 'ENROLLED' }, { label: '请假', value: 'ON_LEAVE' }, { label: '退费', value: 'GRADUATED' }, { label: '停课', value: 'DISABLED' }]
  return [{ label: '全部状态', value: 'all' }, { label: '筹备中', value: 'PREPARING' }, { label: '开班中', value: 'ACTIVE' }, { label: '停课', value: 'SUSPENDED' }, { label: '结课', value: 'CLOSED' }]
})
const teacherFilterOptions = computed(() => [
  { label: '全部老师', value: 'all' },
  ...(props.state.teachers || []).map((item) => ({ label: item.name, value: item.id }))
])
const courseFilterOptions = computed(() => [
  { label: '全部课程', value: 'all' },
  ...(props.state.courses || []).map((item) => ({ label: item.title, value: item.id }))
])
const classTypeFilterOptions = computed(() => [
  { label: '全部班型', value: 'all' },
  ...(props.state.classTypes || []).map((item) => ({ label: item.name, value: item.id }))
])

const availableStudentProfileSections = computed(() => {
  if (props.entity !== 'students') return []
  const configuredFields = props.state.studentProfileFields || []
  const resolveField = (field) => {
    const remote = props.state.studentProfileFieldFor?.(field.key)
    return remote ? { ...field, label: remote.label || field.label, fieldType: remote.fieldType, fieldId: remote.id } : null
  }
  const sections = studentProfileSections
    .map((section) => ({ ...section, fields: section.fields.map(resolveField).filter(Boolean) }))
    .filter((section) => section.fields.length)
  const knownKeys = new Set(sections.flatMap((section) => section.fields.map((field) => field.key)))
  const extraFields = configuredFields
    .filter((field) => field.id && !knownKeys.has(props.state.profileUiKey?.(field.fieldKey) || field.fieldKey))
    .map((field) => ({
      key: props.state.profileUiKey?.(field.fieldKey) || field.fieldKey,
      label: field.label || field.fieldKey,
      hint: field.fieldType || 'CRM 字段',
      fieldType: field.fieldType,
      fieldId: field.id
    }))
  if (extraFields.length) sections.push({ title: '其他 CRM 档案字段', fields: extraFields })
  return sections
})

const blankDraft = () => {
  if (props.entity === 'teachers') {
    return {
      name: '',
      phone: '',
      role: '老师',
      title: '老师',
      status: '启用',
      note: '',
      userId: null
    }
  }
  if (props.entity === 'students') {
    return {
      name: '',
      nickname: '',
      age: 6,
      parent: '',
      phone: '',
      classId: activeItems(props.state.classes)[0]?.id,
      status: '在读',
      note: '',
      ...studentProfileBlank()
    }
  }
  if (props.entity === 'classes') {
    return {
      name: '',
      time: '每周五 18:30',
      teacherId: activeItems(props.state.teachers)[0]?.id,
      courseId: activeItems(props.state.courses)[0]?.id,
      group: '',
      status: '筹备中',
      studentIds: []
    }
  }
  if (props.entity === 'externalLinks') {
    return {
      title: '',
      url: '',
      platform: '通用链接',
      note: '',
      courseId: null,
      courseIds: [],
      status: '启用'
    }
  }
  return {
    title: '',
    age: '5-7岁',
    goal: '',
    materials: '',
    reference: '',
    defaultFocus: '色彩',
    commentTemplate: props.state.templates.comment[0]?.name,
    imageTemplate: props.state.templates.image[0]?.name,
    onlineLinks: []
  }
}

const cloneRecord = (record) => JSON.parse(JSON.stringify(record || blankDraft()))
const draft = ref(blankDraft())
const setDraft = (value, { clean = true } = {}) => {
  draft.value = cloneRecord(value)
  if (clean) draftBaseline.value = draftSnapshot(draft.value)
}
const markDraftClean = () => {
  draftBaseline.value = draftSnapshot(draft.value)
}
const blankCommunicationDraft = () => ({
  studentId: selected.value?.id || null,
  contactPerson: selected.value?.parent || '',
  contactRole: '家长',
  contactMethod: '微信',
  content: '',
  followUpAction: '',
  recordedBy: props.state.currentUser?.name || '',
  recordedAt: props.state.nowText()
})
const communicationDraft = ref(blankCommunicationDraft())

const selectedCommunicationRecords = computed(() => {
  if (props.entity !== 'students' || !selected.value) return []
  return props.state.communicationRecordsFor(selected.value.id)
})
const communicationMethodOptions = computed(() => [
  '全部方式',
  ...new Set(selectedCommunicationRecords.value.map((record) => record.contactMethod).filter(Boolean))
])
const visibleCommunicationRecords = computed(() =>
  selectedCommunicationRecords.value
    .filter((record) => communicationMethodFilter.value === '全部方式' || record.contactMethod === communicationMethodFilter.value)
    .filter((record) => {
      if (communicationFollowFilter.value === '待跟进') return Boolean(record.followUpAction)
      if (communicationFollowFilter.value === '无跟进') return !record.followUpAction
      return true
    })
)
const communicationSummary = computed(() => ({
  total: selectedCommunicationRecords.value.length,
  pending: selectedCommunicationRecords.value.filter((record) => record.followUpAction).length
}))

const resetDraft = () => {
  const base = mode.value === 'new' ? blankDraft() : cloneRecord(selected.value)
  const profile = props.entity === 'students' && mode.value !== 'new' ? props.state.studentProfileFor?.(selected.value?.id) : null
  draft.value = { ...base, ...(profile?.valueMap || {}) }
  markDraftClean()
}

const resetCommunicationDraft = () => {
  communicationEditingId.value = null
  communicationView.value = 'list'
  communicationDraft.value = blankCommunicationDraft()
}

const archiveStateLabel = computed(() => ({ ACTIVE: '当前数据', ARCHIVED: '已归档', ALL: '全部' }[archiveState.value] || '当前数据'))
const archiveStateOptions = [
  { label: '当前数据', value: 'ACTIVE' },
  { label: '已归档', value: 'ARCHIVED' },
  { label: '全部', value: 'ALL' }
]
const availableIdentityUsers = computed(() => (props.state.identityUsers || [])
  .filter((user) => user.status === '启用' || user.status === 'ENABLED' || user.status === 'ACTIVE')
  .map((user) => ({ label: `${user.displayName || user.username || user.phone || '未命名账号'}${user.phone ? ` · ${user.phone}` : ''}`, value: user.id })))
const selectedReferenceCount = computed(() => {
  if (!selected.value) return 0
  if (props.entity === 'teachers') return (props.state.classes || []).filter((item) => sameId(item.teacherId, selected.value.id)).length
  if (props.entity === 'students') return (props.state.classes || []).filter((item) => (item.studentIds || []).some((id) => sameId(id, selected.value.id))).length
  if (props.entity === 'classes') return (props.state.tasks || []).filter((item) => sameId(item.classId, selected.value.id)).length
  return (props.state.classes || []).filter((item) => sameId(item.courseId, selected.value.id)).length
})

const confirmDiscardChanges = (action = '离开当前编辑') => {
  if (!isDirty.value) return true
  return window.confirm(`当前${entityLabel.value}有未保存修改，确定${action}吗？`)
}

const backToGroup = () => {
  if (!confirmDiscardChanges('放弃当前编辑并返回上一级')) return
  emit('backToGroup')
}

const buildDirectoryFilters = () => {
  const filters = {
    pageSize: 20,
    query: queryInput.value.trim() || undefined,
    status: statusInput.value === 'all' ? undefined : statusInput.value,
  }
  if (props.entity === 'students' && classInput.value !== 'all') filters.classId = classInput.value
  if (props.entity === 'classes') {
    if (teacherInput.value !== 'all') filters.teacherId = teacherInput.value
    if (courseInput.value !== 'all') filters.courseId = courseInput.value
    if (classTypeInput.value !== 'all') filters.classTypeId = classTypeInput.value
  }
  if (props.entity === 'externalLinks' && courseInput.value !== 'all') filters.courseId = courseInput.value
  if (props.entity !== 'externalLinks') {
    filters.archiveState = archiveState.value
  }
  return filters
}

const clearSelection = () => {
  detailRequestId.value += 1
  detailLoading.value = false
  detailRecord.value = null
  selectedId.value = null
  mode.value = 'detail'
  setDraft(blankDraft())
  mobileShowingDetail.value = false
  resetCommunicationDraft()
}

const ensureDetailLookups = async () => {
  const entities = props.entity === 'students'
    ? ['classes']
    : props.entity === 'classes'
      ? ['teachers', 'students', 'courses']
      : props.entity === 'externalLinks'
        ? ['courses']
        : []
  await Promise.all(entities.map((entity) => props.state.loadMasterData?.(entity, { archiveState: 'ACTIVE', force: false })))
}

const hydrateStudentProfile = async (record) => {
  if (props.entity !== 'students' || !record?.id || mode.value === 'new') return
  const wasDirty = isDirty.value
  await Promise.all([
    props.state.loadStudentProfile?.(record.id),
    (props.state.permissionCatalog || []).includes('crm.audit.read')
      ? props.state.loadStudentProfileAudits?.(record.id)
      : Promise.resolve([])
  ])
  if (!sameId(selectedId.value, record.id) || mode.value === 'new') return
  const profile = props.state.studentProfileFor?.(record.id)
  if (profile?.valueMap && !wasDirty) {
    draft.value = { ...draft.value, ...profile.valueMap }
    markDraftClean()
  }
}

const loadRecordDetail = async (record, { skipGuard = false, preferredMode = null } = {}) => {
  if (!record?.id) return false
  if (!skipGuard && !confirmDiscardChanges('切换记录')) return false

  const requestId = ++detailRequestId.value
  selectedId.value = record.id
  detailRecord.value = null
  mode.value = preferredMode || (canEditMasterData.value && !record.archived ? 'edit' : 'detail')
  studentDetailTab.value = 'profile'
  detailLoading.value = true
  setDraft(record)
  resetCommunicationDraft()
  if (props.entity === 'students') void props.state.loadCommunicationRecords(record.id)
  if (isMobileFlow.value) mobileShowingDetail.value = true

  try {
    await ensureDetailLookups()
    const detail = await props.state.loadDirectoryDetail?.(props.entity, record)
    if (requestId !== detailRequestId.value || !sameId(selectedId.value, record.id)) return false
    const resolved = detail || record
    detailRecord.value = resolved
    mode.value = preferredMode === 'detail'
      ? 'detail'
      : (canEditMasterData.value && !resolved.archived ? 'edit' : 'detail')
    setDraft(resolved)
    await hydrateStudentProfile(resolved)
    return true
  } catch {
    if (requestId !== detailRequestId.value || !sameId(selectedId.value, record.id)) return false
    detailRecord.value = record
    mode.value = preferredMode === 'detail'
      ? 'detail'
      : (canEditMasterData.value && !record.archived ? 'edit' : 'detail')
    setDraft(record)
    return false
  } finally {
    if (requestId === detailRequestId.value) detailLoading.value = false
  }
}

const loadDirectory = async (page = 1, { skipGuard = false, preserveSelection = false, selectionId = selectedId.value } = {}) => {
  if (!skipGuard && !confirmDiscardChanges('离开当前编辑并刷新列表')) return false
  const filters = buildDirectoryFilters()
  const preservedId = preserveSelection ? selectionId : null
  const preservedMode = preserveSelection ? mode.value : 'detail'
  let requestId = detailRequestId.value
  if (!preserveSelection) {
    clearSelection()
  } else {
    requestId = ++detailRequestId.value
    detailRecord.value = null
    detailLoading.value = Boolean(preservedId)
  }
  try {
    const result = await props.state.loadDirectoryPage?.(props.entity, { ...filters, page })
    if (preservedId && requestId === detailRequestId.value) {
      const refreshed = records.value.find((item) => sameId(item.id, preservedId))
      if (refreshed) {
        await loadRecordDetail(refreshed, { skipGuard: true, preferredMode: preservedMode })
      } else {
        clearSelection()
      }
    }
    return result
  } finally {
    if (preservedId && requestId === detailRequestId.value) detailLoading.value = false
  }
}

const applyFilters = () => loadDirectory(1)
const resetFilters = () => {
  queryInput.value = ''
  statusInput.value = 'all'
  teacherInput.value = 'all'
  courseInput.value = 'all'
  classTypeInput.value = 'all'
  classInput.value = 'all'
  return loadDirectory(1)
}

const reloadArchiveState = async (value = archiveState.value) => {
  if (!confirmDiscardChanges('切换归档筛选并刷新列表')) return false
  archiveState.value = value
  return loadDirectory(1, { skipGuard: true })
}

watch(
  () => props.entity,
  () => {
    archiveState.value = 'ACTIVE'
    clearSelection()
    studentDetailTab.value = 'profile'
    if (props.entity === 'teachers') void props.state.loadIdentityUsers?.({ page: 1, pageSize: 100, status: 'ENABLED' })
    if (props.entity === 'classes') void props.state.loadClassTypes?.()
    void loadDirectory(1, { skipGuard: true })
  },
  { immediate: true }
)

const selectRecord = async (record) => {
  if (!confirmDiscardChanges('切换记录')) return false
  return loadRecordDetail(record, { skipGuard: true })
}

const startNew = async () => {
  if (!confirmDiscardChanges('放弃当前编辑并新建记录')) return false
  detailRequestId.value += 1
  mode.value = 'new'
  selectedId.value = null
  detailRecord.value = null
  studentDetailTab.value = 'profile'
  detailLoading.value = true
  setDraft(blankDraft())
  resetCommunicationDraft()
  if (isMobileFlow.value) mobileShowingDetail.value = true
  try {
    await ensureDetailLookups()
    setDraft(blankDraft())
    return true
  } finally {
    detailLoading.value = false
  }
}

const startEdit = () => {
  if (!selected.value || selected.value.archived || !canEditMasterData.value) return
  mode.value = 'edit'
  resetDraft()
}

const save = async () => {
  if (mode.value === 'detail' || !canEditMasterData.value || detailLoading.value || saving.value) return
  if (mode.value === 'edit' && !isDirty.value) {
    props.state.notify?.('当前没有需要保存的修改')
    return
  }
  const wasNew = mode.value === 'new'
  const page = directoryState.value.page
  let saved = null
  saving.value = true
  try {
    if (props.entity === 'teachers') {
      saved = mode.value === 'new' ? await props.state.addTeacher(draft.value) : await props.state.updateTeacher(selected.value.id, draft.value)
      if (!saved) return
      if (String(draft.value.userId || '') !== String(saved.userId || '')) {
        saved = await props.state.bindTeacherAccount(saved.id, draft.value.userId || null, saved.version)
        if (!saved) return
      }
      selectedId.value = saved.id
    }
    if (props.entity === 'students') {
      saved = mode.value === 'new' ? await props.state.addStudent(draft.value) : await props.state.updateStudent(selected.value.id, draft.value)
      if (!saved) return
      if (!(await props.state.saveStudentProfile?.(saved.id, draft.value))) return
      selectedId.value = saved.id
    }
    if (props.entity === 'classes') {
      saved = mode.value === 'new' ? await props.state.addClass(draft.value) : await props.state.updateClass(selected.value.id, draft.value)
      if (!saved) return
      selectedId.value = saved.id
    }
    if (props.entity === 'courses') {
      saved = mode.value === 'new' ? await props.state.addCourse(draft.value) : await props.state.updateCourse(selected.value.id, draft.value)
      if (!saved) return
      selectedId.value = saved.id
    }
    if (props.entity === 'externalLinks') {
      saved = mode.value === 'new' ? await props.state.addExternalLink(draft.value) : await props.state.updateExternalLink(selected.value.id, draft.value)
      if (!saved) return
      selectedId.value = saved.id
    }
    if (wasNew) {
      await loadDirectory(1, { skipGuard: true })
      return
    }
    mode.value = canEditMasterData.value && !saved.archived ? 'edit' : 'detail'
    if (isMobileFlow.value) mobileShowingDetail.value = true
    detailRecord.value = saved
    setDraft(saved)
    if (props.entity === 'students') {
      const profile = props.state.studentProfileFor?.(saved.id)
      if (profile?.valueMap) draft.value = { ...draft.value, ...profile.valueMap }
    }
    markDraftClean()
    await loadDirectory(page, { skipGuard: true, preserveSelection: true, selectionId: saved.id })
  } finally {
    saving.value = false
  }
}

const archiveSelected = async () => {
  if (!selected.value || selected.value.archived || !canEditMasterData.value || detailLoading.value || saving.value) return
  const reason = window.prompt(`归档“${selected.value.name || selected.value.title}”的原因（可选）`, selected.value.archiveReason || '')
  if (reason === null) return
  if (selectedReferenceCount.value > 0 && !window.confirm(`该数据当前被 ${selectedReferenceCount.value} 条业务关系引用，归档不会删除引用，是否继续？`)) return
  if (!confirmDiscardChanges('放弃未保存修改并归档当前记录')) return
  resetDraft()
  const saved = await props.state.archiveMasterData?.(props.entity, selected.value.id, reason)
  if (saved) {
    await loadDirectory(directoryState.value.page, { skipGuard: true })
  }
}

const restoreSelected = async () => {
  if (!selected.value || !selected.value.archived || !canEditMasterData.value || saving.value) return
  const saved = await props.state.restoreMasterData?.(props.entity, selected.value.id, selected.value.version)
  if (saved) {
    await loadDirectory(directoryState.value.page, { skipGuard: true })
  }
}

const saveCommunicationRecord = async () => {
  if (!selected.value) return
  if (!communicationDraft.value.content.trim()) {
    props.state.notify('请填写沟通内容摘要')
    return
  }
  const payload = {
    ...communicationDraft.value,
    studentId: selected.value.id,
    recordedBy: communicationDraft.value.recordedBy || props.state.currentUser?.name || '当前用户'
  }
  if (communicationEditingId.value) await props.state.updateCommunicationRecord(communicationEditingId.value, payload)
  else await props.state.addCommunicationRecord(payload)
  resetCommunicationDraft()
}

const startNewCommunicationRecord = () => {
  communicationEditingId.value = null
  communicationDraft.value = blankCommunicationDraft()
  communicationView.value = 'form'
}

const editCommunicationRecord = (record) => {
  communicationEditingId.value = record.id
  communicationDraft.value = cloneRecord(record)
  communicationView.value = 'form'
}

const returnToCommunicationList = () => {
  communicationEditingId.value = null
  communicationDraft.value = blankCommunicationDraft()
  communicationView.value = 'list'
}

const deleteCommunicationRecord = (record) => {
  props.state.deleteCommunicationRecord(record.id)
  if (sameId(communicationEditingId.value, record.id)) resetCommunicationDraft()
}

const selectStudentTab = (tab) => {
  if (tab === studentDetailTab.value) return
  if (tab === 'communication' && studentDetailTab.value === 'profile' && isDirty.value) {
    if (!confirmDiscardChanges('放弃未保存修改并查看沟通记录')) return
    resetDraft()
  }
  studentDetailTab.value = tab
  communicationView.value = 'list'
}

const returnToList = () => {
  if (!confirmDiscardChanges('放弃当前编辑并返回列表')) return
  clearSelection()
}

const cancelEdit = () => {
  clearSelection()
}

const toggleStudentInClass = (studentId) => {
  const ids = draft.value.studentIds || []
  draft.value.studentIds = ids.some((id) => sameId(id, studentId)) ? ids.filter((id) => !sameId(id, studentId)) : [...ids, studentId]
}

const className = (classId) => props.state.classes.find((item) => sameId(item.id, classId))?.name || '未分班'
const courseTitle = (courseId) => props.state.courses.find((item) => sameId(item.id, courseId))?.title || '待配置'
const teacherName = (teacherId) => props.state.teachers.find((item) => sameId(item.id, teacherId))?.name || '待配置'

onMounted(() => {
  const media = window.matchMedia('(max-width: 680px)')
  const syncMobile = () => {
    isMobileFlow.value = media.matches
    if (media.matches) mobileShowingDetail.value = false
  }
  syncMobile()
  media.addEventListener('change', syncMobile)
  cleanupMobileMedia = () => media.removeEventListener('change', syncMobile)
})

onBeforeUnmount(() => cleanupMobileMedia())

</script>

<template>
  <button
    v-if="groupLabel && (!isMobileFlow || !mobileShowingDetail)"
    class="module-back-link"
    type="button"
    @click="backToGroup"
  >
    ← 返回{{ groupLabel }}
  </button>

  <button
    v-if="isMobileFlow && mobileShowingDetail"
    class="module-back-link"
    type="button"
    @click="returnToList"
  >
    ← 返回列表
  </button>

  <PageHead :eyebrow="config.eyebrow" :title="config.title">
    <div class="button-pair">
      <button class="primary" :disabled="archiveState !== 'ACTIVE' || !canEditMasterData" @click="startNew">{{ config.action }}</button>
    </div>
  </PageHead>

  <section class="directory-page" :class="{ 'mobile-detail-open': isMobileFlow && mobileShowingDetail }">
    <form class="directory-toolbar panel" @submit.prevent="applyFilters">
      <label class="directory-search">
        <span>关键词</span>
        <input v-model="queryInput" :placeholder="entity === 'teachers' ? '姓名、手机号' : entity === 'students' ? '姓名、家长电话' : entity === 'classes' ? '班级名称' : entity === 'externalLinks' ? '标题、URL' : '课程类别/资料、年龄段'" />
      </label>
      <label>
        <span>状态</span>
        <AdaptiveSelect v-model="statusInput" :options="statusOptions" />
      </label>
      <label v-if="isArchivableEntity">
        <span>归档状态</span>
        <AdaptiveSelect :model-value="archiveState" :options="archiveStateOptions" @update:model-value="reloadArchiveState" />
      </label>
      <label v-if="entity === 'students'">
        <span>班级</span>
        <AdaptiveSelect v-model="classInput" :options="[{ label: '全部班级', value: 'all' }, ...state.classes.map((item) => ({ label: item.name, value: item.id }))]" />
      </label>
      <template v-if="entity === 'classes'">
        <label><span>老师</span><AdaptiveSelect v-model="teacherInput" :options="teacherFilterOptions" /></label>
        <label><span>课程</span><AdaptiveSelect v-model="courseInput" :options="courseFilterOptions" /></label>
        <label><span>班型</span><AdaptiveSelect v-model="classTypeInput" :options="classTypeFilterOptions" /></label>
      </template>
      <label v-if="entity === 'externalLinks'">
        <span>课程</span>
        <AdaptiveSelect v-model="courseInput" :options="courseFilterOptions" />
      </label>
      <div class="button-pair directory-toolbar-actions">
        <button class="secondary" type="submit">查询</button>
        <button class="ghost" type="button" @click="resetFilters">重置</button>
      </div>
    </form>

    <section v-show="!isMobileFlow || !mobileShowingDetail" class="master-list panel directory-list-panel">
      <div class="section-head">
        <div>
          <span>{{ config.title }}</span>
          <strong>{{ directoryState.total }} 条记录</strong>
        </div>
        <small v-if="state.directoryLoading?.[entity]">正在加载…</small>
      </div>
      <div v-if="state.directoryErrors?.[entity]" class="notice-box error-box">
        <small>{{ state.directoryErrors[entity] }}</small>
        <button class="ghost" type="button" @click="loadDirectory(directoryState.page)">重试</button>
      </div>
      <div v-else-if="!records.length && !state.directoryLoading?.[entity]" class="notice-box">
        <small>{{ config.empty }}，请调整筛选条件。</small>
      </div>
      <div v-else class="directory-table-wrap">
        <table class="directory-table">
          <thead>
            <tr>
              <th>{{ entity === 'teachers' ? '老师' : entity === 'students' ? '学生' : entity === 'classes' ? '班级' : entity === 'externalLinks' ? '外部课程链接' : '课程' }}</th>
              <th v-if="entity === 'teachers'">职称</th>
              <th v-if="entity === 'students'">家长电话</th>
              <th v-if="entity === 'classes'">班型 / 老师</th>
              <th v-if="entity === 'courses'">适用年龄</th>
              <th v-if="entity === 'externalLinks'">适用课程</th>
              <th v-if="entity === 'externalLinks'">URL</th>
              <th v-if="entity !== 'externalLinks'">{{ entity === 'teachers' ? '账号绑定' : entity === 'students' ? '班级 / 作品' : entity === 'classes' ? '课程 / 学生' : '使用班级 / 外链' }}</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in records" :key="record.id" class="directory-table-row" :class="{ active: sameId(selected?.id, record.id) }" @click="selectRecord(record)">
              <td><strong>{{ record.name || record.title }}</strong></td>
              <td v-if="entity === 'teachers'">{{ record.role || record.title || '老师' }}</td>
              <td v-if="entity === 'students'">{{ record.phone || '—' }}</td>
              <td v-if="entity === 'classes'">{{ record.classTypeName || '—' }} · {{ record.teacherName || teacherName(record.teacherId) }}</td>
              <td v-if="entity === 'courses'">{{ record.age || '—' }}</td>
              <td v-if="entity === 'externalLinks'">{{ record.courseTitle || courseTitle(record.courseId) }}</td>
              <td v-if="entity === 'externalLinks'" class="directory-url">{{ record.url }}</td>
              <td v-if="entity === 'teachers'">{{ record.userId ? '已绑定' : '未绑定' }} · {{ record.classCount || 0 }} 个班</td>
              <td v-if="entity === 'students'">{{ record.classCount || 0 }} 个班 · {{ record.archiveWorkCount || 0 }} 件作品</td>
              <td v-if="entity === 'classes'">{{ record.courseTitle || courseTitle(record.courseId) }} · {{ record.studentCount || record.studentIds?.length || 0 }} 人</td>
              <td v-if="entity === 'courses'">{{ record.activeClassCount || 0 }} 个班 · {{ record.externalLinkCount || 0 }} 条外链</td>
              <td><span class="status-tag">{{ record.archived ? '已归档' : record.status }}</span></td>
              <td><button class="ghost" type="button" @click.stop="selectRecord(record)">{{ canEditMasterData && !record.archived ? '编辑' : '查看详情' }}</button></td>
            </tr>
          </tbody>
        </table>
        <div class="directory-mobile-cards">
          <button v-for="record in records" :key="record.id" type="button" class="directory-card" :class="{ active: sameId(selected?.id, record.id) }" @click="selectRecord(record)">
            <strong>{{ record.name || record.title }}</strong>
            <span v-if="entity === 'teachers'">{{ record.role || '老师' }} · {{ record.userId ? '已绑定账号' : '未绑定账号' }} · {{ record.classCount || 0 }} 个班</span>
            <span v-if="entity === 'students'">{{ record.phone || '无家长电话' }} · {{ record.classCount || 0 }} 个班 · {{ record.archiveWorkCount || 0 }} 件作品</span>
            <span v-if="entity === 'classes'">{{ record.teacherName || teacherName(record.teacherId) }} · {{ record.courseTitle || courseTitle(record.courseId) }} · {{ record.studentCount || 0 }} 人</span>
            <span v-if="entity === 'courses'">{{ record.age || '未设置年龄段' }} · {{ record.activeClassCount || 0 }} 个使用班级</span>
            <span v-if="entity === 'externalLinks'">{{ record.courseTitle || courseTitle(record.courseId) }} · {{ record.url }}</span>
            <em>{{ record.archived ? '已归档' : record.status }}</em>
          </button>
        </div>
        <PaginationBar :page="directoryState.page" :page-size="directoryState.pageSize" :total="directoryState.total" :loading="state.directoryLoading?.[entity]" @change="loadDirectory" />
      </div>
    </section>

    <div v-if="drawerOpen" class="directory-drawer-backdrop" @click.self="returnToList">
      <section class="master-detail panel directory-drawer">
      <div class="section-head">
        <div>
          <span>{{ mode === 'new' ? '新增' : mode === 'edit' ? '编辑' : '详情' }}</span>
          <strong>{{ mode === 'new' ? config.action : selected?.name || selected?.title }}</strong>
        </div>
        <div class="button-pair">
          <button v-if="showCloseAction" class="ghost" type="button" @click="returnToList">关闭</button>
          <button v-if="mode === 'detail' && !selected?.archived && canEditMasterData" class="secondary" type="button" @click="startEdit">编辑</button>
          <button v-if="mode === 'detail' && isArchivableEntity && selected?.archived && canEditMasterData" class="secondary" type="button" :disabled="detailLoading" @click="restoreSelected">恢复</button>
          <button v-if="isArchivableEntity && selected && !selected.archived && canEditMasterData" class="danger-text" type="button" :disabled="detailLoading || saving" @click="archiveSelected">归档</button>
          <button v-if="showMasterActions" class="ghost" type="button" @click="cancelEdit">取消</button>
          <button v-if="showMasterActions" class="primary" type="button" :disabled="saving || detailLoading || (mode === 'edit' && !isDirty)" @click="save">{{ mode === 'new' ? '保存' : '保存修改' }}</button>
        </div>
      </div>

      <section v-if="detailLoading" class="notice-box">
        <small>正在加载完整资料，请稍候…</small>
      </section>
      <section v-else-if="mode === 'detail' && selected && !selected.archived && !canEditMasterData" class="notice-box">
        <strong>当前为只读模式</strong>
        <small>当前账号没有主数据编辑权限，如需修改请联系管理员。</small>
      </section>

      <section v-if="selected?.archived && mode === 'detail'" class="notice-box archive-notice">
        <strong>该{{ entity === 'teachers' ? '老师' : entity === 'students' ? '学生' : entity === 'classes' ? '班级' : '课程' }}已归档</strong>
        <small>历史引用不会被修改；{{ selected.archiveReason ? `归档原因：${selected.archiveReason}` : '恢复后才可用于新建或编辑业务。' }}</small>
      </section>

      <template v-if="entity === 'teachers'">
        <div class="form-grid">
          <label>姓名<input v-model="draft.name" :disabled="formReadonly" /></label>
          <label>手机号<input v-model="draft.phone" :disabled="formReadonly" /></label>
          <label>职称<input v-model="draft.role" :disabled="formReadonly" /></label>
          <label>
            状态
            <AdaptiveSelect v-model="draft.status" :options="['启用', '停用']" :disabled="formReadonly" />
          </label>
          <label class="wide">
            绑定已有账号
            <AdaptiveSelect v-model="draft.userId" :options="[{ label: '未绑定账号', value: null }, ...availableIdentityUsers]" :disabled="formReadonly" />
            <small>账号创建和停用仍在“账号管理”中完成。</small>
          </label>
          <label class="wide">备注<textarea v-model="draft.note" rows="4" :disabled="formReadonly" /></label>
        </div>
        <div v-if="mode === 'detail'" class="master-form-section">
          <strong>账号关联</strong>
          <p v-if="selected?.userId">已关联账号：{{ state.identityUsers.find((user) => sameId(user.id, selected.userId))?.displayName || selected.userId }}</p>
          <p v-else>未绑定账号。绑定后，课后工作台会通过当前账号对应的老师档案识别身份。</p>
        </div>
      </template>

      <template v-if="entity === 'students'">
        <div v-if="mode !== 'new'" class="student-detail-tabs">
          <button :class="{ active: studentDetailTab === 'profile' }" type="button" @click="selectStudentTab('profile')">档案信息</button>
          <button :class="{ active: studentDetailTab === 'communication' }" type="button" @click="selectStudentTab('communication')">
            沟通记录
            <small>{{ communicationSummary.total }}</small>
          </button>
        </div>

        <template v-if="studentDetailTab === 'profile' || mode === 'new'">
          <section class="master-form-section">
            <strong>基础信息</strong>
            <div class="form-grid">
              <label>姓名<input v-model="draft.name" :disabled="formReadonly" /></label>
              <label>小名<input v-model="draft.nickname" :disabled="formReadonly" /></label>
              <label>年龄<input v-model="draft.age" type="number" :disabled="formReadonly" /></label>
              <label>
                所属班级
                <AdaptiveSelect v-model="draft.classId" :options="activeItems(state.classes).map((klass) => ({ label: klass.name, value: klass.id }))" :disabled="formReadonly" />
              </label>
              <label>家长称呼<input v-model="draft.parent" :disabled="formReadonly" /></label>
              <label>家长电话<input v-model="draft.phone" :disabled="formReadonly" /></label>
              <label>
                状态
                <AdaptiveSelect v-model="draft.status" :options="['在读', '停课', '请假', '退费']" :disabled="formReadonly" />
              </label>
              <label class="wide">备注<textarea v-model="draft.note" rows="4" :disabled="formReadonly" /></label>
            </div>
          </section>

          <template v-if="availableStudentProfileSections.length">
            <section v-for="section in availableStudentProfileSections" :key="section.title" class="master-form-section">
              <strong>{{ section.title }}</strong>
                <div class="form-grid">
                  <label v-for="field in section.fields" :key="field.key">
                    {{ field.label }}
                  <input v-model="draft[field.key]" :placeholder="field.hint" :disabled="formReadonly" />
                  </label>
                </div>
            </section>
          </template>
          <section v-if="mode !== 'new' && state.studentProfileAudits?.[selected?.id]?.items?.length" class="master-form-section profile-audit-section">
            <strong>CRM 档案变更记录</strong>
            <article v-for="audit in state.studentProfileAudits[selected.id].items.slice(0, 8)" :key="audit.id" class="audit-row">
              <div><span>{{ audit.fieldLabel || audit.fieldKey || '档案字段' }}</span><small>{{ audit.createdAt }} · {{ audit.changedByName || audit.changedBy || '系统' }}</small></div>
              <em>{{ audit.summary || audit.changeSummary || '已更新' }}</em>
            </article>
          </section>
        </template>

        <section v-else class="student-communication-panel">
          <template v-if="communicationView === 'list'">
            <div class="communication-list-head">
              <div class="communication-summary">
                <article>
                  <span>累计沟通</span>
                  <strong>{{ communicationSummary.total }}</strong>
                </article>
                <article>
                  <span>待跟进</span>
                  <strong>{{ communicationSummary.pending }}</strong>
                </article>
              </div>
              <button class="primary" type="button" @click="startNewCommunicationRecord">新增记录</button>
            </div>

            <div class="communication-toolbar">
              <label>
                沟通方式
                <AdaptiveSelect v-model="communicationMethodFilter" :options="communicationMethodOptions" />
              </label>
              <label>
                跟进状态
                <AdaptiveSelect v-model="communicationFollowFilter" :options="['全部记录', '待跟进', '无跟进']" />
              </label>
            </div>

            <div class="communication-timeline">
              <article v-for="record in visibleCommunicationRecords" :key="record.id" class="communication-record">
                <div class="communication-record-mark" />
                <div class="communication-record-body">
                  <header>
                    <div>
                      <strong>{{ record.contactPerson }}</strong>
                      <span>{{ record.contactRole }} · {{ record.contactMethod }} · {{ record.recordedAt }}</span>
                    </div>
                    <div class="button-pair">
                      <button class="ghost" type="button" @click="editCommunicationRecord(record)">编辑</button>
                      <button class="danger-text" type="button" @click="deleteCommunicationRecord(record)">删除</button>
                    </div>
                  </header>
                  <p>{{ record.content }}</p>
                  <em v-if="record.followUpAction">跟进：{{ record.followUpAction }}</em>
                  <small>记录人：{{ record.recordedBy }}{{ record.updatedAt ? ` · 更新于 ${record.updatedAt}` : '' }}</small>
                </div>
              </article>
              <div v-if="!visibleCommunicationRecords.length" class="notice-box">
                <small>暂无符合条件的沟通记录</small>
              </div>
            </div>
          </template>

          <section v-else class="communication-form-page">
            <div class="communication-form-head">
              <button class="module-back-link" type="button" @click="returnToCommunicationList">← 返回沟通记录</button>
              <div>
                <span>{{ communicationEditingId ? '编辑记录' : '新增记录' }}</span>
                <strong>{{ selected?.name }} · 沟通记录</strong>
              </div>
            </div>

            <div class="master-form-section communication-editor">
              <div class="form-grid">
                <label>沟通时间<input v-model="communicationDraft.recordedAt" /></label>
                <label>记录人<input v-model="communicationDraft.recordedBy" /></label>
                <label>沟通对象<input v-model="communicationDraft.contactPerson" /></label>
                <label>对象角色<input v-model="communicationDraft.contactRole" /></label>
                <label>
                  沟通方式
                  <AdaptiveSelect v-model="communicationDraft.contactMethod" :options="['微信', '电话', '到店沟通', '企业微信', '家长会', '其他']" />
                </label>
                <label class="wide">内容摘要<textarea v-model="communicationDraft.content" rows="5" placeholder="记录家长反馈、孩子状态、续课关注点或特殊情况" /></label>
                <label class="wide">跟进事项<textarea v-model="communicationDraft.followUpAction" rows="4" placeholder="没有待跟进事项可留空" /></label>
              </div>
              <div class="button-pair">
                <button class="ghost" type="button" @click="returnToCommunicationList">取消</button>
                <button class="primary" type="button" @click="saveCommunicationRecord">{{ communicationEditingId ? '保存记录' : '新增记录' }}</button>
              </div>
            </div>
          </section>
        </section>
      </template>

      <template v-if="entity === 'classes'">
        <div class="form-grid">
          <label>班级名<input v-model="draft.name" :disabled="formReadonly" /></label>
          <label>上课时间<input v-model="draft.time" :disabled="formReadonly" /></label>
          <label>
            任课老师
            <AdaptiveSelect v-model="draft.teacherId" :options="activeItems(state.teachers).map((teacher) => ({ label: teacher.name, value: teacher.id }))" :disabled="formReadonly" />
          </label>
          <label>
            默认课程
            <AdaptiveSelect v-model="draft.courseId" :options="activeItems(state.courses).map((course) => ({ label: course.title, value: course.id }))" :disabled="formReadonly" />
          </label>
          <label>
            状态
            <AdaptiveSelect v-model="draft.status" :options="['筹备中', '开班中', '停课', '结课']" :disabled="formReadonly" />
          </label>
          <label class="wide">
            家长群
            <input v-model="draft.group" disabled />
          </label>
        </div>
        <div class="member-picker">
          <strong>学生名单</strong>
          <label v-for="student in activeItems(state.students)" :key="student.id" class="inline-check">
            <input type="checkbox" :checked="draft.studentIds?.some((id) => sameId(id, student.id))" :disabled="formReadonly" @change="toggleStudentInClass(student.id)" />
            <span>{{ student.name }} · {{ student.status }} · {{ className(student.classId) }}</span>
          </label>
        </div>
      </template>

      <template v-if="entity === 'courses'">
        <div class="form-grid">
          <label>课程类别/课程资料<input v-model="draft.title" :disabled="formReadonly" /></label>
          <label>适用年龄<input v-model="draft.age" :disabled="formReadonly" /></label>
          <label>默认关注点<input v-model="draft.defaultFocus" disabled /></label>
          <label>材料<input v-model="draft.materials" :disabled="formReadonly" /></label>
          <label>
            课评模板
            <AdaptiveSelect v-model="draft.commentTemplate" :options="state.templates.comment.map((template) => template.name)" disabled />
          </label>
          <label>
            图片模板
            <AdaptiveSelect v-model="draft.imageTemplate" :options="state.templates.image.map((template) => template.name)" disabled />
          </label>
          <label class="wide">教学目标<textarea v-model="draft.goal" rows="3" :disabled="formReadonly" /></label>
          <label class="wide">AI 参考材料和特殊话术<textarea v-model="draft.reference" rows="5" :disabled="formReadonly" /></label>
        </div>
      </template>

      <template v-if="entity === 'externalLinks'">
        <div class="form-grid">
          <label>标题<input v-model="draft.title" :disabled="formReadonly" /></label>
          <label>
            状态
            <AdaptiveSelect v-model="draft.status" :options="['启用', '停用']" :disabled="formReadonly" />
          </label>
          <label>平台<input :value="draft.platform || '通用链接'" disabled /></label>
          <label class="wide">链接地址<input v-model="draft.url" :disabled="formReadonly" /></label>
          <label class="wide">
            适用课程
            <AdaptiveSelect
              v-model="draft.courseId"
              :options="[{ label: '未绑定课程', value: null }, ...activeItems(state.courses).map((course) => ({ label: course.title, value: course.id }))]"
              :disabled="formReadonly"
            />
          </label>
          <label class="wide">备注<textarea v-model="draft.note" rows="4" :disabled="formReadonly" /></label>
        </div>
      </template>
    </section>
    </div>
  </section>
</template>
