import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { usePortfolioStudio } from './usePortfolioStudio'
import { api } from '../services/api'
import {
  ApiError,
  clearSession,
  createIdempotencyKey,
  getAccessToken,
  getSession,
  onSessionChanged,
  recordApiCacheHit,
  subscribeSse,
  setSession,
  updateStoredMe
} from '../services/apiClient'
import {
  displayDate,
  displayDateTime,
  displayTime,
  fromApiId,
  fromApiIds,
  identityRoleNames,
  mapCampus,
  mapArchiveRecord,
  mapArchiveVersion,
  mapAsset,
  mapAttendance,
  mapArtwork,
  mapClass,
  mapCloudArchiveJob,
  mapCloudArchiveBatch,
  mapCampusMembership,
  mapCourse,
  mapExternalLink,
  mapExtraArtwork,
  mapExtraTask,
  mapFeedback,
  mapJob,
  mapFile,
  mapIdentityPermission,
  mapIdentityRole,
  mapIdentityUser,
  mapLesson,
  mapPage,
  mapProfileAudit,
  mapProfileField,
  mapProfileValue,
  mapQualityReview,
  mapSupervisionLesson,
  mapStudent,
  mapTeacher,
  mapTeacherArchive,
  mapTerm,
  mapTodo,
  mapHomework,
  mapSharePage,
  mapTouchTask,
  mapWheat,
  sameId,
  toApiAssetType,
  toApiAttendanceStatus,
  toApiLessonStatus,
  toApiLessonType,
  toApiWheatCommand
} from '../services/mappers'
import { sha256ForFile, uploadFile } from '../services/fileService'
import { clearProtectedMediaCache } from '../services/protectedMediaCache'
import { loadAllPageItems } from '../utils/pagination'
import {
  DEFAULT_BAIDU_BACKEND_BASE_URL,
  DEFAULT_BAIDU_FRONTEND_BASE_URL,
  DEFAULT_BAIDU_FRONTEND_RETURN_PATH,
  normalizeBaiduBaseUrl,
  normalizeBaiduReturnPath
} from '../services/baiduConfig'
import {
  buildClientImageTemplateConfig,
  imageTemplateSummary,
  isClientCanvasTemplate,
  normalizeImageTemplate,
  renderArtworkFile
} from '../services/imageTemplateRenderer'
import {
  feedbackTemplateBodyFor,
  feedbackTemplateUpdateBodyFor,
  mapFeedbackTemplate,
  textField
} from '../services/templateMappers'
import {
  apiAssetTypeForUpload,
  defaultMaterialVisible,
  materialCategoryForType,
  uiMaterialTypeForUpload
} from '../services/materialTypes'

const clone = (value) => JSON.parse(JSON.stringify(value))
const DEFAULT_ARCHIVE_RULE = '/{campus}/教学资料归档/课程归总/{year}/{term}+{classType}归总'
const templateIsEnabled = (value) => String(value?.status || 'ENABLED').toUpperCase() !== 'DISABLED'
const homeworkIsAssigned = (value) => value?.taskMode
  ? value.taskMode === 'ASSIGNED'
  : Boolean(String(value?.content || '').trim())
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const displayDateFromValue = (value) => {
  if (!value) return ''
  const [, month, day] = value.split('-').map(Number)
  return `${month}月${day}日`
}
const isWithinDateRange = (value, start, end) => {
  if (!value) return !start && !end
  return (!start || value >= start) && (!end || value <= end)
}
const localTodayValue = () => {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const profileKeyAliases = {
  residential_community: 'residentialCommunity',
  school_name: 'schoolName',
  training_brand_interest: 'trainingBrandInterest',
  primary_caregiver: 'primaryCaregiver',
  purchase_decision_power: 'purchaseDecisionPower',
  decision_interview_time: 'decisionInterviewTime'
}
const profileUiKey = (fieldKey) => profileKeyAliases[fieldKey] || String(fieldKey || '').replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
const profileApiKey = (fieldKey) => Object.entries(profileKeyAliases).find(([, value]) => value === fieldKey)?.[0] || fieldKey

export function useDeliveryWorkflow() {
  const storedMe = ref(getSession())
  const school = reactive({ name: '课后交付系统', campus: '', address: '', aiProvider: '', objectStorage: '', watermark: '' })
  const campuses = reactive([])
  const artworkLibrary = reactive([])
  const teachers = reactive([])
  const students = reactive([])
  const classes = reactive([])
  const courses = reactive([])
  const scheduleLessons = reactive([])
  const templates = reactive({ image: [], comment: [] })
  const classTypes = reactive([])
  const tasks = reactive([])
  // The shell's inbox is deliberately separate from the Today page collection.
  // Today is a navigation view; the inbox must also surface older lessons that
  // are still open or were reopened for remediation.
  const inboxLessons = reactive([])
  const archives = reactive([])
  const archiveRecords = reactive([])
  const archiveCollections = reactive([])
  const communicationRecords = reactive([])
  const studentProfileFields = reactive([])
  const studentProfiles = reactive({})
  const studentProfileAudits = reactive({})
  const aiCallLogStore = reactive([])
  const extraTaskArchives = reactive([])
  const extraTaskWorks = reactive([])
  const externalLinks = reactive([])
  const wheatTraces = reactive([])
  const todos = reactive([])
  const cloudArchiveTodos = reactive([])
  const pendingReviewQueue = reactive([])
  const importBatches = reactive([])
  const importPreviewRows = reactive([])
  const settings = reactive([])
  const providerGroups = reactive([])
  const cloudProviderPicker = reactive({
    open: false,
    lessonId: null,
    providers: [],
    selectedProviderId: null
  })
  let cloudProviderPickerResolver = null
  let cloudProviderPickerPromise = null
  let cloudProviderSelectionPromise = null
  const cloudArchiveRule = reactive({
    id: null,
    pathTemplate: DEFAULT_ARCHIVE_RULE,
    filenameTemplate: '',
    required: false,
    duplicateStrategy: 'SUFFIX',
    configured: false
  })
  const qualityReviews = reactive([])
  const terms = reactive([])
  const supervisionDashboard = reactive([])
  const teacherArchives = reactive([])
  const providerCatalog = reactive({ cloud: [], wecom: [], ai: [] })
  const permissionCatalog = reactive([])
  const identityUsers = reactive([])
  const identityRoles = reactive([])
  const identityPermissions = reactive([])
  const currentTeacherProfile = ref(null)
  const masterArchiveState = reactive({ teachers: 'ACTIVE', students: 'ACTIVE', classes: 'ACTIVE', courses: 'ACTIVE' })
  const teacherSourceMappings = reactive([])
  const identityUserPage = reactive({ page: 1, pageSize: 20, total: 0 })
  const identityUserQuery = ref('')
  const identityUserStatus = ref('')
  const identityLoading = reactive({ users: false, roles: false, permissions: false, memberships: false })
  const identityLoaded = reactive({ users: false, roles: false, permissions: false })
  const identityErrors = reactive({ users: '', roles: '', permissions: '', memberships: '' })
  const statusChangeLogs = reactive([])
  const archiveEditLogs = reactive([])
  const wecomSendTasks = reactive([])

  // The drawer is a personal action inbox. Keep this scope explicit so a
  // shared class or an administrator permission cannot widen it accidentally.
  const currentTodoScope = () => {
    const teacherId = currentTeacherProfile.value?.id
    return teacherId ? { teacherId: String(teacherId), dateTo: localTodayValue() } : null
  }

  const activeTaskId = ref(null)
  // Keeps a historical schedule lesson visible while the daily task list and
  // the aggregated lesson workspace are loading.
  const selectedTaskSnapshot = ref(null)
  const copied = ref(false)
  const copiedStudentId = ref(null)
  const isLoggedIn = ref(Boolean(getAccessToken() && storedMe.value))
  const currentUserId = ref(null)
  const loginForm = reactive({ phone: '', password: '' })
  const remoteLoading = ref(false)
  const remoteReady = ref(false)
  const pageLoading = reactive({})
  const pageLoaded = reactive({})
  const pageErrors = reactive({})
  const shellSummary = reactive({ pendingLessons: 0, wheatPending: 0, openTodos: 0, importIssues: 0, cloudArchiveFailures: 0, pendingQualityReviews: 0, pendingParentTouches: 0 })
  const shellPages = reactive({
    lessons: { page: 1, pageSize: 20, total: 0 },
    wheatTraces: { page: 1, pageSize: 20, total: 0 },
    todos: { page: 1, pageSize: 20, total: 0 }
  })
  // Every server-backed list keeps its own page contract even when the first
  // screen only renders page one. This prevents components from having to
  // infer totals from the currently loaded array.
  const pageMeta = reactive({})
  const scheduleMeta = reactive({ page: 1, pageSize: 200, total: 0, filters: {}, allPages: false })
  const scheduleLoading = ref(false)
  const scheduleError = ref('')
  // Directory pages are intentionally separate from the reference collections
  // used by the lesson workspace. A paginated directory request must never
  // replace the teacher/student/class/course options used by the mobile flow.
  const directoryPages = reactive({
    teachers: { items: [], page: 1, pageSize: 20, total: 0, filters: {} },
    students: { items: [], page: 1, pageSize: 20, total: 0, filters: {} },
    classes: { items: [], page: 1, pageSize: 20, total: 0, filters: {} },
    courses: { items: [], page: 1, pageSize: 20, total: 0, filters: {} },
    externalLinks: { items: [], page: 1, pageSize: 20, total: 0, filters: {} },
    extraTasks: { items: [], page: 1, pageSize: 20, total: 0, filters: {} },
    archiveRecords: { items: [], page: 1, pageSize: 20, total: 0, filters: {} },
    classroomArchives: { items: [], page: 1, pageSize: 20, total: 0, filters: {} },
    teacherArchives: { items: [], page: 1, pageSize: 20, total: 0, filters: {} }
  })
  const directoryLoading = reactive({})
  const directoryErrors = reactive({})
  const directoryPromises = new Map()
  const schedulePromises = new Map()
  const processingAction = ref('')
  const jobProgress = reactive({})
  const jobWatchers = new Map()
  const toast = ref('')
  const previewPulse = ref(false)
  const commentPulse = ref(false)
  const reportPulse = ref(false)

  const createStudentDeliveries = (task, useInitialSeed = false) => {
    if (!task?.id) return []
      const targetClass = classes.find((item) => sameId(item.id, task.classId))
    if (useInitialSeed) return []

    return (targetClass?.studentIds || []).map((studentId) => {
      const student = students.find((item) => sameId(item.id, studentId))
      const isAbsent = student?.status === '请假'
      return {
        id: studentId,
        lessonId: task.id,
        studentId,
        attendance: isAbsent ? '请假' : '到课',
        originalImage: '',
        processedImage: '',
        imageProcessStatus: '未处理',
        imageProcessError: '',
        image: '',
        images: [],
        imageMatched: false,
        processed: false,
        imageConfirmed: false,
        record: '',
        focus: '色彩',
        comment: '',
        confirmed: false,
        artworks: [],
        activeArtworkId: null,
        highlight: false,
        highlightNote: '',
        shareReady: false,
        archived: false
      }
    })
  }

  const createArchiveChecklist = () => ({
    parentTouch: { status: '待创建', detail: '', method: '', sentCount: 0, updatedAt: '' },
    studentCloudArchive: { status: '待推送', detail: '', updatedAt: '' },
    teacherEffectArchive: { status: '待生成', detail: '', title: '', imageCount: 0, updatedAt: '' },
    wheatTrace: { status: '待生成', detail: '', traceId: null, updatedAt: '' }
  })

  const createLessonWorkspace = (task, useInitialSeed = false) => ({
    lessonId: task.id,
    studentDeliveries: createStudentDeliveries(task, useInitialSeed),
    materials: [],
    materialsConfirmedEmpty: false,
    materialsVersion: null,
    homework: { lessonId: task.id, taskMode: 'NONE', content: '', requirement: '', dueDate: '', visible: false, externalLinkIds: [], version: 0 },
    displayConfig: { lessonId: task.id, expiresInDays: 30, showMaterials: true, showHomework: false, showHighlight: true, showLessonType: true },
    bulkRecord: '',
    selectedImageTemplate: [],
    selectedCommentTemplate: 0,
    activeShareMode: 'student',
    activeStudentId: null,
    activeArtworkId: null,
    teacherEffect: null,
    cloudJobs: [],
    cloudBatch: null,
    cloudProgress: null,
    archiveVersions: [],
    selectedArchiveTargets: ['system', 'wheat'],
    archiveChecklist: createArchiveChecklist(),
    currentStep: 0,
    showReport: false,
    sharePage: {
      id: null,
      status: '草稿',
      version: 0,
      draftVersion: 1,
      publishedVersion: 0,
      publishedSnapshot: null,
      studentTokens: {},
      accessLinks: [],
      lastPublishedHash: '',
      revokedReason: '',
      publishedAt: '',
      revokedAt: '',
      expiresAtTimestamp: null
    }
  })

  const lessonWorkspaces = reactive({})
  const emptyLessonWorkspace = reactive(createLessonWorkspace({ id: null }, false))

  const ensureLessonWorkspace = (task) => {
    if (!task?.id) return emptyLessonWorkspace
    if (!lessonWorkspaces[task.id]) lessonWorkspaces[task.id] = createLessonWorkspace(task)
    const workspace = lessonWorkspaces[task.id]
    if (!workspace.activeStudentId) {
      workspace.activeStudentId =
        workspace.studentDeliveries.find((row) => row.attendance === '到课')?.studentId ||
        workspace.studentDeliveries[0]?.studentId ||
        null
    }
    return workspace
  }

  const persistSharePage = (lessonId, page) => {
    return page
  }

  const activeWorkspace = computed(() => ensureLessonWorkspace(activeTask.value))
  const sessionStudents = computed(() => activeWorkspace.value.studentDeliveries)
  const materials = computed(() => activeWorkspace.value.materials)
  const demoMaterials = computed(() => materials.value.filter((item) => item.type === '范画'))
  const stepMaterials = computed(() => materials.value.filter((item) => item.type === '步骤图'))
  const classroomMediaMaterials = computed(() => materials.value.filter((item) => ['课堂照片', '课堂视频'].includes(item.type)))
  const referenceMaterials = computed(() => materials.value.filter((item) => item.type !== '课件'))
  const coursewareMaterials = computed(() => materials.value.filter((item) => item.type === '课件'))
  const materialsConfirmedEmpty = computed({
    get: () => Boolean(activeWorkspace.value.materialsConfirmedEmpty),
    set: (value) => { activeWorkspace.value.materialsConfirmedEmpty = Boolean(value) }
  })
  const homework = computed(() => activeWorkspace.value.homework)
  const displayConfig = computed(() => activeWorkspace.value.displayConfig)
  const sharePage = computed(() => activeWorkspace.value.sharePage)
  const activeStudentId = computed({
    get: () => activeWorkspace.value.activeStudentId,
    set: (value) => { activeWorkspace.value.activeStudentId = value === '' || value === undefined ? null : value }
  })
  const activeArtworkId = computed({
    get: () => activeWorkspace.value.activeArtworkId,
    set: (value) => { activeWorkspace.value.activeArtworkId = value === '' || value === undefined ? null : value }
  })
  const currentStep = computed({
    get: () => activeWorkspace.value.currentStep,
    set: (value) => { activeWorkspace.value.currentStep = Number(value) }
  })
  const selectedImageTemplates = computed({
    get: () => {
      const value = activeWorkspace.value.selectedImageTemplate
      if (Array.isArray(value)) return value.map((item) => Number(item)).filter((item) => Number.isInteger(item))
      if (value === '' || value === null || value === undefined) return []
      return [Number(value)].filter((item) => Number.isInteger(item))
    },
    set: (value) => {
      activeWorkspace.value.selectedImageTemplate = [...new Set((Array.isArray(value) ? value : [value]).map((item) => Number(item)).filter((item) => Number.isInteger(item)))]
    }
  })
  const selectedImageTemplate = computed({
    get: () => selectedImageTemplates.value[0] ?? 0,
    set: (value) => { selectedImageTemplates.value = [Number(value)] }
  })
  const selectedCommentTemplate = computed({
    get: () => activeWorkspace.value.selectedCommentTemplate,
    set: (value) => { activeWorkspace.value.selectedCommentTemplate = Number(value) }
  })
  const bulkRecord = computed({
    get: () => activeWorkspace.value.bulkRecord,
    set: (value) => { activeWorkspace.value.bulkRecord = value }
  })
  const activeShareMode = computed({
    get: () => activeWorkspace.value.activeShareMode,
    set: (value) => { activeWorkspace.value.activeShareMode = value }
  })
  const selectedArchiveTargets = computed({
    get: () => activeWorkspace.value.selectedArchiveTargets || ['system', 'wheat'],
    set: (value) => { activeWorkspace.value.selectedArchiveTargets = value }
  })
  const archiveChecklist = computed(() => {
    if (!activeWorkspace.value.archiveChecklist) activeWorkspace.value.archiveChecklist = createArchiveChecklist()
    return activeWorkspace.value.archiveChecklist
  })
  const showReport = computed({
    get: () => activeWorkspace.value.showReport,
    set: (value) => { activeWorkspace.value.showReport = Boolean(value) }
  })
  const aiCallLogs = computed(() => aiCallLogStore.filter((log) => sameId(log.lessonId, activeTaskId.value)))

  const currentUser = computed(() => {
    const user = storedMe.value?.user
    if (user) {
      const role = identityRoleNames(storedMe.value?.roles) || '未分配角色'
      const teacherId = currentTeacherProfile.value?.id || null
      return {
        id: fromApiId(user.id),
        name: user.displayName || user.username || user.phone || '',
        username: user.username,
        phone: user.phone,
        role,
        teacherId,
        teacherLinked: Boolean(teacherId),
        roles: storedMe.value?.roles || [],
        permissions: storedMe.value?.permissions || [],
        classes: classes.filter((klass) => sameId(klass.teacherId, teacherId)).map((klass) => klass.id)
      }
    }
    const teacher = teachers.find((item) => sameId(item.id, currentUserId.value))
    if (!teacher) return null
    return {
      ...teacher,
      teacherId: teacher.id,
      teacherLinked: true,
      role: teacher.role || '老师'
    }
  })
  const isAdmin = computed(() => {
    const permissions = storedMe.value?.permissions || []
    return Boolean(currentUser.value && permissions.some((permission) => String(permission).includes('identity.') || String(permission).includes('configuration.')))
  })
  const canManageIdentityUsers = computed(() => {
    const permissions = storedMe.value?.permissions || []
    return Boolean(currentUser.value && (isAdmin.value || permissions.includes('identity.user.manage')))
  })
  const canManageIdentityRoles = computed(() => {
    const permissions = storedMe.value?.permissions || []
    return Boolean(currentUser.value && (isAdmin.value || permissions.includes('identity.role.manage')))
  })
  const canManageIdentityMemberships = computed(() => {
    const permissions = storedMe.value?.permissions || []
    return Boolean(currentUser.value && (isAdmin.value || permissions.includes('identity.membership.manage')))
  })
  const canEditMasterData = computed(() => {
    const permissions = storedMe.value?.permissions || []
    return Boolean(currentUser.value && permissions.includes('masterdata.edit'))
  })
  const canEditLessons = computed(() => {
    const permissions = storedMe.value?.permissions || []
    return Boolean(currentUser.value && permissions.includes('lesson.edit'))
  })
  const canQualityReview = computed(() => {
    const permissions = storedMe.value?.permissions || []
    return Boolean(currentUser.value && (isAdmin.value || permissions.includes('quality.review')))
  })
  const canQualityRead = computed(() => {
    const permissions = storedMe.value?.permissions || []
    return Boolean(currentUser.value && (isAdmin.value || permissions.includes('quality.read') || permissions.includes('quality.review')))
  })
  const canEditExtraTaskArtwork = computed(() => {
    const permissions = storedMe.value?.permissions || []
    return Boolean(currentUser.value && (isAdmin.value || permissions.includes('extra-task.edit')))
  })
  const authorizedClassIds = computed(() => {
    if (isAdmin.value) return classes.map((klass) => klass.id)
    const assigned = classes.filter((klass) => sameId(klass.teacherId, currentTeacherProfile.value?.id)).map((klass) => klass.id)
    const lessonAssigned = tasks
      .filter((task) => sameId(task.teacherId, currentTeacherProfile.value?.id))
      .map((task) => task.classId)
      .filter(Boolean)
    return [...new Set([...(currentUser.value?.classes || []), ...assigned, ...lessonAssigned])]
  })
  const visibleTasks = computed(() =>
    tasks.filter((task) => isAdmin.value || authorizedClassIds.value.some((id) => sameId(id, task.classId)))
  )
  const visibleInboxLessons = computed(() => {
    const scope = currentTodoScope()
    if (!scope) return []
    return inboxLessons.filter((lesson) =>
      sameId(lesson.teacherId, scope.teacherId)
      && lesson.dateValue
      && lesson.dateValue <= scope.dateTo
    )
  })
  const visibleNavItems = computed(() => {
    const permissions = new Set(storedMe.value?.permissions || [])
    const can = (...keys) => isAdmin.value || keys.some((key) => permissions.has(key))
    const requiredPermissions = {
      tasks: ['lesson.read'],
      supervision: ['quality.read', 'quality.review'],
      students: ['masterdata.read'],
      classes: ['masterdata.read'],
      teachers: ['masterdata.read'],
      externalLinks: ['masterdata.read'],
      courses: ['masterdata.read'],
      archives: ['archive.read'],
      extraTasks: ['extra-task.read'],
      imports: ['import.create', 'import.preview', 'import.confirm'],
      schedule: ['lesson.read'],
      templates: ['lesson.read'],
      accountManagement: ['identity.user.manage'],
      roleManagement: ['identity.role.manage'],
      permissionResources: ['identity.role.manage'],
      settings: ['identity.user.manage', 'configuration.provider.read', 'configuration.manage']
    }
    return Object.entries(requiredPermissions)
      .filter(([, keys]) => !can(...keys))
      .map(([navId]) => navId)
  })
  const activeTask = computed(() => {
    const selected = visibleTasks.value.find((task) => sameId(task.id, activeTaskId.value)) ||
      scheduleLessons.find((lesson) => sameId(lesson.id, activeTaskId.value)) ||
      (sameId(selectedTaskSnapshot.value?.id, activeTaskId.value) ? selectedTaskSnapshot.value : null)
    return selected || visibleTasks.value[0] || {
      id: null, classId: null, className: '', courseId: null, courseTitle: '', topic: '', teacherId: null, teacher: '', date: '', dateValue: '', time: '', lessonType: '其他', status: '待处理', version: 0, wheatStatus: '未生成'
    }
  })
  const activeClass = computed(() => classes.find((item) => sameId(item.id, activeTask.value?.classId)) || { id: activeTask.value?.classId || null, name: activeTask.value?.className || '未选择班级', studentIds: [], time: '' })
  const activeCourse = computed(() => courses.find((item) => sameId(item.id, activeTask.value?.courseId)) || { id: activeTask.value?.courseId || null, title: activeTask.value?.courseTitle || '待配置', materials: '', defaultFocus: '' })
  const activeSessionStudent = computed(() => sessionStudents.value.find((item) => sameId(item.studentId, activeStudentId.value)))
  const sessionStudentFor = (studentId = activeStudentId.value) => sessionStudents.value.find((item) => sameId(item.studentId, studentId))
  const artworksForRow = (row) => Array.isArray(row?.artworks) ? row.artworks : []
  const artworkForTarget = (target = activeArtworkId.value) => {
    if (target && typeof target === 'object' && target.artworkId) return target
    const targetId = target === null || target === undefined ? activeArtworkId.value : target
    for (const row of sessionStudents.value) {
      const found = artworksForRow(row).find((artwork) => sameId(artwork.artworkId || artwork.id, targetId))
      if (found) return found
    }
    const row = sessionStudentFor(targetId)
    return artworksForRow(row)[0] || (row?.artworkId ? row : null)
  }
  const activeArtwork = computed(() => artworkForTarget(activeArtworkId.value) || artworksForRow(activeSessionStudent.value)[0] || null)
  const activeStudent = computed(() => students.find((item) => sameId(item.id, activeStudentId.value)) || sessionStudents.value.find((item) => sameId(item.studentId, activeStudentId.value)) && {
    id: activeStudentId.value,
    name: sessionStudents.value.find((item) => sameId(item.studentId, activeStudentId.value))?.studentName || '未命名学生',
    parent: sessionStudents.value.find((item) => sameId(item.studentId, activeStudentId.value))?.parent || ''
  })
  const classStudents = computed(() => (activeClass.value.studentIds || []).map((id) => students.find((item) => sameId(item.id, id))).filter(Boolean))
  const attendingRows = computed(() => sessionStudents.value.filter((item) => item.attendance === '到课'))
  const activeImageTemplates = computed(() => {
    const picked = selectedImageTemplates.value.map((index) => templates.image[index])
      .filter((template) => template && templateIsEnabled(template))
    const firstEnabled = templates.image.find(templateIsEnabled)
    return picked.length ? picked : firstEnabled ? [firstEnabled] : []
  })
  const activeImageTemplate = computed(() => activeImageTemplates.value[0] || null)
  // A template selection is preview-only until the teacher adopts it. Keep a
  // lightweight client-side marker so clicking "采用处理图" repeatedly does
  // not upload the same render again during the current session.
  const clientRenderSignatureByArtwork = new Map()
  const clientRenderSignature = (row, template) => [
    String(row?.originalVersionId || ''),
    String(template?.id || template?.templateKey || ''),
    String(template?.templateVersion || 1)
  ].join(':')
  const hasCurrentClientRender = (row, template) => Boolean(
    row?.processedVersionId &&
    clientRenderSignatureByArtwork.get(String(row.artworkId)) === clientRenderSignature(row, template)
  )
  const activeCommentTemplate = computed(() => {
    const selected = templates.comment[selectedCommentTemplate.value]
    return selected && templateIsEnabled(selected)
      ? selected
      : templates.comment.find(templateIsEnabled) || { name: '默认课评', tone: '', length: '' }
  })
  const isProcessing = computed(() => Boolean(processingAction.value))
  const selectedExternalLinks = computed(() => externalLinks.filter((link) => (homework.value.externalLinkIds || []).some((id) => sameId(id, link.id))))
  const permissionSummary = computed(() => ({
    role: currentUser.value?.role || '未登录',
    visibleClasses: authorizedClassIds.value.map((id) => classes.find((klass) => sameId(klass.id, id))?.name).filter(Boolean),
    taskScope: isAdmin.value ? '全部课次' : '本人授权班级课次',
    canManageSettings: isAdmin.value,
    canProcessLesson: Boolean(activeTask.value && (isAdmin.value || authorizedClassIds.value.some((id) => sameId(id, activeTask.value.classId))))
  }))
  const importStats = computed(() => ({
    total: importPreviewRows.length,
    ok: importPreviewRows.filter((row) => row.status === '可导入').length,
    warning: importPreviewRows.filter((row) => row.status !== '可导入').length
  }))
  const cloudDriveSetting = computed(() => settings.find((item) => item.type === 'cloudDrive' || item.name === '网盘配置'))
  const wecomSetting = computed(() => settings.find((item) => item.type === 'wecom' || item.name === '企业微信触达'))
  const wecomEnabled = computed(() => Boolean(
    wecomSetting.value?.status === '已启用' ||
    cloudDriveSetting.value?.value?.providers?.some((provider) =>
      provider.enabled && ['WECOM', 'WE_COM', '企业微信'].includes(String(provider.providerType || provider.type).toUpperCase())
    )
  ))
  const enabledCloudProviders = computed(() => {
    const cloudGroup = providerGroups.find((group) => String(group.category || '').toLowerCase() === 'cloud')
    const providers = cloudGroup
      ? (cloudGroup.value?.providers || [])
      : (cloudDriveSetting.value?.value?.providers || [])
    return providers.filter((provider) => provider.enabled)
  })
  const archiveTargets = computed(() => [
    {
      id: 'system',
      label: '系统作品档案',
      required: true,
      status: '必选'
    },
    ...enabledCloudProviders.value.map((provider) => ({
      id: `cloud:${provider.id}`,
      label: provider.name,
      required: false,
      status: provider.tokenStatus || '已配置'
    })),
    {
      id: 'wheat',
      label: '小麦消课待办',
      required: true,
      status: activeTask.value?.wheatStatus || '未生成'
    }
  ])
  const archiveFilter = reactive({
    studentId: 'all',
    classId: 'all',
    teacher: 'all',
    dateStart: '',
    dateEnd: '',
    sourceType: 'all',
    highlightOnly: false,
    frameStatus: 'all'
  })
  const filteredArchiveRecords = computed(() =>
    archiveRecords.filter((record) => {
      const studentOk = archiveFilter.studentId === 'all' || sameId(record.studentId, archiveFilter.studentId)
      const classOk = archiveFilter.classId === 'all' || sameId(record.classId, archiveFilter.classId)
      const teacherOk = archiveFilter.teacher === 'all' || record.teacher === archiveFilter.teacher
      const dateOk = isWithinDateRange(record.dateValue, archiveFilter.dateStart, archiveFilter.dateEnd)
      const source = record.sourceType || 'lesson'
      const sourceOk = archiveFilter.sourceType === 'all' || source === archiveFilter.sourceType
      const highlightOk = !archiveFilter.highlightOnly || record.highlight
      const frameOk =
        archiveFilter.frameStatus === 'all' ||
        (archiveFilter.frameStatus === 'framed' && record.framed) ||
        (archiveFilter.frameStatus === 'unframed' && !record.framed)
      return studentOk && classOk && teacherOk && dateOk && sourceOk && highlightOk && frameOk
    })
  )
  const lessonArchiveRecords = computed(() => {
    const taskRecords = visibleTasks.value.map((task) => {
      const workspace = ensureLessonWorkspace(task)
      const klass = classes.find((item) => sameId(item.id, task.classId))
      const course = courses.find((item) => sameId(item.id, task.courseId))
      const trace = wheatTraces.find((item) => sameId(item.lessonId, task.id))
      const savedWorks = archiveRecords.filter((record) => sameId(record.lessonId, task.id))
      const toStudentWork = (record) => {
        const nested = Array.isArray(record.artworks) ? record.artworks : []
        const artworks = nested.length ? nested : (record.fileId || record.artwork ? [{
          artworkId: record.artworkId || record.sourceId || record.id,
          fileId: record.fileId,
          fileUrl: record.artwork || '',
          title: record.title || '学生作品',
          sortOrder: 0,
          highlight: Boolean(record.highlight),
          highlightNote: record.highlightNote || ''
        }] : [])
        const current = artworks[0] || {}
        return {
          ...record,
          artworks,
          artworkCount: artworks.length,
          fileId: record.fileId || current.fileId || null,
          artwork: record.artwork || current.fileUrl || current.artwork || '',
          imageMatched: Boolean(artworks.length),
          imageConfirmed: artworks.every((artwork) => artwork.fileId || artwork.fileUrl),
          highlight: artworks.some((artwork) => artwork.highlight),
          highlightNote: artworks.find((artwork) => artwork.highlight)?.highlightNote || record.highlightNote || '',
          shareReady: record.shareReady ?? Boolean(record.shareUrl),
          archived: record.archived ?? task.archived
        }
      }
      const studentWorks = (savedWorks.length ? savedWorks.map(toStudentWork) : workspace.studentDeliveries.filter((row) => row.attendance === '到课').map((row) => {
        const student = students.find((item) => sameId(item.id, row.studentId))
        return {
          id: `${task.id}-${row.studentId}`,
          lessonId: task.id,
          studentId: row.studentId,
          studentName: student?.name || row.studentName || '学生',
          artworks: artworksForRow(row).map((artwork) => ({
            artworkId: artwork.artworkId,
            fileId: artwork.displayFileId || artwork.fileId,
            fileUrl: artwork.image || '',
            title: artwork.artworkTitle || artwork.title || '学生作品',
            sortOrder: artwork.sortOrder,
            highlight: artwork.highlight,
            highlightNote: artwork.highlightNote || ''
          })),
          fileId: row.displayFileId || row.fileId || null,
          artwork: row.image,
          feedback: row.comment,
          highlight: row.highlight,
          highlightNote: row.highlightNote,
          shareReady: row.shareReady,
          archived: row.archived,
          imageMatched: row.imageMatched,
          imageConfirmed: row.imageConfirmed,
          artworkCount: artworksForRow(row).length
        }
      }).map(toStudentWork))
      const materialItems = (workspace.materials || []).map((material) => ({
        ...material,
        archiveRole: material.type === '课件' ? '备课课件' : material.type === '步骤图' ? '课堂步骤' : '课堂参考'
      }))
      return {
        id: `task-${task.id}`,
        source: 'task',
        lessonId: task.id,
        date: task.date,
        dateValue: task.dateValue,
        time: task.time,
        classId: task.classId,
        className: klass?.name || '班级',
        classArchived: Boolean(task.classArchived || klass?.archived),
        classType: klass?.classType || '固定班',
        teacher: task.teacher,
        teacherArchived: Boolean(task.teacherArchived),
        course: course?.title || task.courseTitle || task.course || '课程主题',
        courseArchived: Boolean(task.courseArchived || course?.archived),
        lessonType: task.lessonType,
        status: task.status,
        progress: progressForTask(task),
        materials: materialItems,
        referenceMaterials: materialItems.filter((item) => item.type !== '课件'),
        coursewares: materialItems.filter((item) => item.type === '课件'),
        classroomMedia: materialItems.filter((item) => ['课堂照片', '课堂视频'].includes(item.type)),
        studentWorks,
        worksCount: studentWorks.reduce((total, item) => total + Number(item.artworkCount || 0), 0),
        shareReadyCount: studentWorks.filter((item) => item.shareReady).length,
        archivedCount: studentWorks.filter((item) => item.archived).length,
        highlights: studentWorks.reduce((total, item) => total + (item.artworks || []).filter((artwork) => artwork.highlight).length, 0),
        wheatStatus: trace?.status || task.wheatStatus || '未生成',
        cloudArchiveStatus: task.cloudArchiveStatus || '待推送',
        teacherEffect: workspace.archiveChecklist?.teacherEffectArchive || createArchiveChecklist().teacherEffectArchive,
        studentArchive: workspace.archiveChecklist?.studentCloudArchive || createArchiveChecklist().studentCloudArchive,
        archiveVersions: workspace.archiveVersions || [],
        shareStatus: workspace.sharePage?.status || '草稿'
      }
    })

    const historicalRecords = archives
      .filter((archive) => !archive.lessonId || !taskRecords.some((record) => record.lessonId === archive.lessonId))
      .map((archive) => {
        const relatedWorks = archiveRecords.filter((record) =>
          record.date === archive.date &&
          record.className === archive.className &&
          record.course === archive.course &&
          record.teacher === archive.teacher
        )
        const firstWork = relatedWorks[0]
        return {
          id: `archive-${archive.id}`,
          source: 'history',
          lessonId: archive.lessonId || null,
          date: archive.date,
          dateValue: archive.dateValue || firstWork?.dateValue || '',
          time: firstWork?.time || '',
          classId: firstWork?.classId || null,
          className: archive.className,
          classType: archive.classType || '固定班',
          teacher: archive.teacher,
          course: archive.course,
          lessonType: firstWork?.lessonType || '课次归档',
          status: '已完成',
          progress: 100,
          materials: [],
          referenceMaterials: [],
          coursewares: [],
          classroomMedia: [],
          studentWorks: relatedWorks.map((record) => {
            const artworks = Array.isArray(record.artworks) && record.artworks.length ? record.artworks : record.fileId || record.artwork ? [{
              artworkId: record.artworkId || record.sourceId || record.id,
              fileId: record.fileId,
              fileUrl: record.artwork || '',
              title: record.title || '学生作品',
              sortOrder: 0,
              highlight: Boolean(record.highlight),
              highlightNote: record.highlightNote || ''
            }] : []
            return {
              ...record,
              artworks,
              artworkCount: artworks.length,
              imageMatched: artworks.length > 0,
              imageConfirmed: artworks.length > 0,
              shareReady: Boolean(record.shareUrl),
              archived: true,
              highlight: artworks.some((artwork) => artwork.highlight)
            }
          }),
          worksCount: archive.works || relatedWorks.reduce((total, record) => total + Number(record.artworkCount || (record.artworks?.length || (record.artwork ? 1 : 0))), 0),
          shareReadyCount: relatedWorks.filter((record) => record.shareUrl).length,
          archivedCount: archive.works || relatedWorks.length,
          highlights: archive.highlights || relatedWorks.reduce((total, record) => total + (record.artworks || []).filter((artwork) => artwork.highlight).length, 0),
          wheatStatus: archive.wheatStatus || '已人工处理',
          cloudArchiveStatus: archive.cloudArchiveStatus || '历史归档',
          teacherEffect: {
            status: '已归档',
            title: `${archive.date}《${archive.className}--${archive.course}》${archive.teacher}`,
            imageCount: archive.works || relatedWorks.length,
            detail: `${archive.teacher}历史课效图 · ${archive.className} · ${archive.course}`,
            updatedAt: archive.date
          },
          studentArchive: { status: '已同步', detail: '历史学生作品档案已归档' },
          shareStatus: '已归档'
        }
      })

    return [...taskRecords, ...historicalRecords]
  })
  const teacherEffectArchiveRecords = computed(() => {
    if (teacherArchives.length) {
      return teacherArchives.map((effect) => {
        const sourceLesson = lessonArchiveRecords.value.find((lesson) => sameId(lesson.lessonId, effect.lessonId)) || {
          lessonId: effect.lessonId,
          classId: effect.classId,
          className: effect.className,
          classType: '固定班',
          date: effect.date,
          dateValue: effect.dateValue,
          time: effect.time,
          teacher: effect.teacher,
          course: effect.course,
          studentWorks: [],
          referenceMaterials: []
        }
        return {
          ...effect,
          imageCount: effect.imageCount || 0,
          detail: effect.failureReason || '老师课效长图已归档',
        cloudPath: effect.targetPath || '',
          sourceWorks: sourceLesson.studentWorks || [],
          sourceLesson
        }
      })
    }
    return lessonArchiveRecords.value
      .filter((lesson) => ['已生成', '已确认', '已同步', '已归档'].includes(lesson.teacherEffect?.status))
      .map((lesson) => ({
        id: `effect-${lesson.id}`,
        lessonId: lesson.lessonId,
        date: lesson.date,
        dateValue: lesson.dateValue,
        time: lesson.time,
        teacher: lesson.teacher,
        className: lesson.className,
        classType: lesson.classType,
        course: lesson.course,
        title: lesson.teacherEffect.title || `${lesson.date}《${lesson.className}--${lesson.course}》${lesson.teacher} ${lesson.time}`,
        status: lesson.teacherEffect.status,
        imageCount: lesson.teacherEffect.imageCount || lesson.worksCount,
        detail: lesson.teacherEffect.detail || '课效长图已生成',
        cloudPath: lesson.teacherEffect.detail?.includes('教学资料归档') ? lesson.teacherEffect.detail : '',
        cover: lesson.studentWorks.find((work) => work.artwork)?.artwork || lesson.referenceMaterials.find((material) => material.image)?.image || '',
        outputFileId: lesson.teacherEffect?.outputFileId
          || lesson.studentWorks.find((work) => work.artwork || work.fileId)?.fileId
          || lesson.referenceMaterials.find((material) => material.image || material.fileId)?.fileId
          || null,
        sourceWorks: lesson.studentWorks,
        sourceLesson: lesson
      }))
  })
  const latestLessonDate = computed(() =>
    [...new Set(tasks.map((task) => task.dateValue).filter(Boolean))].sort().at(-1) || ''
  )
  const qualityReviewForLesson = (lessonId) => {
    if (!lessonId) return null
    return qualityReviews.find((review) => sameId(review.lessonId, lessonId)) || null
  }
  const supervisionLessonRecords = computed(() => {
    const dashboardByLesson = new Map(supervisionDashboard.map((item) => [String(item.lessonId), item]))
    return lessonArchiveRecords.value.map((lesson) => {
      const dashboard = dashboardByLesson.get(String(lesson.lessonId))
      const currentReview = qualityReviewForLesson(lesson.lessonId)
      const review = currentReview || dashboard?.review || (dashboard?.reviewId
        ? {
            id: dashboard.reviewId,
            lessonId: dashboard.lessonId,
            teacher: dashboard.teacherName,
            score: dashboard.score,
            comment: dashboard.reviewComment || '',
            status: dashboard.reviewStatus || '待评分',
            reviewedAt: dashboard.reviewedAt,
            version: dashboard.reviewVersion || 0
          }
        : null)
      return {
        ...lesson,
        className: dashboard?.className || lesson.className,
        teacher: dashboard?.teacherName || lesson.teacher,
        course: dashboard?.courseTitle || lesson.course,
        review,
        reviewStatus: lesson.status === '已完成'
          ? (review?.status || currentReview?.status || dashboard?.reviewStatus || '待评分')
          : (dashboard?.status || '未完成')
      }
    })
  })
  const pendingQualityReviews = computed(() =>
    supervisionLessonRecords.value.filter((lesson) => lesson.lessonId && lesson.status === '已完成' && lesson.review?.status !== '已评分')
  )
  const saveQualityReview = (payload) => {
    if (!isAdmin.value) {
      notify('只有管理员/教管可以评分')
      return null
    }
    const lesson = supervisionLessonRecords.value.find((item) => sameId(item.lessonId, payload.lessonId))
    if (!lesson) {
      notify('没有找到要评分的课次')
      return null
    }
    if (lesson.status !== '已完成') {
      notify('课次完成后才能提交质量评分')
      return null
    }
    const score = Number(payload.score)
    if (!Number.isFinite(score) || score < 0 || score > 10) {
      notify('评分需要在 0-10 分之间')
      return null
    }
    const existing = qualityReviewForLesson(lesson.lessonId)
    const next = {
      id: existing?.id || nextId(qualityReviews),
      lessonId: lesson.lessonId,
      teacher: lesson.teacher,
      reviewer: currentUser.value?.name || '管理员',
      score,
      comment: payload.comment?.trim() || '',
      status: '已评分',
      reviewedAt: nowText()
    }
    if (existing) Object.assign(existing, next)
    else qualityReviews.unshift(next)
    notify(`已保存${lesson.teacher} ${lesson.date}课次评分：${score}分`)
    return next
  }
  const studentHistoryFor = (studentId) => archiveRecords.filter((record) => sameId(record.studentId, studentId))
  const communicationRecordsFor = (studentId) =>
    communicationRecords
      .filter((record) => sameId(record.studentId, studentId))
      .sort((a, b) => String(b.recordedAt || '').localeCompare(String(a.recordedAt || '')))
  const archiveCollectionsForRecord = (recordId) => archiveCollections.filter((collection) => collection.recordIds.includes(recordId))
  const archiveEditLogsForRecord = (recordId) => archiveEditLogs.filter((log) => log.recordId === recordId)
  const canEditArchiveRecord = (record) => Boolean(
    record &&
    record.archiveStatus !== 'CURRENT' &&
    (isAdmin.value || authorizedClassIds.value.some((id) => sameId(id, record.classId)))
  )
  const archiveFieldLabels = {
    title: '作品标题',
    description: '作品说明',
    tags: '标签',
    note: '档案备注',
    highlight: '高光状态',
    highlightNote: '高光说明',
    framed: '装裱状态',
    framedAt: '装裱日期',
    frameFee: '装裱费用',
    framerName: '装裱人',
    frameNote: '装裱备注'
  }
  const archiveValueText = (key, value) => {
    if (key === 'highlight' || key === 'framed') return value ? '是' : '否'
    if (key === 'tags') return (value || []).join('、') || '无'
    if (key === 'frameFee') return `¥${Number(value || 0).toFixed(2)}`
    return value === '' || value === null || value === undefined ? '空' : String(value)
  }
  const updateArchiveRecord = (recordId, payload) => {
    const record = archiveRecords.find((item) => item.id === recordId)
    if (!record || !canEditArchiveRecord(record)) {
      notify('无权限编辑该作品档案')
      return null
    }

    const next = {
      title: payload.title?.trim() || '',
      description: payload.description?.trim() || '',
      tags: [...new Set((payload.tags || []).map((tag) => tag.trim()).filter(Boolean))],
      note: payload.note?.trim() || '',
      highlight: Boolean(payload.highlight),
      highlightNote: payload.highlight ? payload.highlightNote?.trim() || '' : '',
      framed: Boolean(payload.framed),
      framedAt: payload.framedAt || '',
      frameFee: Number(payload.frameFee || 0),
      framerId: payload.framerId || null,
      framerName: payload.framerName?.trim() || '',
      frameNote: payload.frameNote?.trim() || ''
    }
    const trackedKeys = Object.keys(archiveFieldLabels)
    const changes = trackedKeys
      .filter((key) => JSON.stringify(record[key] ?? (key === 'tags' ? [] : '')) !== JSON.stringify(next[key]))
      .map((key) => ({
        field: key,
        label: archiveFieldLabels[key],
        before: archiveValueText(key, record[key]),
        after: archiveValueText(key, next[key])
      }))

    if (!changes.length) {
      notify('作品档案没有需要保存的修改')
      return record
    }

    const updatedAt = nowText()
    const updatedBy = currentUser.value?.name || '未登录用户'
    Object.assign(record, next, { updatedAt, updatedBy })
    archiveEditLogs.unshift({
      id: nextId(archiveEditLogs),
      recordId,
      operator: updatedBy,
      time: updatedAt,
      reason: payload.changeReason?.trim() || '编辑作品档案',
      changes
    })
    notify(`已保存作品档案：${record.title}`)
    return record
  }
  const createArchiveCollection = (payload) => {
    const selectedRecords = payload.recordIds
      .map((id) => archiveRecords.find((record) => record.id === id))
      .filter(Boolean)
    if (!selectedRecords.length) {
      notify('请先选择要发布的作品')
      return null
    }
    const id = nextId(archiveCollections)
    const firstRecord = selectedRecords[0]
    const title = payload.title?.trim() || `${firstRecord.studentName} · 高光作品集`
    const collection = {
      id,
      type: payload.type,
      title,
      owner: currentUser.value.name,
      target: payload.target?.trim() || `${firstRecord.studentName}家长`,
      className: firstRecord.className,
      createdAt: nowText(),
      status: '已发布',
      recordIds: selectedRecords.map((record) => record.id),
      link: '',
      intro: payload.intro?.trim() || '',
      summary: payload.summary?.trim() || '',
      teacherMessage: payload.teacherMessage?.trim() || '',
      displayConfig: {
        showDate: payload.showDate !== false,
        showCourse: payload.showCourse !== false,
        showComment: payload.showComment === true,
        showHighlight: payload.showHighlight !== false,
        showWatermark: payload.showWatermark !== false
      },
      note: payload.note?.trim() || ''
    }
    archiveCollections.unshift(collection)
    selectedRecords.forEach((record) => {
      record.collectionIds = [...new Set([...(record.collectionIds || []), id])]
    })
    notify(`${collection.title}已生成，可复制链接发送给家长`)
    return collection
  }
  const copyArchiveCollectionLink = async (collection) => {
    await navigator.clipboard.writeText(`${collection.title}\n${collection.link}`)
    notify('作品集链接已复制')
  }

  const isAttendanceMarked = (row) => row?.attendance && row.attendance !== '未标记'
  const artworkCountForRow = (row) => {
    const artworks = artworksForRow(row)
    if (artworks.length) return artworks.length
    return row?.imageMatched ? (row.imageFileIds?.length || 1) : 0
  }
  const isDeliveryConfirmed = (row) => {
    const artworks = artworksForRow(row)
    const imagesReady = artworks.length
      ? artworks.every((artwork) => artwork.imageMatched && artwork.imageConfirmed)
      : Boolean(row?.imageConfirmed)
    return row?.attendance === '到课' && imagesReady && row.confirmed
  }
  const confirmedDeliveryCount = (rows = []) => rows.filter(isDeliveryConfirmed).length

  const counts = computed(() => ({
    total: classStudents.value.length,
    attendanceConfirmed: sessionStudents.value.length > 0 && sessionStudents.value.every(isAttendanceMarked),
    attend: sessionStudents.value.filter((item) => item.attendance === '到课').length,
    matched: sessionStudents.value.filter((item) => item.attendance === '到课' && item.imageMatched).length,
    imageConfirmed: sessionStudents.value.filter((item) => item.attendance === '到课' && item.imageConfirmed).length,
    records: sessionStudents.value.filter((item) => item.attendance === '到课' && item.record?.trim()).length,
    processed: sessionStudents.value.filter((item) => item.attendance === '到课' && item.processed).length,
    comments: sessionStudents.value.filter((item) => item.attendance === '到课' && item.comment?.trim()).length,
    confirmed: sessionStudents.value.filter((item) => item.attendance === '到课' && item.confirmed).length,
    deliveryConfirmed: confirmedDeliveryCount(sessionStudents.value),
    studentDeliveryCompleted: sessionStudents.value.filter((item) => item.attendance === '到课' && item.imageMatched && item.imageConfirmed && item.record?.trim() && item.comment?.trim() && item.confirmed).length,
    highlights: sessionStudents.value.filter((item) => item.attendance === '到课' && item.highlight).length,
    artworkCount: sessionStudents.value.reduce((total, row) => total + artworkCountForRow(row), 0),
    confirmedArtworkCount: sessionStudents.value.reduce((total, row) => total + artworksForRow(row).filter((artwork) => artwork.imageMatched && artwork.imageConfirmed).length, 0),
    processedArtworkCount: sessionStudents.value.reduce((total, row) => total + artworksForRow(row).filter((artwork) => artwork.processed).length, 0),
    highlightArtworkCount: sessionStudents.value.reduce((total, row) => total + artworksForRow(row).filter((artwork) => artwork.highlight).length, 0),
    shareReady: sessionStudents.value.filter((item) => item.attendance === '到课' && item.shareReady).length,
    archived: sessionStudents.value.filter((item) => item.attendance === '到课' && item.archived).length,
    homeworkReady: homeworkIsAssigned(homework.value) && !String(homework.value.content || '').trim() ? 0 : 1,
    demoMaterials: demoMaterials.value.length,
    stepMaterials: stepMaterials.value.length,
    classroomMedia: classroomMediaMaterials.value.length,
    referenceMaterials: referenceMaterials.value.length,
    coursewares: coursewareMaterials.value.length,
    classroomMaterials: materials.value.length,
    classroomMaterialsDone: materials.value.length || materialsConfirmedEmpty.value ? 1 : 0,
    artworks: materials.value.filter((item) => item.type === '范画').length,
    visibleMaterials: materials.value.filter((item) => item.visible).length
  }))

  const steps = computed(() => [
    { title: '课次与出勤', done: counts.value.attendanceConfirmed ? 1 : 0, total: 1 },
    { title: '课堂素材', done: counts.value.classroomMaterialsDone, total: 1 },
    { title: '学生交付', done: counts.value.studentDeliveryCompleted, total: counts.value.attend },
    { title: '课后任务与家长展示', done: counts.value.homeworkReady, total: 1 },
    { title: '提交归档', done: counts.value.archived, total: counts.value.attend }
  ])

  const taskProgress = computed(() => {
    const total = counts.value.attend * 5 || 1
    const done =
      (counts.value.attendanceConfirmed ? counts.value.attend : 0) +
      (counts.value.classroomMaterialsDone ? counts.value.attend : 0) +
      counts.value.studentDeliveryCompleted +
      (counts.value.homeworkReady ? counts.value.attend : 0) +
      counts.value.archived
    return Math.min(100, Math.round((done / total) * 100))
  })

  const progressForTask = (task) => {
    const workspace = ensureLessonWorkspace(task)
    const attendanceConfirmed = workspace.studentDeliveries.length > 0 && workspace.studentDeliveries.every(isAttendanceMarked)
    const rows = workspace.studentDeliveries.filter((row) => row.attendance === '到课')
    if (task.status === '已完成') return 100
    if (!rows.length) return 0
    const completed =
      (attendanceConfirmed ? rows.length : 0) +
      (workspace.materials.length || workspace.materialsConfirmedEmpty ? rows.length : 0) +
      rows.filter((row) => row.imageMatched && row.imageConfirmed && row.record?.trim() && row.comment?.trim() && row.confirmed).length +
      (homeworkIsAssigned(workspace.homework) && !String(workspace.homework.content || '').trim() ? 0 : rows.length) +
      rows.filter((row) => row.archived).length
    const workspaceProgress = Math.min(100, Math.round((completed / (rows.length * 5)) * 100))
    if (sameId(task.id, activeTaskId.value)) return taskProgress.value
    return workspaceProgress
  }

  const currentWarnings = computed(() => {
    const warnings = []
    if (!sessionStudents.value.length) warnings.push('当前班级没有学生名单')
    else if (sessionStudents.value.some((row) => !isAttendanceMarked(row))) warnings.push('仍有学生未确认出勤')
    if (!materials.value.length && !materialsConfirmedEmpty.value) warnings.push('课堂资料待上传或确认无资料')
    if (homeworkIsAssigned(homework.value) && !String(homework.value.content || '').trim()) warnings.push('课后任务内容为空')
    attendingRows.value.forEach((row) => {
      const student = students.find((item) => sameId(item.id, row.studentId))
      const name = student?.name || row.studentName || '学生'
      if (!row.imageMatched) warnings.push(`${name}缺作品`)
      if (!row.imageConfirmed) warnings.push(`${name}图片待确认`)
      if (!row.record?.trim()) warnings.push(`${name}缺课堂记录`)
      if (!row.comment?.trim()) warnings.push(`${name}缺课评`)
      if (row.comment?.trim() && !row.confirmed) warnings.push(`${name}课评待确认`)
    })
    return warnings
  })

  const archiveDoneStatuses = ['已同步', '已上传', '已归档', '已生成', '已确认', '已跳过', '待老师确认发送', '已发送', '人工触达', '发送失败', '已人工处理', '无需处理']
  const archiveWorkingStatuses = ['推送中', '生成中', '创建中']
  const isArchiveDone = (item) => archiveDoneStatuses.includes(item.status)
  const isArchiveWorking = (item) => archiveWorkingStatuses.includes(item.status)
  const studentArchivePathPreview = computed(() =>
    activeWorkspace.value.cloudJobs?.find((job) => job.targetPath)?.targetPath || '待生成'
  )
  const teacherEffectPathPreview = computed(() =>
    activeWorkspace.value.teacherEffect?.outputFileId ? '已生成' : '待生成'
  )
  const archiveChecklistItems = computed(() => [
    {
      key: 'parentTouch',
      title: '家长展示发布与企业微信推送',
      meta: wecomEnabled.value
        ? '发布展示页快照并创建企业微信推送任务'
        : '企业微信未启用',
      action: '创建企微待推送',
      required: true,
      item: archiveChecklist.value.parentTouch
    },
    {
      key: 'studentCloudArchive',
      title: '学生作品与照片百度归档',
      meta: studentArchivePathPreview.value,
      action: '推送',
      required: false,
      item: archiveChecklist.value.studentCloudArchive
    },
    {
      key: 'teacherEffectArchive',
      title: '老师课效长图归档',
      meta: archiveChecklist.value.teacherEffectArchive.title || teacherEffectPathPreview.value,
      action: '配置并生成',
      required: false,
      item: archiveChecklist.value.teacherEffectArchive
    },
    {
      key: 'wheatTrace',
      title: '小麦消课待办',
      meta: archiveChecklist.value.wheatTrace.traceId ? `待办 #${archiveChecklist.value.wheatTrace.traceId}` : '',
      action: '生成待办',
      required: true,
      item: archiveChecklist.value.wheatTrace
    }
  ])
  const archiveChecklistProgress = computed(() => {
    const total = archiveChecklistItems.value.filter((item) => item.required).length || 1
    const done = archiveChecklistItems.value.filter((item) => item.required && isArchiveDone(item.item)).length
    return { done, total, percent: Math.round((done / total) * 100) }
  })
  const archiveChecklistReady = computed(() =>
    !currentWarnings.value.length && archiveChecklistItems.value.every((item) => !item.required || isArchiveDone(item.item))
  )
  const archiveChecklistPending = computed(() =>
    archiveChecklistItems.value.filter((item) => item.required && !isArchiveDone(item.item)).map((item) => item.title)
  )

  const toggleArchiveTarget = (target) => {
    if (target.required) return
    const selected = new Set(selectedArchiveTargets.value)
    if (selected.has(target.id)) selected.delete(target.id)
    else selected.add(target.id)
    selectedArchiveTargets.value = ['system', ...[...selected].filter((id) => id !== 'system' && id !== 'wheat'), 'wheat']
  }

  const selectCloudArchiveProvider = (providerConfigId) => {
    if (!providerConfigId) return
    const otherTargets = selectedArchiveTargets.value.filter((id) =>
      id !== 'system' && id !== 'wheat' && !String(id).startsWith('cloud:')
    )
    selectedArchiveTargets.value = ['system', ...otherTargets, `cloud:${providerConfigId}`, 'wheat']
  }

  const createShareToken = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().replaceAll('-', '')
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
  }

  const ensureStudentToken = (lessonId, studentId) => {
    const workspace = ensureLessonWorkspace(tasks.find((task) => sameId(task.id, lessonId)))
    if (!workspace.sharePage.studentTokens) workspace.sharePage.studentTokens = {}
    if (!workspace.sharePage.studentTokens[studentId]) workspace.sharePage.studentTokens[studentId] = createShareToken()
    return workspace.sharePage.studentTokens[studentId]
  }

  const studentShareUrlFor = (rowOrId) => {
    return ''
  }

  const parentShareUrl = computed(() => studentShareUrlFor(activeStudentId.value))

  const qrText = computed(() => `QR · ${activeShareMode.value === 'class' ? activeClass.value.name : activeStudent.value?.name || ''}`)

  const fileNameFor = (row) => {
    const student = students.find((item) => sameId(item.id, row.studentId))
    return `${activeTask.value.date}-${activeClass.value.name}-${student.name}-${activeCourse.value.title}.jpg`
  }

  const exportText = computed(() =>
    attendingRows.value
      .map((row, index) => {
        const student = students.find((item) => item.id === row.studentId)
        const link = studentShareUrlFor(row)
        return `${index + 1}. ${student.name}\n作品文件：${fileNameFor(row)}\n展示页：${link}\n课评：${row.comment || '待生成'}`
      })
      .join('\n\n')
  )

  const notify = (message) => {
    toast.value = message
    setTimeout(() => {
      if (toast.value === message) toast.value = ''
    }, 2200)
  }

  const nowText = () => new Date().toLocaleString('zh-CN', { hour12: false })
  const nextId = (collection) => Math.max(0, ...collection.map((item) => item.id || 0)) + 1
  const addStatusLog = (objectType, objectId, before, after, reason, source = '工作台', lessonId = activeTask.value?.id || null) => {
    statusChangeLogs.unshift({
      id: nextId(statusChangeLogs),
      lessonId,
      objectType,
      objectId,
      before,
      after,
      operator: currentUser.value?.name || '未登录用户',
      time: nowText(),
      reason,
      source
    })
  }

  const lessonStatusLogs = computed(() => statusChangeLogs.filter((log) => sameId(log.lessonId, activeTask.value.id)))

  const transitionLesson = (action, reason, exceptionType = '') => {
    const task = activeTask.value
    const before = task.status
    const rules = {
      start: { from: ['待处理'], to: '处理中' },
      exception: { from: ['待处理', '处理中'], to: '异常' },
      recover: { from: ['异常'], to: '处理中' },
      reopen: { from: ['已完成'], to: '处理中', admin: true }
    }
    const rule = rules[action]
    if (!rule || !rule.from.includes(before)) {
      notify(`操作未执行：课次当前为“${before}”，不满足状态前置条件`)
      return false
    }
    if (rule.admin && !isAdmin.value) {
      notify('操作未执行：只有管理员可以重新打开已完成课次')
      return false
    }
    if (action !== 'start' && !reason?.trim()) {
      notify('请填写本次状态变更原因')
      return false
    }
    if (action === 'exception' && !exceptionType) {
      notify('请先选择异常类型')
      return false
    }
    task.status = rule.to
    task.exceptionType = action === 'exception' ? exceptionType : task.exceptionType || ''
    task.exceptionReason = action === 'exception' ? reason.trim() : task.exceptionReason || ''
    if (action === 'recover') task.recoveryReason = reason.trim()
    if (action === 'reopen') {
      task.reopenReason = reason.trim()
      task.archived = false
      showReport.value = false
    }
    addStatusLog('课次', task.id, before, rule.to, action === 'start' ? '开始课后处理' : reason.trim())
    notify(`课次状态已由“${before}”变更为“${rule.to}”`)
    return true
  }

  const runAction = async (label, message, action) => {
    processingAction.value = label
    await wait(420)
    await action()
    await wait(220)
    processingAction.value = ''
    notify(message)
  }

  const pulsePreview = () => {
    previewPulse.value = false
    requestAnimationFrame(() => {
      previewPulse.value = true
      setTimeout(() => {
        previewPulse.value = false
      }, 900)
    })
  }

  const pulseComment = () => {
    commentPulse.value = false
    requestAnimationFrame(() => {
      commentPulse.value = true
      setTimeout(() => {
        commentPulse.value = false
      }, 900)
    })
  }

  const selectTask = (task) => {
    if (!isAdmin.value && !authorizedClassIds.value.some((id) => sameId(id, task.classId))) {
      notify('无权限查看该课次，请联系管理员授权班级')
      return
    }
    cancelJobWatchers()
    selectedTaskSnapshot.value = task
    ensureLessonWorkspace(task)
    activeTaskId.value = task.id
  }

  const setAttendance = (row, value) => {
    row.attendance = value
    if (value !== '到课') {
      row.imageMatched = false
      row.imageConfirmed = false
      row.processed = false
      row.confirmed = false
      row.shareReady = false
      row.archived = false
    } else {
      if (!row.images?.length && row.image) row.images = [row.image]
      row.imageMatched = Boolean(row.images?.length)
      row.imageConfirmed = row.imageMatched
    }
  }

  const toggleMaterialVisible = (material) => {
    material.visible = !material.visible
    notify(`${material.title}${material.visible ? '会展示给家长' : '已隐藏'}`)
  }

  const releaseLocalMaterialUrl = (material) => {
    if (material?.fileUrl && String(material.fileUrl).startsWith('blob:')) URL.revokeObjectURL(material.fileUrl)
  }

  const addMaterial = (type = '范画') => {
    materials.value.push({
      id: Date.now(),
      lessonId: activeTaskId.value,
      type,
      title: `新上传${type} ${materials.value.length + 1}`,
      image: '',
      visible: defaultMaterialVisible(type),
      libraryId: null
    })
    notify(`已上传一张${type}`)
  }

  const uploadLessonMaterial = (event, category = '范画') => {
    const files = [...(event.target.files || [])]
    if (!files.length) return
    files.forEach((file, index) => {
      const url = URL.createObjectURL(file)
      const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : ''
      materials.value.push({
        id: Date.now() + index,
        lessonId: activeTaskId.value,
        type: uiMaterialTypeForUpload(category, file),
        title: category === '课件' ? file.name : file.name.replace(/\.[^.]+$/, ''),
        image: category === '课件' ? '' : url,
        fileUrl: url,
        fileName: file.name,
        fileExt: extension,
        fileSize: file.size,
        visible: defaultMaterialVisible(category),
        libraryId: null
      })
    })
    materialsConfirmedEmpty.value = false
    event.target.value = ''
    notify(`已上传 ${files.length} 个${category}`)
  }

  const removeLessonMaterial = (material) => {
    const index = materials.value.findIndex((item) => item.id === material.id)
    if (index < 0) return
    releaseLocalMaterialUrl(material)
    materials.value.splice(index, 1)
    if (!materials.value.length) materialsConfirmedEmpty.value = false
    notify(`已删除${material.title}`)
  }

  const replaceLessonMaterial = (material, file, category = materialCategoryForType(material?.type)) => {
    if (!material || !file) return false
    const index = materials.value.findIndex((item) => item.id === material.id)
    if (index < 0) return false
    const previousUrl = material.fileUrl
    const url = URL.createObjectURL(file)
    const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : ''
    materials.value.splice(index, 1, {
      ...material,
      id: Date.now(),
      type: uiMaterialTypeForUpload(category, file),
      title: category === '课件' ? file.name : file.name.replace(/\.[^.]+$/, ''),
      image: category === '课件' ? '' : url,
      fileUrl: url,
      fileName: file.name,
      fileExt: extension,
      fileSize: file.size,
      visible: category === '课堂记录' ? Boolean(material.visible) : defaultMaterialVisible(category),
      libraryId: null
    })
    if (previousUrl && String(previousUrl).startsWith('blob:')) URL.revokeObjectURL(previousUrl)
    notify(`已替换${material.title}`)
    return true
  }

  const confirmNoLessonMaterials = () => {
    materialsConfirmedEmpty.value = !materialsConfirmedEmpty.value
    notify(materialsConfirmedEmpty.value ? '已确认本节无课堂资料' : '已取消无资料确认')
  }

  const useArtworkFromLibrary = (item) => {
    if (materials.value.some((material) => material.libraryId === item.id)) {
      notify(`${item.title}已在本节课中`)
      return
    }
    materials.value.push({ id: Date.now(), lessonId: activeTaskId.value, type: item.type, title: item.title, image: item.image, visible: defaultMaterialVisible(item.type), libraryId: item.id })
    item.usage += 1
    notify(`已从范画库选择：${item.title}`)
  }

  const addArtworkLibraryItem = (payload) => {
    const item = { id: nextId(artworkLibrary), type: payload.type || '范画', title: payload.title || '新范画', theme: payload.theme || '未分类', age: payload.age || '不限', uploader: currentUser.value.name, usage: 0, image: payload.image || '' }
    artworkLibrary.unshift(item)
    notify(`已加入范画库：${item.title}`)
    return item
  }

  const chooseImageTemplate = (index) => {
    const picked = new Set(selectedImageTemplates.value)
    if (index === 0) {
      selectedImageTemplates.value = [0]
      pulsePreview()
      notify('已选择图片效果：不套模板/保留原图')
      return
    }
    picked.delete(0)
    if (picked.has(index)) picked.delete(index)
    else picked.add(index)
    selectedImageTemplates.value = [...picked]
    pulsePreview()
    notify(picked.has(index) ? `已选择图片效果：${templates.image[index].name}` : `已移除图片效果：${templates.image[index].name}`)
  }

  const removeImageTemplate = (index) => {
    selectedImageTemplates.value = selectedImageTemplates.value.filter((item) => item !== Number(index))
    pulsePreview()
    notify('已移除图片效果，未选择时将使用原图')
  }

  const chooseCommentTemplate = (index) => {
    selectedCommentTemplate.value = index
    pulseComment()
    notify(`已切换课评模板：${templates.comment[index].name}`)
  }

  const parseBulkRecord = () => {
    bulkRecord.value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const [rawName, ...rest] = line.split(/[:：]/)
        const student = students.find((item) => item.name === rawName.trim() || item.nickname === rawName.trim())
        const row = student ? sessionStudents.value.find((item) => item.studentId === student.id) : null
        if (row && rest.length) row.record = rest.join('：').trim()
      })
    notify('课堂记录已匹配到学生')
  }

  const simulateVoice = async () => {
    const row = activeSessionStudent.value
    const student = activeStudent.value
    if (!row || row.attendance !== '到课') return
    await runAction('正在将语音转成文字...', '语音内容已添加到当前学生记录', async () => {
      const samples = {
        彤彤: '今天用色很大胆，叶子比上次更舒展，背景留白可以再注意。',
        浩浩: '今天的画面很有故事感，涂色均匀了很多，细节可以继续深入。',
        安安: '今天构图很完整，画面排列有节奏，背景层次可以再丰富。'
      }
      const text = samples[student?.name] || '今天课堂参与认真，能够跟随步骤完成作品，也有自己的表达。'
      row.record = row.record?.trim() ? `${row.record.trim()} ${text}` : text
    })
  }

  const matchImages = async () => {
    await runAction('正在匹配作品图片...', `已匹配 ${counts.value.attend} 张作品`, async () => {
      sessionStudents.value.forEach((row) => {
        if (row.attendance === '到课') row.imageMatched = true
      })
    })
  }

  const addAiLog = (type, target, status, message, retry = 0) => {
    aiCallLogStore.unshift({
      id: Date.now() + aiCallLogStore.length,
      lessonId: activeTaskId.value,
      time: '刚刚',
      type,
      target,
      status,
      retry,
      cost: status === '成功' ? '0.012' : '0.000',
      message
    })
  }

  const confirmImages = () => {
    attendingRows.value.forEach((row) => {
      if (row.imageMatched) {
        if (row.processedImage && row.imageProcessStatus === '成功') row.image = row.processedImage
        row.imageConfirmed = true
      }
    })
    notify('已确认全部可用图片，处理图已生效')
  }

  const confirmCurrentImage = (mode = 'processed') => {
    const row = activeSessionStudent.value
    if (!row) return false
    if (mode === 'processed' && row.processedImage) row.image = row.processedImage
    else row.image = row.originalImage || row.image
    row.imageConfirmed = true
    notify(`${activeStudent.value?.name || '当前学生'}已采用${mode === 'processed' && row.processedImage ? '处理图' : '原图'}`)
    return true
  }

  const processImages = async () => {
    const effectNames = activeImageTemplates.value.map((template) => template.name).join('、')
    await runAction('正在进行作品美化和水印处理...', `已按“${effectNames}”处理 ${counts.value.matched} 张作品`, async () => {
      sessionStudents.value.forEach((row) => {
        if (row.attendance === '到课' && row.imageMatched) {
          const student = students.find((item) => item.id === row.studentId)
          row.imageProcessStatus = '成功'
          row.imageProcessError = ''
          row.processedImage = row.originalImage || row.image
          row.processed = true
          row.imageConfirmed = false
          addAiLog('图片处理', student?.name || '学生', '成功', '已生成处理图，等待老师确认')
        }
      })
      pulsePreview()
    })
  }

  const failCurrentImageProcess = () => {
    const row = activeSessionStudent.value
    const student = activeStudent.value
    row.imageProcessStatus = '失败'
    row.imageProcessError = '接口返回质量不足，请重试或保留原图'
    row.processed = false
    row.processedImage = ''
    row.imageConfirmed = false
    addAiLog('图片处理', student?.name || '当前学生', '失败', row.imageProcessError, 1)
    notify(`${student?.name || '当前学生'}图片处理失败，可重试或确认原图`)
  }

  const retryCurrentImageProcess = async () => {
    const row = activeSessionStudent.value
    const student = activeStudent.value
    await runAction('正在重试图片处理...', `${student?.name || '当前学生'}处理图已重新生成`, async () => {
      row.imageProcessStatus = '成功'
      row.imageProcessError = ''
      row.processedImage = row.originalImage || row.image
      row.processed = true
      row.imageConfirmed = false
      addAiLog('图片处理', student?.name || '当前学生', '成功', '重试成功，等待老师确认', 1)
      pulsePreview()
    })
  }

  const generateOne = (row) => {
    const student = students.find((item) => item.id === row.studentId)
    row.confirmed = false
    const record = row.record || ''
    const inferredFocus = /色|涂|暖|冷/.test(record) ? '色彩' : /想法|故事|创意|想象/.test(record) ? '想象力' : /构图|画面|主体|层次|空间/.test(record) ? '构图' : '细节'
    const complimentMap = {
      色彩: '今天的色彩选择很大胆，画面一下子就亮了起来',
      想象力: '今天的想法很丰富，能把自己的故事放进画面里',
      构图: '今天画面安排很完整，主体和周围元素关系更清楚了',
      细节: '今天观察得很认真，小细节处理得比之前更稳定'
    }
    const suggestionMap = {
      色彩: '下次可以试着让背景留白更舒服，画面会更透气',
      想象力: '下次可以把关键角色的细节再刻画得更明确',
      构图: '下次可以继续加强前后层次，让画面更有空间感',
      细节: '下次可以在主体和背景之间做一点更清楚的区分'
    }
    const observation = record.trim() ? `课堂记录中可以看到：${record.trim()}` : '课堂中能够认真跟随步骤完成作品'
    row.comment = `${student.nickname}今天表现很棒，${complimentMap[inferredFocus]}。${observation} 本节课围绕“${activeCourse.value.title}”完成练习，也保留了自己的表达。${suggestionMap[inferredFocus]}。继续保持这份专注和大胆。`
    if (activeCommentTemplate.value.name === '低龄鼓励版') {
      row.comment = `${student.nickname}今天特别投入，${complimentMap[inferredFocus]}。${observation} 老师能看到他很愿意大胆尝试。下次我们继续鼓励他把喜欢的细节画得更多一些，相信会越来越棒。`
    }
    if (activeCommentTemplate.value.name === '专业简洁版') {
      row.comment = `${student.nickname}本节课能围绕“${activeCourse.value.title}”完成主体表达，${complimentMap[inferredFocus]}。${observation} 下一步建议继续关注画面层次和细节完整度，让作品呈现更稳定。`
    }
  }

  const generateAll = async () => {
    processingAction.value = '正在生成全班 1v1 课评...'
    for (const row of attendingRows.value) {
      await wait(260)
      generateOne(row)
      activeStudentId.value = row.studentId
      addAiLog('课评生成', students.find((item) => item.id === row.studentId)?.name || '学生', '成功', '生成 1v1 课评，等待老师确认')
      pulseComment()
    }
    await wait(180)
    processingAction.value = ''
    notify(`已按“${activeCommentTemplate.value.name}”生成 ${counts.value.comments} 条课评`)
  }

  const confirmAll = () => {
    attendingRows.value.forEach((row) => {
      if (row.comment) row.confirmed = true
    })
    notify('已确认全部课评')
  }

  const confirmCurrentComment = () => {
    const row = activeSessionStudent.value
    if (!row?.comment?.trim()) {
      notify('当前学生还没有课评内容')
      return false
    }
    row.confirmed = true
    notify(`${activeStudent.value?.name || '当前学生'}课评已确认`)
    return true
  }

  const toggleHighlight = (row) => {
    row.highlight = !row.highlight
    if (row.highlight && !row.highlightNote) row.highlightNote = '作品表现突出，可作为本节课高光展示。'
    notify(row.highlight ? '已标记高光作品' : '已取消高光标记')
  }

  const toggleHomeworkLink = (id) => {
    if (!Array.isArray(homework.value.externalLinkIds)) homework.value.externalLinkIds = []
    const normalizedId = fromApiId(id)
    if (normalizedId === null || normalizedId === undefined) return
    const index = homework.value.externalLinkIds.findIndex((item) => sameId(item, normalizedId))
    if (index >= 0) homework.value.externalLinkIds.splice(index, 1)
    else homework.value.externalLinkIds.push(normalizedId)
  }

  const setHomeworkMode = (mode) => {
    const nextMode = mode === 'ASSIGNED' ? 'ASSIGNED' : 'NONE'
    homework.value.taskMode = nextMode
    if (nextMode === 'NONE') {
      homework.value.visible = false
      displayConfig.value.showHomework = false
    } else {
      homework.value.visible = true
      displayConfig.value.showHomework = true
    }
  }

  const applyHomeworkExample = ({ content = '', requirement = '' } = {}) => {
    setHomeworkMode('ASSIGNED')
    homework.value.content = content
    homework.value.requirement = requirement
  }

  const shareDraftPayload = () => ({
    lesson: clone(activeTask.value),
    klass: clone(activeClass.value),
    course: clone(activeCourse.value),
    studentDeliveries: clone(sessionStudents.value),
    students: clone(students),
    materials: clone(materials.value),
    homework: clone(homework.value),
    displayConfig: clone(displayConfig.value),
    school: clone(school),
    externalLinks: clone(selectedExternalLinks.value)
  })

  const shareContentHash = () => JSON.stringify({
    lesson: {
      id: activeTask.value.id,
      date: activeTask.value.date,
      time: activeTask.value.time,
      lessonType: activeTask.value.lessonType,
      classId: activeTask.value.classId,
      courseId: activeTask.value.courseId
    },
    studentDeliveries: sessionStudents.value.map(({ shareReady, archived, ...row }) => row),
    materials: materials.value,
    homework: homework.value,
    displayConfig: Object.fromEntries(Object.entries(displayConfig.value).filter(([key]) => !['publicStatus', 'expiresAt', 'expiresAtTimestamp'].includes(key))),
    externalLinks: selectedExternalLinks.value
  })

  const saveShareDraft = (reason = '调整展示内容') => {
    const before = sharePage.value.status
    if (before === '草稿') {
      notify(`展示页已经是草稿状态（V${sharePage.value.draftVersion}），重复保存未新建版本`)
      return false
    }
    sharePage.value.status = '草稿'
    sharePage.value.draftVersion = Math.max(sharePage.value.draftVersion, sharePage.value.publishedVersion + 1)
    displayConfig.value.publicStatus = '草稿'
    persistSharePage(activeTask.value.id, sharePage.value)
    addStatusLog('家长展示页', activeTask.value.id, before, '草稿', reason)
    notify(`已保存为 V${sharePage.value.draftVersion} 草稿；家长仍可访问上一发布版本`)
    return true
  }

  const generateSharePages = async () => {
    const missing = attendingRows.value.filter((row) => !isDeliveryConfirmed(row))
    if (missing.length) {
      notify(`发布失败：还有 ${missing.length} 名学生的作品或课评未确认`)
      return false
    }
    attendingRows.value.forEach((row) => ensureStudentToken(activeTask.value.id, row.studentId))
    const payload = shareDraftPayload()
    const payloadHash = shareContentHash()
    if (sharePage.value.publishedVersion && sharePage.value.lastPublishedHash === payloadHash) {
      const before = sharePage.value.status
      sharePage.value.status = '已发布'
      sharePage.value.draftVersion = sharePage.value.publishedVersion
      displayConfig.value.publicStatus = '已发布'
      persistSharePage(activeTask.value.id, sharePage.value)
      if (before !== '已发布') addStatusLog('家长展示页', activeTask.value.id, before, '已发布', '草稿内容与已发布版本一致，恢复原发布状态')
      notify(`重复发布已拦截：内容与 V${sharePage.value.publishedVersion} 一致，未生成重复链接或版本`)
      return false
    }
    await runAction('正在发布家长展示页和二维码...', '', async () => {
      const before = sharePage.value.status
      attendingRows.value.forEach((row) => {
        ensureStudentToken(activeTask.value.id, row.studentId)
        row.shareReady = true
      })
      sharePage.value.publishedVersion += 1
      sharePage.value.draftVersion = sharePage.value.publishedVersion
      sharePage.value.status = '已发布'
      sharePage.value.publishedSnapshot = payload
      sharePage.value.lastPublishedHash = payloadHash
      sharePage.value.publishedAt = nowText()
      displayConfig.value.expiresAtTimestamp = Date.now() + Math.max(1, Number(displayConfig.value.expiresInDays) || 1) * 24 * 60 * 60 * 1000
      sharePage.value.expiresAtTimestamp = displayConfig.value.expiresAtTimestamp
      displayConfig.value.expiresAt = new Date(displayConfig.value.expiresAtTimestamp).toLocaleString('zh-CN', { hour12: false })
      sharePage.value.revokedAt = ''
      sharePage.value.revokedReason = ''
      persistSharePage(activeTask.value.id, sharePage.value)
      activeTask.value.shareGenerated = true
      displayConfig.value.publicStatus = '已发布'
      addStatusLog('家长展示页', activeTask.value.id, before, '已发布', `发布 V${sharePage.value.publishedVersion}`)
      pulsePreview()
    })
    notify(`家长展示页 V${sharePage.value.publishedVersion} 已发布，共 ${counts.value.attend} 个学生链接`)
    return true
  }

  const revokeSharePage = (reason) => {
    if (!isAdmin.value) {
      notify('操作未执行：只有管理员可以撤销家长展示页')
      return false
    }
    if (!reason?.trim()) {
      notify('请填写撤销原因')
      return false
    }
    if (sharePage.value.status === '已失效') {
      notify(`重复撤销已拦截：展示页已于 ${sharePage.value.revokedAt} 失效`)
      return false
    }
    const before = sharePage.value.status
    sharePage.value.status = '已失效'
    sharePage.value.revokedAt = nowText()
    sharePage.value.revokedReason = reason.trim()
    displayConfig.value.publicStatus = '已失效'
    persistSharePage(activeTask.value.id, sharePage.value)
    addStatusLog('家长展示页', activeTask.value.id, before, '已失效', reason.trim())
    notify('家长展示页已撤销，所有现有链接立即失效')
    return true
  }

  const getLessonWorkspace = (lessonId) => lessonWorkspaces[String(lessonId)]
  const isShareAccessible = (route) => {
    const workspace = getLessonWorkspace(route.lessonId)
    return Boolean(
      route.type === 'student' &&
      workspace?.sharePage?.publishedSnapshot &&
      workspace.sharePage.status !== '已失效' &&
      (!workspace.sharePage.expiresAtTimestamp || Date.now() < workspace.sharePage.expiresAtTimestamp) &&
      route.token &&
      route.token === workspace.sharePage.studentTokens?.[route.studentId]
    )
  }

  const ensureWheatTrace = () => {
    const lesson = `${activeTask.value.date} ${activeTask.value.time} · ${activeClass.value.name}`
    const exists = wheatTraces.find((item) => item.lessonId === activeTask.value.id || item.lesson === lesson)
    if (exists) return exists
    const trace = {
      id: Date.now(),
      lessonId: activeTask.value.id,
      lesson,
      course: activeCourse.value.title,
      teacher: activeTask.value.teacher,
      type: activeTask.value.lessonType,
      status: '待处理',
      source: '课后归档生成',
      note: '请前往小麦助教完成消课，完成后返回本系统确认'
    }
    wheatTraces.unshift(trace)
    return trace
  }

  const setArchiveChecklistItem = (key, patch) => {
    const item = archiveChecklist.value[key]
    if (!item) return
    Object.assign(item, patch, { updatedAt: nowText() })
  }

  const archiveActionBlocked = () => {
    if (activeTask.value.status === '异常') {
      notify('请先恢复异常课次再执行归档动作')
      return true
    }
    if (activeTask.value.status !== '处理中') {
      notify(`课次当前为“${activeTask.value.status}”，请先开始处理`)
      return true
    }
    if (currentWarnings.value.length) {
      notify(`还有 ${currentWarnings.value.length} 项前置内容未完成`)
      return true
    }
    return false
  }

  const writeLessonArchiveRecords = (trace = null, storageTarget = '系统作品档案') => {
    attendingRows.value.forEach((row) => {
      if (row.shareReady) row.archived = true
    })
    const wheatStatus = trace?.status || activeTask.value.wheatStatus || '未生成'
    const summary = archives.find((item) => item.lessonId === activeTask.value.id)
    const summaryPayload = {
      lessonId: activeTask.value.id,
      date: activeTask.value.date,
      dateValue: activeTask.value.dateValue,
      className: activeClass.value.name,
      course: activeCourse.value.title,
      works: counts.value.attend,
      comments: counts.value.comments || counts.value.attend,
      highlights: counts.value.highlights,
      teacher: activeTask.value.teacher,
      wheatStatus,
      cloudArchiveStatus: activeTask.value.cloudArchiveStatus || '待推送'
    }
    if (summary) Object.assign(summary, summaryPayload)
    else archives.unshift({ id: Date.now() + 1, ...summaryPayload })
    attendingRows.value.forEach((row) => {
      const student = students.find((item) => item.id === row.studentId)
      if (!student) return
      const existing = archiveRecords.find((record) => record.lessonId === activeTask.value.id && record.studentId === row.studentId)
      const payload = {
        lessonId: activeTask.value.id,
        date: activeTask.value.date,
        dateValue: activeTask.value.dateValue,
        time: activeTask.value.time,
        classId: activeClass.value.id,
        className: activeClass.value.name,
        teacher: activeTask.value.teacher,
        course: activeCourse.value.title,
        lessonType: activeTask.value.lessonType,
        studentId: row.studentId,
        studentName: student.name,
        artwork: row.image,
        title: existing?.title || `${student.name}的${activeCourse.value.title}`,
        description: existing?.description || '',
        tags: existing?.tags || [],
        note: existing?.note || '',
        feedback: row.comment,
        homework: homework.value.content,
        highlight: existing?.highlight ?? row.highlight,
        highlightNote: existing?.highlightNote ?? row.highlightNote,
        framed: existing?.framed || false,
        framedAt: existing?.framedAt || '',
        frameFee: existing?.frameFee || 0,
        framerId: existing?.framerId || null,
        framerName: existing?.framerName || '',
        frameNote: existing?.frameNote || '',
        updatedBy: existing?.updatedBy || '',
        updatedAt: existing?.updatedAt || '',
        shareUrl: existing?.shareUrl || '',
        collectionIds: existing?.collectionIds || [],
        wheatStatus,
        storageTarget,
        sourceType: 'lesson',
        archiveCategory: '课堂作品'
      }
      if (existing) Object.assign(existing, payload)
      else archiveRecords.unshift({ id: Date.now() + row.studentId, ...payload })
    })
  }

  const pushArchiveItem = async (key) => {
    if (archiveActionBlocked()) return false
    if (!enabledCloudProviders.value.length) {
      setArchiveChecklistItem(key, { status: '已跳过', detail: '未启用网盘通道，本项不阻断课次完成' })
      notify('未启用网盘通道，已标记为跳过')
      return false
    }
    const labels = {
      studentCloudArchive: '学生作品与照片'
    }
    setArchiveChecklistItem(key, { status: '推送中' })
    await runAction(`正在推送${labels[key]}到百度网盘...`, `${labels[key]}已同步到百度网盘`, async () => {
      activeTask.value.cloudArchiveStatus = '已同步'
      setArchiveChecklistItem(key, { status: '已同步', detail: studentArchivePathPreview.value })
    })
    return true
  }

  const archiveTeacherEffectImage = async () => {
    if (archiveActionBlocked()) return false
    const title = `${activeTask.value.date}《${activeClass.value.name}--${activeCourse.value.title}》${activeTask.value.teacher} ${activeTask.value.time}`
    setArchiveChecklistItem('teacherEffectArchive', { status: '生成中' })
    await runAction('正在生成并归档老师课效长图...', '老师课效长图已生成并进入归档', async () => {
      setArchiveChecklistItem('teacherEffectArchive', {
        status: enabledCloudProviders.value.length ? '已归档' : '已跳过',
        title,
        imageCount: counts.value.matched,
        detail: enabledCloudProviders.value.length
          ? `${title} · ${counts.value.matched} 张图片 · 已同步 ${teacherEffectPathPreview.value}`
          : `${title} · ${counts.value.matched} 张图片 · 已保存到老师归档中心，未启用网盘`
      })
    })
    return true
  }

  const generateWheatTraceTask = async () => {
    if (archiveActionBlocked()) return false
    if (isArchiveDone(archiveChecklist.value.wheatTrace)) {
      notify('小麦消课待办已经生成')
      return false
    }
    setArchiveChecklistItem('wheatTrace', { status: '生成中' })
    await runAction('正在生成小麦消课待办...', '小麦消课待办已生成', async () => {
      const trace = ensureWheatTrace()
      activeTask.value.wheatStatus = trace.status
      setArchiveChecklistItem('wheatTrace', { status: '已生成', traceId: trace.id, detail: '请前往小麦助教完成消课，完成后返回本系统确认' })
    })
    return true
  }

  const wecomTaskFor = (lessonId, studentId) =>
    wecomSendTasks.find((task) => sameId(task.lessonId, lessonId) && sameId(task.studentId, studentId))

  const refreshParentTouchSummary = (lessonId = activeTask.value.id) => {
    const workspace = getLessonWorkspace(lessonId)
    if (!workspace?.archiveChecklist?.parentTouch) return
    const lessonTasks = wecomSendTasks.filter((task) => task.lessonId === Number(lessonId))
    if (!lessonTasks.length) return
    const sent = lessonTasks.filter((task) => task.status === '已发送').length
    const manual = lessonTasks.filter((task) => task.status === '人工触达').length
    const failed = lessonTasks.filter((task) => task.status === '发送失败').length
    const pending = lessonTasks.filter((task) => task.status === '待老师确认发送').length
    const status = pending ? '待老师确认发送' : failed ? '发送失败' : sent >= manual ? '已发送' : '人工触达'
    Object.assign(workspace.archiveChecklist.parentTouch, {
      status,
      sentCount: sent + manual,
      detail: `企微已发送 ${sent} · 人工触达 ${manual} · 待确认发送 ${pending}${failed ? ` · 发送失败 ${failed}（已进入待办中心，不阻断归档）` : ''}`,
      updatedAt: nowText()
    })
  }

  const pushParentTouch = async () => {
    if (archiveActionBlocked()) return false
    const item = archiveChecklist.value.parentTouch
    if (isArchiveDone(item)) {
      notify('重复提交已拦截：本节家长触达任务已创建并留痕')
      return false
    }
    const missing = attendingRows.value.filter((row) => !isDeliveryConfirmed(row))
    if (missing.length) {
      notify(`发布失败：还有 ${missing.length} 名学生的作品或课评未确认`)
      return false
    }
    if (sharePage.value.status !== '已发布') await generateSharePages()
    if (sharePage.value.status !== '已发布') return false
    const before = item.status
    setArchiveChecklistItem('parentTouch', { status: '创建中' })
    const nextStatus = wecomEnabled.value ? '待老师确认发送' : '人工触达'
    await runAction(
      wecomEnabled.value ? '正在创建企业微信家长触达任务...' : '正在记录人工触达留痕...',
      '',
      async () => {
        attendingRows.value.forEach((row) => {
          const student = students.find((entry) => entry.id === row.studentId)
          const payload = {
            lessonId: activeTask.value.id,
            lesson: `${activeTask.value.date} ${activeTask.value.time} · ${activeClass.value.name}`,
            studentId: row.studentId,
            studentName: student?.name || '学生',
            targetName: student?.parent || '家长',
            shareUrl: studentShareUrlFor(row),
            shareVersion: sharePage.value.publishedVersion,
            status: nextStatus,
            fallbackMethod: wecomEnabled.value ? '' : '待复制链接发送',
            failureReason: '',
            createdAt: nowText(),
            sentAt: ''
          }
          const existing = wecomTaskFor(activeTask.value.id, row.studentId)
          if (existing) Object.assign(existing, payload)
          else wecomSendTasks.unshift({ id: nextId(wecomSendTasks), ...payload })
        })
        setArchiveChecklistItem('parentTouch', {
          status: nextStatus,
          method: wecomEnabled.value ? '企业微信客户触达' : '人工触达',
          sentCount: 0,
          detail: wecomEnabled.value
            ? `已创建 ${attendingRows.value.length} 个企微触达任务`
            : `企业微信未启用，已生成 ${attendingRows.value.length} 个学生链接`
        })
        addStatusLog(
          '家长触达',
          activeTask.value.id,
          before,
          nextStatus,
          wecomEnabled.value ? `发布展示页 V${sharePage.value.publishedVersion} 并创建 ${attendingRows.value.length} 个企微触达任务` : '企微未启用，发布展示页并记录人工触达'
        )
      }
    )
    notify(
      wecomEnabled.value
        ? `已创建 ${attendingRows.value.length} 个企微触达任务，等待老师在企业微信中确认发送`
        : '企业微信未启用：请复制学生链接人工发送给家长'
    )
    return true
  }

  const markWecomSendTask = (task, status, reason = '') => {
    const before = task.status
    if (before === status) {
      notify(`重复操作已拦截：该触达任务已经是“${status}”`)
      return false
    }
    if (status === '发送失败' && !reason.trim()) {
      notify('请填写发送失败原因')
      return false
    }
    task.status = status
    if (status === '已发送') {
      task.sentAt = nowText()
      task.failureReason = ''
    }
    if (status === '发送失败') task.failureReason = reason.trim()
    addStatusLog('企微触达', task.id, before, status, reason.trim() || (status === '已发送' ? '老师已在企业微信确认发送' : ''), '待办中心', task.lessonId)
    refreshParentTouchSummary(task.lessonId)
    notify(`${task.studentName}的触达任务已标记为：${status}`)
    return true
  }

  const manualCopyWecomTask = async (task) => {
    let clipboardOk = true
    try {
      await navigator.clipboard.writeText(task.shareUrl)
    } catch {
      clipboardOk = false
    }
    const before = task.status
    if (task.status !== '已发送') {
      task.status = '人工触达'
      task.sentAt = nowText()
    }
    task.fallbackMethod = '复制链接人工发送'
    if (before !== task.status) addStatusLog('企微触达', task.id, before, task.status, '企微不可用或未绑定，复制链接人工发送', '家长触达', task.lessonId)
    refreshParentTouchSummary(task.lessonId)
    copiedStudentId.value = task.studentId
    notify(clipboardOk ? `已复制${task.studentName}的家长链接，并记录人工触达` : `已记录${task.studentName}的人工触达，请手动复制链接发送`)
    setTimeout(() => {
      if (copiedStudentId.value === task.studentId) copiedStudentId.value = null
    }, 1600)
    return true
  }

  const manualCopyStudentLink = async (row) => {
    const task = wecomTaskFor(activeTask.value.id, row.studentId)
    if (task) return manualCopyWecomTask(task)
    return copyStudentLink(row)
  }

  const archiveAll = async () => {
    if (activeTask.value.status === '已完成' || activeTask.value.archived) {
      const trace = wheatTraces.find((item) => item.lessonId === activeTask.value.id)
      notify(`重复提交已拦截：归档和小麦待办均未重复生成${trace ? `（待办 #${trace.id}）` : ''}`)
      return false
    }
    if (activeTask.value.status === '异常') {
      notify('归档失败：请先恢复异常课次再完成交付')
      return false
    }
    if (activeTask.value.status !== '处理中') {
      notify(`归档失败：课次当前为“${activeTask.value.status}”，请先开始处理`)
      return false
    }
    if (currentWarnings.value.length) {
      notify(`归档失败：仍有 ${currentWarnings.value.length} 项完成门槛未通过`)
      return false
    }
    if (!archiveChecklistReady.value) {
      notify(`归档失败：还有 ${archiveChecklistPending.value.slice(0, 3).join('、')} 未完成`)
      return false
    }
    const cloudTargets = archiveTargets.value.filter((target) => target.id.startsWith('cloud:') && selectedArchiveTargets.value.includes(target.id))
    const targetLabel = cloudTargets.length ? `，并同步 ${cloudTargets.map((target) => target.label).join('、')}` : ''
    await runAction(`正在完成本节归档交付...`, `本节课已完成归档交付${targetLabel}`, async () => {
      const before = activeTask.value.status
      const trace = ensureWheatTrace()
      activeTask.value.wheatStatus = trace.status
      activeTask.value.archived = true
      activeTask.value.archiveTargets = selectedArchiveTargets.value
      activeTask.value.cloudArchiveStatus = cloudTargets.length ? '已同步' : '未选择网盘'
      activeTask.value.archiveVersion = (activeTask.value.archiveVersion || 0) + 1
      activeTask.value.status = '已完成'
      addStatusLog('课次', activeTask.value.id, before, '已完成', '归档交付清单全部完成')
      showReport.value = true
      reportPulse.value = true
      setTimeout(() => {
        reportPulse.value = false
      }, 1200)
      writeLessonArchiveRecords(trace, cloudTargets.map((target) => target.label).join('、') || '系统作品档案')
    })
    return true
  }

  const copyExport = async () => {
    await navigator.clipboard.writeText(exportText.value)
    copied.value = true
    notify('家长展示链接和文案已复制')
    setTimeout(() => {
      copied.value = false
    }, 1600)
  }

  const copyStudentLink = async (row) => {
    await navigator.clipboard.writeText(studentShareUrlFor(row))
    copiedStudentId.value = row.studentId
    notify(`已复制${students.find((item) => item.id === row.studentId)?.name || '学生'}的家长链接`)
    setTimeout(() => {
      if (copiedStudentId.value === row.studentId) copiedStudentId.value = null
    }, 1600)
  }

  const updateImage = (event, row, replaceIndex = null) => {
    const files = [...(event.target.files || [])]
    if (!files.length) return
    if (!Array.isArray(row.images)) row.images = row.image ? [row.image] : []
    const urls = files.map((file) => URL.createObjectURL(file))
    if (replaceIndex === null) row.images.push(...urls)
    else row.images.splice(replaceIndex, 1, urls[0])
    row.image = row.images[0] || ''
    row.originalImage = row.image
    row.imageMatched = row.images.length > 0
    row.imageConfirmed = row.imageMatched
    row.processed = false
    row.processedImage = ''
    row.imageProcessStatus = '未处理'
    row.imageProcessError = ''
    event.target.value = ''
    notify(`已为${students.find((item) => item.id === row.studentId)?.name || '学生'}上传 ${files.length} 张作品`)
  }

  const removeStudentImage = (row, index) => {
    if (!Array.isArray(row.images)) row.images = row.image ? [row.image] : []
    row.images.splice(index, 1)
    row.image = row.images[0] || ''
    row.originalImage = row.image
    row.imageMatched = row.images.length > 0
    row.imageConfirmed = row.imageMatched
    row.processed = false
    row.processedImage = ''
    row.imageProcessStatus = '未处理'
    row.imageProcessError = ''
    notify(row.imageMatched ? '已删除这张作品' : '该学生暂无作品，请重新上传')
  }

  const markTrace = (trace, status, reason = '') => {
    const before = trace.status
    if (before === status) {
      notify(`重复提交已拦截：该消课记录已经是“${status}”`)
      return false
    }
    const isCorrection = ['已人工处理', '无需处理'].includes(before)
    if ((status === '异常' || status === '无需处理' || isCorrection) && !reason?.trim()) {
      notify(isCorrection ? '更正已完成的消课状态必须填写更正原因' : '该状态变更必须填写说明')
      return false
    }
    if (isCorrection && !isAdmin.value) {
      notify('操作未执行：只有管理员可以更正已完成的消课状态')
      return false
    }
    trace.status = status
    trace.note = reason?.trim() || (status === '已人工处理' ? '已在小麦助教完成消课' : trace.note)
    trace.lastReason = reason?.trim() || '人工确认已处理'
    trace.operator = currentUser.value?.name
    trace.processedAt = nowText()
    const lesson = `${activeTask.value.date} ${activeTask.value.time} · ${activeClass.value.name}`
    if (trace.lesson === lesson) activeTask.value.wheatStatus = status
    // Keep the audit object type stable for historical records; only change
    // the user-facing label of this workflow.
    addStatusLog('小麦留痕', trace.id, before, status, trace.lastReason, '小麦消课页', trace.lessonId || null)
    notify(`小麦消课已标记为：${status}`)
    return true
  }

  const addLesson = (payload) => {
    const klass = classes.find((item) => item.id === Number(payload.classId))
    const course = courses.find((item) => item.id === Number(payload.courseId))
    const teacher = teachers.find((item) => item.id === Number(payload.teacherId))
    const lesson = {
      id: nextId(tasks),
      date: payload.date || displayDateFromValue(payload.dateValue) || '6月21日',
      dateValue: payload.dateValue || '2026-06-21',
      time: payload.time || '17:40',
      classId: klass?.id || classes[0]?.id,
      courseId: course?.id || courses[0]?.id,
      teacher: teacher?.name || klass?.teacher || '待配置',
      lessonType: payload.lessonType || '收费课',
      status: payload.status || '待处理',
      wheatStatus: '未生成',
      importedFrom: payload.importedFrom || '手动补录',
      shareGenerated: false,
      archived: false
    }
    tasks.unshift(lesson)
    activeTaskId.value = lesson.id
    ensureLessonWorkspace(lesson)
    notify(`已补录课次：${klass?.name || '班级'} · ${course?.title || '课程'}`)
    return lesson
  }

  const addStudent = (payload) => {
    const student = {
      ...payload,
      id: nextId(students),
      name: payload.name || '新学生',
      nickname: payload.nickname || payload.name || '新学生',
      age: Number(payload.age) || 6,
      parent: payload.parent || '待补充',
      phone: payload.phone || '',
      classId: Number(payload.classId) || classes[0]?.id,
      status: payload.status || '在读',
      note: payload.note || '',
      works: payload.works || 0,
      highlights: payload.highlights || 0
    }
    students.push(student)
    const klass = classes.find((item) => item.id === student.classId)
    if (klass && !klass.studentIds.includes(student.id)) klass.studentIds.push(student.id)
    notify(`已新增学生：${student.name}`)
    return student
  }

  const updateStudent = (id, payload) => {
    const student = students.find((item) => item.id === id)
    if (!student) return null
    const oldClassId = student.classId
    Object.assign(student, {
      ...payload,
      age: Number(payload.age) || student.age,
      classId: Number(payload.classId) || student.classId
    })
    if (oldClassId !== student.classId) {
      const oldClass = classes.find((item) => item.id === oldClassId)
      const nextClass = classes.find((item) => item.id === student.classId)
      if (oldClass) oldClass.studentIds = oldClass.studentIds.filter((studentId) => studentId !== student.id)
      if (nextClass && !nextClass.studentIds.includes(student.id)) nextClass.studentIds.push(student.id)
    }
    notify(`已保存学生：${student.name}`)
    return student
  }

  const addCommunicationRecord = (payload) => {
    const student = students.find((item) => item.id === Number(payload.studentId))
    if (!student) {
      notify('请先选择学生')
      return null
    }
    const record = {
      id: nextId(communicationRecords),
      studentId: student.id,
      contactPerson: payload.contactPerson || student.parent || '家长',
      contactRole: payload.contactRole || '家长',
      contactMethod: payload.contactMethod || '微信',
      content: payload.content || '',
      followUpAction: payload.followUpAction || '',
      recordedBy: payload.recordedBy || currentUser.value?.name || '当前用户',
      recordedAt: payload.recordedAt || nowText(),
      updatedAt: ''
    }
    communicationRecords.unshift(record)
    notify(`已新增${student.name}的沟通记录`)
    return record
  }

  const updateCommunicationRecord = (id, payload) => {
    const record = communicationRecords.find((item) => item.id === Number(id))
    if (!record) return null
    Object.assign(record, {
      ...payload,
      studentId: Number(payload.studentId) || record.studentId,
      updatedAt: nowText()
    })
    const student = students.find((item) => item.id === record.studentId)
    notify(`已保存${student?.name || '学生'}的沟通记录`)
    return record
  }

  const deleteCommunicationRecord = (id) => {
    const index = communicationRecords.findIndex((item) => item.id === Number(id))
    if (index < 0) return null
    const [record] = communicationRecords.splice(index, 1)
    const student = students.find((item) => item.id === record.studentId)
    notify(`已删除${student?.name || '学生'}的沟通记录`)
    return record
  }

  const addClass = (payload) => {
    const teacher = teachers.find((item) => item.id === Number(payload.teacherId))
    const klass = {
      id: nextId(classes),
      name: payload.name || '新班级',
      time: payload.time || '待排课',
      scheduleSlots: payload.scheduleSlots || [],
      teacherId: Number(payload.teacherId) || teachers[0]?.id,
      teacher: teacher?.name || payload.teacher || '待配置',
      group: payload.group || '待创建家长群',
      status: payload.status || '筹备中',
      studentIds: payload.studentIds || [],
      courseId: Number(payload.courseId) || courses[0]?.id
    }
    classes.push(klass)
    notify(`已新增班级：${klass.name}`)
    return klass
  }

  const updateClass = (id, payload) => {
    const klass = classes.find((item) => item.id === id)
    if (!klass) return null
    const teacher = teachers.find((item) => item.id === Number(payload.teacherId))
    Object.assign(klass, {
      ...payload,
      teacherId: Number(payload.teacherId) || klass.teacherId,
      teacher: teacher?.name || klass.teacher,
      courseId: Number(payload.courseId) || klass.courseId,
      studentIds: payload.studentIds || klass.studentIds
    })
    students.forEach((student) => {
      if (klass.studentIds.includes(student.id)) student.classId = klass.id
    })
    notify(`已保存班级：${klass.name}`)
    return klass
  }

  const addCourse = (payload) => {
    const course = {
      id: nextId(courses),
      title: payload.title || '新课程主题',
      age: payload.age || '5-7岁',
      goal: payload.goal || '',
      materials: payload.materials || '',
      reference: payload.reference || '',
      defaultFocus: payload.defaultFocus || '色彩',
      commentTemplate: payload.commentTemplate || templates.comment[0]?.name,
      imageTemplate: payload.imageTemplate || templates.image[0]?.name,
      onlineLinks: payload.onlineLinks || []
    }
    courses.push(course)
    notify(`已新增课程：${course.title}`)
    return course
  }

  const updateCourse = (id, payload) => {
    const course = courses.find((item) => item.id === id)
    if (!course) return null
    Object.assign(course, payload)
    notify(`已保存课程：${course.title}`)
    return course
  }

  const addExternalLink = (payload) => {
    const link = {
      id: nextId(externalLinks),
      title: payload.title || '新外部课程',
      url: payload.url || 'https://example.com/course',
      platform: payload.platform || '通用链接',
      note: payload.note || '',
      courseIds: payload.courseIds || [],
      status: payload.status || '启用'
    }
    externalLinks.push(link)
    notify(`已新增外部课程链接：${link.title}`)
    return link
  }

  const updateExternalLink = (id, payload) => {
    const link = externalLinks.find((item) => item.id === id)
    if (!link) return null
    Object.assign(link, payload, { courseIds: payload.courseIds || [] })
    notify(`已保存外部课程链接：${link.title}`)
    return link
  }

  const addTeacher = (payload) => {
    const teacher = {
      id: nextId(teachers),
      name: payload.name || '新老师',
      phone: payload.phone || '',
      password: payload.password || '123456',
      role: payload.role || '老师',
      availableRoles: [payload.role || '老师'],
      status: payload.status || '启用',
      classes: []
    }
    teachers.push(teacher)
    notify(`已新增账号：${teacher.name}`)
    return teacher
  }

  const updateTeacher = (id, payload) => {
    const teacher = teachers.find((item) => item.id === id)
    if (!teacher) return null
    Object.assign(teacher, payload)
    notify(`已保存账号：${teacher.name}`)
    return teacher
  }

  const applyImportRows = () => {
    const rows = importPreviewRows.filter((row) => row.status === '可导入')
    rows.forEach((row) => {
      if (row.type === 'student') {
        const klass = classes.find((item) => item.name === row.className)
        addStudent({ name: row.name, nickname: row.nickname, parent: row.parent, phone: row.phone, classId: klass?.id, status: '在读' })
      }
      if (row.type === 'class') {
        const teacher = teachers.find((item) => item.name === row.teacher)
        const course = courses.find((item) => item.title === row.course)
        addClass({ name: row.name, teacherId: teacher?.id, time: row.time, courseId: course?.id, status: '筹备中' })
      }
    })
    importBatches.unshift({
      id: Date.now(),
      source: '导入预览确认',
      time: '6月21日 16:30',
      success: rows.length,
      failed: importPreviewRows.length - rows.length,
      note: '可导入记录已写入基础数据，异常记录保留待补录'
    })
    notify(`已导入 ${rows.length} 条基础数据`)
  }

  const updateSetting = (id, payload) => {
    const setting = settings.find((item) => item.id === id)
    if (!setting) return null
    Object.assign(setting, payload)
    if (setting.name === 'AI 接口') school.aiProvider = setting.value
    if (setting.name === '作品存储') school.objectStorage = setting.value
    if (setting.name === '水印配置') school.watermark = setting.value
    notify(`已保存配置：${setting.name}`)
    return setting
  }

  const addTemplate = (type, payload) => {
    const defaults = {
      image: { ratio: '4:5', brightness: '+10%', watermark: '右下角校区水印', border: '米白作品框', crop: '居中裁切', quality: '高清', status: '启用' },
      comment: { tone: '温暖自然', length: '60-80字', structure: '亮点、建议、鼓励', taboo: '不夸大、不排名', sample: '', status: '启用' },
      prompt: { model: '学生记录 + 课程参考 + 模板规则', scene: 'feedback', systemPrompt: '', userPrompt: '', temperature: 0.7, maxTokens: 220, status: '启用' }
    }
    const template = { name: payload.name || '新模板', ...defaults[type], ...payload }
    templates[type].push(template)
    notify(`已新增模板：${template.name}`)
    return template
  }

  const updateTemplate = (type, index, payload) => {
    if (!templates[type]?.[index]) return null
    Object.assign(templates[type][index], payload)
    notify(`已保存模板：${templates[type][index].name}`)
    return templates[type][index]
  }

  const addExtraTask = (payload) => {
    const lesson = tasks.find((task) => task.id === Number(payload.relatedLessonId))
    const klass = lesson ? classes.find((item) => item.id === lesson.classId) : null
    const task = {
      id: nextId(extraTaskArchives),
      title: payload.title || '新课外任务',
      taskType: payload.taskType || '学生课外任务',
      owner: payload.owner || currentUser.value?.name || '待发布老师',
      relatedLessonId: payload.relatedLessonId ? Number(payload.relatedLessonId) : null,
      relatedLesson: lesson ? `${lesson.date} ${lesson.time} · ${klass?.name || '班级'}` : '无归属课次',
      content: payload.content || '',
      dueDate: payload.dueDate || '',
      status: payload.status || '待发布',
      note: payload.note || ''
    }
    extraTaskArchives.unshift(task)
    notify(`已新增课外任务：${task.title}`)
    return task
  }

  const extraTaskWorksForTask = (taskId) =>
    archiveRecords.filter((record) => record.sourceType === 'extraTask' && record.extraTaskId === Number(taskId))

  const buildExtraTaskWorkPayload = (extraTask, payload, existing = null) => {
    const student = students.find((item) => item.id === Number(payload.studentId ?? existing?.studentId))
    if (!extraTask || !student) return null
    const relatedLesson = tasks.find((task) => task.id === Number(extraTask.relatedLessonId))
    const relatedClass = relatedLesson ? classes.find((item) => item.id === relatedLesson.classId) : null
    const studentClass = classes.find((item) => item.id === student.classId)
    const dateValue = payload.dateValue || existing?.dateValue || relatedLesson?.dateValue || ''
    const teacher = extraTask.owner || relatedLesson?.teacher || currentUser.value?.name || '待记录老师'

    return {
      lessonId: relatedLesson?.id || null,
      date: displayDateFromValue(dateValue) || payload.date || existing?.date || extraTask.dueDate || '未记录日期',
      dateValue,
      time: relatedLesson?.time || existing?.time || '课外',
      classId: relatedClass?.id || studentClass?.id || existing?.classId || null,
      className: relatedClass?.name || studentClass?.name || existing?.className || '未归属班级',
      teacher,
      course: extraTask.title,
      lessonType: '课外作品',
      studentId: student.id,
      studentName: student.name,
      artwork: payload.artwork || existing?.artwork || '',
      pixelWidth: existing?.pixelWidth || 1600,
      pixelHeight: existing?.pixelHeight || 1200,
      title: payload.title?.trim() || existing?.title || `${student.name}的课外作品`,
      description: payload.description?.trim() || existing?.description || '',
      tags: [...new Set((payload.tags || []).map((tag) => tag.trim()).filter(Boolean))],
      note: payload.note?.trim() || existing?.note || '',
      feedback: existing?.feedback || '',
      homework: extraTask.content || '',
      highlight: Boolean(payload.highlight ?? existing?.highlight),
      highlightNote: payload.highlight ? payload.highlightNote?.trim() || '' : '',
      framed: existing?.framed || false,
      framedAt: existing?.framedAt || '',
      frameFee: existing?.frameFee || 0,
      framerId: existing?.framerId || null,
      framerName: existing?.framerName || '',
      frameNote: existing?.frameNote || '',
      updatedBy: currentUser.value?.name || teacher,
      updatedAt: nowText(),
      shareUrl: existing?.shareUrl || '',
      collectionIds: existing?.collectionIds || [],
      wheatStatus: '无需处理',
      storageTarget: '系统作品档案',
      sourceType: 'extraTask',
      archiveCategory: '课外作品',
      extraTaskId: extraTask.id,
      extraTaskTitle: extraTask.title,
      extraTaskStatus: extraTask.status
    }
  }

  const addExtraTaskWork = (extraTaskId, payload) => {
    const extraTask = extraTaskArchives.find((item) => item.id === Number(extraTaskId))
    const next = buildExtraTaskWorkPayload(extraTask, payload)
    if (!next || !next.artwork) {
      notify('请先选择学生并上传作品图片')
      return null
    }
    const record = { id: nextId(archiveRecords), ...next }
    archiveRecords.unshift(record)
    if (extraTask && extraTask.status !== '已归档') extraTask.status = '待归档'
    notify(`已归档课外作品：${record.title}`)
    return record
  }

  const updateExtraTaskWork = (recordId, payload) => {
    const record = archiveRecords.find((item) => item.id === Number(recordId) && item.sourceType === 'extraTask')
    if (!record || !canEditArchiveRecord(record)) {
      notify('无权限编辑该课外作品')
      return null
    }
    const extraTask = extraTaskArchives.find((item) => item.id === Number(record.extraTaskId))
    const next = buildExtraTaskWorkPayload(extraTask, payload, record)
    if (!next || !next.artwork) {
      notify('请保留学生和作品图片')
      return null
    }
    Object.assign(record, next)
    notify(`已保存课外作品：${record.title}`)
    return record
  }

  const deleteExtraTaskWork = (recordId) => {
    const index = archiveRecords.findIndex((item) => item.id === Number(recordId) && item.sourceType === 'extraTask')
    const record = archiveRecords[index]
    if (!record || !canEditArchiveRecord(record)) {
      notify('无权限删除该课外作品')
      return false
    }
    archiveCollections.forEach((collection) => {
      collection.recordIds = collection.recordIds.filter((id) => id !== record.id)
    })
    archiveRecords.splice(index, 1)
    notify(`已删除课外作品：${record.title}`)
    return true
  }

  const updateExtraTask = (id, payload) => {
    const task = extraTaskArchives.find((item) => item.id === id)
    if (!task) return null
    const lesson = tasks.find((item) => item.id === Number(payload.relatedLessonId))
    const klass = lesson ? classes.find((item) => item.id === lesson.classId) : null
    Object.assign(task, payload, {
      relatedLessonId: payload.relatedLessonId ? Number(payload.relatedLessonId) : null,
      relatedLesson: lesson ? `${lesson.date} ${lesson.time} · ${klass?.name || '班级'}` : '无归属课次'
    })
    notify(`已保存课外任务：${task.title}`)
    return task
  }

  const nextStep = () => {
    if (currentStep.value < steps.value.length - 1) currentStep.value += 1
  }

  const prevStep = () => {
    if (currentStep.value > 0) currentStep.value -= 1
  }

  const replaceReactive = (target, values = []) => {
    target.splice(0, target.length, ...(Array.isArray(values) ? values : []))
  }

  const remoteErrorMessage = (error, fallback = '操作失败，请稍后重试') => {
    if (error?.status === 401 || error?.code === 'TOKEN_EXPIRED') return '登录状态已失效，请重新登录'
    if (error?.status === 404 || error?.code === 'RESOURCE_NOT_FOUND') return '服务端找不到对应资源，请刷新后重试'
    if (error?.code === 'INVALID_STATE_TRANSITION' && String(error?.message || '').includes('命令仍在处理中')) {
      return '该操作已在处理中，页面已刷新，请稍候'
    }
    if (error?.status === 409 || ['VERSION_CONFLICT', 'INVALID_STATE_TRANSITION', 'DUPLICATE_RESOURCE', 'IDEMPOTENCY_KEY_REUSED', 'STALE_JOB_ATTEMPT'].includes(error?.code)) return '数据已被其他人更新或操作重复，页面已刷新，请确认后重试'
    if (error?.code === 'PERMISSION_DENIED' || error?.status === 403) return '当前账号没有执行此操作的权限'
    if (error?.status === 422 || error?.code === 'TRANSITION_PRECONDITION_FAILED' || error?.code === 'LESSON_COMPLETION_BLOCKED') return error.message || '当前前置条件未满足'
    if (error?.status === 413) return '文件超过系统允许的大小'
    if (error?.status === 415) return '文件格式不受支持'
    return error?.message || fallback
  }

  const runRemote = async (label, action, success = '', onConflict = null) => {
    processingAction.value = label
    try {
      const result = await action()
      if (success) notify(success)
      return result
    } catch (error) {
      let recovered = null
      if (error?.status === 409 && remoteReady.value) {
        try {
          if (typeof onConflict === 'function') recovered = await onConflict(error)
          else if (activeTaskId.value) await refreshRemoteLesson(activeTaskId.value, { force: true })
          else await refreshWorkbenchSummary()
        } catch {
          // 原始冲突信息仍由统一错误提示展示。
        }
      }
      if (recovered?.handled) {
        if (recovered.message) notify(recovered.message)
        return recovered.value ?? true
      }
      if (recovered) return recovered
      notify(remoteErrorMessage(error))
      return null
    } finally {
      processingAction.value = ''
    }
  }

  const runRemoteVoid = async (label, action, success = '', onConflict = null) => {
    processingAction.value = label
    try {
      await action()
      if (success) notify(success)
      return true
    } catch (error) {
      if (error?.status === 409 && remoteReady.value) {
        try {
          if (typeof onConflict === 'function') await onConflict()
          else if (activeTaskId.value) await refreshRemoteLesson(activeTaskId.value, { force: true })
          else await refreshWorkbenchSummary()
        } catch {
          // 原始冲突信息仍由统一错误提示展示。
        }
      }
      notify(remoteErrorMessage(error))
      return false
    } finally {
      processingAction.value = ''
    }
  }

  const runIdentity = async (label, action, success = '', onConflict = null) => {
    processingAction.value = label
    try {
      const value = await action()
      if (success) notify(success)
      return { ok: true, value }
    } catch (error) {
      if (error?.status === 409 && onConflict) {
        try {
          await onConflict()
        } catch {
          // 保留原始版本冲突提示。
        }
      }
      notify(remoteErrorMessage(error))
      return { ok: false, value: null }
    } finally {
      processingAction.value = ''
    }
  }

  const identityIdStrings = (values) => (Array.isArray(values)
    ? values.filter((value) => value !== null && value !== undefined && value !== '').map(String)
    : [])

  const loadIdentityPermissions = async ({ force = false } = {}) => {
    if (identityLoading.permissions) return identityPermissions
    if (identityLoaded.permissions && !force) return identityPermissions
    identityLoading.permissions = true
    identityErrors.permissions = ''
    try {
      const values = await api.auth.permissions()
      replaceReactive(identityPermissions, Array.isArray(values) ? values.map(mapIdentityPermission) : [])
      identityLoaded.permissions = true
      return identityPermissions
    } catch (error) {
      identityErrors.permissions = remoteErrorMessage(error, '权限资源加载失败')
      return null
    } finally {
      identityLoading.permissions = false
    }
  }

  const loadIdentityRoles = async ({ force = false } = {}) => {
    if (identityLoading.roles) return identityRoles
    if (identityLoaded.roles && !force) return identityRoles
    identityLoading.roles = true
    identityErrors.roles = ''
    try {
      const values = await api.auth.roles()
      replaceReactive(identityRoles, Array.isArray(values) ? values.map(mapIdentityRole) : [])
      identityLoaded.roles = true
      return identityRoles
    } catch (error) {
      identityErrors.roles = remoteErrorMessage(error, '角色列表加载失败')
      return null
    } finally {
      identityLoading.roles = false
    }
  }

  const loadIdentityUsers = async ({ page = 1, pageSize = identityUserPage.pageSize, query = identityUserQuery.value, status = identityUserStatus.value } = {}) => {
    identityLoading.users = true
    identityErrors.users = ''
    const nextPage = Math.max(1, Number(page) || 1)
    const nextPageSize = Math.max(1, Number(pageSize) || 20)
    identityUserQuery.value = query || ''
    identityUserStatus.value = status || ''
    try {
      const result = mapPage(await api.auth.users({
        page: nextPage,
        pageSize: nextPageSize,
        query: identityUserQuery.value || undefined,
        status: identityUserStatus.value || undefined
      }), mapIdentityUser)
      replaceReactive(identityUsers, result.items)
      Object.assign(identityUserPage, {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total
      })
      identityLoaded.users = true
      return result
    } catch (error) {
      identityErrors.users = remoteErrorMessage(error, '账号列表加载失败')
      return null
    } finally {
      identityLoading.users = false
    }
  }

  const loadIdentityMemberships = async (userId) => {
    identityLoading.memberships = true
    identityErrors.memberships = ''
    try {
      const values = await api.auth.memberships(userId)
      return Array.isArray(values) ? values.map(mapCampusMembership) : []
    } catch (error) {
      identityErrors.memberships = remoteErrorMessage(error, '账号数据范围加载失败')
      return null
    } finally {
      identityLoading.memberships = false
    }
  }

  const refreshIdentityUsers = () => loadIdentityUsers({
    page: identityUserPage.page,
    pageSize: identityUserPage.pageSize,
    query: identityUserQuery.value,
    status: identityUserStatus.value
  })

  const refreshIdentityRoles = () => Promise.all([
    loadIdentityRoles({ force: true }),
    loadIdentityPermissions({ force: true })
  ])

  const remoteCreateIdentityUser = async (payload = {}) => {
    const outcome = await runIdentity('正在创建账号...', () => api.auth.createUser({
      username: String(payload.username || '').trim() || undefined,
      phone: String(payload.phone || '').trim(),
      displayName: String(payload.displayName || '').trim(),
      password: String(payload.password || ''),
      roleIds: identityIdStrings(payload.roleIds),
      campusIds: identityIdStrings(payload.campusIds)
    }), '账号已创建', refreshIdentityUsers)
    if (!outcome.ok) return null
    await refreshIdentityUsers()
    return mapIdentityUser(outcome.value)
  }

  const remoteUpdateIdentityUser = async (userId, payload = {}) => {
    const current = identityUsers.find((user) => sameId(user.id, userId))
    const outcome = await runIdentity('正在保存账号资料...', () => api.auth.updateUser(userId, {
      phone: String(payload.phone ?? current?.phone ?? '').trim(),
      displayName: String(payload.displayName ?? current?.displayName ?? '').trim(),
      status: payload.status || current?.status || 'ENABLED',
      version: Number(payload.version ?? current?.version ?? 0)
    }), '账号资料已保存', refreshIdentityUsers)
    if (!outcome.ok) return null
    await refreshIdentityUsers()
    return mapIdentityUser(outcome.value)
  }

  const remoteResetIdentityPassword = async (userId, password) => {
    const outcome = await runIdentity('正在重置账号密码...', () => api.auth.resetPassword(userId, {
      password: String(password || '')
    }), '账号密码已重置', refreshIdentityUsers)
    return outcome.ok
  }

  const remoteReplaceIdentityUserRoles = async (userId, version, roleIds) => {
    const outcome = await runIdentity('正在保存账号角色...', () => api.auth.replaceUserRoles(userId, {
      version: Number(version || 0),
      roleIds: identityIdStrings(roleIds)
    }), '账号角色已保存', refreshIdentityUsers)
    if (!outcome.ok) return false
    await refreshIdentityUsers()
    return true
  }

  const remoteReplaceIdentityUserMemberships = async (userId, version, campusIds) => {
    const outcome = await runIdentity('正在保存数据范围...', () => api.auth.replaceMemberships(userId, {
      version: Number(version || 0),
      campusIds: identityIdStrings(campusIds)
    }), '账号数据范围已保存', refreshIdentityUsers)
    if (!outcome.ok) return false
    await refreshIdentityUsers()
    return true
  }

  const remoteCreateIdentityRole = async (payload = {}) => {
    const outcome = await runIdentity('正在创建角色...', () => api.auth.createRole({
      roleKey: String(payload.roleKey || '').trim(),
      name: String(payload.name || '').trim(),
      description: String(payload.description || '').trim() || undefined,
      status: payload.status || 'ENABLED'
    }), '角色已创建', refreshIdentityRoles)
    if (!outcome.ok) return null
    await refreshIdentityRoles()
    return mapIdentityRole(outcome.value)
  }

  const remoteUpdateIdentityRole = async (roleId, payload = {}) => {
    const current = identityRoles.find((role) => sameId(role.id, roleId))
    const outcome = await runIdentity('正在保存角色...', () => api.auth.updateRole(roleId, {
      roleKey: String(payload.roleKey ?? current?.roleKey ?? '').trim(),
      name: String(payload.name ?? current?.name ?? '').trim(),
      description: String(payload.description ?? current?.description ?? '').trim() || undefined,
      status: payload.status || current?.status || 'ENABLED',
      version: Number(payload.version ?? current?.version ?? 0)
    }), '角色已保存', refreshIdentityRoles)
    if (!outcome.ok) return null
    await refreshIdentityRoles()
    return mapIdentityRole(outcome.value)
  }

  const remoteReplaceIdentityRolePermissions = async (roleId, version, permissionIds) => {
    const outcome = await runIdentity('正在保存角色权限...', () => api.auth.replaceRolePermissions(roleId, {
      version: Number(version || 0),
      permissionIds: identityIdStrings(permissionIds)
    }), '角色权限已保存', refreshIdentityRoles)
    if (!outcome.ok) return null
    await refreshIdentityRoles()
    return mapIdentityRole(outcome.value)
  }

  const mapImportBatch = (value = {}) => ({
    ...value,
    id: fromApiId(value.id),
    source: value.originalFilename || value.sourceType || '数据导入',
    time: displayDateTime(value.createdAt),
    statusCode: value.status || '',
    statusLabel: ({
      UPLOADED: '待识别',
      PARSING: '识别中',
      PREVIEW_READY: '待确认',
      IMPORTING: '写入中',
      IMPORTED: '已完成',
      FAILED: '失败'
    }[value.status] || value.status || ''),
    readyRows: Number(value.readyRows || 0),
    importedRows: Number(value.importedRows || 0),
    failed: Number(value.invalidRows || 0) + Number(value.duplicateRows || 0),
    success: Number(value.importedRows || value.readyRows || 0),
    note: value.failedStage || value.status || '',
    version: Number(value.version || 0)
  })

  const mapImportRow = (value = {}) => {
    const normalized = value.normalizedValues || {}
    return {
      ...value,
      id: fromApiId(value.id),
      type: String(value.recordType || '').toLowerCase().includes('student') ? 'student' : String(value.recordType || '').toLowerCase().includes('class') ? 'class' : 'lesson',
      name: normalized.name || normalized.studentName || normalized.className || normalized.title || value.rawValues?.name || '',
      className: normalized.className || normalized.class_name || value.rawValues?.className || '',
      teacher: normalized.teacher || normalized.teacherName || value.rawValues?.teacher || '',
      teacherId: fromApiId(normalized.teacherId || value.teacherId),
      teacherMatchStatus: normalized.teacherMatchStatus || value.teacherMatchStatus || '',
      teacherCandidates: Array.isArray(normalized.teacherCandidates) ? normalized.teacherCandidates : Array.isArray(value.teacherCandidates) ? value.teacherCandidates : [],
      dateValue: normalized.date || value.rawValues?.date || '',
      time: normalized.time || normalized.timeRange || normalized.scheduleText || value.rawValues?.time || '',
      course: normalized.course || normalized.courseTitle || value.rawValues?.course || '',
      topic: normalized.topic || normalized.content || value.rawValues?.topic || value.rawValues?.content || '',
      nickname: normalized.nickname || '',
      parent: normalized.parentName || normalized.parent || '',
      phone: normalized.parentPhone || normalized.phone || '',
      status: value.status === 'READY' ? '可导入' : value.status === 'SKIPPED' ? '已跳过' : '需处理',
      issue: value.reasonDetail || value.reasonCode || ''
    }
  }

  const mapProviderCategory = (provider = {}) => {
    const category = String(provider.category || '').trim().toUpperCase()
    if (['CLOUD', 'WECOM', 'AI', 'OTHER'].includes(category)) return category
    const type = String(provider.providerType || provider.type || '').trim().toUpperCase()
    if (type.includes('WECOM') || type.includes('WE_COM') || type.includes('WECHAT')) return 'WECOM'
    if (type.includes('AI') || type.includes('OPENAI') || type.includes('CLAUDE') || type.includes('DEEPSEEK')) return 'AI'
    return 'CLOUD'
  }

  const mapProvider = (provider = {}) => {
    const providerType = provider.providerType || provider.type || ''
    const isBaidu = String(providerType).toUpperCase() === 'BAIDU_NETDISK'
    const isAi = mapProviderCategory({ ...provider, providerType }) === 'AI'
    const config = provider.config && typeof provider.config === 'object' ? { ...provider.config } : {}
    const directoryRule = provider.directoryRule || config.directoryRule || DEFAULT_ARCHIVE_RULE
    const filenameTemplate = provider.filenameTemplate ?? (
      Object.prototype.hasOwnProperty.call(config, 'filenameTemplate')
        ? config.filenameTemplate
        : ''
    )
    if (isAi) {
      config.protocol = config.protocol || 'OPENAI_COMPATIBLE'
      config.textProtocol = config.textProtocol || config.protocol || 'OPENAI_COMPATIBLE'
      config.textEndpoint = config.textEndpoint || config.endpoint || ''
      config.textModel = config.textModel || config.modelName || ''
      config.imageProtocol = config.imageProtocol || 'WAN_NATIVE'
      config.imageEndpoint = config.imageEndpoint || ''
      config.imageModel = config.imageModel || ''
      config.imageSize = config.imageSize || '1K'
      config.watermark = config.watermark === true
      config.thinkingMode = config.thinkingMode === true
    }
    const rawBackendBaseUrl = provider.backendBaseUrl || provider.config?.backendBaseUrl || ''
    const rawFrontendBaseUrl = provider.frontendBaseUrl || provider.config?.frontendBaseUrl || ''
    const rawFrontendReturnPath = provider.frontendReturnPath || provider.config?.frontendReturnPath || ''
    return {
      ...provider,
      config,
      category: mapProviderCategory({ ...provider, providerType }),
      endpoint: provider.endpoint || config.endpoint || config.textEndpoint || '',
      appKey: provider.appKey || config.appKey || '',
      appId: provider.appId || provider.config?.appId || '',
      directoryRule: isBaidu
        ? String(directoryRule).startsWith('/') ? directoryRule : `/${directoryRule}`
        : provider.directoryRule || config.directoryRule || '',
      filenameTemplate: isBaidu ? filenameTemplate || '' : provider.filenameTemplate ?? config.filenameTemplate ?? '',
      backendBaseUrl: isBaidu
        ? normalizeBaiduBaseUrl(rawBackendBaseUrl, DEFAULT_BAIDU_BACKEND_BASE_URL)
        : rawBackendBaseUrl,
      frontendBaseUrl: isBaidu
        ? normalizeBaiduBaseUrl(rawFrontendBaseUrl, DEFAULT_BAIDU_FRONTEND_BASE_URL)
        : rawFrontendBaseUrl,
      frontendReturnPath: isBaidu
        ? normalizeBaiduReturnPath(rawFrontendReturnPath)
        : rawFrontendReturnPath,
      authorizeUrl: provider.authorizeUrl || provider.config?.authorizeUrl || '',
      tokenUrl: provider.tokenUrl || provider.config?.tokenUrl || '',
      scope: provider.scope || provider.config?.scope || '',
      callbackPath: provider.callbackPath || provider.config?.callbackPath || '',
      apiBaseUrl: provider.apiBaseUrl || provider.config?.apiBaseUrl || '',
      uploadBaseUrl: provider.uploadBaseUrl || provider.config?.uploadBaseUrl || '',
      stateTtl: provider.stateTtl || provider.config?.stateTtl || 'PT10M',
      chunkSizeBytes: provider.chunkSizeBytes || provider.config?.chunkSizeBytes || 4194304,
      tokenRefreshSkew: provider.tokenRefreshSkew || provider.config?.tokenRefreshSkew || 'PT5M',
      baiduSecretKeyConfigured: Boolean(provider.baiduSecretConfigured),
      authType: provider.authType || provider.config?.authType || '',
      id: fromApiId(provider.id),
      type: providerType,
      providerType,
      name: provider.name,
      enabled: ['ENABLED', '启用', 'ACTIVE'].includes(provider.status),
      status: ['ENABLED', 'ACTIVE'].includes(provider.status) ? '已启用' : provider.status || '未启用',
      tokenStatus: provider.secretStatus || (provider.secretRefPresent ? '已配置' : '未配置')
    }
  }

  const providerGroupDefinitions = [
    { key: 'cloud', name: '网盘配置', category: 'CLOUD' },
    { key: 'wecom', name: '企业微信配置', category: 'WECOM' },
    { key: 'ai', name: 'AI 配置', category: 'AI' }
  ]

  const providerGroupStatusLabel = (providers = []) => {
    if (!providers.length) return '未配置'
    return providers.some((provider) => provider.enabled) ? '已启用' : '未启用'
  }

  const mapArchiveRule = (value = {}) => {
    cloudArchiveRule.id = fromApiId(value.id)
    cloudArchiveRule.pathTemplate = value.pathTemplate || DEFAULT_ARCHIVE_RULE
    cloudArchiveRule.filenameTemplate = value.filenameTemplate || ''
    cloudArchiveRule.required = Boolean(value.required)
    cloudArchiveRule.duplicateStrategy = value.duplicateStrategy || 'SUFFIX'
    cloudArchiveRule.configured = value.configured !== false
    return cloudArchiveRule
  }

  const mapProviderGroupsFromProviders = (providers = []) => {
    replaceReactive(providerGroups, providerGroupDefinitions.map((definition) => {
      const groupProviders = providers.filter((provider) => provider.category === definition.category)
      return {
        id: definition.key,
        key: definition.key,
        name: definition.name,
        category: definition.category.toLowerCase(),
        status: providerGroupStatusLabel(groupProviders),
        value: {
          providers: groupProviders,
          defaultArchiveTargets: []
        }
      }
    }))
  }

  const mapProviderGroups = (groups = []) => {
    replaceReactive(providerGroups, groups.map((group) => {
      const providers = (group.providers || []).map(mapProvider)
      const category = String(group.category || '').toLowerCase()
      return {
        ...group,
        id: group.key || group.id,
        name: group.name,
        category,
        status: ['ENABLED', 'ACTIVE'].includes(group.status) ? '已启用' : group.status === 'UNCONFIGURED' ? '未配置' : ['DISABLED', '停用'].includes(group.status) ? '未启用' : group.status || providerGroupStatusLabel(providers),
        value: {
          providers,
          defaultArchiveTargets: group.defaultArchiveTargets || []
        }
      }
    }))
  }

  const mapProviderSetting = (providers = []) => {
    const mapped = providers.map(mapProvider)
    replaceReactive(settings, [{ id: 'providers', type: 'cloudDrive', name: '第三方通道配置', status: mapped.some((item) => item.enabled) ? '已启用' : '未启用', value: { providers: mapped }, version: 0 }])
    mapProviderGroupsFromProviders(mapped)
  }

  const applyBaiduOAuthStatus = (provider, status = {}) => {
    if (!provider || !status) return
    provider.oauthStatus = status.status || ''
    provider.oauthAuthorized = Boolean(status.authorized)
    provider.oauthConfigured = status.oauthConfigured !== false
    provider.baiduUid = status.baiduUid || ''
    provider.baiduDisplayName = status.displayName || ''
    provider.authorizedAt = status.authorizedAt || ''
    provider.expiresAt = status.expiresAt || ''
    provider.oauthScope = status.scope || ''
    provider.authErrorCode = status.errorCode || ''
    provider.authErrorMessage = status.errorMessage || ''
    provider.callbackUrl = status.callbackUrl || ''
    provider.frontendReturnUrl = status.frontendReturnUrl || ''
    provider.tokenStatus = provider.oauthAuthorized ? '已授权' : provider.oauthStatus || '未授权'
  }

  const allMappedProviders = () => [
    ...settings.flatMap((setting) => setting.value?.providers || []),
    ...providerGroups.flatMap((group) => group.value?.providers || [])
  ]

  const updateMappedBaiduOAuthStatus = (providerId, status) => {
    allMappedProviders()
      .filter((provider) => sameId(provider.id, providerId))
      .forEach((provider) => applyBaiduOAuthStatus(provider, status))
  }

  const refreshBaiduProviderStatuses = async (providers = []) => {
    const candidates = providers.filter((provider) => provider?.id &&
      String(provider.providerType || provider.type).toUpperCase() === 'BAIDU_NETDISK' &&
      !String(provider.id).startsWith('provider-'))
    await Promise.all(candidates.map(async (provider) => {
      try {
        const status = await api.m5.baiduOAuthStatus(provider.id)
        updateMappedBaiduOAuthStatus(provider.id, status)
      } catch {
        // 授权状态读取失败时不把账号误判为可用，后续设置页仍可重试读取。
      }
    }))
    return candidates
  }

  const loadCloudProvidersForSelection = async () => {
    let cloudGroup = providerGroups.find((group) => String(group.category || '').toLowerCase() === 'cloud')
    if (!cloudGroup) {
      const [providers, groups] = await Promise.all([api.m5.providers(), api.m5.providerGroups()])
      mapProviderSetting(providers?.items || providers || [])
      if (groups) mapProviderGroups(groups)
      cloudGroup = providerGroups.find((group) => String(group.category || '').toLowerCase() === 'cloud')
    }
    const providers = cloudGroup?.value?.providers || []
    await refreshBaiduProviderStatuses(providers)
    return providers.filter((provider) => provider.enabled &&
      String(provider.providerType || provider.type).toUpperCase() === 'BAIDU_NETDISK' &&
      provider.oauthAuthorized)
  }

  const requestCloudProvider = (lessonId) => {
    if (cloudProviderSelectionPromise) return cloudProviderSelectionPromise
    const request = (async () => {
      let available = []
      try {
        available = await loadCloudProvidersForSelection()
      } catch (error) {
        notify(remoteErrorMessage(error, '百度网盘账号加载失败，请稍后重试'))
        return null
      }
      if (!available.length) {
        notify('请先在系统配置中启用并授权百度网盘账号')
        return null
      }
      if (available.length === 1) return available[0].id
      cloudProviderPicker.open = true
      cloudProviderPicker.lessonId = lessonId
      cloudProviderPicker.providers = available
      cloudProviderPicker.selectedProviderId = available[0].id
      const pickerPromise = new Promise((resolve) => {
        cloudProviderPickerResolver = resolve
      })
      cloudProviderPickerPromise = pickerPromise
      return pickerPromise.finally(() => {
        if (cloudProviderPickerPromise !== pickerPromise) return
        cloudProviderPickerPromise = null
        cloudProviderPickerResolver = null
        cloudProviderPicker.open = false
        cloudProviderPicker.lessonId = null
        cloudProviderPicker.providers = []
        cloudProviderPicker.selectedProviderId = null
      })
    })()
    const trackedRequest = request.finally(() => {
      if (cloudProviderSelectionPromise === trackedRequest) cloudProviderSelectionPromise = null
    })
    cloudProviderSelectionPromise = trackedRequest
    return trackedRequest
  }

  const resolveCloudProviderPicker = (providerConfigId) => {
    if (!cloudProviderPickerResolver) return false
    const selected = cloudProviderPicker.providers.find((provider) => sameId(provider.id, providerConfigId))
    const resolver = cloudProviderPickerResolver
    resolver(selected?.id || null)
    return true
  }

  const cancelCloudProviderPicker = () => resolveCloudProviderPicker(null)

  const mergeSharePageForWorkspace = (workspace, page) => {
    const existingLinks = workspace.sharePage?.accessLinks || []
    const accessLinks = page.statusCode === 'PUBLISHED' && !page.accessLinks?.length
      ? existingLinks
      : (page.accessLinks || [])
    return {
      ...workspace.sharePage,
      ...page,
      accessLinks,
      studentTokens: Object.fromEntries(accessLinks.map((link) => [String(link.studentId), link.token]).filter(([, token]) => token))
    }
  }

  const providerTypeOptions = computed(() => providerCatalog.cloud)
  const providerTypeCatalog = computed(() => providerCatalog)

  const defaultTeacherEffectTitle = (lesson = {}) => {
    const date = lesson.dateValue || lesson.date || ''
    const className = lesson.className || '未命名班级'
    const course = lesson.course || lesson.courseTitle || '未命名课程'
    const teacher = lesson.teacher || lesson.teacherName || '未命名老师'
    const time = lesson.time || lesson.startTime || ''
    return `${date}《${className}--${course}》${teacher}${time ? ` ${time}` : ''}`.trim()
  }

  const createTeacherEffectPlaceholder = (lesson) => ({
    id: null,
    lessonId: lesson?.id || null,
    title: defaultTeacherEffectTitle(lesson),
    width: 1080,
    imageGap: 24,
    sources: [],
    layoutConfig: {},
    status: 'PENDING',
    jobId: null,
    generatedVersionId: null,
    outputFileId: null,
    outputUrl: null,
    failureCode: null,
    failureReason: '',
    version: 0,
    skipReason: '',
    history: []
  })

  const statusForArchiveItem = (value) => ({
    DRAFT: '待配置', PENDING: '待配置', QUEUED: '创建中', CREATING: '创建中', RUNNING: '推送中', GENERATING: '生成中', GENERATED: '已生成', CONFIRMED: '已确认', SUCCEEDED: '已同步', SYNCED: '已同步', COMPLETED: '已归档', SKIPPED: '已跳过', FAILED: '生成失败', CANCELED: '已取消'
  }[value] || value || '待处理')

  const artworkUploadFailures = new Map()

  const artworkVersionsForUi = (artwork) => [...(artwork?.versions || [])].sort((left, right) =>
    Number(right.versionNo || 0) - Number(left.versionNo || 0)
    || String(right.id || '').localeCompare(String(left.id || ''), undefined, { numeric: true })
  )

  const decorateArtworkForRow = (artwork, studentName, fallbackAsset = null) => {
    const versions = artworkVersionsForUi(artwork)
    const availableVersions = versions.filter((version) => !version.status || version.status === 'AVAILABLE')
    const selectedVersion = availableVersions.find((version) => sameId(version.id, artwork?.selectedVersionId)) || null
    const originalVersion = availableVersions.find((version) => version.versionKind === 'ORIGINAL') || null
    const processedVersion = availableVersions.find((version) =>
      version.versionKind === 'PROCESSED' &&
      (!originalVersion?.id || !version.sourceVersionId || sameId(version.sourceVersionId, originalVersion.id))
    ) || null
    const fallbackVersion = fallbackAsset ? {
      id: null,
      fileId: fallbackAsset?.fileId || null,
      file: fallbackAsset?.file || null,
      versionKind: 'ORIGINAL'
    } : null
    const currentVersion = selectedVersion || originalVersion || fallbackVersion
    let processedSnapshot = {}
    if (processedVersion?.templateSnapshot && typeof processedVersion.templateSnapshot === 'object') {
      processedSnapshot = processedVersion.templateSnapshot
    } else if (typeof processedVersion?.templateSnapshot === 'string') {
      try { processedSnapshot = JSON.parse(processedVersion.templateSnapshot) || {} } catch { /* 历史处理图快照可能不是 JSON */ }
    }
    const displayFileId = currentVersion?.fileId || null
    const displayImage = currentVersion?.file?.downloadUrl || ''
    const originalFileId = originalVersion?.fileId || fallbackAsset?.fileId || null
    const originalImage = originalVersion?.file?.downloadUrl || fallbackAsset?.file?.downloadUrl || ''
    return {
      ...artwork,
      artworkId: artwork?.id || artwork?.artworkId || null,
      studentId: artwork?.studentId || fallbackAsset?.studentId || null,
      studentName,
      title: artwork?.title || originalVersion?.file?.originalFilename || fallbackAsset?.title || '',
      artworkTitle: artwork?.title || originalVersion?.file?.originalFilename || fallbackAsset?.title || '',
      sortOrder: Number(artwork?.sortOrder || 0),
      versions,
      selectedVersionId: artwork?.selectedVersionId || null,
      effectiveVersionId: currentVersion?.id || null,
      originalVersionId: originalVersion?.id || null,
      processedVersionId: processedVersion?.id || null,
      originalFileId,
      processedFileId: processedVersion?.fileId || null,
      displayFileId,
      fileId: displayFileId,
      image: displayImage,
      images: displayImage ? [displayImage] : [],
      originalImage,
      processedImage: processedVersion?.file?.downloadUrl || '',
      imageMatched: Boolean(displayFileId),
      imageConfirmed: Boolean(currentVersion?.id || displayFileId),
      processed: Boolean(processedVersion),
      processedTemplateKey: processedSnapshot.templateKey || null,
      processedTemplateVersion: Number(processedSnapshot.templateVersion || 0) || null,
      processedRenderer: processedSnapshot.renderer || (processedSnapshot.operation ? 'AI_ASYNC' : null),
      processedOperation: processedSnapshot.operation || null,
      imageProcessStatus: artwork?.job?.statusLabel || artwork?.statusLabel || '未处理',
      imageProcessError: artwork?.job?.failureReason || artwork?.failureReason || '',
      highlight: Boolean(artwork?.highlight),
      highlightNote: artwork?.highlightNote || '',
      artworkVersion: Number(artwork?.version || 0)
    }
  }

  const summarizeRowArtworks = (row, artworks, studentAssets = []) => {
    const items = artworks.filter((artwork) => artwork?.imageMatched)
    const first = items[0] || null
    const displayFileIds = items.map((artwork) => artwork.displayFileId || artwork.fileId).filter(Boolean)
    const fallbackFileIds = studentAssets.map((asset) => asset.fileId).filter(Boolean)
    const currentFileIds = [...new Set([...displayFileIds, ...fallbackFileIds])]
    const allArtworksReady = artworks.length > 0 && artworks.every((artwork) => artwork?.imageMatched)
    const hasLegacyAssets = artworks.length === 0 && fallbackFileIds.length > 0
    row.artworks = artworks
    row.imageFileIds = currentFileIds
    row.fileId = first?.displayFileId || first?.fileId || fallbackFileIds[0] || null
    row.displayFileId = row.fileId
    row.image = first?.image || ''
    row.images = items.map((artwork) => artwork.image).filter(Boolean)
    row.originalImage = first?.originalImage || ''
    row.processedImage = first?.processedImage || ''
    row.originalFileId = first?.originalFileId || null
    row.processedFileId = first?.processedFileId || null
    row.imageMatched = allArtworksReady || hasLegacyAssets
    row.imageConfirmed = row.imageMatched && (artworks.length === 0 || artworks.every((artwork) => artwork.imageConfirmed))
    row.processed = items.some((artwork) => artwork.processed)
    row.imageProcessStatus = first?.imageProcessStatus || '未处理'
    row.imageProcessError = first?.imageProcessError || ''
    row.artworkId = first?.artworkId || null
    row.artworkVersion = first?.artworkVersion || 0
    row.selectedVersionId = first?.selectedVersionId || null
    row.originalVersionId = first?.originalVersionId || null
    row.processedVersionId = first?.processedVersionId || null
    row.artworkTitle = first?.artworkTitle || ''
    row.highlight = items.some((artwork) => artwork.highlight)
    row.highlightNote = items.find((artwork) => artwork.highlight)?.highlightNote || ''
    row.highlightCount = items.filter((artwork) => artwork.highlight).length
    row.artworkCount = artworks.length || fallbackFileIds.length
    return row
  }

  const applyRemoteLesson = async (lessonId, value) => {
    const lesson = mapLesson(value?.lesson || lessonForInboxId(lessonId) || {})
    if (lesson.id) {
      if (sameId(activeTaskId.value, lesson.id)) selectedTaskSnapshot.value = { ...selectedTaskSnapshot.value, ...lesson }
      const existing = tasks.findIndex((item) => sameId(item.id, lesson.id))
      if (existing >= 0) tasks.splice(existing, 1, { ...tasks[existing], ...lesson })
      else tasks.unshift(lesson)
      const inboxExisting = inboxLessons.findIndex((item) => sameId(item.id, lesson.id))
      if (inboxExisting >= 0) inboxLessons.splice(inboxExisting, 1, { ...inboxLessons[inboxExisting], ...lesson })
    }
    const assetsModule = value?.assets || value?.m3?.asset || value?.m3?.assets || {}
    const feedbackModule = value?.feedback || value?.m3?.feedback || {}
    const parentModule = value?.parentDelivery || value?.m3?.parentDelivery || {}
    const attendance = (value?.attendance || []).map(mapAttendance)
    const assets = (assetsModule.classroomMaterials || assetsModule.assets || []).map(mapAsset)
    const artworks = (assetsModule.artworks || []).map(mapArtwork)
    const feedbacks = (feedbackModule.feedbacks || []).map(mapFeedback)
    const draft = mapSharePage(parentModule.sharePage || {})
    const currentDraft = draft.draftSnapshot || {}
    // 课次接口返回的草稿快照可能包含已选资源详情。先合并进全局资源目录，
    // 这样重新进入课次时，即使资源列表请求稍后完成，已保存的选择也能立即回显。
    const savedExternalLinks = Array.isArray(currentDraft.externalLinks)
      ? currentDraft.externalLinks.map(mapExternalLink).filter((link) => link.id !== null && link.id !== undefined)
      : []
    if (savedExternalLinks.length) {
      const mergedExternalLinks = [...externalLinks]
      savedExternalLinks.forEach((link) => {
        const index = mergedExternalLinks.findIndex((item) => sameId(item.id, link.id))
        if (index >= 0) mergedExternalLinks.splice(index, 1, link)
        else mergedExternalLinks.push(link)
      })
      replaceReactive(externalLinks, mergedExternalLinks)
    }
    const touchTasks = (parentModule.touchTasks || []).map((value) => decorateTouchTask(value, lesson))
    const wheat = mapWheat(parentModule.wheatTrace || {})
    const teacherEffectValue = value?.teacherEffect?.teacherEffect || value?.m3?.teacherEffect?.teacherEffect
    const teacherEffect = teacherEffectValue || createTeacherEffectPlaceholder(lesson)
    const workspace = ensureLessonWorkspace(lesson)
    const cloudArchiveModule = value?.cloudArchive || value?.m3?.cloudArchive || {}
    const cloudJobs = (cloudArchiveModule.jobs || []).map(mapCloudArchiveJob)
    const cloudBatch = cloudArchiveModule.batch ? mapCloudArchiveBatch(cloudArchiveModule.batch) : workspace.cloudBatch
    const archiveVersions = (value?.archive?.versions || []).map(mapArchiveVersion)
    const draftDisplayConfig = {
      ...workspace.displayConfig,
      ...(currentDraft.displayConfig || draft.displayConfig || {})
    }
    ;['showMaterials', 'showHomework', 'showHighlight', 'showLessonType'].forEach((key) => {
      if (currentDraft[key] !== undefined) draftDisplayConfig[key] = Boolean(currentDraft[key])
    })
    const draftStudentById = new Map()
    ;(Array.isArray(currentDraft.students) ? currentDraft.students : []).forEach((student) => {
      if (student?.studentId !== undefined && student?.studentId !== null) draftStudentById.set(String(student.studentId), student)
    })
    // studentDeliveries 是工作区高光的权威来源，覆盖同一 studentId 的基础学生快照。
    ;(Array.isArray(currentDraft.studentDeliveries) ? currentDraft.studentDeliveries : []).forEach((student) => {
      if (student?.studentId !== undefined && student?.studentId !== null) draftStudentById.set(String(student.studentId), student)
    })
    const artworksByStudent = new Map()
    artworks.forEach((artwork) => {
      const key = String(artwork.studentId)
      if (!artworksByStudent.has(key)) artworksByStudent.set(key, [])
      artworksByStudent.get(key).push(artwork)
    })
    artworksByStudent.forEach((items) => items.sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0) || String(left.id || '').localeCompare(String(right.id || ''), undefined, { numeric: true })))
    const feedbackByStudent = new Map(feedbacks.map((feedback) => [String(feedback.studentId), feedback]))
    const assetsByStudent = new Map()
    assets.filter((asset) => asset.studentId).forEach((asset) => {
      const key = String(asset.studentId)
      if (!assetsByStudent.has(key)) assetsByStudent.set(key, [])
      assetsByStudent.get(key).push(asset)
    })
    const rows = attendance.map((attendanceRow) => {
      const feedback = feedbackByStudent.get(String(attendanceRow.studentId))
      const studentAssets = assetsByStudent.get(String(attendanceRow.studentId)) || []
      const studentName = attendanceRow.studentName || ''
      const rowArtworks = (artworksByStudent.get(String(attendanceRow.studentId)) || [])
        .map((artwork) => decorateArtworkForRow(artwork, studentName))
      const draftStudent = draftStudentById.get(String(attendanceRow.studentId))
      if (draftStudent?.highlight && rowArtworks.length && !rowArtworks.some((artwork) => artwork.highlight)) {
        rowArtworks[0].highlight = true
        rowArtworks[0].highlightNote = draftStudent.highlightNote || ''
      }
      const row = {
        id: attendanceRow.studentId,
        lessonId: lesson.id,
        studentId: attendanceRow.studentId,
        studentName: attendanceRow.studentName || '',
        artworkTitle: rowArtworks[0]?.artworkTitle || '',
        studentArchived: Boolean(attendanceRow.studentArchived),
        attendance: attendanceRow.attendance,
        attendanceVersion: attendanceRow.version,
        note: attendanceRow.note || '',
        record: feedback?.classroomRecord || '',
        comment: feedback?.content || '',
        feedbackId: feedback?.id || null,
        feedbackVersion: feedback?.version || 0,
        feedbackVersionId: feedback?.currentVersionId || null,
        confirmed: feedback?.status === 'CONFIRMED' || Boolean(feedback?.confirmedVersionId),
        highlight: rowArtworks.some((artwork) => artwork.highlight) || Boolean(draftStudent?.highlight),
        highlightNote: rowArtworks.find((artwork) => artwork.highlight)?.highlightNote || draftStudent?.highlightNote || '',
        artworks: rowArtworks,
        activeArtworkId: rowArtworks[0]?.artworkId || null,
        uploadFailures: artworkUploadFailures.get(String(attendanceRow.studentId)) || [],
        shareReady: Boolean(draft.accessLinks?.some((link) => sameId(link.studentId, attendanceRow.studentId))),
        archived: lesson.status === '已完成'
      }
      summarizeRowArtworks(row, rowArtworks, studentAssets)
      return row
    })
    const materialItems = assets.filter((asset) => !asset.studentId).map((asset) => ({
      ...asset,
      image: '',
      lessonId: lesson.id
    }))
    const homeworkData = mapHomework(parentModule.homework || draft.homework || draft.publishedSnapshot?.homework || {})
    draftDisplayConfig.showHomework = homeworkIsAssigned(homeworkData) && homeworkData.visible !== false && draftDisplayConfig.showHomework !== false
    Object.assign(workspace, {
      lessonId: lesson.id,
      studentDeliveries: rows,
      materials: materialItems,
      materialsConfirmedEmpty: Boolean(assetsModule.materialsConfirmedEmpty),
      materialsVersion: workspace.materialsVersion ?? null,
      homework: { ...workspace.homework, ...homeworkData, lessonId: lesson.id, externalLinkIds: fromApiIds(homeworkData.externalLinkIds || []) },
      displayConfig: draftDisplayConfig,
      sharePage: mergeSharePageForWorkspace(workspace, draft),
      teacherEffect,
      cloudJobs,
      cloudBatch: cloudBatch || null,
      cloudProgress: cloudBatch || workspace.cloudProgress || null,
      archiveVersions,
      artworkJobs: {},
      completion: value?.completion || value?.completionCheck || null,
      availableCommands: value?.availableCommands || []
    })
    const activeRow = rows.find((row) => sameId(row.studentId, workspace.activeStudentId)) || rows.find((row) => row.attendance === '到课')
    if (!activeRow?.artworks?.some((artwork) => sameId(artwork.artworkId, workspace.activeArtworkId))) {
      workspace.activeArtworkId = activeRow?.artworks?.[0]?.artworkId || null
    }
    const touchStatus = touchTasks.length && touchTasks.every((task) => ['已发送', '人工触达'].includes(task.status)) ? '已发送' : touchTasks.some((task) => task.status === '发送失败') ? '发送失败' : touchTasks.length ? '待老师确认发送' : '待创建'
    Object.assign(workspace.archiveChecklist, {
      parentTouch: { ...workspace.archiveChecklist.parentTouch, status: touchStatus, sentCount: touchTasks.filter((task) => ['已发送', '人工触达'].includes(task.status)).length, detail: touchTasks.length ? `已创建 ${touchTasks.length} 个触达任务` : '' },
      studentCloudArchive: { ...workspace.archiveChecklist.studentCloudArchive, status: statusForArchiveItem(cloudJobs.find((job) => job.required || ['LESSON_ASSET', 'ARCHIVE_RECORD', 'TEACHER_EFFECT'].includes(job.sourceType))?.status) },
      teacherEffectArchive: { ...workspace.archiveChecklist.teacherEffectArchive, status: statusForArchiveItem(teacherEffect.status), title: teacherEffect.title || '', imageCount: teacherEffect.sources?.length || 0, detail: teacherEffect.failureReason || '' },
      wheatTrace: { ...workspace.archiveChecklist.wheatTrace, status: wheat.status === '已人工处理' || wheat.status === '无需处理' ? wheat.status : wheat.id ? '已生成' : '待生成', traceId: wheat.id || null, detail: wheat.note || '' }
    })
    replaceReactive(wheatTraces, [...wheatTraces.filter((item) => !sameId(item.lessonId, lesson.id)), wheat.id ? { ...wheat, lesson: `${lesson.date} ${lesson.time} · ${lesson.className}`, course: lesson.courseTitle, teacher: lesson.teacher } : null].filter(Boolean))
    const otherTouchTasks = wecomSendTasks.filter((item) => !sameId(item.lessonId, lesson.id))
    replaceReactive(wecomSendTasks, [...otherTouchTasks, ...touchTasks])
    return workspace
  }

  const lessonWorkspacePromises = new Map()
  const lessonWorkspaceControllers = new Map()
  const lessonWorkspaceEpochs = new Map()
  const lessonWorkspaceLoaded = new Set()
  const lessonStartPromises = new Map()
  // 展示草稿会同时被高光勾选、说明输入框失焦等事件触发；按课次串行保存，
  // 确保后一个请求使用前一个请求返回的 page/homework 版本。
  const shareDraftSaveChains = new Map()
  const refreshRemoteLesson = async (lessonId, { force = false } = {}) => {
    if (!lessonId) return null
    const key = String(lessonId)
    if (!force && lessonWorkspacePromises.has(key)) return lessonWorkspacePromises.get(key)
    if (force) lessonWorkspaceControllers.get(key)?.abort()
    const epoch = (lessonWorkspaceEpochs.get(key) || 0) + 1
    lessonWorkspaceEpochs.set(key, epoch)
    const controller = new AbortController()
    const promise = (async () => {
      try {
        const value = await api.lessons.workspace(lessonId, { signal: controller.signal })
        if (controller.signal.aborted || lessonWorkspaceEpochs.get(key) !== epoch) return null
        const workspace = applyRemoteLesson(lessonId, value)
        lessonWorkspaceLoaded.add(key)
        return workspace
      } catch (error) {
        if (controller.signal.aborted) return null
        throw error
      }
    })()
    lessonWorkspacePromises.set(key, promise)
    lessonWorkspaceControllers.set(key, controller)
    promise.finally(() => {
      if (lessonWorkspacePromises.get(key) === promise) lessonWorkspacePromises.delete(key)
      if (lessonWorkspaceControllers.get(key) === controller) lessonWorkspaceControllers.delete(key)
    }).catch(() => {})
    return promise
  }

  const loadLessonWorkspace = async (lessonId, { force = false } = {}) => {
    const key = String(lessonId || '')
    if (!key) return null
    if (!force && lessonWorkspaceLoaded.has(key) && lessonWorkspaces[key]) {
      recordApiCacheHit(`/api/v1/lessons/${encodeURIComponent(key)}/workspace`)
      return lessonWorkspaces[key]
    }
    return refreshRemoteLesson(lessonId, { force })
  }

  const mergeLessonRecord = (value) => {
    const lesson = mapLesson(value?.lesson || value || {})
    if (!lesson.id) return lesson
    ;[tasks, inboxLessons, scheduleLessons].forEach((collection) => {
      const index = collection.findIndex((item) => sameId(item.id, lesson.id))
      if (index >= 0) collection.splice(index, 1, { ...collection[index], ...lesson })
    })
    if (sameId(activeTaskId.value, lesson.id)) {
      selectedTaskSnapshot.value = { ...selectedTaskSnapshot.value, ...lesson }
    }
    return lesson
  }

  const startLessonProcessingOnOpen = async (task) => {
    if (!task?.id || toApiLessonStatus(task.status) !== 'PENDING') return task
    const key = String(task.id)
    if (lessonStartPromises.has(key)) return lessonStartPromises.get(key)
    const promise = (async () => {
      const result = await runRemote(
        '正在开始处理课次...',
        () => api.lessons.transition(task.id, {
          command: 'START_PROCESSING',
          version: task.version
        }),
        '课次已进入处理中',
        async () => {
          // 其他页面或账号可能已经完成了状态推进；读取最新课次后继续打开工作台。
          const latest = mapLesson(await api.lessons.get(task.id))
          return toApiLessonStatus(latest.status) === 'PROCESSING'
            ? { handled: true, value: latest }
            : null
        }
      )
      if (!result) return null
      return mergeLessonRecord(result)
    })()
    lessonStartPromises.set(key, promise)
    try {
      return await promise
    } finally {
      if (lessonStartPromises.get(key) === promise) lessonStartPromises.delete(key)
    }
  }

  const cloudBatchWatchers = new Map()
  const cloudBatchTerminal = (status) => ['SUCCEEDED', 'FAILED', 'PARTIAL_FAILED', 'CANCELED'].includes(String(status || '').toUpperCase())
  const cloudBatchPayload = (value) => {
    if (!value) return null
    if (typeof value === 'string') {
      try { return JSON.parse(value) } catch { return null }
    }
    return value
  }
  const applyCloudBatchProgress = (lessonId, value) => {
    const payload = cloudBatchPayload(value)
    const batchId = payload?.batchId || payload?.id
    if (!batchId) return null
    payload.batchId = batchId
    const workspace = ensureLessonWorkspace(tasks.find((task) => sameId(task.id, lessonId)) || { id: lessonId })
    workspace.cloudBatch = { ...(workspace.cloudBatch || {}), ...payload }
    workspace.cloudProgress = workspace.cloudBatch
    const status = String(payload.status || '').toUpperCase()
    if (status === 'SUCCEEDED') {
      workspace.archiveChecklist.studentCloudArchive = {
        ...workspace.archiveChecklist.studentCloudArchive,
        status: '已同步',
        detail: `${payload.completedFiles || 0} 个文件 · ${payload.percent || 0}%`
      }
    } else if (['FAILED', 'PARTIAL_FAILED'].includes(status)) {
      workspace.archiveChecklist.studentCloudArchive = {
        ...workspace.archiveChecklist.studentCloudArchive,
        status: '同步失败',
        detail: payload.failureSummary || `${payload.failedFiles || 0} 个文件失败`
      }
    } else if (['QUEUED', 'RUNNING'].includes(status)) {
      workspace.archiveChecklist.studentCloudArchive = {
        ...workspace.archiveChecklist.studentCloudArchive,
        status: '推送中',
        detail: `${payload.percent || 0}% · ${payload.currentFilename || '准备中'}`
      }
    }
    return workspace.cloudBatch
  }
  const watchCloudArchiveBatch = (batchId, lessonId) => {
    const key = String(batchId)
    if (cloudBatchWatchers.has(key)) return cloudBatchWatchers.get(key)
    const controller = new AbortController()
    let settled = false
    let resolveResult
    let rejectResult
    const promise = new Promise((resolve, reject) => {
      resolveResult = resolve
      rejectResult = reject
    })
    const finish = (value) => {
      if (settled) return
      settled = true
      cloudBatchWatchers.delete(key)
      controller.abort()
      resolveResult(value)
    }
    const loop = async () => {
      while (!controller.signal.aborted && !settled) {
        try {
          await subscribeSse(api.m5.cloudArchiveEventsPath(batchId), {
            signal: controller.signal,
            onEvent: (event) => {
              const payload = applyCloudBatchProgress(lessonId, event.data)
              if (payload && cloudBatchTerminal(payload.status)) finish(payload)
            }
          })
          if (settled || controller.signal.aborted) return
          const latest = await api.m5.cloudArchiveBatchGet(batchId)
          const payload = applyCloudBatchProgress(lessonId, latest)
          if (payload && cloudBatchTerminal(payload.status)) {
            finish(payload)
            return
          }
        } catch (error) {
          if (controller.signal.aborted || settled) return
          if (error?.status === 401 || error?.code === 'PERMISSION_DENIED') {
            rejectResult(error)
            cloudBatchWatchers.delete(key)
            return
          }
        }
        if (!controller.signal.aborted && !settled) await wait(800)
      }
    }
    const watcher = { promise, controller, cancel: () => controller.abort() }
    cloudBatchWatchers.set(key, watcher)
    loop().catch((error) => {
      if (!settled) rejectResult(error)
      cloudBatchWatchers.delete(key)
    })
    return watcher
  }
  const ensureCloudArchiveBatch = async (lessonId, { waitForCompletion = false, providerConfigId = null } = {}) => {
    const workspace = ensureLessonWorkspace(tasks.find((task) => sameId(task.id, lessonId)) || { id: lessonId })
    const current = workspace.cloudBatch
    if (current?.batchId && ['FAILED', 'PARTIAL_FAILED'].includes(String(current.status).toUpperCase())) {
      const retried = await runRemote('正在重试百度网盘归档批次...', () => api.m5.retryCloudBatch(current.batchId,
        createIdempotencyKey(`cloud-archive-batch-retry:${current.batchId}`)), '百度网盘归档已重新提交')
      if (!retried) return null
      applyCloudBatchProgress(lessonId, retried)
      const watcher = watchCloudArchiveBatch(retried.id || retried.batchId || current.batchId, lessonId)
      return waitForCompletion && !cloudBatchTerminal(retried.status) ? watcher.promise : retried
    }
    if (current?.batchId) {
      const watcher = watchCloudArchiveBatch(current.batchId, lessonId)
      return waitForCompletion && !cloudBatchTerminal(current.status) ? watcher.promise : current
    }
    const selectedProviderConfigId = providerConfigId && !String(providerConfigId).startsWith('provider-')
      ? providerConfigId
      : await requestCloudProvider(lessonId)
    if (!selectedProviderConfigId) return null
    const result = await runRemote('正在创建百度网盘归档批次...', () => api.m5.cloudArchiveBatch(lessonId, {
      providerConfigId: selectedProviderConfigId,
      includeTeacherEffect: false,
      items: []
    }, createIdempotencyKey(`cloud-archive-batch:${lessonId}`)), '', () => refreshRemoteLesson(lessonId, { force: true }))
    if (!result) return null
    applyCloudBatchProgress(lessonId, result)
    const watcher = watchCloudArchiveBatch(result.id || result.batchId, lessonId)
    if (waitForCompletion && !cloudBatchTerminal(result.status)) return watcher.promise
    return result
  }

  const jobTerminalStatuses = new Set(['SUCCEEDED', 'FAILED', 'CANCELED'])
  const jobStaleNotices = new Set()

  const jobPayload = (value) => {
    let source = value
    if (typeof source === 'string') {
      try { source = JSON.parse(source) } catch { return null }
    }
    if (!source || typeof source !== 'object') return null
    const jobId = source.jobId ?? source.id
    if (jobId === null || jobId === undefined || jobId === '') return null
    const status = String(source.status || 'QUEUED').toUpperCase()
    const failureCode = source.failureCode || null
    const stale = failureCode === 'STALE_JOB_ATTEMPT'
    const progressPercent = Number.isFinite(Number(source.progressPercent))
      ? Math.max(0, Math.min(100, Number(source.progressPercent)))
      : status === 'SUCCEEDED' ? 100 : 0
    const stage = source.stage || (stale ? 'STALE' : {
      QUEUED: 'QUEUED', RUNNING: 'GENERATING', SUCCEEDED: 'SUCCEEDED', FAILED: 'FAILED', CANCELED: 'CANCELED'
    }[status] || 'QUEUED')
    const message = source.message || (stale
      ? '输入已变化，本次结果未应用'
      : source.failureReason || ({ QUEUED: '排队中', RUNNING: '正在处理', SUCCEEDED: '已完成', FAILED: '处理失败', CANCELED: '已取消' }[status] || '正在处理'))
    return {
      ...source,
      jobId: String(jobId),
      status,
      progressPercent,
      stage,
      message,
      failureCode,
      failureReason: source.failureReason || '',
      businessObjectId: source.businessObjectId === null || source.businessObjectId === undefined
        ? null : String(source.businessObjectId),
      receivedAt: Date.now()
    }
  }

  const applyJobProgress = (value) => {
    const payload = jobPayload(value)
    if (!payload) return null
    jobProgress[payload.jobId] = payload
    if (payload.status === 'FAILED' && payload.failureCode === 'STALE_JOB_ATTEMPT'
      && !jobStaleNotices.has(payload.jobId)) {
      jobStaleNotices.add(payload.jobId)
      notify('原输入已变化，本次 AI 结果未应用，请确认最新内容后重新生成')
    }
    return payload
  }

  const jobResultFor = (jobId, key) => {
    const payload = jobProgress[String(jobId)]
    return payload?.result?.[key] || payload?.[key] || null
  }

  const workspaceContainsJobResults = (workspace, jobIds = []) => {
    const rows = Array.isArray(workspace?.studentDeliveries) ? workspace.studentDeliveries : []
    return jobIds.every((jobId) => {
      const processedVersionId = jobResultFor(jobId, 'processedVersionId')
      const feedbackVersionId = jobResultFor(jobId, 'feedbackVersionId')
      const feedbackId = jobResultFor(jobId, 'feedbackId')
      if (processedVersionId && !rows.some((row) => sameId(row.processedVersionId, processedVersionId))) return false
      if (feedbackVersionId && !rows.some((row) => sameId(row.feedbackVersionId, feedbackVersionId))) return false
      if (feedbackId && !rows.some((row) => sameId(row.feedbackId, feedbackId))) return false
      return true
    })
  }

  // A worker publishes the terminal job event from inside its transaction.
  // The SSE client can therefore receive SUCCEEDED a few milliseconds before
  // the lesson workspace query can see the new artwork/feedback version. Keep
  // the realtime UX, but refetch until the result IDs are visible (or the
  // short compatibility window is exhausted).
  const refreshRemoteLessonAfterJobs = async (lessonId, jobIds = []) => {
    if (!lessonId) return null
    const ids = [...new Set(jobIds.filter(Boolean).map(String))]
    const hasResultIds = ids.some((jobId) =>
      jobResultFor(jobId, 'processedVersionId')
      || jobResultFor(jobId, 'feedbackVersionId')
      || jobResultFor(jobId, 'feedbackId')
    )
    const attempts = hasResultIds ? 4 : 2
    let workspace = null
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt > 0) await wait(Math.min(800, 180 * attempt))
      workspace = await refreshRemoteLesson(lessonId, { force: true })
      if (workspace && ((hasResultIds && workspaceContainsJobResults(workspace, ids)) || attempt === attempts - 1)) {
        return workspace
      }
    }
    return workspace
  }

  const jobProgressFor = (row, type) => {
    if (!row) return null
    const businessObjectType = String(type || '').toUpperCase() === 'ARTWORK' ? 'ARTWORK' : 'FEEDBACK'
    const businessObjectId = businessObjectType === 'ARTWORK' ? row.artworkId : row.feedbackId
    if (businessObjectId === null || businessObjectId === undefined || businessObjectId === '') return null
    const candidates = Object.values(jobProgress).filter((job) =>
      String(job.businessObjectType || '').toUpperCase() === businessObjectType
      && String(job.businessObjectId ?? '') === String(businessObjectId))
    if (!candidates.length) return null
    const active = candidates.filter((job) => !jobTerminalStatuses.has(job.status))
    return [...(active.length ? active : candidates)].sort((left, right) =>
      (right.receivedAt || 0) - (left.receivedAt || 0) || String(right.jobId).localeCompare(String(left.jobId), undefined, { numeric: true })
    )[0] || null
  }

  const loadJobSnapshots = async (jobIds) => {
    const snapshots = await api.jobs.list({ ids: jobIds })
    const values = Array.isArray(snapshots) ? snapshots : snapshots?.items || []
    values.forEach((snapshot) => applyJobProgress({ ...snapshot, jobId: snapshot.jobId || snapshot.id }))
    return values
  }

  const areJobsTerminal = (jobIds) => jobIds.every((jobId) =>
    jobTerminalStatuses.has(String(jobProgress[String(jobId)]?.status || ''))
  )

  // Polling remains the compatibility path for an older API deployment, a
  // proxy that strips SSE, or a temporary Redis/pub-sub outage.
  const waitForJobs = async (jobIds = [], lessonId) => {
    const pendingIds = [...new Set(jobIds.filter(Boolean).map(String))]
    if (!pendingIds.length) {
      if (lessonId) await refreshRemoteLesson(lessonId, { force: true })
      return []
    }
    let snapshots = []
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (attempt > 0) await wait(1000)
      try {
        snapshots = await loadJobSnapshots(pendingIds)
      } catch {
        // Preserve the old behavior: a failed status refresh must not hide the
        // result that the worker may already have committed.
      }
      if (pendingIds.every((jobId) => jobTerminalStatuses.has(String(
        snapshots.find((snapshot) => String(snapshot.id || snapshot.jobId) === jobId)?.status || ''
      )))) break
    }
    if (lessonId) await refreshRemoteLessonAfterJobs(lessonId, pendingIds)
    return snapshots
  }

  const watchJobs = (jobIds = [], lessonId) => {
    const ids = [...new Set(jobIds.filter(Boolean).map(String))]
    if (!ids.length) return waitForJobs([], lessonId)
    const key = ids.slice().sort((left, right) => left.localeCompare(right, undefined, { numeric: true })).join(',')
    const existing = jobWatchers.get(key)
    if (existing) return existing.promise

    const controller = new AbortController()
    const promise = (async () => {
      let refreshed = false
      let snapshots = []
      let completed = false
      for (let attempt = 0; attempt < 3 && !controller.signal.aborted; attempt += 1) {
        if (attempt > 0) await wait(600)
        let terminalFromStream = false
        try {
          await subscribeSse(api.jobs.eventsPath(ids), {
            signal: controller.signal,
            onEvent: (event) => {
              const payload = applyJobProgress(event.data)
              if (payload && jobTerminalStatuses.has(payload.status) && areJobsTerminal(ids)) {
                terminalFromStream = true
                completed = true
                controller.abort()
              }
            }
          })
        } catch (error) {
          if (controller.signal.aborted && (terminalFromStream || areJobsTerminal(ids))) break
          if (controller.signal.aborted) return snapshots
          // Reconnect a few times before falling back to the task query.
        }
        if (controller.signal.aborted) break
        if (areJobsTerminal(ids)) break
        try {
          snapshots = await loadJobSnapshots(ids)
        } catch {
          // The polling fallback below will retry the same query.
        }
        if (areJobsTerminal(ids)) break
      }

      if (!controller.signal.aborted && !areJobsTerminal(ids)) {
        snapshots = await waitForJobs(ids, lessonId)
        refreshed = Boolean(lessonId)
      }
      const terminal = completed || areJobsTerminal(ids)
      if (lessonId && !refreshed && terminal && (completed || !controller.signal.aborted)) {
        await refreshRemoteLessonAfterJobs(lessonId, ids)
      }
      const progress = ids.map((jobId) => jobProgress[String(jobId)]).filter(Boolean)
      return progress.length ? progress : snapshots
    })().catch((error) => {
      if (controller.signal.aborted) return []
      throw error
    }).finally(() => {
      if (jobWatchers.get(key)?.promise === promise) jobWatchers.delete(key)
    })
    jobWatchers.set(key, { promise, controller, cancel: () => controller.abort() })
    return promise
  }

  const cancelJobWatchers = () => {
    jobWatchers.forEach((watcher) => watcher.cancel())
    jobWatchers.clear()
  }

  onBeforeUnmount(() => {
    cancelJobWatchers()
    if (cloudProviderPickerResolver) cloudProviderPickerResolver(null)
  })

  let portfolioStudioRef = null

  const applyMe = (me) => {
    if (!me) return
    if (storedMe.value?.activeCampusId && me.activeCampusId
      && !sameId(storedMe.value.activeCampusId, me.activeCampusId)) {
      clearProtectedMediaCache()
    }
    storedMe.value = me
    updateStoredMe(me)
    currentUserId.value = me.user?.id || null
    const campus = me.campuses?.find((item) => sameId(item.id, me.activeCampusId)) || me.campuses?.[0]
    if (campus) Object.assign(school, { campus: campus.name, address: campus.address || '' })
  }

  const mapWheatListItem = (value = {}) => {
    const wheat = mapWheat(value.wheat?.wheat || value.wheat || value)
    const todo = value.todo || value.wheat?.todo
    const lesson = value.lesson || {}
    return wheat.id ? {
      ...wheat,
      todo: todo ? mapTodo(todo) : null,
      lesson: lesson.className ? `${lesson.className}${lesson.courseTitle ? ` · ${lesson.courseTitle}` : ''}` : '',
      course: lesson.courseTitle || '',
      teacher: lesson.teacherName || ''
    } : null
  }

  const lessonForInboxId = (lessonId) => [...inboxLessons, ...tasks, ...scheduleLessons]
    .find((lesson) => sameId(lesson.id, lessonId)) || null

  const decorateTouchTask = (value, lessonOverride = null) => {
    const task = mapTouchTask(value)
    const lesson = lessonOverride || lessonForInboxId(task.lessonId)
    const student = students.find((item) => sameId(item.id, task.studentId))
    return {
      ...task,
      studentName: student?.name || task.studentName,
      targetName: student?.parent || task.targetName || '家长',
      parent: student?.parent || task.targetName || '',
      lesson: lesson
        ? `${lesson.date} ${lesson.time} · ${lesson.className || ''}`.trim()
        : `课次 ${task.lessonId || '未知'}`
    }
  }

  const refreshInboxLessons = async () => {
    if (!isLoggedIn.value) return null
    const scope = currentTodoScope()
    if (!scope) {
      replaceReactive(inboxLessons)
      updateListPageMeta('inboxLessons', { page: 1, pageSize: 200, total: 0 })
      return []
    }
    // Keep all of the current teacher's historical lessons in the local
    // context. The drawer filters out completed lessons, while WeCom/wheat
    // records may still need their lesson context for display.
    const page = await loadAllPageItems(api.lessons.list, mapLesson, scope)
    const items = page.items.filter((lesson) =>
      lesson?.id && lesson.dateValue && lesson.dateValue <= scope.dateTo
    )
    const statusOrder = { 异常: 0, 处理中: 1, 待处理: 2 }
    items.sort((left, right) =>
      (statusOrder[left.status] ?? 9) - (statusOrder[right.status] ?? 9)
      || `${left.dateValue || ''} ${left.time || ''}`.localeCompare(`${right.dateValue || ''} ${right.time || ''}`)
    )
    replaceReactive(inboxLessons, items)
    updateListPageMeta('inboxLessons', { page: 1, pageSize: 200, total: items.length })
    return items
  }

  const refreshCloudArchiveTodos = async () => {
    if (!isLoggedIn.value) return null
    const scope = currentTodoScope()
    if (!scope) {
      replaceReactive(cloudArchiveTodos)
      updateListPageMeta('cloudArchiveTodos', { page: 1, pageSize: 200, total: 0 })
      return []
    }
    const page = await loadAllPageItems(api.m5.cloudJobs, mapCloudArchiveJob, { ...scope, status: 'FAILED' })
    const items = page.items.filter((job) => job?.statusCode === 'FAILED' || job?.status === '同步失败')
    replaceReactive(cloudArchiveTodos, items)
    updateListPageMeta('cloudArchiveTodos', { page: 1, pageSize: 200, total: items.length })
    return items
  }

  const refreshWecomSendTasks = async () => {
    if (!isLoggedIn.value) return null
    const scope = currentTodoScope()
    if (!scope) {
      replaceReactive(wecomSendTasks)
      return []
    }
    const values = await api.parent.touchTasksForLesson(null, scope)
    const items = (Array.isArray(values) ? values : []).map((value) => decorateTouchTask(value))
    replaceReactive(wecomSendTasks, items)
    return items
  }

  const refreshPendingReviewQueue = async () => {
    if (!isLoggedIn.value || !canQualityReview.value) {
      replaceReactive(pendingReviewQueue)
      return []
    }
    const pages = await Promise.all(['PENDING_REVIEW', 'RETURNED'].map((status) =>
      loadAllPageItems(api.m6.qualityReviews, mapQualityReview, { status })
    ))
    const byId = new Map()
    pages.flatMap((page) => page.items).forEach((review) => {
      if (review?.id) byId.set(String(review.id), review)
    })
    const items = [...byId.values()].filter((review) => ['待评分', '已退回'].includes(review?.status))
    replaceReactive(pendingReviewQueue, items)
    updateListPageMeta('pendingReviews', { page: 1, pageSize: 200, total: items.length })
    return items
  }

  const updatePageMeta = (target, page) => {
    Object.assign(target, {
      page: Number(page?.page || 1),
      pageSize: Number(page?.pageSize || 20),
      total: Number(page?.total || 0)
    })
  }

  const updateListPageMeta = (key, page) => {
    if (!pageMeta[key]) pageMeta[key] = { page: 1, pageSize: 20, total: 0 }
    updatePageMeta(pageMeta[key], page)
  }

  const loadScheduleLessons = async (params = {}, { force = false, allPages = false } = {}) => {
    if (!isLoggedIn.value) return null
    const page = Math.max(1, Number(params.page || scheduleMeta.page || 1))
    const pageSize = Math.min(200, Math.max(1, Number(params.pageSize || scheduleMeta.pageSize || 200)))
    const filters = { ...params }
    delete filters.page
    delete filters.pageSize
    const promiseKey = `${allPages ? 'all' : page}:${pageSize}:${JSON.stringify(filters)}`
    if (!force && schedulePromises.has(promiseKey)) return schedulePromises.get(promiseKey)
    const load = (async () => {
      scheduleLoading.value = true
      scheduleError.value = ''
      try {
        if (allPages) {
          const result = await loadAllPageItems(api.lessons.list, mapLesson, filters, pageSize)
          const byId = new Map()
          result.items.forEach((lesson) => {
            const hasId = lesson?.id !== null && lesson?.id !== undefined && lesson?.id !== ''
            const key = hasId ? String(lesson.id) : `${lesson?.dateValue || ''}:${lesson?.time || ''}:${lesson?.classId || ''}`
            if (!byId.has(key)) byId.set(key, lesson)
          })
          const mapped = { items: [...byId.values()], page: 1, pageSize, total: result.total }
          replaceReactive(scheduleLessons, mapped.items)
          Object.assign(scheduleMeta, { page: 1, pageSize, total: mapped.total, filters, allPages: true })
          return mapped
        }
        const mapped = mapPage(await api.lessons.list({ ...filters, page, pageSize }), mapLesson)
        replaceReactive(scheduleLessons, mapped.items)
        Object.assign(scheduleMeta, { page: mapped.page, pageSize: mapped.pageSize, total: mapped.total, filters, allPages: false })
        return mapped
      } catch (error) {
        scheduleError.value = remoteErrorMessage(error, '课表加载失败')
        throw error
      } finally {
        scheduleLoading.value = false
        schedulePromises.delete(promiseKey)
      }
    })()
    schedulePromises.set(promiseKey, load)
    return load
  }

  const masterCollectionFor = (entity) => ({ teachers, students, classes, courses }[entity] || null)
  const masterMapperFor = (entity) => ({ teachers: mapTeacher, students: mapStudent, classes: mapClass, courses: mapCourse }[entity] || null)
  const masterApiFor = (entity) => ({
    teachers: api.master.teachers,
    students: api.master.students,
    classes: api.master.classes,
    courses: api.master.courses
  }[entity] || null)

  const loadMasterData = async (entity, { archiveState = masterArchiveState[entity] || 'ACTIVE', force = true } = {}) => {
    const collection = masterCollectionFor(entity)
    const mapper = masterMapperFor(entity)
    const loader = masterApiFor(entity)
    if (!collection || !mapper || !loader || !isLoggedIn.value) return null
    if (!force && pageLoaded[`master:${entity}:${archiveState}`]) return pageMeta[entity]
    const pageKey = `master:${entity}`
    pageLoading[pageKey] = true
    pageErrors[pageKey] = ''
    try {
      const result = mapPage(await loader({ page: 1, pageSize: 50, archiveState }), mapper)
      replaceReactive(collection, result.items)
      masterArchiveState[entity] = archiveState
      updateListPageMeta(entity, result)
      pageLoaded[`master:${entity}:${archiveState}`] = true
      return result
    } catch (error) {
      pageErrors[pageKey] = remoteErrorMessage(error, '基础数据加载失败')
      throw error
    } finally {
      pageLoading[pageKey] = false
    }
  }

  const directoryLoaderFor = {
    teachers: (params) => api.master.teachers(params),
    students: (params) => api.master.students(params),
    classes: (params) => api.master.classes(params),
    courses: (params) => api.master.courses(params),
    externalLinks: (params) => api.master.externalLinks(params),
    extraTasks: (params) => api.m6.extraTasks(params),
    archiveRecords: (params) => api.archive.records(params),
    classroomArchives: (params) => api.lessons.list(params),
    teacherArchives: (params) => api.archive.teacherArchives(params)
  }
  const directoryMapperFor = {
    teachers: mapTeacher,
    students: mapStudent,
    classes: mapClass,
    courses: mapCourse,
    externalLinks: mapExternalLink,
    extraTasks: mapExtraTask,
    archiveRecords: mapArchiveRecord,
    classroomArchives: mapLesson,
    teacherArchives: mapTeacherArchive
  }

  const loadDirectoryPage = async (key, params = {}) => {
    const pageState = directoryPages[key]
    const loader = directoryLoaderFor[key]
    const mapper = directoryMapperFor[key]
    if (!pageState || !loader || !mapper || !isLoggedIn.value) return null
    const page = Math.max(1, Number(params.page || pageState.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || pageState.pageSize || 20))
    const filters = { ...params }
    delete filters.page
    delete filters.pageSize
    if (key === 'archiveRecords' && !filters.sourceType) filters.sourceType = 'ALL'
    if (key === 'classroomArchives') {
      if (filters.archiveVisible) {
        delete filters.status
        delete filters.archived
      } else {
        if (!filters.status) filters.status = 'COMPLETED'
        filters.archived = true
      }
    }
    const promiseKey = `${key}:${page}:${pageSize}:${JSON.stringify(filters)}`
    if (directoryPromises.has(promiseKey)) return directoryPromises.get(promiseKey)
    const load = (async () => {
      directoryLoading[key] = true
      directoryErrors[key] = ''
      try {
        const mapped = mapPage(await loader({ ...filters, page, pageSize }), mapper)
        replaceReactive(pageState.items, mapped.items)
        Object.assign(pageState, { page: mapped.page, pageSize: mapped.pageSize, total: mapped.total, filters })
        return mapped
      } catch (error) {
        directoryErrors[key] = remoteErrorMessage(error, '列表加载失败')
        throw error
      } finally {
        directoryLoading[key] = false
        directoryPromises.delete(promiseKey)
      }
    })()
    directoryPromises.set(promiseKey, load)
    return load
  }

  const loadResourceExternalLinks = async () => {
    if (!isLoggedIn.value) return []
    const page = mapPage(await api.master.externalLinks({ page: 1, pageSize: 200, status: 'ENABLED' }), mapExternalLink)
    replaceReactive(externalLinks, page.items)
    return externalLinks
  }

  const loadDirectoryDetail = async (key, recordOrId) => {
    const record = recordOrId && typeof recordOrId === 'object' ? recordOrId : null
    const value = record || { id: recordOrId }
    if (!value.id && !value.lessonId) return null
    try {
      if (key === 'teachers') return mapTeacher(await api.master.teacher(value.id))
      if (key === 'students') return mapStudent(await api.master.student(value.id))
      if (key === 'classes') return mapClass(await api.master.class(value.id))
      if (key === 'courses') return mapCourse(await api.master.course(value.id))
      if (key === 'externalLinks') return mapExternalLink(await api.master.externalLink(value.id))
      if (key === 'extraTasks') return mapExtraTask(await api.m6.extraTask(value.id))
      if (key === 'archiveRecords') {
        if (String(value.sourceType || '').toLowerCase() === 'extratask' || value.extraTaskId) {
          return mapExtraArtwork(await api.m6.extraArtwork(value.id))
        }
        if (value.archiveStatus === 'CURRENT') return mapArchiveRecord(value)
        return mapArchiveRecord(await api.archive.record(value.id))
      }
      if (key === 'classroomArchives') return loadLessonWorkspace(value.id)
      if (key === 'teacherArchives') return api.m5.teacherEffect(value.lessonId || value.id)
      return null
    } catch (error) {
      directoryErrors[key] = remoteErrorMessage(error, '详情加载失败')
      throw error
    }
  }

  const loadDirectoryExtraTaskWorks = async (taskId) => {
    if (!taskId) return []
    try {
      const values = await api.m6.extraArtworks(taskId)
      const mapped = (Array.isArray(values) ? values : []).map(mapExtraArtwork)
      replaceReactive(extraTaskWorks, mapped)
      return mapped
    } catch (error) {
      directoryErrors.extraTasks = remoteErrorMessage(error, '课外作品加载失败')
      throw error
    }
  }

  const loadClassTypes = async ({ force = false } = {}) => {
    if (!isLoggedIn.value) return []
    if (classTypes.length && !force) return classTypes
    const page = await api.master.classTypes({ page: 1, pageSize: 100, status: 'ENABLED' })
    const values = mapPage(page, (value) => ({
      ...value,
      id: fromApiId(value.id),
      name: value.name || '',
      status: value.status || 'ENABLED',
      version: Number(value.version || 0)
    })).items
    replaceReactive(classTypes, values)
    return classTypes
  }

  const loadCurrentTeacherProfile = async () => {
    if (!isLoggedIn.value) return null
    try {
      const value = mapTeacher(await api.master.currentTeacher())
      currentTeacherProfile.value = value
      return value
    } catch {
      currentTeacherProfile.value = null
      return null
    }
  }

  const loadTeacherSourceMappings = async (params = {}) => {
    try {
      const values = await api.master.teacherSourceMappings(params)
      replaceReactive(teacherSourceMappings, Array.isArray(values) ? values.map((value) => ({
        ...value,
        id: fromApiId(value.id),
        teacherId: fromApiId(value.teacherId),
        teacherUserId: fromApiId(value.teacherUserId),
        version: Number(value.version || 0)
      })) : [])
      return teacherSourceMappings
    } catch (error) {
      notify(remoteErrorMessage(error, '老师来源映射加载失败'))
      return null
    }
  }

  const refreshWorkbenchSummary = async () => {
    if (!isLoggedIn.value) return null
    const value = await api.workbench.summary()
    if (value) Object.assign(shellSummary, value)
    return shellSummary
  }

  const refreshTodayLessons = async () => {
    if (!isLoggedIn.value) return null
    const page = mapPage(await api.lessons.today({ page: 1, pageSize: 20 }), mapLesson)
    replaceReactive(tasks, page.items)
    updatePageMeta(shellPages.lessons, page)
    updateListPageMeta('tasks', page)
    if (!activeTaskId.value && tasks[0]) activeTaskId.value = tasks[0].id
    return page
  }

  const refreshWheatTraces = async () => {
    if (!isLoggedIn.value) return null
    const scope = currentTodoScope()
    if (!scope) {
      const emptyPage = { page: 1, pageSize: 200, total: 0, items: [] }
      replaceReactive(wheatTraces)
      updatePageMeta(shellPages.wheatTraces, emptyPage)
      updateListPageMeta('wheatTraces', emptyPage)
      return emptyPage
    }
    const result = await loadAllPageItems(api.todo.wheatTraces, mapWheatListItem,
      { ...scope, status: ['PENDING', 'EXCEPTION'] })
    const items = result.items.filter(Boolean)
    replaceReactive(wheatTraces, items)
    const page = { page: 1, pageSize: 200, total: result.total, items }
    updatePageMeta(shellPages.wheatTraces, page)
    updateListPageMeta('wheatTraces', page)
    return page
  }

  const refreshTodos = async () => {
    if (!isLoggedIn.value) return null
    const page = mapPage(await api.todo.list({ status: 'OPEN', page: 1, pageSize: 20 }), mapTodo)
    replaceReactive(todos, page.items)
    updatePageMeta(shellPages.todos, page)
    updateListPageMeta('todos', page)
    return page
  }

  const loadShellData = async ({ force = false, initialMe = null } = {}) => {
    if (!isLoggedIn.value) return null
    if (remoteReady.value && !force && pageLoaded.shell) return shellSummary
    remoteLoading.value = true
    try {
      const results = await Promise.allSettled([
        initialMe ? Promise.resolve(initialMe) : api.auth.me(),
        api.lessons.today({ page: 1, pageSize: 20 }),
        api.workbench.summary()
      ])
      if (results[0].status === 'rejected') throw results[0].reason
      const valueAt = (index) => results[index].status === 'fulfilled' ? results[index].value : null
      applyMe(valueAt(0))
      await loadCurrentTeacherProfile()
      const lessonPage = mapPage(valueAt(1), mapLesson)
      replaceReactive(tasks, lessonPage.items)
      updatePageMeta(shellPages.lessons, lessonPage)
      updateListPageMeta('tasks', lessonPage)
      if (valueAt(2)) Object.assign(shellSummary, valueAt(2))
      // The drawer is an action inbox, so load each business source directly.
      // The generic todo projection remains available for source modules but is
      // intentionally not rendered as a separate user-facing category.
      // Load lessons first because the WeCom list is decorated with lesson
      // context and must also cover lessons outside today's page.
      await Promise.allSettled([refreshInboxLessons()])
      await Promise.allSettled([
        refreshWheatTraces(),
        refreshCloudArchiveTodos(),
        refreshWecomSendTasks(),
        refreshPendingReviewQueue()
      ])
      if (!activeTaskId.value && tasks[0]) activeTaskId.value = tasks[0].id
      pageLoaded.shell = true
      remoteReady.value = true
      return shellSummary
    } finally {
      remoteLoading.value = false
    }
  }

  const mapImageTemplate = (item = {}) => {
    const config = normalizeImageTemplate(item)
    return {
      ...item,
      id: fromApiId(item.id),
      templateVersion: Number(item.templateVersion || 1),
      version: Number(item.version || 0),
      config,
      renderer: config.renderer,
      ratio: config.canvas.aspectRatio,
      brightness: config.adjustments.brightness,
      watermark: config.watermark.enabled ? '启用水印' : '隐藏水印',
      border: config.border.enabled ? '启用边框' : '无边框',
      quality: config.output.quality,
      summary: imageTemplateSummary({ ...item, config })
    }
  }

  const loadTemplates = async ({ force = false } = {}) => {
    if (pageLoaded.templates && !force) return templates
    const [feedbackValues, imageValues] = await Promise.all([
      api.feedback.templates(),
      api.feedback.imageTemplates()
    ])
    templates.comment = (feedbackValues || []).map(mapFeedbackTemplate)
    templates.image = (imageValues || []).map(mapImageTemplate)
    pageLoaded.templates = true
    return templates
  }

  const pagePromises = new Map()
  const loadPageData = async (pageName, { force = false } = {}) => {
    if (!isLoggedIn.value) return null
    if (pageLoaded[pageName] && !force) return true
    if (pagePromises.has(pageName) && !force) return pagePromises.get(pageName)
    const load = (async () => {
      pageLoading[pageName] = true
      pageErrors[pageName] = ''
      try {
        switch (pageName) {
          case 'tasks': {
            // Keep opening a lesson within five JSON requests: four small reference
            // pages plus the single aggregated workspace request. Class types are
            // only needed by the lesson-maintenance dialog and are loaded with that
            // page instead of adding another request to the delivery workflow.
            const [teacherPage, studentPage, classPage, coursePage] = await Promise.all([
              api.master.teachers({ page: 1, pageSize: 200, archiveState: 'ACTIVE' }), api.master.students({ page: 1, pageSize: 200, archiveState: 'ACTIVE' }),
              api.master.classes({ page: 1, pageSize: 200, archiveState: 'ACTIVE' }), api.master.courses({ page: 1, pageSize: 200, archiveState: 'ACTIVE' })
            ])
            const mappedTeachers = mapPage(teacherPage, mapTeacher)
            const mappedStudents = mapPage(studentPage, mapStudent)
            const mappedClasses = mapPage(classPage, mapClass)
            const mappedCourses = mapPage(coursePage, mapCourse)
            replaceReactive(teachers, mappedTeachers.items)
            replaceReactive(students, mappedStudents.items)
            replaceReactive(classes, mappedClasses.items)
            replaceReactive(courses, mappedCourses.items)
            updateListPageMeta('teachers', mappedTeachers)
            updateListPageMeta('students', mappedStudents)
            updateListPageMeta('classes', mappedClasses)
            updateListPageMeta('courses', mappedCourses)
            await loadCurrentTeacherProfile()
            break
          }
          case 'schedule': {
            const [teacherPage, classPage, coursePage] = await Promise.all([
              api.master.teachers({ page: 1, pageSize: 200, archiveState: 'ACTIVE' }),
              api.master.classes({ page: 1, pageSize: 200, archiveState: 'ACTIVE' }),
              api.master.courses({ page: 1, pageSize: 200, archiveState: 'ACTIVE' })
            ])
            const mappedTeachers = mapPage(teacherPage, mapTeacher)
            const mappedClasses = mapPage(classPage, mapClass)
            const mappedCourses = mapPage(coursePage, mapCourse)
            replaceReactive(teachers, mappedTeachers.items)
            replaceReactive(classes, mappedClasses.items)
            replaceReactive(courses, mappedCourses.items)
            updateListPageMeta('teachers', mappedTeachers)
            updateListPageMeta('classes', mappedClasses)
            updateListPageMeta('courses', mappedCourses)
            await loadCurrentTeacherProfile()
            break
          }
          case 'teachers': await loadDirectoryPage('teachers', { page: 1, pageSize: 20, archiveState: masterArchiveState.teachers }); break
          case 'students': await loadDirectoryPage('students', { page: 1, pageSize: 20, archiveState: masterArchiveState.students }); break
          case 'classes': await loadDirectoryPage('classes', { page: 1, pageSize: 20, archiveState: masterArchiveState.classes }); break
          case 'courses': await loadDirectoryPage('courses', { page: 1, pageSize: 20, archiveState: masterArchiveState.courses }); break
          case 'externalLinks': await loadDirectoryPage('externalLinks', { page: 1, pageSize: 20 }); break
          case 'supervision': {
            const page = mapPage(await api.m6.supervision({ page: 1, pageSize: 20 }), mapSupervisionLesson)
            replaceReactive(supervisionDashboard, page.items)
            updateListPageMeta('supervision', page)
            break
          }
          case 'archives': await loadDirectoryPage('archiveRecords', { page: 1, pageSize: 20, sourceType: 'ALL' }); break
          case 'imports': {
            const page = mapPage(await api.imports.list({ page: 1, pageSize: 20 }), mapImportBatch)
            replaceReactive(importBatches, page.items)
            updateListPageMeta('imports', page)
            break
          }
          case 'extraTasks': await loadDirectoryPage('extraTasks', { page: 1, pageSize: 20 }); break
          case 'templates': await loadTemplates({ force }); break
          case 'production': {
            const [archivePage, , studentData, classData] = await Promise.all([
              api.archive.records({ page: 1, pageSize: 20 }),
              portfolioStudioRef?.loadPortfolioData?.(),
              loadAllPageItems(api.master.students, mapStudent, { archiveState: masterArchiveState.students }),
              loadAllPageItems(api.master.classes, mapClass, { archiveState: masterArchiveState.classes })
            ])
            const mappedArchives = mapPage(archivePage, mapArchiveRecord)
            const mappedStudents = { items: studentData.items, page: 1, pageSize: 200, total: studentData.total }
            const mappedClasses = { items: classData.items, page: 1, pageSize: 200, total: classData.total }
            replaceReactive(archiveRecords, mappedArchives.items)
            pageLoaded.archives = true
            replaceReactive(students, mappedStudents.items)
            replaceReactive(classes, mappedClasses.items)
            updateListPageMeta('archives', mappedArchives)
            updateListPageMeta('students', mappedStudents)
            updateListPageMeta('classes', mappedClasses)
            break
          }
          case 'settings': {
            const [providers, providerTypes, groups] = await Promise.all([
              api.m5.providers({ page: 1, pageSize: 20 }),
              api.m5.providerTypes(),
              api.m5.providerGroups()
            ])
            mapProviderSetting(providers?.items || providers || [])
            Object.assign(providerCatalog, providerTypes || {})
            if (groups) mapProviderGroups(groups)
            break
          }
          case 'permissions': {
            const values = await api.auth.permissions()
            replaceReactive(permissionCatalog, (values || []).map((permission) => typeof permission === 'string' ? permission : permission?.permissionKey).filter(Boolean))
            break
          }
          default: break
        }
        pageLoaded[pageName] = true
        return true
      } catch (error) {
        pageErrors[pageName] = remoteErrorMessage(error, '页面数据加载失败')
        throw error
      } finally {
        pageLoading[pageName] = false
        pagePromises.delete(pageName)
      }
    })()
    pagePromises.set(pageName, load)
    return load
  }

  const invalidateResource = async (key, { lessonId = null, force = true } = {}) => {
    switch (key) {
      case 'workbench.summary': return refreshWorkbenchSummary()
      case 'lessons.today': return refreshTodayLessons()
      case 'inbox-lessons': return refreshInboxLessons()
      case 'lessons.schedule': {
        if (!Object.keys(scheduleMeta.filters || {}).length) return null
        return loadScheduleLessons({ ...scheduleMeta.filters, page: scheduleMeta.page, pageSize: scheduleMeta.pageSize }, { force, allPages: Boolean(scheduleMeta.allPages) })
      }
      case 'wheat-traces': return refreshWheatTraces()
      case 'cloud-archive-todos': return refreshCloudArchiveTodos()
      case 'touch-tasks': return refreshWecomSendTasks()
      case 'pending-reviews': return refreshPendingReviewQueue()
      case 'todos': return refreshTodos()
      case 'lesson.workspace': return lessonId ? refreshRemoteLesson(lessonId, { force }) : null
      case 'archive.records': return loadPageData('archives', { force })
      case 'imports': return loadPageData('imports', { force })
      default: return loadPageData(key, { force })
    }
  }

  const remoteLoginWithForm = async () => {
    try {
      const auth = await api.auth.login({ account: loginForm.phone.trim(), password: loginForm.password })
      setSession(auth)
      storedMe.value = auth.me
      currentUserId.value = auth.me?.user?.id || null
      isLoggedIn.value = true
      await loadShellData({ initialMe: auth.me })
      notify(`欢迎回来，${currentUser.value?.name || '用户'}`)
      return true
    } catch (error) {
      // Authentication is atomic from the UI's perspective. If shell loading
      // fails after the server has issued tokens, do not leave a half-logged-in
      // browser session behind.
      clearSession()
      storedMe.value = null
      currentUserId.value = null
      isLoggedIn.value = false
      remoteReady.value = false
      notify(remoteErrorMessage(error, '登录失败，请检查账号密码或稍后重试'))
      return false
    }
  }

  const remoteLogout = async () => {
    if (cloudProviderPickerResolver) cloudProviderPickerResolver(null)
    try {
      if (getAccessToken()) await api.auth.logout()
    } catch {
      // 服务端会话失效时仍清理本地凭据。
    }
    clearSession()
    cancelJobWatchers()
    lessonWorkspaceControllers.forEach((controller) => controller.abort())
    lessonWorkspaceControllers.clear()
    lessonWorkspacePromises.clear()
    lessonWorkspaceEpochs.clear()
    lessonWorkspaceLoaded.clear()
    lessonStartPromises.clear()
    clearProtectedMediaCache()
    portfolioStudioRef?.clearPortfolioSession?.()
    storedMe.value = null
    currentUserId.value = null
    loginForm.phone = ''
    loginForm.password = ''
    isLoggedIn.value = false
    remoteReady.value = false
    replaceReactive(teachers)
    replaceReactive(students)
    replaceReactive(classes)
    replaceReactive(courses)
    replaceReactive(scheduleLessons)
    replaceReactive(tasks)
    replaceReactive(inboxLessons)
    replaceReactive(archiveRecords)
    replaceReactive(artworkLibrary)
    replaceReactive(communicationRecords)
    replaceReactive(extraTaskArchives)
    replaceReactive(extraTaskWorks)
    replaceReactive(externalLinks)
    replaceReactive(wheatTraces)
    replaceReactive(todos)
    replaceReactive(cloudArchiveTodos)
    replaceReactive(pendingReviewQueue)
    replaceReactive(importBatches)
    replaceReactive(importPreviewRows)
    replaceReactive(qualityReviews)
    replaceReactive(terms)
    replaceReactive(supervisionDashboard)
    replaceReactive(permissionCatalog)
    replaceReactive(identityUsers)
    replaceReactive(identityRoles)
    replaceReactive(identityPermissions)
    replaceReactive(teacherSourceMappings)
    currentTeacherProfile.value = null
    Object.assign(masterArchiveState, { teachers: 'ACTIVE', students: 'ACTIVE', classes: 'ACTIVE', courses: 'ACTIVE' })
    Object.assign(identityUserPage, { page: 1, pageSize: 20, total: 0 })
    identityUserQuery.value = ''
    identityUserStatus.value = ''
    Object.assign(identityLoaded, { users: false, roles: false, permissions: false })
    Object.assign(identityErrors, { users: '', roles: '', permissions: '', memberships: '' })
    replaceReactive(studentProfileFields)
    replaceReactive(wecomSendTasks)
    Object.keys(studentProfiles).forEach((key) => delete studentProfiles[key])
    Object.keys(studentProfileAudits).forEach((key) => delete studentProfileAudits[key])
    Object.keys(lessonWorkspaces).forEach((key) => delete lessonWorkspaces[key])
    shareDraftSaveChains.clear()
    selectedTaskSnapshot.value = null
    Object.keys(pageLoaded).forEach((key) => delete pageLoaded[key])
    Object.keys(pageErrors).forEach((key) => delete pageErrors[key])
    Object.keys(pageMeta).forEach((key) => delete pageMeta[key])
    Object.assign(scheduleMeta, { page: 1, pageSize: 200, total: 0, filters: {}, allPages: false })
    scheduleError.value = ''
    schedulePromises.clear()
    Object.assign(shellSummary, { pendingLessons: 0, wheatPending: 0, openTodos: 0, importIssues: 0, cloudArchiveFailures: 0, pendingQualityReviews: 0, pendingParentTouches: 0 })
    Object.assign(shellPages.lessons, { page: 1, pageSize: 20, total: 0 })
    Object.assign(shellPages.wheatTraces, { page: 1, pageSize: 20, total: 0 })
    Object.assign(shellPages.todos, { page: 1, pageSize: 20, total: 0 })
    activeTaskId.value = null
    notify('已退出登录')
  }

  const remoteSavePreferences = async (uiTheme) => {
    const preferences = storedMe.value?.preferences || {}
    const result = await runRemote('正在保存界面偏好...', () => api.auth.preferences({
      uiTheme,
      language: preferences.language || 'zh-CN',
      timezone: preferences.timezone || 'Asia/Shanghai',
      version: Number(preferences.version || 0)
    }), '', () => api.auth.me().then((me) => { applyMe(me); return me }))
    if (!result) return false
    storedMe.value = { ...storedMe.value, preferences: result }
    updateStoredMe(storedMe.value)
    return true
  }

  const remoteSelectTask = async (task) => {
    if (!task?.id) return null
    cancelJobWatchers()
    const openedTask = await startLessonProcessingOnOpen(task)
    if (!openedTask) return null
    activeTaskId.value = task.id
    selectedTaskSnapshot.value = openedTask
    const workspace = ensureLessonWorkspace(openedTask)
    if (workspace) workspace.currentStep = 0
    if (!pageLoaded.tasks) await loadPageData('tasks')
    return runRemote('正在加载课次工作区...', async () => {
      // 课次工作区只保存资源 ID；预览还需要资源详情和图片模板，因此在加载草稿前一并准备。
      // 资源目录失败不应阻断课次打开，预览组件本身还有安全兜底。
      await Promise.allSettled([loadTemplates(), loadResourceExternalLinks()])
      return loadLessonWorkspace(task.id)
    })
  }

  const remoteSelectTaskById = async (lessonId) => {
    const key = String(lessonId || '')
    if (!key) return null
    const existing = visibleTasks.value.find((task) => sameId(task.id, key)) ||
      inboxLessons.find((lesson) => sameId(lesson.id, key)) ||
      scheduleLessons.find((lesson) => sameId(lesson.id, key))
    if (existing) return remoteSelectTask(existing)
    try {
      const value = await api.lessons.get(key)
      const task = mapLesson(value?.lesson || value)
      if (!task.id) {
        notify('未找到该课次或当前账号无权访问')
        return null
      }
      return remoteSelectTask(task)
    } catch (error) {
      notify(remoteErrorMessage(error, '课次加载失败'))
      return null
    }
  }

  const remoteTransitionLesson = async (action, reason = '', exceptionType = '') => {
    const task = activeTask.value
    if (!task?.id) return false
    const commands = { start: 'START_PROCESSING', exception: 'MARK_EXCEPTION', recover: 'RECOVER_PROCESSING', reopen: 'REOPEN' }
    if (!commands[action]) return false
    const result = await runRemote('正在更新课次状态...', () => api.lessons.transition(task.id, {
      command: commands[action], version: task.version, reason: reason?.trim() || undefined, exceptionType: exceptionType || undefined
    }))
    if (!result) return false
    const mapped = mergeLessonRecord(result)
    await Promise.all([
      refreshRemoteLesson(task.id),
      invalidateResource('inbox-lessons'),
      invalidateResource('pending-reviews')
    ])
    notify(`课次状态已更新为“${mapped.status}”`)
    return true
  }

  const remoteSetAttendance = async (row, value) => {
    if (!activeTask.value?.id || !row?.studentId) return false
    const result = await runRemote('正在保存出勤...', () => api.lessons.updateAttendance(activeTask.value.id, row.studentId, {
      status: toApiAttendanceStatus(value), note: row.note || undefined, version: activeTask.value.version, attendanceVersion: row.attendanceVersion || row.version || undefined
    }))
    if (!result) return false
    await refreshRemoteLesson(activeTask.value.id)
    return true
  }

  const remoteToggleMaterialVisible = async (material) => {
    if (!material?.id) return false
    const result = await runRemote('正在更新素材展示状态...', () => api.assets.update(material.id, {
      studentId: material.studentId === null || material.studentId === undefined ? undefined : String(material.studentId),
      title: material.title || undefined,
      visible: !material.visible,
      sortOrder: material.sortOrder || 0,
      version: material.version
    }))
    if (!result) return false
    await refreshRemoteLesson(activeTask.value.id)
    return true
  }

  const remoteRenameLessonMaterial = async (material, title) => {
    if (!material?.id) return false
    const nextTitle = String(title || '').trim()
    if (!nextTitle) {
      notify('素材名称不能为空')
      return false
    }
    if (nextTitle.length > 255) {
      notify('素材名称不能超过 255 个字符')
      return false
    }
    if (nextTitle === String(material.title || '').trim()) return true
    const result = await runRemote('正在保存素材名称...', () => api.assets.update(material.id, {
      studentId: material.studentId === null || material.studentId === undefined ? undefined : String(material.studentId),
      title: nextTitle,
      visible: material.visible,
      sortOrder: material.sortOrder || 0,
      version: material.version
    }), '素材名称已保存')
    if (!result) return false
    await refreshRemoteLesson(activeTask.value.id)
    return true
  }

  const remoteUploadLessonMaterialFiles = async (files, category = '范画', replacement = null) => {
    if (!files.length || !activeTask.value?.id) return false
    const result = await runRemote(
      replacement ? '正在替换课堂素材...' : '正在上传课堂资料...',
      async () => {
        const items = []
        for (const file of files) {
          const uploaded = await uploadFile(file, `lesson-${activeTask.value.id}-asset`)
          items.push({
            fileId: String(uploaded.id),
            assetType: apiAssetTypeForUpload(category, file),
            title: file.name,
            visible: replacement ? Boolean(replacement.visible) : defaultMaterialVisible(category),
            sortOrder: replacement ? Number(replacement.sortOrder || 0) : materials.value.length + items.length
          })
        }
        await api.assets.createBatch(activeTask.value.id, items)
        if (replacement?.id) {
          try {
            await api.assets.remove(replacement.id, replacement.version)
          } catch (error) {
            await refreshRemoteLesson(activeTask.value.id, { force: true })
            throw error
          }
        }
        await refreshRemoteLesson(activeTask.value.id)
        return true
      },
      replacement ? '课堂素材已替换' : `已上传 ${files.length} 个${category}`
    )
    return result === true
  }

  const remoteUploadLessonMaterial = async (event, category = '范画') => {
    const files = [...(event.target.files || [])]
    event.target.value = ''
    return remoteUploadLessonMaterialFiles(files, category)
  }

  const remoteReplaceLessonMaterial = async (material, file, category = materialCategoryForType(material?.type)) => {
    if (!material || !file) return false
    return remoteUploadLessonMaterialFiles([file], category, material)
  }

  const remoteRemoveLessonMaterial = async (material) => {
    if (!material?.id) return false
    const result = await runRemote('正在删除课堂资料...', () => api.assets.remove(material.id, material.version))
    if (!result) return false
    await refreshRemoteLesson(activeTask.value.id)
    return true
  }

  const remoteConfirmNoLessonMaterials = async () => {
    const result = await runRemote('正在保存无资料确认...', () => api.assets.emptyConfirmation(activeTask.value.id, {
      confirmedEmpty: !materialsConfirmedEmpty.value,
      version: activeWorkspace.value.materialsVersion ?? undefined
    }))
    if (!result) return false
    activeWorkspace.value.materialsVersion = Number(result.version || 0)
    await refreshRemoteLesson(activeTask.value.id)
    return true
  }

  const rememberArtworkUploadFailures = (row, failures) => {
    const key = String(row?.studentId || '')
    if (!key) return
    if (failures.length) artworkUploadFailures.set(key, failures)
    else artworkUploadFailures.delete(key)
    const fresh = sessionStudentFor(row.studentId)
    if (fresh) fresh.uploadFailures = failures
  }

  const uploadArtworkFiles = async (files, row) => {
    const safeFiles = (files || []).filter(Boolean)
    if (!safeFiles.length || !row?.studentId || !activeTask.value?.id) return { uploaded: 0, failed: [] }
    const items = []
    const failed = []
    const baseSortOrder = artworksForRow(row).reduce((max, artwork) =>
      Math.max(max, Number(artwork?.sortOrder ?? -1)), -1) + 1
    for (const file of safeFiles) {
      try {
        const uploaded = await uploadFile(file, `lesson-${activeTask.value.id}-artwork-${row.studentId}`)
        items.push({
          file,
          payload: {
            studentId: String(row.studentId),
            fileId: String(uploaded.id),
            sortOrder: baseSortOrder + items.length
          }
        })
      } catch (error) {
        failed.push({ kind: 'ADD', file, name: file.name || '未命名文件', message: error?.message || '上传失败' })
      }
    }
    const boundItems = []
    if (items.length) {
      try {
        await api.assets.createArtworksBatch(activeTask.value.id, items.map((item) => item.payload))
        boundItems.push(...items)
      } catch (batchError) {
        // 批量绑定失败时逐文件重试，确保部分文件失败不会掩盖已经成功的文件。
        for (const item of items) {
          try {
            await api.assets.createArtwork(activeTask.value.id, item.payload)
            boundItems.push(item)
          } catch (error) {
            failed.push({ kind: 'ADD', file: item.file, name: item.file.name || '未命名文件', message: error?.message || batchError?.message || '绑定作品失败' })
          }
        }
      }
    }
    await refreshRemoteLesson(activeTask.value.id)
    rememberArtworkUploadFailures(row, failed)
    return { uploaded: boundItems.length, failed }
  }

  const remoteUpdateImage = async (event, row, replaceIndex = null) => {
    const files = [...(event.target.files || [])]
    event.target.value = ''
    if (!files.length || !row?.studentId || !activeTask.value?.id) return
    const result = await runRemote('正在上传学生作品...', () => uploadArtworkFiles(files, row), `已为${students.find((item) => sameId(item.id, row.studentId))?.name || '学生'}上传作品`)
    if (result?.failed?.length) notify(`${result.failed.length} 个作品上传失败，可点击失败文件重试：${result.failed.map((item) => item.name).join('、')}`)
    return Boolean(result?.uploaded)
  }

  const remoteReplaceStudentImage = async (event, row) => {
    const files = [...(event.target.files || [])]
    event.target.value = ''
    const file = files[0]
    if (!file || !row?.studentId || !activeTask.value?.id) return false

    const result = await runRemote('正在替换学生作品...', async () => {
      try {
        const uploaded = await uploadFile(file, `lesson-${activeTask.value.id}-artwork-${row.studentId}`)
        if (row.artworkId) {
          await api.assets.updateArtwork(row.artworkId, {
            fileId: String(uploaded.id),
            sortOrder: Number(row.sortOrder || 0),
            version: row.artworkVersion
          })
        } else {
          await api.assets.createArtworksBatch(activeTask.value.id, [{
            studentId: String(row.studentId),
            fileId: String(uploaded.id),
            sortOrder: Number(row.sortOrder || 0)
          }])
        }
        await refreshRemoteLesson(activeTask.value.id)
        rememberArtworkUploadFailures(row, [])
        return true
      } catch (error) {
        rememberArtworkUploadFailures(row, [{
          kind: row.artworkId ? 'REPLACE' : 'ADD',
          artworkId: row.artworkId || null,
          artworkVersion: row.artworkVersion || 0,
          sortOrder: Number(row.sortOrder || 0),
          file,
          name: file.name || '未命名文件',
          message: error?.message || '上传失败'
        }])
        throw error
      }
    }, '学生作品已替换')
    return result === true
  }

  const remoteRetryArtworkUploads = async (row) => {
    const failures = artworkUploadFailures.get(String(row?.studentId || '')) || row?.uploadFailures || []
    if (!failures.length) return false
    const replacementFailures = failures.filter((item) => item.kind === 'REPLACE' && item.artworkId)
    const addFailures = failures.filter((item) => !(item.kind === 'REPLACE' && item.artworkId))
    let uploaded = 0
    let remaining = []
    if (replacementFailures.length) {
      const replacementResult = await runRemote('正在重试失败作品替换...', async () => {
        const failed = []
        for (const item of replacementFailures) {
          const artwork = artworkForTarget(item.artworkId) || {
            artworkId: item.artworkId,
            artworkVersion: item.artworkVersion,
            sortOrder: item.sortOrder
          }
          try {
            const uploadedFile = await uploadFile(item.file, `lesson-${activeTask.value.id}-artwork-${row.studentId}`)
            await api.assets.updateArtwork(artwork.artworkId, {
              fileId: String(uploadedFile.id),
              sortOrder: Number(artwork.sortOrder || item.sortOrder || 0),
              version: artwork.artworkVersion ?? item.artworkVersion
            })
            uploaded += 1
          } catch (error) {
            failed.push({ ...item, message: error?.message || '替换失败' })
          }
        }
        await refreshRemoteLesson(activeTask.value.id)
        return { uploaded, failed }
      }, '失败作品替换已重试')
      if (replacementResult?.failed?.length) remaining.push(...replacementResult.failed)
    }
    if (addFailures.length) {
      const addResult = await runRemote('正在重试失败作品上传...', () => uploadArtworkFiles(addFailures.map((item) => item.file), row), '失败作品已重试')
      uploaded += Number(addResult?.uploaded || 0)
      if (addResult?.failed?.length) remaining.push(...addResult.failed)
    }
    rememberArtworkUploadFailures(row, remaining)
    if (remaining.length) notify(`${remaining.length} 个作品仍上传失败：${remaining.map((item) => item.name).join('、')}`)
    return Boolean(uploaded)
  }

  const remoteRenameArtwork = async (row, title) => {
    if (!row?.artworkId) {
      notify('请先上传学生作品')
      return false
    }
    const nextTitle = String(title || '').trim()
    if (!nextTitle) {
      notify('作品名称不能为空')
      return false
    }
    if (nextTitle.length > 255) {
      notify('作品名称不能超过 255 个字符')
      return false
    }
    if (nextTitle === String(row.artworkTitle || row.title || '').trim()) return true
    const result = await runRemote('正在保存作品名称...', () => api.assets.updateArtwork(row.artworkId, {
      title: nextTitle,
      version: row.artworkVersion
    }), '作品名称已保存')
    if (!result) return false
    await refreshRemoteLesson(activeTask.value.id)
    return true
  }

  const remoteRemoveStudentImage = async (row) => {
    if (!row?.artworkId) return false
    const result = await runRemote('正在删除作品...', () => api.assets.removeArtwork(row.artworkId, row.artworkVersion))
    if (!result) return false
    await refreshRemoteLesson(activeTask.value.id)
    return true
  }

  const remoteRemoveArtworkVersion = async (row) => {
    if (!row?.artworkId || !row?.processedVersionId) return false
    const result = await runRemote('正在删除处理图...', () => api.assets.removeArtworkVersion(
      row.artworkId,
      row.processedVersionId,
      row.artworkVersion
    ))
    if (!result) return false
    await refreshRemoteLesson(activeTask.value.id)
    return true
  }

  const imageRenderContextFor = (row) => {
    const student = students.find((item) => sameId(item.id, row?.studentId))
    return {
      campusName: school.campus || school.name || '',
      schoolName: school.name || school.campus || '',
      studentName: student?.name || row?.studentName || ''
    }
  }

  const renderClientArtwork = async (row, template, maxDimension = 2400) => {
    if (!row?.artworkId || !row?.originalVersionId) throw new Error('当前作品没有可处理的原图版本')
    if (!isClientCanvasTemplate(template)) throw new Error('当前模板需要后端异步处理')
    const rendered = await renderArtworkFile({ fileId: row.originalFileId, src: row.originalImage || row.image }, template,
      imageRenderContextFor(row), { maxDimension })
    const extension = rendered.blob.type === 'image/png' ? 'png' : 'jpg'
    const file = new File([rendered.blob], `artwork-${row.studentId}-processed.${extension}`, { type: rendered.blob.type })
    const uploaded = await uploadFile(file, `lesson-${activeTask.value.id}-artwork-processed-${row.studentId}`)
    const committed = await api.assets.commitRenderedArtwork(row.artworkId, {
      sourceVersionId: String(row.originalVersionId),
      fileId: String(uploaded.id),
      templateId: String(template.id),
      templateVersion: Number(template.templateVersion || 1)
    })
    clientRenderSignatureByArtwork.set(String(row.artworkId), clientRenderSignature(row, template))
    return committed
  }

  const remoteRenderCurrentImage = async (row = activeArtwork.value || activeSessionStudent.value) => {
    const template = activeImageTemplate.value
    if (!row?.artworkId) return false
    if (!template || !isClientCanvasTemplate(template)) return false
    const result = await runRemote('正在生成处理图预览并保存...', async () => {
      await renderClientArtwork(row, template)
      await refreshRemoteLesson(activeTask.value.id, { force: true })
      return true
    }, '处理图已保存，等待老师确认')
    return result === true
  }

  const remoteAdoptCurrentImage = async (target = activeArtworkId.value || activeStudentId.value) => {
    const row = artworkForTarget(target)
    if (!row?.artworkId) return false
    const template = activeImageTemplate.value
    const hasPersistedProcessedCandidate = Boolean(row.processedVersionId && row.processedFileId)
    const persistedRenderer = String(row.processedRenderer || '').toUpperCase()
    const isPersistedAiCandidate = hasPersistedProcessedCandidate && persistedRenderer !== 'CLIENT_CANVAS'
    const isOriginalTemplate = String(template?.templateKey || '').trim().toLowerCase() === 'original'

    // An AI result is already an immutable server-side version. Confirm that
    // version directly; the selected client template must not cause the AI
    // result to be replaced by a second browser-rendered candidate.
    if (isPersistedAiCandidate) return remoteConfirmCurrentImage('processed', row)
    if (!hasPersistedProcessedCandidate && isOriginalTemplate) return remoteConfirmCurrentImage('original', row)

    const selectedTemplateKey = String(template?.templateKey || '').trim().toLowerCase()
    const processedTemplateKey = String(row.processedTemplateKey || '').trim().toLowerCase()
    const selectedTemplateVersion = Number(template?.templateVersion || 1)
    const processedTemplateVersion = Number(row.processedTemplateVersion || 0)
    const persistedClientCandidateMatchesTemplate = Boolean(
      hasPersistedProcessedCandidate &&
      persistedRenderer === 'CLIENT_CANVAS' &&
      selectedTemplateKey &&
      selectedTemplateKey === processedTemplateKey &&
      (!processedTemplateVersion || processedTemplateVersion === selectedTemplateVersion)
    )

    // Reuse a persisted browser-rendered candidate only when it represents
    // the template currently selected by the teacher. Otherwise continue with
    // the normal render-and-confirm flow below.
    if (persistedClientCandidateMatchesTemplate) return remoteConfirmCurrentImage('processed', row)

    if (!template || !isClientCanvasTemplate(template)) {
      return remoteConfirmCurrentImage(hasPersistedProcessedCandidate ? 'processed' : 'original', row)
    }

    const result = await runRemote('正在保存并采用处理图...', async () => {
      if (!hasCurrentClientRender(row, template)) {
        await renderClientArtwork(row, template)
        await refreshRemoteLesson(activeTask.value.id, { force: true })
      }
      const current = artworkForTarget(row.artworkId)
      const versionId = current?.processedVersionId
      if (!current?.artworkId || !versionId) throw new Error('当前预览尚未生成处理图，请稍后重试')
      await api.assets.confirmArtwork(current.artworkId, {
        versionId: String(versionId),
        version: current.artworkVersion
      })
      await refreshRemoteLesson(activeTask.value.id)
      return true
    }, '处理图已保存并采用')
    return result === true
  }

  const remoteConfirmCurrentImage = async (mode = 'processed', target = activeArtworkId.value || activeStudentId.value) => {
    const row = artworkForTarget(target)
    if (!row?.artworkId) return false
    const versionId = mode === 'processed' ? row.processedVersionId : (row.originalVersionId || row.selectedVersionId)
    if (!versionId) {
      notify(mode === 'processed' ? '当前作品没有可确认的处理图，请选择原图' : '当前作品没有可确认的图片版本')
      return false
    }
    const result = await runRemote('正在确认作品图片...', () => api.assets.confirmArtwork(row.artworkId, { versionId: String(versionId), version: row.artworkVersion }))
    if (!result) return false
    await refreshRemoteLesson(activeTask.value.id)
    return true
  }

  const remoteProcessImages = async () => {
    const artworks = attendingRows.value.flatMap((row) => artworksForRow(row).filter((artwork) => artwork.artworkId && artwork.imageMatched))
    if (!artworks.length) {
      notify('请先上传学生作品')
      return false
    }
    const template = activeImageTemplate.value
    if (template && isClientCanvasTemplate(template)) {
      if (String(template.templateKey).toLowerCase() === 'original') {
        notify('当前选择为保留原图，无需生成处理图')
        return true
      }
      const result = await runRemote('正在生成并保存批量处理图...', async () => {
        for (const artwork of artworks) await renderClientArtwork(artwork, template)
        await refreshRemoteLesson(activeTask.value.id, { force: true })
        return true
      }, `已按“${template.name}”生成 ${artworks.length} 张处理图`)
      return result === true
    }
    const result = await runRemote('正在提交图片处理任务...', async () => {
      const jobs = await api.assets.processArtworksBatch(activeTask.value.id, artworks.map((artwork) => artwork.artworkId), {
        templateKey: template?.templateKey || template?.name || undefined,
        parameters: JSON.stringify({})
      })
      const jobIds = (Array.isArray(jobs) ? jobs : jobs?.items || []).map((job) => job?.jobId).filter(Boolean)
      const progress = await watchJobs(jobIds, activeTask.value.id)
      const failed = progress.filter((job) => ['FAILED', 'CANCELED'].includes(job.status))
      if (failed.length) {
        notify(failed.length === 1 ? failed[0].message : `${failed.length} 个作品处理任务失败，请按学生重试`)
        return null
      }
      return true
    }, '图片处理已完成')
    return result === true
  }

  const remoteRetryCurrentImageProcess = async () => {
    const row = activeArtwork.value || activeSessionStudent.value
    if (!row?.artworkId) return false
    if (activeImageTemplate.value && isClientCanvasTemplate(activeImageTemplate.value)) {
      if (String(activeImageTemplate.value.templateKey).toLowerCase() === 'original') {
        return remoteConfirmCurrentImage('original', row)
      }
      return remoteRenderCurrentImage(row)
    }
    const result = await runRemote('正在重试图片处理...', async () => {
      const submitted = await api.assets.processArtwork(row.artworkId, {
        templateKey: activeImageTemplate.value?.templateKey || undefined,
        parameters: JSON.stringify({})
      })
      const progress = await watchJobs([submitted?.jobId], activeTask.value.id)
      if (progress.some((job) => ['FAILED', 'CANCELED'].includes(job.status))) {
        notify(progress.find((job) => ['FAILED', 'CANCELED'].includes(job.status))?.message || '图片处理失败，可直接重试')
        return null
      }
      return submitted
    }, '图片处理已完成')
    if (!result) return false
    return true
  }

  const remoteProcessCurrentImageWithPrompt = async (prompt, target = activeArtworkId.value || activeStudentId.value) => {
    const safePrompt = String(prompt || '').trim()
    if (!safePrompt) {
      notify('请输入 AI 处理提示词')
      return false
    }
    const row = artworkForTarget(target)
    if (!row?.artworkId) {
      notify('请先上传当前学生的作品')
      return false
    }
    const result = await runRemote('正在提交 AI 图片处理任务...', async () => {
      const submitted = await api.assets.processArtwork(row.artworkId, {
        templateKey: activeImageTemplate.value?.templateKey || 'original',
        parameters: JSON.stringify({ prompt: safePrompt })
      })
      const progress = await watchJobs([submitted?.jobId], activeTask.value.id)
      if (progress.some((job) => ['FAILED', 'CANCELED'].includes(job.status))) {
        notify(progress.find((job) => ['FAILED', 'CANCELED'].includes(job.status))?.message || 'AI 图片处理失败，可直接重试')
        return null
      }
      return submitted
    }, 'AI 图片处理已完成')
    if (!result) return false
    return true
  }

  const feedbackBodyFor = (row) => ({
    classroomRecord: row.record || '',
    content: row.comment || '',
    clear: false,
    version: row.feedbackVersion || 0
  })

  const remoteGenerateOne = async (row) => {
    if (!row) return null
    const result = await runRemote('正在生成当前学生课评...', async () => {
      // Persist the latest classroom record before every single-student generation.
      // Omit content so regeneration does not create an unnecessary manual version
      // from the currently displayed AI candidate.
      const feedback = await api.feedback.saveForStudent(activeTask.value.id, row.studentId, {
        classroomRecord: row.record || '',
        clear: false,
        version: row.feedbackVersion || 0
      })
      if (!feedback?.id) throw new Error('课堂记录保存失败，无法生成课评')
      Object.assign(row, {
        feedbackId: feedback.id,
        feedbackVersion: feedback.version ?? row.feedbackVersion ?? 0,
        feedbackVersionId: feedback.currentVersionId || row.feedbackVersionId || null,
        record: feedback.classroomRecord ?? row.record
      })
      const generation = await api.feedback.regenerate(feedback.id, {
        templateId: activeCommentTemplate.value?.id
      })
      if (generation?.status && generation.status !== 'QUEUED') {
        notify(generation.message || '课评任务提交失败，请稍后重试')
        return null
      }
      const progress = await watchJobs([generation?.jobId], activeTask.value.id)
      if (progress.some((job) => ['FAILED', 'CANCELED'].includes(job.status))) {
        notify(progress.find((job) => ['FAILED', 'CANCELED'].includes(job.status))?.message || '课评生成失败，可直接重试')
        return null
      }
      return generation
    })
    return result
  }

  const remoteGenerateAll = async () => {
    const rows = attendingRows.value
    if (!rows.length) {
      notify('当前课次没有到课学生')
      return false
    }
    const result = await runRemote('正在保存课堂记录并生成全班 1v1 课评...', async () => {
      const savedFeedbacks = await api.feedback.saveBatch(activeTask.value.id,
        rows.map((row) => ({ studentId: String(row.studentId), ...feedbackBodyFor(row) })))
      ;(Array.isArray(savedFeedbacks) ? savedFeedbacks : []).forEach((feedback) => {
        const row = rows.find((item) => sameId(item.studentId, feedback.studentId))
        if (!row || !feedback?.id) return
        Object.assign(row, {
          feedbackId: feedback.id,
          feedbackVersion: feedback.version ?? row.feedbackVersion ?? 0,
          feedbackVersionId: feedback.currentVersionId || row.feedbackVersionId || null,
          record: feedback.classroomRecord ?? row.record
        })
      })
      const generation = await api.feedback.generate(activeTask.value.id, {
        templateId: activeCommentTemplate.value?.id
      })
      const immediateFailures = (generation?.items || []).filter((item) => item?.status && item.status !== 'QUEUED')
      const progress = await watchJobs((generation?.items || []).map((item) => item.jobId), activeTask.value.id)
      const failed = progress.filter((job) => ['FAILED', 'CANCELED'].includes(job.status))
      if (immediateFailures.length || failed.length) {
        notify(`${immediateFailures.length + failed.length} 个学生课评生成失败，可在对应学生行重试`)
        return null
      }
      return generation
    }, '课评生成任务已提交')
    return result
  }

  const remoteConfirmCurrentComment = async (studentId = activeStudentId.value) => {
    const targetStudentId = studentId ?? activeStudentId.value
    const row = sessionStudentFor(targetStudentId)
    if (!row?.comment?.trim()) {
      notify('当前学生还没有课评内容')
      return false
    }
    const saved = await runRemote('正在保存课评...', () => api.feedback.saveForStudent(activeTask.value.id, row.studentId, feedbackBodyFor(row)))
    if (!saved) return false
    const versionId = saved.currentVersionId || saved.confirmedVersionId || row.feedbackVersionId
    if (!versionId) {
      notify('当前课评暂无可确认版本，请刷新后重试')
      return false
    }
    const confirmed = await runRemote('正在确认课评...', () => api.feedback.confirm(saved.id || row.feedbackId, { versionId: String(versionId), version: saved.version || row.feedbackVersion || 0 }))
    if (!confirmed) return false
    await refreshRemoteLesson(activeTask.value.id)
    const student = students.find((item) => sameId(item.id, targetStudentId))
    notify(`${student?.name || row.studentName || '当前学生'}课评已确认`)
    return true
  }

  const remoteConfirmAll = async () => {
    const rows = attendingRows.value.filter((row) => row.comment?.trim())
    if (!rows.length) {
      notify('没有可确认的课评')
      return false
    }
    const result = await runRemote('正在批量保存并确认课评...', async () => {
      const saved = await api.feedback.saveBatch(activeTask.value.id, rows.map((row) => ({ studentId: String(row.studentId), ...feedbackBodyFor(row) })))
      const savedItems = Array.isArray(saved) ? saved : saved?.items || []
      const confirmations = savedItems.filter((item) => item?.id && (item.currentVersionId || item.confirmedVersionId)).map((item) => ({
        feedbackId: String(item.id),
        versionId: String(item.currentVersionId || item.confirmedVersionId),
        version: Number(item.version || 0)
      }))
      if (!confirmations.length) throw new Error('没有可确认的课评版本')
      return api.feedback.confirmBatch(activeTask.value.id, confirmations)
    }, '全班课评已确认')
    if (!result) return false
    await refreshRemoteLesson(activeTask.value.id)
    return true
  }

  const remoteSaveRecord = async (row) => {
    if (!row) return false
    const result = await runRemote('正在保存课堂记录...', () => api.feedback.saveForStudent(activeTask.value.id, row.studentId, feedbackBodyFor(row)))
    if (!result) return false
    await refreshRemoteLesson(activeTask.value.id)
    return true
  }

  const remoteShareDraftPayload = () => ({
    version: ensureLessonWorkspace(activeTask.value).sharePage.version || 0,
    lessonId: String(activeTask.value.id),
    showMaterials: displayConfig.value.showMaterials !== false,
    showHomework: homeworkIsAssigned(homework.value) && displayConfig.value.showHomework !== false,
    showHighlight: displayConfig.value.showHighlight !== false,
    showLessonType: displayConfig.value.showLessonType !== false,
    expiresAt: new Date(Date.now() + Math.max(1, Number(displayConfig.value.expiresInDays) || 30) * 24 * 60 * 60 * 1000).toISOString(),
    lesson: (() => {
      const lesson = clone(activeTask.value)
      ;['id', 'classId', 'teacherId', 'courseId', 'sourceBatchId'].forEach((key) => {
        if (lesson[key] !== null && lesson[key] !== undefined) lesson[key] = String(lesson[key])
      })
      return lesson
    })(),
    class: (() => {
      const klass = clone(activeClass.value)
      ;['id', 'classTypeId', 'teacherId', 'courseId'].forEach((key) => {
        if (klass[key] !== null && klass[key] !== undefined) klass[key] = String(klass[key])
      })
      klass.studentIds = (klass.studentIds || []).map(String)
      return klass
    })(),
    course: (() => {
      const course = clone(activeCourse.value)
      if (course.id !== null && course.id !== undefined) course.id = String(course.id)
      return course
    })(),
    // 仅保存展示草稿字段；受保护文件的 Blob URL 只存在于当前浏览器会话，不能写入服务端快照。
    studentDeliveries: sessionStudents.value.map((row) => ({
      studentId: String(row.studentId),
      attendance: row.attendance,
      record: row.record || '',
      comment: row.comment || '',
      confirmed: Boolean(row.confirmed),
      imageConfirmed: Boolean(row.imageConfirmed),
      highlight: Boolean(row.highlight),
      highlightNote: row.highlightNote || '',
      artworks: artworksForRow(row).map((artwork) => ({
        artworkId: String(artwork.artworkId),
        highlight: Boolean(artwork.highlight),
        highlightNote: artwork.highlightNote || ''
      }))
    })),
    students: students.map((student) => ({
      ...clone(student),
      id: String(student.id),
      classId: student.classId === null || student.classId === undefined ? null : String(student.classId),
      classIds: (student.classIds || []).map(String)
    })),
    materials: materials.value.map((asset) => ({
      id: asset.id,
      fileId: asset.fileId,
      type: asset.type,
      assetType: asset.assetType,
      title: asset.title,
      visible: asset.visible,
      sortOrder: asset.sortOrder
    })),
    homework: {
      ...clone(homework.value),
      taskMode: homeworkIsAssigned(homework.value) ? 'ASSIGNED' : 'NONE',
      visible: homeworkIsAssigned(homework.value) && displayConfig.value.showHomework !== false,
      externalLinkIds: (homework.value.externalLinkIds || []).map(String)
    },
    displayConfig: clone(displayConfig.value),
    school: clone(school),
    externalLinks: selectedExternalLinks.value.map((link) => ({
      ...clone(link),
      id: String(link.id),
      courseId: link.courseId === null || link.courseId === undefined ? null : String(link.courseId)
    }))
  })

  const remoteSaveShareDraft = async (reason = '调整展示内容') => {
    const lessonId = activeTask.value?.id
    if (!lessonId) return false
    const key = String(lessonId)
    const previous = shareDraftSaveChains.get(key) || Promise.resolve(true)
    const operation = previous.catch(() => false).then(async () => {
      // 用户已经切换到另一课次时，不要把当前课次的草稿保存到错误的工作区。
      if (!sameId(activeTask.value?.id, lessonId)) return false
      const task = activeTask.value
      const payload = remoteShareDraftPayload()
      const result = await runRemote(
        '正在保存家长展示草稿...',
        () => api.parent.saveDraft(lessonId, payload),
        '展示草稿已保存',
        () => refreshRemoteLesson(lessonId, { force: true })
      )
      if (!result) return false
      const workspace = ensureLessonWorkspace(task)
      const page = mapSharePage(result)
      workspace.sharePage = mergeSharePageForWorkspace(workspace, page)
      if (page.homework) {
        workspace.homework = {
          ...workspace.homework,
          ...page.homework,
          version: Number(page.homework.version ?? workspace.homework.version ?? 0)
        }
      }
      workspace.sharePage.draftSnapshot = payload
      addStatusLog('家长展示页', lessonId, '已发布', '草稿', reason)
      return true
    })
    shareDraftSaveChains.set(key, operation)
    try {
      return await operation
    } finally {
      if (shareDraftSaveChains.get(key) === operation) shareDraftSaveChains.delete(key)
    }
  }

  const remoteToggleHighlight = async (target) => {
    const artwork = artworkForTarget(target)
    if (!artwork?.artworkId || !activeTask.value?.id) return false
    const nextHighlight = !Boolean(artwork.highlight)
    const nextNote = nextHighlight
      ? (artwork.highlightNote || '作品表现突出，可作为本节课高光展示。')
      : ''
    const saved = await runRemote('正在保存作品高光...', () => api.assets.updateArtwork(artwork.artworkId, {
      highlight: nextHighlight,
      highlightNote: nextNote,
      version: artwork.artworkVersion
    }), nextHighlight ? '已标记高光作品' : '已取消高光标记')
    if (!saved) return false
    await refreshRemoteLesson(activeTask.value.id)
    return true
  }

  const remoteSaveArtworkHighlight = async (target) => {
    const artwork = artworkForTarget(target)
    if (!artwork?.artworkId || !activeTask.value?.id) return false
    const saved = await runRemote('正在保存高光说明...', () => api.assets.updateArtwork(artwork.artworkId, {
      highlight: Boolean(artwork.highlight),
      highlightNote: artwork.highlight ? String(artwork.highlightNote || '').trim() : '',
      version: artwork.artworkVersion
    }), '高光说明已保存')
    if (!saved) return false
    await refreshRemoteLesson(activeTask.value.id)
    return true
  }

  const remoteGenerateSharePages = async () => {
    const missing = attendingRows.value.filter((row) => !isDeliveryConfirmed(row))
    if (missing.length) {
      notify(`发布失败：还有 ${missing.length} 名学生的作品或课评未确认`)
      return false
    }
    const draftSaved = await remoteSaveShareDraft('发布前保存草稿')
    if (!draftSaved) return false
    const pageState = ensureLessonWorkspace(activeTask.value).sharePage
    const result = await runRemote(
      pageState.status === '已失效' ? '正在重新发布家长展示页...' : '正在发布家长展示页...',
      () => pageState.status === '已失效'
        ? api.parent.republish(pageState.id, { reason: '更新展示内容后重新发布', version: pageState.version }, createIdempotencyKey(`share-republish:${activeTask.value.id}`))
        : api.parent.publish(activeTask.value.id, { version: pageState.version || 0 }, createIdempotencyKey(`share-publish:${activeTask.value.id}`)),
      pageState.status === '已失效' ? '家长展示页已重新发布' : '家长展示页已发布'
    )
    if (!result) return false
    const workspace = ensureLessonWorkspace(activeTask.value)
    const page = mapSharePage(result.page || result)
    Object.assign(workspace.sharePage, mergeSharePageForWorkspace(workspace, page), { publishedSnapshot: page.publishedSnapshot || remoteShareDraftPayload() })
    workspace.studentDeliveries.forEach((row) => { row.shareReady = Boolean(page.accessLinks?.some((link) => sameId(link.studentId, row.studentId))) })
    await refreshRemoteLesson(activeTask.value.id)
    return true
  }

  const remoteRevokeSharePage = async (reason) => {
    const page = sharePage.value
    if (!page?.id) return false
    if (!reason?.trim()) {
      notify('请填写撤销原因')
      return false
    }
    const result = await runRemote('正在撤销家长展示页...', () => api.parent.revoke(page.id, { reason: reason.trim(), version: page.version }), '家长展示页已撤销')
    if (!result) return false
    Object.assign(sharePage.value, mapSharePage(result))
    return true
  }

  const remoteStudentShareUrlFor = (rowOrId) => {
    const studentId = rowOrId?.studentId || rowOrId
    const link = sharePage.value?.accessLinks?.find((item) => sameId(item.studentId, studentId))
    const token = link?.token || String(link?.url || '').match(/\/public\/share\/([^/?#]+)/)?.[1]
    if (token && typeof window !== 'undefined') return `${window.location.origin}/#/share/student/${activeTask.value.id}/${studentId}?token=${encodeURIComponent(token)}`
    const storedUrl = wecomTaskFor(activeTask.value?.id, studentId)?.shareUrl
    if (storedUrl) {
      if (typeof window === 'undefined') return storedUrl
      try {
        return new URL(storedUrl, window.location.origin).toString()
      } catch {
        return storedUrl
      }
    }
    return ''
  }

  const remoteFileNameFor = (row) => {
    const student = students.find((item) => sameId(item.id, row?.studentId))
    const studentName = student?.name || row?.studentName || '学生'
    return `${activeTask.value.date}-${activeClass.value.name}-${studentName}-${activeCourse.value.title}.jpg`
  }

  const remoteExportText = computed(() =>
    attendingRows.value
      .map((row, index) => {
        const student = students.find((item) => sameId(item.id, row.studentId))
        const link = remoteStudentShareUrlFor(row)
        return `${index + 1}. ${student?.name || row.studentName || '学生'}\n作品文件：${remoteFileNameFor(row)}\n展示页：${link || '待发布'}\n课评：${row.comment || '待生成'}`
      })
      .join('\n\n')
  )

  const remoteCopyExport = async () => {
    if (!remoteExportText.value) {
      notify('当前课次没有可复制的交付内容')
      return false
    }
    try {
      await navigator.clipboard.writeText(remoteExportText.value)
      copied.value = true
      notify('家长展示链接和文案已复制')
      setTimeout(() => { copied.value = false }, 1600)
      return true
    } catch {
      notify('复制失败，请手动选择内容复制')
      return false
    }
  }

  const remoteCopyStudentLink = async (row) => {
    const link = remoteStudentShareUrlFor(row)
    if (!link) {
      notify('当前学生还没有已发布的家长展示链接')
      return false
    }
    try { await navigator.clipboard.writeText(link); copiedStudentId.value = row.studentId } catch { /* 仅记录提示 */ }
    notify('家长展示链接已复制')
    return true
  }

  const remotePushParentTouch = async () => {
    if (sharePage.value?.status !== '已发布') {
      if (!(await remoteGenerateSharePages())) return false
    }
    const channel = wecomEnabled.value ? 'WECOM' : 'MANUAL'
    const result = await runRemote('正在创建家长触达任务...', () => api.parent.touchTasks(activeTask.value.id, {
      channel,
      sharePageVersion: sharePage.value.publishedVersion,
      studentIds: attendingRows.value.map((row) => String(row.studentId)),
      shareUrls: Object.fromEntries(attendingRows.value.map((row) => [String(row.studentId), remoteStudentShareUrlFor(row)]))
    }, createIdempotencyKey(`touch:${activeTask.value.id}:${sharePage.value.publishedVersion}`)), '家长触达任务已创建')
    if (!result) return false
    await Promise.all([
      refreshRemoteLesson(activeTask.value.id),
      invalidateResource('touch-tasks'),
      invalidateResource('workbench.summary')
    ])
    return true
  }

  const remoteManualCopyStudentLink = async (row) => {
    const task = wecomTaskFor(activeTask.value.id, row.studentId)
    if (!task) return remoteCopyStudentLink(row)
    const result = await runRemote('正在记录人工触达...', () => api.parent.fallbackManual(task.id, { reason: '复制链接人工发送', version: task.version, shareUrl: task.shareUrl }))
    if (!result) return false
    await Promise.all([
      refreshRemoteLesson(activeTask.value.id),
      invalidateResource('touch-tasks'),
      invalidateResource('workbench.summary')
    ])
    return remoteCopyStudentLink(row)
  }

  const remoteManualCopyWecomTask = async (task) => {
    if (!task?.id) return false
    const result = await runRemote('正在记录人工触达...', () => api.parent.fallbackManual(task.id, {
      reason: '复制链接人工发送',
      version: task.version,
      shareUrl: task.shareUrl
    }))
    if (!result) return false
    await Promise.all([
      refreshRemoteLesson(task.lessonId),
      invalidateResource('touch-tasks'),
      invalidateResource('workbench.summary')
    ])
    return remoteCopyStudentLink({ studentId: task.studentId })
  }

  const remoteMarkWecomSendTask = async (task, status, reason = '') => {
    if (!task?.id) return false
    const action = status === '已发送' ? api.parent.markSent : status === '人工触达' ? api.parent.fallbackManual : status === '已取消' ? api.parent.cancelTouch : null
    if (!action) return false
    const body = status === '已发送' ? { version: task.version } : { reason: reason.trim() || '人工操作', version: task.version }
    const result = await runRemote('正在更新触达任务...', () => action(task.id, body))
    if (!result) return false
    await Promise.all([
      refreshRemoteLesson(task.lessonId),
      invalidateResource('touch-tasks'),
      invalidateResource('workbench.summary')
    ])
    return true
  }

  const remoteRetryWecomSendTask = async (task) => {
    if (!task?.id) return false
    const result = await runRemote('正在重试触达任务...', () => api.parent.retryTouch(task.id, { version: task.version }), '触达任务已重新提交')
    if (!result) return false
    await Promise.all([
      refreshRemoteLesson(task.lessonId),
      invalidateResource('touch-tasks'),
      invalidateResource('workbench.summary')
    ])
    return true
  }

  const remoteRetryCloudArchiveTodo = async (job) => {
    if (!job?.id) return false
    const result = await runRemote('正在重试网盘同步...', () => api.m5.retryCloud(
      job.id,
      { version: job.version },
      createIdempotencyKey(`cloud-archive-retry:${job.id}`)
    ), '网盘同步已重新提交')
    if (!result) return false
    await Promise.all([
      invalidateResource('cloud-archive-todos'),
      invalidateResource('workbench.summary'),
      job.lessonId ? invalidateResource('lesson.workspace', { lessonId: job.lessonId }) : Promise.resolve()
    ])
    return true
  }

  const remoteGenerateWheatTraceTask = async () => {
    if (!activeTask.value?.id) return false
    const result = await runRemote('正在创建小麦消课待办...', () => api.todo.createWheat(activeTask.value.id, createIdempotencyKey(`wheat:${activeTask.value.id}`)), '小麦消课待办已创建')
    if (!result) return false
    await Promise.all([
      invalidateResource('lesson.workspace', { lessonId: activeTask.value.id }),
      invalidateResource('wheat-traces'),
      invalidateResource('workbench.summary')
    ])
    return true
  }

  const remoteMarkTrace = async (trace, status, reason = '') => {
    if (!trace?.id) return false
    const command = toApiWheatCommand(status)
    const result = await runRemote('正在更新小麦消课状态...', () => api.todo.transitionWheat(trace.id, {
      command, reason: reason.trim() || undefined, version: trace.version, exceptionType: status === '异常' ? 'OTHER' : undefined
    }))
    if (!result) return false
    await Promise.all([
      invalidateResource('lesson.workspace', { lessonId: trace.lessonId }),
      invalidateResource('wheat-traces'),
      invalidateResource('workbench.summary')
    ])
    return true
  }

  const remoteCompleteTodo = async (todo) => {
    if (!todo?.id) return false
    const result = await runRemote('正在完成待办...', () => api.todo.complete(todo.id, { version: todo.version }))
    if (!result) return false
    const mapped = mapTodo(result)
    const index = todos.findIndex((item) => sameId(item.id, todo.id))
    if (index >= 0) todos.splice(index, 1, mapped)
    else todos.push(mapped)
    await Promise.all([
      invalidateResource('todos'),
      invalidateResource('workbench.summary'),
      todo.lessonId ? invalidateResource('lesson.workspace', { lessonId: todo.lessonId }) : Promise.resolve()
    ])
    return true
  }

  const remoteCancelTodo = async (todo, reason = '') => {
    if (!todo?.id || !reason.trim()) {
      notify('取消待办必须填写原因')
      return false
    }
    const result = await runRemote('正在取消待办...', () => api.todo.cancel(todo.id, { reason: reason.trim(), version: todo.version }))
    if (!result) return false
    const mapped = mapTodo(result)
    const index = todos.findIndex((item) => sameId(item.id, todo.id))
    if (index >= 0) todos.splice(index, 1, mapped)
    else todos.push(mapped)
    await Promise.all([
      invalidateResource('todos'),
      invalidateResource('workbench.summary'),
      todo.lessonId ? invalidateResource('lesson.workspace', { lessonId: todo.lessonId }) : Promise.resolve()
    ])
    return true
  }

  const remotePushArchiveItem = async (key) => {
    if (key !== 'studentCloudArchive') return false
    const current = activeWorkspace.value.cloudBatch
    if (current?.batchId && ['FAILED', 'PARTIAL_FAILED'].includes(String(current.status).toUpperCase())) {
      const retried = await runRemote('正在重试百度网盘归档批次...', () => api.m5.retryCloudBatch(current.batchId,
        createIdempotencyKey(`cloud-archive-batch-retry:${current.batchId}`)), '百度网盘归档已重新提交')
      if (!retried) return false
      applyCloudBatchProgress(activeTask.value.id, retried)
    }
    const result = await ensureCloudArchiveBatch(activeTask.value.id, { waitForCompletion: true })
    if (!result) return false
    selectCloudArchiveProvider(result.providerConfigId)
    if (['FAILED', 'PARTIAL_FAILED'].includes(String(result.status).toUpperCase())) return false
    await Promise.all([
      refreshRemoteLesson(activeTask.value.id),
      invalidateResource('cloud-archive-todos'),
      invalidateResource('workbench.summary')
    ])
    return true
  }

  const teacherEffectSourceIds = (effect) => (effect?.sources || [])
    .map((source) => source?.sourceAssetId)
    .filter((sourceId) => sourceId !== null && sourceId !== undefined && sourceId !== '')
    .map((sourceId) => String(sourceId))

  const recoverTeacherEffectGeneration = async (error, lessonId) => {
    if (error?.code !== 'INVALID_STATE_TRANSITION' || !String(error?.message || '').includes('课效图生成命令仍在处理中')) {
      return false
    }
    const workspace = await refreshRemoteLesson(lessonId, { force: true })
    const effect = workspace?.teacherEffect || activeWorkspace.value.teacherEffect
    if (effect?.status !== 'GENERATING' || !effect?.jobId) {
      if (effect?.status === 'PENDING' && !effect?.jobId) {
        return { handled: true, value: false, message: '没有找到正在运行的课效图任务，请重新点击“保存并生成”' }
      }
      return false
    }
    await waitForJobs([effect.jobId], lessonId)
    return { handled: true, value: true, message: '课效图生成已在处理中，页面状态已同步' }
  }

  const remoteArchiveTeacherEffectImage = async (config = null, renderedImage = null) => {
    const lesson = activeTask.value
    if (!lesson?.id) return false
    if (!renderedImage?.file) {
      notify('课效图预览尚未准备好，请稍候重试')
      return false
    }

    let effect = activeWorkspace.value.teacherEffect
    if (!effect?.id) {
      try {
        effect = await api.m5.teacherEffect(lesson.id)
      } catch (error) {
        if (error?.status !== 404 && error?.code !== 'RESOURCE_NOT_FOUND') {
          notify(remoteErrorMessage(error, '老师课效图加载失败'))
          return false
        }
      }
    }

    const configuredSourceIds = Array.isArray(config?.sourceAssetIds)
      ? [...new Set(config.sourceAssetIds.filter((sourceId) => sourceId !== null && sourceId !== undefined && sourceId !== '').map((sourceId) => String(sourceId)))]
      : teacherEffectSourceIds(effect)
    if (!configuredSourceIds.length) {
      notify('请先在课效图配置中选择至少一张已确认图片')
      return false
    }

    const hasDraftConfig = Boolean(config) || !effect?.id
    let draft = effect
    if (hasDraftConfig) {
      draft = await runRemote('正在保存课效图草稿...', () => api.m5.saveTeacherEffectDraft(lesson.id, {
        sourceAssetIds: configuredSourceIds,
        title: String(config?.title || effect?.title || defaultTeacherEffectTitle(lesson)).trim(),
        width: Number(config?.width || effect?.width || 1080),
        imageGap: Number(config?.imageGap ?? effect?.imageGap ?? 24),
        layoutConfig: {
          ...(config?.layoutConfig || effect?.layoutConfig || {}),
          renderMode: 'CLIENT_CANVAS',
          rendererVersion: renderedImage.rendererVersion || 'teacher-effect-canvas-v2'
        },
        version: effect?.id ? effect.version : 0
      }))
      if (!draft?.id) return false
    }

    const uploaded = await runRemote('正在上传老师课效长图...', () => uploadFile(
      renderedImage.file,
      `teacher-effect-${lesson.id}`,
      { idempotencyKey: createIdempotencyKey(`teacher-effect-file:${lesson.id}:${draft.version}`) }
    ))
    if (!uploaded?.id) return false
    const uploadedFileId = String(uploaded.id)

    const committed = await runRemote(
      '正在保存老师课效长图版本...',
      () => api.m5.commitClientRenderedTeacherEffect(lesson.id, {
        version: draft.version,
        fileId: uploadedFileId,
        outputWidth: renderedImage.width,
        outputHeight: renderedImage.height,
        outputSizeBytes: uploaded.sizeBytes || renderedImage.file.size,
        sha256: uploaded.sha256,
        rendererVersion: renderedImage.rendererVersion || 'teacher-effect-canvas-v2'
      }, createIdempotencyKey(`teacher-effect-render:${lesson.id}:${draft.version}`)),
      '老师课效长图已生成并保存'
    )
    if (!committed) return false
    await refreshRemoteLesson(lesson.id, { force: true })
    return true
  }

  const remoteConfirmTeacherEffect = async () => {
    const effect = activeWorkspace.value.teacherEffect
    if (!effect?.id) {
      notify('请先生成老师课效图')
      return false
    }
    const result = await runRemote('正在确认老师课效图...', () => api.m5.confirmTeacherEffect(effect.id, { version: effect.version }), '老师课效图已确认')
    if (!result) return false
    await refreshRemoteLesson(activeTask.value.id)
    return true
  }

  const remoteRetryTeacherEffect = async () => {
    const effect = activeWorkspace.value.teacherEffect
    if (!effect?.id) {
      notify('请先配置课效图素材')
      return false
    }
    const result = await runRemote('正在重试老师课效图...', () => api.m5.retryTeacherEffect(effect.id, { version: effect.version }, createIdempotencyKey(`teacher-effect-retry:${effect.id}`)), '老师课效图已重新提交')
    if (!result) return false
    await refreshRemoteLesson(activeTask.value.id)
    return true
  }

  const remoteSkipTeacherEffect = async (reason = '') => {
    const effect = activeWorkspace.value.teacherEffect
    if (!effect?.id || !reason.trim()) {
      notify('跳过老师课效图必须填写原因')
      return false
    }
    const result = await runRemote('正在跳过老师课效图...', () => api.m5.skipTeacherEffect(effect.id, { reason: reason.trim(), version: effect.version }), '老师课效图已跳过')
    if (!result) return false
    await refreshRemoteLesson(activeTask.value.id)
    return true
  }

  const remoteArchiveAll = async () => {
    const task = activeTask.value
    if (!task?.id) return false

    if (!(await remoteSaveShareDraft('归档前保存展示草稿'))) return false
    const lessonTouchTasks = wecomSendTasks.filter((item) => sameId(item.lessonId, task.id))
    const touchReady = attendingRows.value.every((row) => lessonTouchTasks.some((item) =>
      sameId(item.studentId, row.studentId) && ['待老师确认发送', '已发送', '人工触达', '发送失败', '已跳过'].includes(item.status)
    ))
    if (!touchReady && !(await remotePushParentTouch())) return false
    const lessonWheat = wheatTraces.find((item) => sameId(item.lessonId, task.id))
    if (!lessonWheat?.id && !(await remoteGenerateWheatTraceTask())) return false

    const cloudBatch = await ensureCloudArchiveBatch(task.id, { waitForCompletion: false })
    if (!cloudBatch) return false
    selectCloudArchiveProvider(cloudBatch.providerConfigId)
    if (cloudBatch?.required && !cloudBatchTerminal(cloudBatch.status)) {
      const watcher = watchCloudArchiveBatch(cloudBatch.batchId || cloudBatch.id, task.id)
      const completed = await watcher.promise
      if (!completed || !['SUCCEEDED'].includes(String(completed.status).toUpperCase())) {
        notify(completed?.failureSummary || '必需的百度网盘归档尚未完成')
        return false
      }
    }

    const completion = await runRemote('正在检查归档前置条件...', () => api.lessons.completion(task.id))
    if (!completion) return false
    if (!completion.passed) {
      const messages = (completion?.items || []).filter((item) => item.blocking && !item.passed).map((item) => item.message)
      notify(messages.join('、') || '后端完成检查未通过')
      return false
    }
    const result = await runRemote('正在完成本节归档交付...', () => api.lessons.archiveCommit(task.id, { version: completion.lessonVersion ?? task.version }, createIdempotencyKey(`archive-commit:${task.id}`)), '本节课已完成归档交付')
    if (!result) return false
    await Promise.all([
      invalidateResource('lesson.workspace', { lessonId: task.id }),
      invalidateResource('archive.records'),
      invalidateResource('lessons.today'),
      invalidateResource('inbox-lessons'),
      invalidateResource('pending-reviews'),
      invalidateResource('touch-tasks'),
      invalidateResource('cloud-archive-todos'),
      invalidateResource('workbench.summary')
    ])
    return true
  }

  const apiStudentStatus = (value) => ({ 在读: 'ACTIVE', 停课: 'SUSPENDED', 请假: 'LEAVE', 退费: 'REFUNDED' }[value] || value || 'ACTIVE')
  const apiEnabledStatus = (value) => ({ 启用: 'ENABLED', 停用: 'DISABLED' }[value] || value || 'ENABLED')
  const apiClassStatus = (value) => ({ 筹备中: 'PREPARING', 开班中: 'ACTIVE', 停课: 'SUSPENDED', 结课: 'CLOSED' }[value] || value || 'PREPARING')
  const apiExtraTaskStatus = (value) => ({
    待发布: 'DRAFT',
    已发布: 'PUBLISHED',
    进行中: 'IN_PROGRESS',
    待归档: 'PENDING_ARCHIVE',
    已归档: 'ARCHIVED',
    已取消: 'CANCELED'
  }[value] || value || 'DRAFT')

  const remoteAddLesson = async (payload) => {
    const idempotencyKey = payload.idempotencyKey || createIdempotencyKey('lesson-create')
    const result = await runRemote('正在创建课次...', () => api.lessons.create({
      temporary: Boolean(payload.temporary),
      classId: payload.temporary ? undefined : (payload.classId ? String(payload.classId) : undefined),
      teacherId: payload.teacherId ? String(payload.teacherId) : undefined,
      courseId: payload.courseId ? String(payload.courseId) : undefined,
      dateValue: payload.dateValue,
      startTime: String(payload.startTime || '').slice(0, 5),
      endTime: String(payload.endTime || '').slice(0, 5),
      lessonType: toApiLessonType(payload.lessonType || '其他'),
      topic: payload.topic?.trim() || undefined,
      studentIds: payload.temporary ? (payload.studentIds || []).map((id) => String(id)) : undefined
    }, idempotencyKey), '课次已创建')
    if (!result) return null
    await Promise.all([
      invalidateResource('lessons.today'),
      invalidateResource('lessons.schedule'),
      invalidateResource('inbox-lessons'),
      invalidateResource('workbench.summary')
    ])
    if (result.classId) {
      try {
        const classValue = mapClass(await api.master.class(result.classId))
        const classIndex = classes.findIndex((item) => sameId(item.id, classValue.id))
        if (classIndex >= 0) classes.splice(classIndex, 1, classValue)
        else classes.unshift(classValue)
      } catch {
        // The lesson itself is already created; the next page refresh will
        // repopulate the generated temporary class.
      }
    }
    const lesson = mapLesson(result)
    // The cache invalidations above refresh today's lessons before this
    // response is merged. The newly created lesson may therefore already be
    // present in tasks; upsert it instead of blindly inserting a second row.
    const existingTaskIndex = tasks.findIndex((item) => sameId(item.id, lesson.id))
    if (existingTaskIndex >= 0) {
      tasks.splice(existingTaskIndex, 1, { ...tasks[existingTaskIndex], ...lesson })
    } else {
      tasks.unshift(lesson)
    }
    activeTaskId.value = lesson.id
    await refreshRemoteLesson(lesson.id)
    return lesson
  }

  const syncStudentClassMembership = async (studentId, targetClassId) => {
    const affectedClasses = classes.filter((klass) =>
      klass.studentIds?.some((memberId) => sameId(memberId, studentId)) || sameId(klass.id, targetClassId)
    )
    for (const klass of affectedClasses) {
      const shouldContain = Boolean(targetClassId) && sameId(klass.id, targetClassId)
      const nextStudentIds = [...new Set([
        ...(klass.studentIds || []).filter((memberId) => shouldContain || !sameId(memberId, studentId)),
        ...(shouldContain ? [studentId] : [])
      ].map(String))]
      const previousStudentIds = (klass.studentIds || []).map(String)
      if (nextStudentIds.length === previousStudentIds.length && nextStudentIds.every((memberId) => previousStudentIds.includes(memberId))) continue
      const saved = await api.master.updateClass(klass.id, {
        classTypeId: klass.classTypeId ? String(klass.classTypeId) : undefined,
        teacherId: klass.teacherId ? String(klass.teacherId) : undefined,
        courseId: klass.courseId ? String(klass.courseId) : undefined,
        name: klass.name,
        status: apiClassStatus(klass.status),
        studentIds: nextStudentIds,
        version: klass.version,
        scheduleSlots: (klass.scheduleSlots || []).map((slot) => ({
          id: slot.id ? String(slot.id) : undefined, weekday: Number(slot.weekday), startTime: slot.startTime || undefined,
          endTime: slot.endTime || undefined
        }))
      })
      const mapped = mapClass(saved)
      const index = classes.findIndex((item) => sameId(item.id, klass.id))
      if (index >= 0) classes.splice(index, 1, mapped)
    }
    return classes
  }

  const remoteAddStudent = async (payload) => {
    const result = await runRemote('正在创建学生...', async () => {
      const saved = await api.master.createStudent({
        externalId: payload.externalId || undefined, name: payload.name, nickname: payload.nickname || undefined, age: Number(payload.age) || undefined,
        parentName: payload.parent || payload.parentName || undefined, parentPhone: payload.phone || payload.parentPhone || undefined,
        status: apiStudentStatus(payload.status), note: payload.note || undefined
      })
      const student = mapStudent(saved)
      if (payload.classId !== undefined && payload.classId !== '') {
        await syncStudentClassMembership(student.id, payload.classId)
        const assigned = classes.filter((klass) => klass.studentIds?.some((memberId) => sameId(memberId, student.id))).map((klass) => klass.id)
        student.classIds = assigned
        student.classId = assigned[0] || null
      }
      return student
    }, '学生已创建', () => Promise.all([invalidateResource('students'), invalidateResource('classes')]))
    if (!result) return null
    students.push(result)
    return result
  }

  const remoteUpdateStudent = async (studentId, payload) => {
    const current = students.find((item) => sameId(item.id, studentId))
    if (!current) return null
    const result = await runRemote('正在保存学生...', async () => {
      const saved = await api.master.updateStudent(studentId, {
        externalId: payload.externalId || undefined, name: payload.name, nickname: payload.nickname || undefined, age: Number(payload.age) || undefined,
        parentName: payload.parent || payload.parentName || undefined, parentPhone: payload.phone || payload.parentPhone || undefined,
        status: apiStudentStatus(payload.status), note: payload.note || undefined, version: current.version
      })
      const student = mapStudent(saved)
      if (Object.prototype.hasOwnProperty.call(payload, 'classId')) {
        await syncStudentClassMembership(studentId, payload.classId || null)
        const assigned = classes.filter((klass) => klass.studentIds?.some((memberId) => sameId(memberId, studentId))).map((klass) => klass.id)
        student.classIds = assigned
        student.classId = assigned[0] || null
      }
      return student
    }, '学生信息已保存', () => Promise.all([invalidateResource('students'), invalidateResource('classes')]))
    if (!result) return null
    const index = students.findIndex((item) => sameId(item.id, studentId))
    students.splice(index, 1, result)
    return result
  }

  const studentProfileFor = (studentId) => {
    const entry = studentProfiles[String(studentId)]
    if (!entry) return null
    return {
      ...entry,
      valueMap: { ...(entry.valueMap || {}) }
    }
  }

  const studentProfileFieldFor = (fieldKey) => {
    const apiKey = profileApiKey(fieldKey)
    return studentProfileFields.find((field) => field.fieldKey === apiKey || field.fieldKey === fieldKey) || null
  }

  const remoteLoadStudentProfile = async (studentId) => {
    if (!studentId) return null
    try {
      const result = await api.m6.profile(studentId)
      const fields = (result?.fields || []).map(mapProfileField)
      const values = (result?.values || []).map(mapProfileValue)
      const mergedFields = [...studentProfileFields]
      fields.forEach((field) => {
        const index = mergedFields.findIndex((item) => sameId(item.id, field.id))
        if (index >= 0) mergedFields.splice(index, 1, field)
        else mergedFields.push(field)
      })
      mergedFields.sort((left, right) => Number(left.displayOrder || 0) - Number(right.displayOrder || 0))
      replaceReactive(studentProfileFields, mergedFields)
      studentProfiles[String(studentId)] = {
        studentId: studentId,
        fields,
        values,
        valueMap: Object.fromEntries(values.map((value) => [profileUiKey(value.fieldKey), value.value ?? '']))
      }
      return studentProfiles[String(studentId)]
    } catch (error) {
      notify(remoteErrorMessage(error, '学生 CRM 档案加载失败'))
      return null
    }
  }

  const remoteLoadStudentProfileAudits = async (studentId, params = {}) => {
    if (!studentId) return []
    try {
      const result = await api.m6.profileAudits(studentId, params)
      const rows = (result?.items || []).map(mapProfileAudit)
      studentProfileAudits[String(studentId)] = { ...result, items: rows }
      return rows
    } catch (error) {
      notify(remoteErrorMessage(error, '学生 CRM 档案审计加载失败'))
      return []
    }
  }

  const remoteSaveStudentProfile = async (studentId, payload = {}) => {
    if (!studentId) return false
    let entry = studentProfiles[String(studentId)]
    if (!entry) entry = await remoteLoadStudentProfile(studentId)
    const fields = (entry?.fields?.length ? entry.fields : studentProfileFields).filter((field) => field.id)
    if (!fields.length) {
      notify('当前账号暂无可保存的 CRM 档案字段')
      return true
    }
    const existingValues = new Map((entry?.values || []).map((value) => [String(value.fieldId), value]))
    const requests = fields.map((field) => {
      const uiKey = profileUiKey(field.fieldKey)
      const rawValue = Object.prototype.hasOwnProperty.call(payload, uiKey) ? payload[uiKey] : payload[field.fieldKey]
      const current = existingValues.get(String(field.id))
      return {
        fieldId: String(field.id),
        value: rawValue === undefined || rawValue === null || String(rawValue).trim() === '' ? null : String(rawValue).trim(),
        ...(current ? { version: String(current.version) } : {})
      }
    })
    processingAction.value = '正在保存学生 CRM 档案...'
    try {
      await api.m6.saveProfileValues(studentId, requests)
      await remoteLoadStudentProfile(studentId)
      notify('学生 CRM 档案已保存')
      return true
    } catch (error) {
      notify(remoteErrorMessage(error, '学生 CRM 档案保存失败'))
      return false
    } finally {
      processingAction.value = ''
    }
  }

  const remoteLoadCommunicationRecords = async (studentId) => {
    try {
      const result = await api.m6.communications(studentId)
      const rows = result?.items || result || []
      replaceReactive(communicationRecords, [...communicationRecords.filter((item) => !sameId(item.studentId, studentId)), ...rows.map((item) => ({
        ...item,
        id: fromApiId(item.id),
        studentId: fromApiId(item.studentId),
        recordedBy: fromApiId(item.recordedBy),
        createdBy: fromApiId(item.createdBy),
        updatedBy: fromApiId(item.updatedBy),
        recordedAt: displayDateTime(item.recordedAt),
        version: Number(item.version || 0)
      }))])
      return rows
    } catch (error) {
      notify(remoteErrorMessage(error, '沟通记录加载失败'))
      return []
    }
  }

  const remoteAddCommunicationRecord = async (payload) => {
    const result = await runRemote('正在新增沟通记录...', () => api.m6.createCommunication(payload.studentId, {
      contactPerson: payload.contactPerson || undefined, contactRole: payload.contactRole || undefined, contactMethod: payload.contactMethod,
      content: payload.content, followUpAction: payload.followUpAction || undefined, recordedAt: payload.recordedAt ? new Date(payload.recordedAt).toISOString() : undefined
    }), '沟通记录已新增', () => remoteLoadCommunicationRecords(payload.studentId))
    if (!result) return null
    await remoteLoadCommunicationRecords(payload.studentId)
    return result
  }

  const remoteUpdateCommunicationRecord = async (recordId, payload) => {
    const current = communicationRecords.find((item) => sameId(item.id, recordId))
    const result = await runRemote('正在保存沟通记录...', () => api.m6.updateCommunication(recordId, {
      contactPerson: payload.contactPerson || undefined, contactRole: payload.contactRole || undefined, contactMethod: payload.contactMethod,
      content: payload.content, followUpAction: payload.followUpAction || undefined, recordedAt: payload.recordedAt ? new Date(payload.recordedAt).toISOString() : undefined,
      version: current?.version || 0
    }), '沟通记录已保存', () => remoteLoadCommunicationRecords(payload.studentId || current?.studentId))
    if (!result) return null
    await remoteLoadCommunicationRecords(payload.studentId || current?.studentId)
    return result
  }

  const remoteDeleteCommunicationRecord = async (recordId) => {
    const current = communicationRecords.find((item) => sameId(item.id, recordId))
    if (!current) return null
    const success = await runRemoteVoid('正在删除沟通记录...', () => api.m6.deleteCommunication(recordId, current.version), '沟通记录已删除', () => remoteLoadCommunicationRecords(current.studentId))
    if (!success) return null
    await remoteLoadCommunicationRecords(current.studentId)
    return current
  }

  const remoteAddClass = async (payload) => {
    const result = await runRemote('正在创建班级...', () => api.master.createClass({
      classTypeId: payload.classTypeId ? String(payload.classTypeId) : undefined, teacherId: payload.teacherId ? String(payload.teacherId) : undefined,
      courseId: payload.courseId ? String(payload.courseId) : undefined, name: payload.name,
      status: apiClassStatus(payload.status), studentIds: (payload.studentIds || []).map(String),
      scheduleSlots: (payload.scheduleSlots || []).map((slot) => ({
        id: slot.id ? String(slot.id) : undefined, weekday: Number(slot.weekday), startTime: slot.startTime || undefined,
        endTime: slot.endTime || undefined
      }))
    }), '班级已创建', () => invalidateResource('classes'))
    if (!result) return null
    const klass = mapClass(result)
    classes.push(klass)
    return klass
  }

  const remoteUpdateClass = async (classId, payload) => {
    const current = classes.find((item) => sameId(item.id, classId))
    const result = await runRemote('正在保存班级...', () => api.master.updateClass(classId, {
      classTypeId: payload.classTypeId ? String(payload.classTypeId) : undefined, teacherId: payload.teacherId ? String(payload.teacherId) : undefined,
      courseId: payload.courseId ? String(payload.courseId) : undefined, name: payload.name,
      status: apiClassStatus(payload.status), studentIds: (payload.studentIds || []).map(String), version: current?.version || 0,
      scheduleSlots: (payload.scheduleSlots || []).map((slot) => ({
        id: slot.id ? String(slot.id) : undefined, weekday: Number(slot.weekday), startTime: slot.startTime || undefined,
        endTime: slot.endTime || undefined
      }))
    }), '班级信息已保存', () => invalidateResource('classes'))
    if (!result) return null
    const klass = mapClass(result)
    const index = classes.findIndex((item) => sameId(item.id, classId))
    classes.splice(index, 1, klass)
    return klass
  }

  const previewLessonGeneration = async (classId, payload) => runRemote('正在预览固定课次...',
    () => api.master.previewLessonGeneration(classId, {
      dateFrom: payload.dateFrom, dateTo: payload.dateTo, lessonType: payload.lessonType || 'PAID'
    }))

  const generateLessonGeneration = async (classId, payload) => {
    const result = await runRemote('正在生成固定课次...', () => api.master.generateLessonGeneration(classId, {
      dateFrom: payload.dateFrom, dateTo: payload.dateTo, lessonType: payload.lessonType || 'PAID'
    }, createIdempotencyKey(`class-lesson-generation:${classId}:${payload.dateFrom}:${payload.dateTo}:${payload.lessonType || 'PAID'}`)), '固定课次已生成')
    if (!result) return null
    await Promise.all([
      invalidateResource('lessons.today'),
      invalidateResource('lessons.schedule'),
      invalidateResource('inbox-lessons'),
      invalidateResource('workbench.summary'),
      invalidateResource('todos'),
      invalidateResource('classes')
    ])
    return result
  }

  const remoteAddCourse = async (payload) => {
    const result = await runRemote('正在创建课程...', () => api.master.createCourse({ title: payload.title, ageRange: payload.age || payload.ageRange || '', teachingGoal: payload.goal || payload.teachingGoal || '', materials: payload.materials || '', referenceText: payload.reference || payload.referenceText || '' }), '课程已创建', () => invalidateResource('courses'))
    if (!result) return null
    const course = mapCourse(result)
    courses.push(course)
    return course
  }

  const remoteUpdateCourse = async (courseId, payload) => {
    const current = courses.find((item) => sameId(item.id, courseId))
    const result = await runRemote('正在保存课程...', () => api.master.updateCourse(courseId, {
      title: payload.title, ageRange: payload.age || payload.ageRange || '', teachingGoal: payload.goal || payload.teachingGoal || '', materials: payload.materials || '', referenceText: payload.reference || payload.referenceText || '', status: apiEnabledStatus(payload.status), version: current?.version || 0
    }), '课程信息已保存', () => invalidateResource('courses'))
    if (!result) return null
    const course = mapCourse(result)
    const index = courses.findIndex((item) => sameId(item.id, courseId))
    courses.splice(index, 1, course)
    return course
  }

  const remoteAddExternalLink = async (payload) => {
    const courseId = payload.courseId !== undefined ? payload.courseId : payload.courseIds?.[0]
    const result = await runRemote('正在创建外部课程链接...', () => api.master.createExternalLink({ courseId: courseId ? String(courseId) : undefined, title: payload.title, url: payload.url, note: payload.note || undefined }), '外部课程链接已创建', () => invalidateResource('externalLinks'))
    if (!result) return null
    const link = mapExternalLink(result)
    externalLinks.push(link)
    return link
  }

  const remoteUpdateExternalLink = async (linkId, payload) => {
    const current = externalLinks.find((item) => sameId(item.id, linkId))
      || directoryPages.externalLinks.items.find((item) => sameId(item.id, linkId))
    const courseId = payload.courseId !== undefined ? payload.courseId : payload.courseIds?.[0]
    const result = await runRemote('正在保存外部课程链接...', () => api.master.updateExternalLink(linkId, {
      courseId: courseId ? String(courseId) : undefined, title: payload.title, url: payload.url, note: payload.note || undefined, status: apiEnabledStatus(payload.status), version: current?.version || 0
    }), '外部课程链接已保存', () => invalidateResource('externalLinks'))
    if (!result) return null
    const link = mapExternalLink(result)
    const index = externalLinks.findIndex((item) => sameId(item.id, linkId))
    if (index >= 0) externalLinks.splice(index, 1, link)
    const directoryIndex = directoryPages.externalLinks.items.findIndex((item) => sameId(item.id, linkId))
    if (directoryIndex >= 0) directoryPages.externalLinks.items.splice(directoryIndex, 1, link)
    return link
  }

  const remoteAddTeacher = async (payload) => {
    const result = await runRemote('正在创建老师资料...', () => api.master.createTeacher({ name: payload.name, phone: payload.phone || undefined, title: payload.role || '老师', note: payload.note || '由系统设置创建', status: payload.status === '停用' ? 'DISABLED' : 'ENABLED' }), '老师资料已创建', () => invalidateResource('teachers'))
    if (!result) return null
    const teacher = mapTeacher(result)
    const index = teachers.findIndex((item) => sameId(item.id, teacher.id))
    if (index >= 0) teachers.splice(index, 1, teacher)
    else teachers.push(teacher)
    return teacher
  }

  const remoteUpdateTeacher = async (teacherId, payload) => {
    const current = teachers.find((item) => sameId(item.id, teacherId))
    const result = await runRemote('正在保存老师资料...', () => api.master.updateTeacher(teacherId, { name: payload.name, phone: payload.phone || undefined, title: payload.role || payload.title || '老师', note: payload.note || '', status: payload.status === '停用' ? 'DISABLED' : 'ENABLED', version: current?.version || 0 }), '老师资料已保存', () => invalidateResource('teachers'))
    if (!result) return null
    const teacher = mapTeacher(result)
    const index = teachers.findIndex((item) => sameId(item.id, teacherId))
    teachers.splice(index, 1, teacher)
    return teacher
  }

  const remoteBindTeacherAccount = async (teacherId, userId, version) => {
    const current = teachers.find((item) => sameId(item.id, teacherId))
    const result = await runRemote('正在保存老师账号关联...', () => api.master.bindTeacherAccount(teacherId, {
      userId: userId === null || userId === undefined || userId === '' ? null : String(userId),
      version: Number(version ?? current?.version ?? 0)
    }), '老师账号关联已保存', () => loadMasterData('teachers', { archiveState: masterArchiveState.teachers, force: true }))
    if (!result) return null
    const teacher = mapTeacher(result)
    const index = teachers.findIndex((item) => sameId(item.id, teacherId))
    if (index >= 0) teachers.splice(index, 1, teacher)
    if (sameId(currentTeacherProfile.value?.id, teacherId)) currentTeacherProfile.value = teacher
    return teacher
  }

  const remoteSaveTeacherSourceMapping = async (payload = {}) => {
    const sourceName = String(payload.sourceName || '').trim()
    const current = teacherSourceMappings.find((mapping) =>
      String(mapping.sourceType || '') === String(payload.sourceType || '') &&
      String(mapping.sourceName || '').replace(/\s+/g, '').toLowerCase() === sourceName.replace(/\s+/g, '').toLowerCase()
    )
    const result = await runRemote('正在保存老师来源映射...', () => api.master.saveTeacherSourceMapping({
      sourceType: payload.sourceType || 'WHEAT_EXCEL',
      sourceName,
      teacherId: String(payload.teacherId),
      version: Number(payload.version ?? current?.version ?? 0)
    }), '老师来源映射已保存')
    if (!result) return null
    await loadTeacherSourceMappings()
    return result
  }

  const masterArchiveApi = {
    teachers: { archive: api.master.archiveTeacher, restore: api.master.restoreTeacher },
    students: { archive: api.master.archiveStudent, restore: api.master.restoreStudent },
    classes: { archive: api.master.archiveClass, restore: api.master.restoreClass },
    courses: { archive: api.master.archiveCourse, restore: api.master.restoreCourse }
  }

  const remoteArchiveMasterData = async (entity, recordId, reason = '') => {
    const record = masterCollectionFor(entity)?.find((item) => sameId(item.id, recordId))
    const endpoint = masterArchiveApi[entity]?.archive
    if (!record || !endpoint) return null
    const result = await runRemote(`正在归档${entity === 'teachers' ? '老师' : entity === 'students' ? '学生' : entity === 'classes' ? '班级' : '课程'}...`,
      () => endpoint(recordId, { version: Number(record.version || 0), reason: String(reason || '').trim() || undefined }),
      '已完成归档')
    if (!result) return null
    await loadMasterData(entity, { archiveState: masterArchiveState[entity], force: true })
    return result
  }

  const remoteRestoreMasterData = async (entity, recordId, version) => {
    const record = masterCollectionFor(entity)?.find((item) => sameId(item.id, recordId))
    const endpoint = masterArchiveApi[entity]?.restore
    if (!record || !endpoint) return null
    const result = await runRemote(`正在恢复${entity === 'teachers' ? '老师' : entity === 'students' ? '学生' : entity === 'classes' ? '班级' : '课程'}...`,
      () => endpoint(recordId, { version: Number(version ?? record.version ?? 0) }),
      '已恢复到有效数据')
    if (!result) return null
    await loadMasterData(entity, { archiveState: masterArchiveState[entity], force: true })
    return result
  }

  const baiduProviderConfigFor = (provider = {}) => {
    const rawFrontendBaseUrl = provider.frontendBaseUrl || provider.config?.frontendBaseUrl || ''
    const rawFrontendReturnPath = provider.frontendReturnPath || provider.config?.frontendReturnPath || ''
    const rawBackendBaseUrl = provider.backendBaseUrl || provider.config?.backendBaseUrl || ''
    const frontendBaseUrl = normalizeBaiduBaseUrl(rawFrontendBaseUrl, DEFAULT_BAIDU_FRONTEND_BASE_URL)
    const directoryRule = provider.directoryRule || provider.config?.directoryRule || DEFAULT_ARCHIVE_RULE
    const filenameTemplate = provider.filenameTemplate ?? provider.config?.filenameTemplate ?? ''
    return {
      ...(provider.config || {}),
      authType: 'OAuth2',
      directoryRule,
      filenameTemplate,
      appId: provider.appId || provider.config?.appId || '',
      appKey: provider.appKey || provider.config?.appKey || '',
      secretKey: provider.secretKey || '',
      backendBaseUrl: normalizeBaiduBaseUrl(rawBackendBaseUrl, DEFAULT_BAIDU_BACKEND_BASE_URL),
      frontendBaseUrl,
      frontendReturnPath: normalizeBaiduReturnPath(rawFrontendReturnPath),
      // API 读取配置时会隐藏 SecretKey；空值表示沿用服务端已有值。
      frontendReturnUrl: frontendBaseUrl ? '' : provider.config?.frontendReturnUrl || '',
      authorizeUrl: provider.authorizeUrl || provider.config?.authorizeUrl || '',
      tokenUrl: provider.tokenUrl || provider.config?.tokenUrl || '',
      scope: provider.scope || provider.config?.scope || '',
      callbackPath: provider.callbackPath || provider.config?.callbackPath || '',
      apiBaseUrl: provider.apiBaseUrl || provider.config?.apiBaseUrl || '',
      uploadBaseUrl: provider.uploadBaseUrl || provider.config?.uploadBaseUrl || '',
      stateTtl: provider.stateTtl || provider.config?.stateTtl || 'PT10M',
      chunkSizeBytes: provider.chunkSizeBytes || provider.config?.chunkSizeBytes || 4194304,
      tokenRefreshSkew: provider.tokenRefreshSkew || provider.config?.tokenRefreshSkew || 'PT5M'
    }
  }

  const baiduProviderBodyFor = (provider = {}) => ({
    name: provider.name || '百度网盘账号',
    capabilities: provider.capabilities || [],
    config: baiduProviderConfigFor(provider),
    secretRef: null,
    status: provider.enabled ? 'ENABLED' : 'DISABLED'
  })

  const refreshProviderSettingsState = async () => {
    const [providers, groups] = await Promise.all([api.m5.providers(), api.m5.providerGroups()])
    mapProviderSetting(providers?.items || providers || [])
    if (groups) mapProviderGroups(groups)
    return providerGroups
  }

  const mappedProviderById = (providerId) => allMappedProviders().find((provider) => sameId(provider.id, providerId)) || null

  const remoteCreateBaiduProvider = async (provider) => {
    const saved = await runRemote('正在创建百度网盘账号配置...', () => api.m5.createProvider({
      scopeType: 'CAMPUS',
      providerType: 'BAIDU_NETDISK',
      ...baiduProviderBodyFor(provider)
    }), '', () => refreshProviderSettingsState())
    if (!saved) return null
    await refreshProviderSettingsState()
    notify('百度网盘账号配置已创建')
    return mappedProviderById(saved.id)
  }

  const remoteUpdateBaiduProvider = async (provider) => {
    if (!provider?.id || String(provider.id).startsWith('provider-')) return remoteCreateBaiduProvider(provider)
    const saved = await runRemote('正在保存百度网盘账号配置...', () => api.m5.updateProvider(provider.id,
      baiduProviderBodyFor(provider)), '', () => refreshProviderSettingsState())
    if (!saved) return null
    await refreshProviderSettingsState()
    notify('百度网盘账号配置已保存')
    return mappedProviderById(saved.id)
  }

  const remoteDisableProvider = async (provider) => {
    if (!provider?.id || String(provider.id).startsWith('provider-')) return null
    const saved = await runRemote('正在停用百度网盘账号...', () => api.m5.deleteProvider(provider.id), '百度网盘账号已停用', () => refreshProviderSettingsState())
    if (!saved) return null
    await refreshProviderSettingsState()
    return mappedProviderById(saved.id)
  }

  const remoteRestoreProvider = async (provider) => {
    if (!provider?.id || String(provider.id).startsWith('provider-')) return null
    const saved = await runRemote('正在恢复百度网盘账号...', () => api.m5.restoreProvider(provider.id), '百度网盘账号已恢复', () => refreshProviderSettingsState())
    if (!saved) return null
    await refreshProviderSettingsState()
    return mappedProviderById(saved.id)
  }

  const remoteUpdateArchiveRule = async (pathTemplate, filenameTemplate) => {
    const saved = await runRemote('正在保存归档规则...', () => api.m5.updateArchiveRule({
      pathTemplate,
      filenameTemplate: filenameTemplate || ''
    }), '归档规则已保存', () => invalidateResource('settings'))
    if (!saved) return null
    mapArchiveRule(saved)
    const group = providerGroups.find((item) => String(item.category || '').toLowerCase() === 'cloud')
    if (group?.value) {
      group.value.directoryRule = cloudArchiveRule.pathTemplate
      group.value.filenameTemplate = cloudArchiveRule.filenameTemplate
    }
    return saved
  }

  const remoteUpdateSetting = async (settingId, payload) => {
    const providers = payload.value?.providers || []
    const isCloudSetting = String(payload.category || '').toLowerCase() === 'cloud'
    if (!providers.length && !isCloudSetting) {
      notify('请先添加配置通道')
      return null
    }
    for (const provider of providers) {
      const providerType = provider.providerType || provider.type
      if (!providerType) {
        notify('缺少服务端提供的通道类型，无法保存配置')
        return null
      }
      const isBaidu = String(providerType).toUpperCase() === 'BAIDU_NETDISK'
      const isAi = mapProviderCategory({ ...provider, providerType }) === 'AI'
      const rawFrontendBaseUrl = provider.frontendBaseUrl || provider.config?.frontendBaseUrl || ''
      const rawFrontendReturnPath = provider.frontendReturnPath || provider.config?.frontendReturnPath || ''
      const frontendBaseUrl = isBaidu
        ? normalizeBaiduBaseUrl(rawFrontendBaseUrl, DEFAULT_BAIDU_FRONTEND_BASE_URL)
        : rawFrontendBaseUrl
      const frontendReturnPath = isBaidu
        ? normalizeBaiduReturnPath(rawFrontendReturnPath)
        : rawFrontendReturnPath
      const rawBackendBaseUrl = provider.backendBaseUrl || provider.config?.backendBaseUrl || ''
      const backendBaseUrl = isBaidu
        ? normalizeBaiduBaseUrl(rawBackendBaseUrl, DEFAULT_BAIDU_BACKEND_BASE_URL)
        : rawBackendBaseUrl
      const config = isBaidu
        ? baiduProviderConfigFor(provider)
        : isAi
        ? {
            ...(provider.config || {}),
            protocol: provider.config?.protocol || provider.config?.textProtocol || 'OPENAI_COMPATIBLE',
            textProtocol: provider.config?.textProtocol || provider.config?.protocol || 'OPENAI_COMPATIBLE',
            textEndpoint: provider.config?.textEndpoint || provider.endpoint || '',
            textModel: provider.config?.textModel || '',
            imageProtocol: provider.config?.imageProtocol || 'WAN_NATIVE',
            imageEndpoint: provider.config?.imageEndpoint || '',
            imageModel: provider.config?.imageModel || '',
            imageSize: provider.config?.imageSize || '1K',
            watermark: provider.config?.watermark === true,
            thinkingMode: provider.config?.thinkingMode === true
          }
        : {
            ...(provider.config || {}),
            endpoint: provider.endpoint || provider.config?.endpoint || '',
            appKey: provider.appKey || provider.config?.appKey || '',
            authType: provider.authType || provider.config?.authType || ''
          }
      if (!provider.id || String(provider.id).startsWith('provider-')) {
        const saved = await runRemote('正在创建通道配置...', () => api.m5.createProvider({ scopeType: 'CAMPUS', providerType, name: provider.name, capabilities: provider.capabilities || [], config, secretRef: isBaidu ? null : provider.secretRef, status: provider.enabled ? 'ENABLED' : 'DISABLED' }), '', () => invalidateResource('settings'))
        if (!saved) return null
      } else {
        const saved = await runRemote('正在保存通道配置...', () => api.m5.updateProvider(provider.id, { name: provider.name, capabilities: provider.capabilities || [], config, secretRef: isBaidu ? null : provider.secretRef, status: provider.enabled ? 'ENABLED' : 'DISABLED' }), '', () => invalidateResource('settings'))
        if (!saved) return null
      }
    }
    const latest = await runRemote('正在刷新通道配置...', () => api.m5.providers(), '', () => invalidateResource('settings'))
    if (!latest) return null
    mapProviderSetting(latest)
    notify('当前配置已保存')
    return settings[0]
  }

  const remoteTestProvider = async (provider) => {
    if (!provider?.id || String(provider.id).startsWith('provider-')) {
      notify('请先保存通道配置后再测试')
      return null
    }
    const result = await runRemote('正在测试通道连接...', () => api.m5.testProvider(provider.id), '', () => invalidateResource('settings'))
    if (result) {
      provider.tokenStatus = result.success ? '连接正常' : (result.message || '连接失败')
      notify(result.message || (result.success ? '连接成功' : '连接失败'))
      if (String(provider.providerType || provider.type).toUpperCase() === 'BAIDU_NETDISK') {
        await refreshProviderSettingsState()
      }
    }
    return result
  }

  const remoteStartBaiduOAuth = async (provider) => {
    if (!provider?.id || String(provider.id).startsWith('provider-')) {
      notify('请先保存百度网盘通道配置')
      return null
    }
    const result = await runRemote('正在准备百度网盘授权...', () => api.m5.startBaiduOAuth(provider.id))
    if (result?.authorizeUrl && typeof window !== 'undefined') {
      window.location.assign(result.authorizeUrl)
    }
    return result
  }

  const remoteBaiduOAuthStatus = async (provider) => {
    if (!provider?.id || String(provider.id).startsWith('provider-')) return null
    return runRemote('', () => api.m5.baiduOAuthStatus(provider.id))
  }

  const apiTemplateStatus = (value) => String(value || '').toUpperCase() === 'DISABLED' || value === '停用' ? 'DISABLED' : 'ENABLED'

  const imageTemplateBodyFor = (payload = {}) => ({
    templateKey: payload.templateKey || `client-${Date.now()}`,
    name: payload.name?.trim() || '新图片模板',
    templateVersion: Number(payload.templateVersion || 1),
    config: payload.config || buildClientImageTemplateConfig(payload),
    status: apiTemplateStatus(payload.status)
  })

  const remoteAddTemplate = async (type, payload) => {
    const createByType = {
      comment: {
        label: '课评生成模板',
        body: feedbackTemplateBodyFor(payload),
        action: (body) => api.feedback.createFeedbackTemplate(body)
      },
      image: {
        label: '图片处理模板',
        body: imageTemplateBodyFor(payload),
        action: (body) => api.feedback.createImageTemplate(body)
      }
    }[type]
    if (!createByType) return null
    const result = await runRemote(`正在创建${createByType.label}...`, () => createByType.action(createByType.body), `${createByType.label}已创建`, () => invalidateResource('templates'))
    if (!result) return null
    await loadTemplates({ force: true })
    const createdId = result.id
    return templates[type].find((item) => sameId(item.id, createdId)) || templates[type][0] || null
  }

  const remoteUpdateTemplate = async (type, index, payload) => {
    const current = templates[type]?.[index]
    if (!current?.id) return null
    const updateByType = {
      comment: {
        label: '课评生成模板',
        body: {
          ...feedbackTemplateUpdateBodyFor(payload, current),
          version: Number(current.version || 0)
        },
        action: (body) => api.feedback.updateFeedbackTemplate(current.id, body)
      },
      image: {
        label: '图片处理模板',
        body: {
          name: payload.name?.trim() || current.name,
          config: payload.config || buildClientImageTemplateConfig(payload),
          status: apiTemplateStatus(payload.status),
          version: Number(current.version || 0)
        },
        action: (body) => api.feedback.updateImageTemplate(current.id, body)
      }
    }[type]
    if (!updateByType) return null
    const result = await runRemote(`正在保存${updateByType.label}...`, () => updateByType.action(updateByType.body), `${updateByType.label}已保存`, () => invalidateResource('templates'))
    if (!result) return null
    await loadTemplates({ force: true })
    const updatedId = result.id || current.id
    return templates[type].find((item) => sameId(item.id, updatedId)) || null
  }

  const pendingImportFile = ref(null)
  const pendingImportMeta = reactive({ batchId: null, version: 0, source: '', dataType: '', mapping: {} })

  const remoteStageImportFile = (file, source, dataType) => {
    pendingImportFile.value = file
    pendingImportMeta.batchId = null
    pendingImportMeta.version = 0
    pendingImportMeta.mapping = {}
    pendingImportMeta.source = source
    pendingImportMeta.dataType = ({ 综合课表: 'COMBINED', 学生名单: 'STUDENTS', 班级课表: 'CLASSES' }[dataType] || dataType)
    return true
  }

  const remotePreviewImport = async (mapping = {}) => {
    if (!pendingImportFile.value) {
      notify('请先选择 Excel 文件')
      return false
    }
    const file = pendingImportFile.value
    const result = await runRemote('正在上传并解析导入文件...', async () => {
      let batch
      if (pendingImportMeta.batchId) {
        batch = await api.imports.get(pendingImportMeta.batchId)
        pendingImportMeta.version = Number(batch.version || pendingImportMeta.version || 0)
      } else {
        const uploaded = await uploadFile(file, `import-${pendingImportMeta.dataType}`)
        batch = await api.imports.create({ fileId: String(uploaded.id), sourceType: pendingImportMeta.source === '小麦 Excel 导出' ? 'WHEAT_EXCEL' : pendingImportMeta.source === '小麦课表整理表' ? 'WHEAT_COPY' : 'MANUAL_TABLE', dataType: pendingImportMeta.dataType })
        pendingImportMeta.batchId = batch.id
        pendingImportMeta.version = Number(batch.version || 0)
      }
      pendingImportMeta.mapping = mapping
      const preview = await api.imports.preview(batch.id, { version: pendingImportMeta.version, columnMapping: mapping })
      const batchResult = preview.batch || preview
      const rowPage = await api.imports.rows(batch.id)
      const rows = rowPage?.items || preview.rows || preview.previewRows || []
      replaceReactive(importBatches, [mapImportBatch(batchResult), ...importBatches.filter((item) => !sameId(item.id, batch.id))])
      replaceReactive(importPreviewRows, rows.map(mapImportRow))
      pendingImportMeta.version = Number(batchResult.version || pendingImportMeta.version)
      return preview
    }, '导入预览已生成', () => invalidateResource('imports'))
    return Boolean(result)
  }

  const remoteApplyImportRows = async () => {
    if (!pendingImportMeta.batchId) {
      notify('请先完成文件识别和预览')
      return false
    }
    const skipRowIds = importPreviewRows
      .filter((row) => row.status !== '可导入'
        && !(row.type === 'lesson' && row.duplicateObjectType === 'LESSON' && row.topic))
      .map((row) => String(row.id))
    const result = await runRemote('正在确认导入...', () => api.imports.confirm(pendingImportMeta.batchId, { version: pendingImportMeta.version, skipRowIds }, createIdempotencyKey(`import-confirm:${pendingImportMeta.batchId}`)), '导入已确认', () => Promise.all([invalidateResource('imports'), invalidateResource('lessons.today'), invalidateResource('lessons.schedule'), invalidateResource('inbox-lessons'), invalidateResource('workbench.summary')]))
    if (!result) return false
    replaceReactive(importBatches, [mapImportBatch(result), ...importBatches.filter((item) => !sameId(item.id, result.id))])
    pendingImportMeta.batchId = null
    pendingImportFile.value = null
    await Promise.all([
      invalidateResource('imports'),
      invalidateResource('lessons.today'),
      invalidateResource('lessons.schedule'),
      invalidateResource('inbox-lessons'),
      invalidateResource('workbench.summary')
    ])
    return true
  }

  const remoteSaveQualityReview = async (payload) => {
    if (!canQualityReview.value) {
      notify('只有具备质量评分权限的账号可以评分')
      return null
    }
    const score = Number(payload.score)
    if (!Number.isFinite(score) || score < 0 || score > 10) {
      notify('评分需要在 0-10 之间')
      return null
    }
    const dashboard = supervisionDashboard.find((item) => sameId(item.lessonId, payload.lessonId))
    const existing = qualityReviewForLesson(payload.lessonId) || dashboard?.review || (dashboard?.reviewId
      ? { id: dashboard.reviewId, version: dashboard.reviewVersion || 0 }
      : null)
    const result = await runRemote('正在保存质量评分...', () => existing?.id
      ? api.m6.updateQualityReview(existing.id, { score, comment: payload.comment?.trim() || '', reason: '更新课次评分', version: existing.version })
      : api.m6.createQualityReview({ lessonId: String(payload.lessonId), score, comment: payload.comment?.trim() || '', version: payload.version }), '质量评分已保存', () => Promise.all([
      invalidateResource('supervision'),
      invalidateResource('pending-reviews')
    ]))
    if (!result) return null
    const mapped = mapQualityReview(result)
    const index = qualityReviews.findIndex((item) => sameId(item.id, mapped.id))
    if (index >= 0) qualityReviews.splice(index, 1, mapped)
    else qualityReviews.unshift(mapped)
    if (dashboard) {
      Object.assign(dashboard, {
        reviewId: mapped.id,
        reviewStatus: mapped.status,
        score: mapped.score,
        reviewedAt: mapped.reviewedAt,
        reviewVersion: mapped.version,
        review: mapped
      })
    }
    return mapped
  }

  const remoteUpdateArchiveRecord = async (recordId, payload) => {
    const current = archiveRecords.find((item) => sameId(item.id, recordId)) || directoryPages.archiveRecords.items.find((item) => sameId(item.id, recordId))
    if (!current || current.archiveStatus === 'CURRENT') {
      notify('进行中档案不能编辑正式档案元数据')
      return null
    }
    const result = await runRemote('正在保存作品档案...', () => api.archive.update(recordId, {
      title: payload.title?.trim() || undefined,
      description: payload.description?.trim() || undefined,
      tags: payload.tags || [],
      note: payload.note?.trim() || undefined,
      mountingStatus: payload.framed ? 'MOUNTED' : 'UNMOUNTED',
      mountedOn: payload.framedAt || undefined,
      mountingFeeMinor: Math.round(Number(payload.frameFee || 0) * 100),
      framerName: payload.framerName?.trim() || undefined,
      mountingNote: payload.frameNote?.trim() || undefined,
      version: current.version
    }), '作品档案已保存', () => invalidateResource('archive.records'))
    if (!result) return null
    const mapped = mapArchiveRecord(result)
    if (!mapped.artwork && current.artwork) mapped.artwork = current.artwork
    const index = archiveRecords.findIndex((item) => sameId(item.id, recordId))
    if (index >= 0) archiveRecords.splice(index, 1, mapped)
    const directoryIndex = directoryPages.archiveRecords.items.findIndex((item) => sameId(item.id, recordId))
    if (directoryIndex >= 0) directoryPages.archiveRecords.items.splice(directoryIndex, 1, mapped)
    return mapped
  }

  const remoteCreateArchiveCollection = () => {
    notify('归档集合暂不可发布')
    return null
  }

  const remoteAddExtraTask = async (payload) => {
    const ownerId = payload.ownerId || teachers.find((teacher) => teacher.name === payload.owner)?.id
    const result = await runRemote('正在创建课外任务...', () => api.m6.createExtraTask({ relatedLessonId: payload.relatedLessonId ? String(payload.relatedLessonId) : undefined, title: payload.title, taskType: payload.taskType || '学生课外任务', content: payload.content || '', dueDate: payload.dueDate || undefined, status: apiExtraTaskStatus(payload.status), ownerId: ownerId ? String(ownerId) : undefined, note: payload.note || '' }), '课外任务已创建', () => invalidateResource('extraTasks'))
    if (!result) return null
    const task = mapExtraTask(result)
    task.owner = result.owner || result.ownerName || teachers.find((teacher) => sameId(teacher.id, result.ownerId || ownerId))?.name || ''
    extraTaskArchives.unshift(task)
    return task
  }

  const remoteUpdateExtraTask = async (taskId, payload) => {
    const current = extraTaskArchives.find((item) => sameId(item.id, taskId)) || directoryPages.extraTasks.items.find((item) => sameId(item.id, taskId))
    const ownerId = payload.ownerId || teachers.find((teacher) => teacher.name === payload.owner)?.id
    const result = await runRemote('正在保存课外任务...', () => api.m6.updateExtraTask(taskId, { relatedLessonId: payload.relatedLessonId ? String(payload.relatedLessonId) : undefined, title: payload.title, taskType: payload.taskType, content: payload.content || '', dueDate: payload.dueDate || undefined, status: apiExtraTaskStatus(payload.status), ownerId: ownerId ? String(ownerId) : undefined, note: payload.note || '', version: current?.version || 0 }), '课外任务已保存', () => invalidateResource('extraTasks'))
    if (!result) return null
    const task = mapExtraTask(result)
    task.owner = result.owner || result.ownerName || teachers.find((teacher) => sameId(teacher.id, result.ownerId || ownerId))?.name || ''
    const index = extraTaskArchives.findIndex((item) => sameId(item.id, taskId))
    if (index >= 0) extraTaskArchives.splice(index, 1, task)
    const directoryIndex = directoryPages.extraTasks.items.findIndex((item) => sameId(item.id, taskId))
    if (directoryIndex >= 0) directoryPages.extraTasks.items.splice(directoryIndex, 1, task)
    return task
  }

  const remoteDeleteExtraTask = async (taskId) => {
    const current = extraTaskArchives.find((item) => sameId(item.id, taskId))
    if (!current) return false
    const success = await runRemoteVoid('正在取消课外任务...', () => api.m6.deleteExtraTask(taskId, current.version), '课外任务已取消', () => invalidateResource('extraTasks'))
    if (!success) return false
    const index = extraTaskArchives.findIndex((item) => sameId(item.id, taskId))
    if (index >= 0) extraTaskArchives.splice(index, 1)
    return true
  }

  const remoteAddExtraTaskWork = async (extraTaskId, payload) => {
    const file = payload.file || payload.artworkFile
    const tags = Array.isArray(payload.tags) ? payload.tags : String(payload.tags || '').split(/[，,、]/).map((tag) => tag.trim()).filter(Boolean)
    const result = await runRemote('正在上传并保存课外作品...', async () => {
      let fileId = payload.fileId
      if (file && !fileId) fileId = (await uploadFile(file, `extra-task-${extraTaskId}-artwork`)).id
      if (!fileId) throw new Error('请先选择作品文件')
      return api.m6.createExtraArtwork(extraTaskId, { studentId: payload.studentId ? String(payload.studentId) : undefined, fileId: String(fileId), dateValue: payload.dateValue || undefined, title: payload.title || '课外作品', description: payload.description || '', tags: JSON.stringify(tags), highlight: Boolean(payload.highlight), highlightNote: payload.highlightNote || '' })
    }, '课外作品已保存', () => invalidateResource('extraTasks'))
    if (result) {
      const work = mapExtraArtwork(result)
      work.artwork = file ? URL.createObjectURL(file) : ''
      extraTaskWorks.unshift(work)
    }
    return result
  }

  const remoteUpdateExtraTaskWork = async (recordId, payload) => {
    const current = extraTaskWorks.find((work) => sameId(work.id, recordId))
    const tags = Array.isArray(payload.tags) ? payload.tags : String(payload.tags || '').split(/[，,、]/).map((tag) => tag.trim()).filter(Boolean)
    const result = await runRemote('正在保存课外作品...', () => api.m6.updateExtraArtwork(recordId, { title: payload.title || '课外作品', description: payload.description || '', tags: JSON.stringify(tags), highlight: Boolean(payload.highlight), highlightNote: payload.highlightNote || '', version: payload.version ?? current?.version ?? 0 }), '课外作品已保存', () => invalidateResource('extraTasks'))
    if (result) {
      const index = extraTaskWorks.findIndex((work) => sameId(work.id, recordId))
      if (index >= 0) extraTaskWorks.splice(index, 1, { ...extraTaskWorks[index], ...mapExtraArtwork(result) })
    }
    return result
  }

  const remoteDeleteExtraTaskWork = async (recordId) => {
    const record = extraTaskWorks.find((item) => sameId(item.id, recordId))
    const success = await runRemoteVoid('正在删除课外作品...', () => api.m6.deleteExtraArtwork(recordId, record?.version || 0), '课外作品已删除', () => invalidateResource('extraTasks'))
    if (!success) return false
    const index = extraTaskWorks.findIndex((work) => sameId(work.id, recordId))
    if (index >= 0) extraTaskWorks.splice(index, 1)
    return true
  }

  const remoteExtraTaskWorksForTask = (taskId) => extraTaskWorks.filter((record) => sameId(record.extraTaskId, taskId))

  const remoteUseArtworkFromLibrary = () => {
    notify('范画库暂不可用')
    return false
  }

  const remoteAddArtworkLibraryItem = () => {
    notify('范画库暂不可新增')
    return null
  }

  onSessionChanged((me) => {
    storedMe.value = me
    if (!me) isLoggedIn.value = false
  })

  if (isLoggedIn.value) {
    void loadShellData().catch((error) => {
      remoteLoading.value = false
      notify(remoteErrorMessage(error, '登录状态已失效，请重新登录'))
    })
  }

  const portfolioStudio = usePortfolioStudio({
    archiveRecords,
    students,
    classes,
    school,
    currentUser,
    isAdmin,
    canQualityReview,
    canQualityRead,
    canEditExtraTaskArtwork,
    authorizedClassIds,
    canEditArchiveRecord,
    createArchiveCollection,
    notify,
    nowText
  })
  portfolioStudioRef = portfolioStudio
  const remoteParentShareUrl = computed(() => remoteStudentShareUrlFor(activeStudentId.value))

  return {
    ...portfolioStudio,
    school,
    campuses,
    artworkLibrary,
    teachers,
    students,
    classes,
    courses,
    scheduleLessons,
    scheduleMeta,
    scheduleLoading,
    scheduleError,
    templates,
    classTypes,
    tasks,
    inboxLessons,
    lessonWorkspaces,
    activeWorkspace,
    sharePage,
    statusChangeLogs,
    archiveEditLogs,
    lessonStatusLogs,
    communicationRecords,
    studentProfileFields,
    studentProfileAudits,
    sessionStudents,
    archives,
    archiveRecords,
    aiCallLogs,
    extraTaskArchives,
    extraTaskWorks,
    qualityReviews,
    archiveFilter,
    filteredArchiveRecords,
    lessonArchiveRecords,
    teacherEffectArchiveRecords,
    supervisionLessonRecords,
    terms,
    teacherArchives,
    pendingQualityReviews,
    materials,
    demoMaterials,
    stepMaterials,
    classroomMediaMaterials,
    referenceMaterials,
    coursewareMaterials,
    materialsConfirmedEmpty,
    homework,
    displayConfig,
    externalLinks,
    wheatTraces,
    todos,
    cloudArchiveTodos,
    pendingReviewQueue,
    importBatches,
    importPreviewRows,
    settings,
    providerGroups,
    providerTypeOptions,
    providerTypeCatalog,
    permissionCatalog,
    identityUsers,
    identityRoles,
    identityPermissions,
    currentTeacherProfile,
    masterArchiveState,
    teacherSourceMappings,
    identityUserPage,
    identityUserQuery,
    identityUserStatus,
    identityLoading,
    identityLoaded,
    identityErrors,
    cloudDriveSetting,
    enabledCloudProviders,
    cloudProviderPicker,
    resolveCloudProviderPicker,
    cancelCloudProviderPicker,
    activeTaskId,
    activeStudentId,
    currentStep,
    selectedImageTemplates,
    selectedImageTemplate,
    selectedCommentTemplate,
    copied,
    copiedStudentId,
    isLoggedIn,
    currentUserId,
    loginForm,
    showReport,
    processingAction,
    jobProgress,
    jobProgressFor,
    toast,
    previewPulse,
    commentPulse,
    reportPulse,
    bulkRecord,
    activeShareMode,
    activeTask,
    currentUser,
    isAdmin,
    canManageIdentityUsers,
    canManageIdentityRoles,
    canManageIdentityMemberships,
    canEditMasterData,
    canEditLessons,
    canQualityReview,
    canQualityRead,
    canEditExtraTaskArtwork,
    authorizedClassIds,
    visibleTasks,
    visibleInboxLessons,
    visibleNavItems,
    activeClass,
    activeCourse,
    activeSessionStudent,
    activeArtworkId,
    activeArtwork,
    activeStudent,
    classStudents,
    attendingRows,
    activeImageTemplates,
    activeImageTemplate,
    activeCommentTemplate,
    isProcessing,
    selectedExternalLinks,
    permissionSummary,
    studentHistoryFor,
    communicationRecordsFor,
    archiveEditLogsForRecord,
    canEditArchiveRecord,
    updateArchiveRecord: remoteUpdateArchiveRecord,
    createArchiveCollection: remoteCreateArchiveCollection,
    importStats,
    latestLessonDate,
    qualityReviewForLesson,
    saveQualityReview: remoteSaveQualityReview,
    counts,
    steps,
    taskProgress,
    progressForTask,
    currentWarnings,
    archiveTargets,
    selectedArchiveTargets,
    archiveChecklist,
    archiveChecklistItems,
    archiveChecklistProgress,
    archiveChecklistReady,
    archiveChecklistPending,
    isArchiveDone,
    isArchiveWorking,
    wecomSendTasks,
    wecomEnabled,
    wecomTaskFor,
    pushParentTouch: remotePushParentTouch,
    markWecomSendTask: remoteMarkWecomSendTask,
    retryWecomSendTask: remoteRetryWecomSendTask,
    retryCloudArchiveTodo: remoteRetryCloudArchiveTodo,
    startBaiduOAuth: remoteStartBaiduOAuth,
    baiduOAuthStatus: remoteBaiduOAuthStatus,
    manualCopyWecomTask: remoteManualCopyWecomTask,
    manualCopyStudentLink,
    parentShareUrl: remoteParentShareUrl,
    studentShareUrlFor: remoteStudentShareUrlFor,
    qrText,
    exportText: remoteExportText,
    fileNameFor: remoteFileNameFor,
    selectTask: remoteSelectTask,
    selectTaskById: remoteSelectTaskById,
    transitionLesson: remoteTransitionLesson,
    loginAs: () => {
      notify('请使用服务端账号登录')
      return false
    },
    loginWithForm: remoteLoginWithForm,
    logout: remoteLogout,
    savePreferences: remoteSavePreferences,
    setAttendance: remoteSetAttendance,
    toggleMaterialVisible: remoteToggleMaterialVisible,
    renameLessonMaterial: remoteRenameLessonMaterial,
    addMaterial: remoteUploadLessonMaterial,
    uploadLessonMaterial: remoteUploadLessonMaterial,
    replaceLessonMaterial: remoteReplaceLessonMaterial,
    removeLessonMaterial: remoteRemoveLessonMaterial,
    confirmNoLessonMaterials: remoteConfirmNoLessonMaterials,
    useArtworkFromLibrary: remoteUseArtworkFromLibrary,
    addArtworkLibraryItem: remoteAddArtworkLibraryItem,
    chooseImageTemplate,
    removeImageTemplate,
    chooseCommentTemplate,
    parseBulkRecord,
    simulateVoice: () => notify('语音转文字暂不可用，请手工录入课堂记录'),
    matchImages: () => notify('图片匹配暂不可用，请手工上传作品'),
    confirmImages,
    confirmCurrentImage: remoteConfirmCurrentImage,
    adoptCurrentImage: remoteAdoptCurrentImage,
    processImages: remoteProcessImages,
    renderCurrentImage: remoteRenderCurrentImage,
    processImageWithPrompt: remoteProcessCurrentImageWithPrompt,
    failCurrentImageProcess: () => notify('图片处理失败请根据服务端任务状态重试'),
    retryCurrentImageProcess: remoteRetryCurrentImageProcess,
    generateOne: remoteGenerateOne,
    generateAll: remoteGenerateAll,
    confirmAll: remoteConfirmAll,
    confirmCurrentComment: remoteConfirmCurrentComment,
    saveSessionRecord: remoteSaveRecord,
    toggleHighlight: remoteToggleHighlight,
    saveArtworkHighlight: remoteSaveArtworkHighlight,
    toggleHomeworkLink,
    setHomeworkMode,
    applyHomeworkExample,
    saveShareDraft: remoteSaveShareDraft,
    generateSharePages: remoteGenerateSharePages,
    revokeSharePage: remoteRevokeSharePage,
    getLessonWorkspace: (lessonId) => lessonWorkspaces[String(lessonId)] || null,
    isShareAccessible: () => false,
    pushArchiveItem: remotePushArchiveItem,
    archiveTeacherEffectImage: remoteArchiveTeacherEffectImage,
    generateTeacherEffect: remoteArchiveTeacherEffectImage,
    confirmTeacherEffect: remoteConfirmTeacherEffect,
    retryTeacherEffect: remoteRetryTeacherEffect,
    skipTeacherEffect: remoteSkipTeacherEffect,
    generateWheatTraceTask: remoteGenerateWheatTraceTask,
    archiveAll: remoteArchiveAll,
    copyExport: remoteCopyExport,
    copyStudentLink: remoteCopyStudentLink,
    updateImage: remoteUpdateImage,
    replaceStudentImage: remoteReplaceStudentImage,
    retryArtworkUploads: remoteRetryArtworkUploads,
    renameArtwork: remoteRenameArtwork,
    removeArtwork: remoteRemoveStudentImage,
    removeArtworkVersion: remoteRemoveArtworkVersion,
    removeStudentImage: remoteRemoveStudentImage,
    markTrace: remoteMarkTrace,
    completeTodo: remoteCompleteTodo,
    cancelTodo: remoteCancelTodo,
    addLesson: remoteAddLesson,
    addStudent: remoteAddStudent,
    updateStudent: remoteUpdateStudent,
    addCommunicationRecord: remoteAddCommunicationRecord,
    updateCommunicationRecord: remoteUpdateCommunicationRecord,
    deleteCommunicationRecord: remoteDeleteCommunicationRecord,
    loadStudentProfile: remoteLoadStudentProfile,
    studentProfileFor,
    studentProfileFieldFor,
    profileUiKey,
    saveStudentProfile: remoteSaveStudentProfile,
    loadStudentProfileAudits: remoteLoadStudentProfileAudits,
    addClass: remoteAddClass,
    updateClass: remoteUpdateClass,
    previewLessonGeneration,
    generateLessonGeneration,
    addCourse: remoteAddCourse,
    updateCourse: remoteUpdateCourse,
    addExternalLink: remoteAddExternalLink,
    updateExternalLink: remoteUpdateExternalLink,
    addTeacher: remoteAddTeacher,
    updateTeacher: remoteUpdateTeacher,
    bindTeacherAccount: remoteBindTeacherAccount,
    archiveMasterData: remoteArchiveMasterData,
    restoreMasterData: remoteRestoreMasterData,
    loadMasterData,
    loadCurrentTeacherProfile,
    loadTeacherSourceMappings,
    saveTeacherSourceMapping: remoteSaveTeacherSourceMapping,
    loadIdentityUsers,
    loadIdentityRoles,
    loadIdentityPermissions,
    loadIdentityMemberships,
    createIdentityUser: remoteCreateIdentityUser,
    updateIdentityUser: remoteUpdateIdentityUser,
    resetIdentityPassword: remoteResetIdentityPassword,
    replaceIdentityUserRoles: remoteReplaceIdentityUserRoles,
    replaceIdentityUserMemberships: remoteReplaceIdentityUserMemberships,
    createIdentityRole: remoteCreateIdentityRole,
    updateIdentityRole: remoteUpdateIdentityRole,
    replaceIdentityRolePermissions: remoteReplaceIdentityRolePermissions,
    stageImportFile: remoteStageImportFile,
    previewImport: remotePreviewImport,
    applyImportRows: remoteApplyImportRows,
    loadCommunicationRecords: remoteLoadCommunicationRecords,
    updateSetting: remoteUpdateSetting,
    createBaiduProvider: remoteCreateBaiduProvider,
    updateBaiduProvider: remoteUpdateBaiduProvider,
    disableProvider: remoteDisableProvider,
    restoreProvider: remoteRestoreProvider,
    updateArchiveRule: remoteUpdateArchiveRule,
    testProvider: remoteTestProvider,
    toggleArchiveTarget,
    addTemplate: remoteAddTemplate,
    updateTemplate: remoteUpdateTemplate,
    addExtraTask: remoteAddExtraTask,
    updateExtraTask: remoteUpdateExtraTask,
    extraTaskWorksForTask: remoteExtraTaskWorksForTask,
    addExtraTaskWork: remoteAddExtraTaskWork,
    updateExtraTaskWork: remoteUpdateExtraTaskWork,
    deleteExtraTaskWork: remoteDeleteExtraTaskWork,
    nextStep,
    prevStep,
    nowText,
    notify,
    pulseComment,
    remoteLoading,
    remoteReady,
    ensurePageData: loadPageData,
    loadShellData,
    loadScheduleLessons,
    loadLessonWorkspace,
    loadTemplates,
    pageLoading,
    pageLoaded,
    pageErrors,
    pageMeta,
    directoryPages,
    directoryLoading,
    directoryErrors,
    loadDirectoryPage,
    loadResourceExternalLinks,
    loadDirectoryDetail,
    loadDirectoryExtraTaskWorks,
    loadClassTypes,
    shellSummary,
    shellPages,
    invalidateResource
  }
}
