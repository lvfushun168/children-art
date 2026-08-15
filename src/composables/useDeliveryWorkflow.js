import { computed, reactive, ref } from 'vue'
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
  setSession,
  updateStoredMe
} from '../services/apiClient'
import {
  displayDate,
  displayDateTime,
  displayTime,
  fromApiId,
  fromApiIds,
  mapCampus,
  mapArchiveRecord,
  mapArchiveVersion,
  mapAsset,
  mapAttendance,
  mapArtwork,
  mapClass,
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

const clone = (value) => JSON.parse(JSON.stringify(value))
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
  const templates = reactive({ image: [], comment: [], prompt: [], watermark: [] })
  const classTypes = reactive([])
  const tasks = reactive([])
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
  const importBatches = reactive([])
  const importPreviewRows = reactive([])
  const settings = reactive([])
  const providerGroups = reactive([])
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

  const activeTaskId = ref(null)
  const copied = ref(false)
  const copiedStudentId = ref(null)
  const isLoggedIn = ref(Boolean(getAccessToken() && storedMe.value))
  const currentUserId = ref(null)
  const verifiedLoginUserId = ref(null)
  const activeLoginRole = ref(null)
  const loginForm = reactive({ phone: '', password: '', role: '' })
  const pendingAuth = ref(null)
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
  const processingAction = ref('')
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
    homework: { lessonId: task.id, content: '', requirement: '', dueDate: '', visible: true, externalLinkIds: [], version: 0 },
    displayConfig: { lessonId: task.id, expiresInDays: 30, showMaterials: true, showHomework: true, showHighlight: true, showLessonType: true },
    bulkRecord: '',
    selectedImageTemplate: [],
    selectedCommentTemplate: 0,
    activeShareMode: 'student',
    activeStudentId: null,
    teacherEffect: null,
    cloudJobs: [],
    archiveVersions: [],
    selectedArchiveTargets: ['system', 'wheat'],
    archiveChecklist: createArchiveChecklist(),
    currentStep: 0,
    showReport: false,
    sharePage: {
      id: null,
      status: '草稿',
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
      const role = activeLoginRole.value || storedMe.value?.roles?.[0]?.name || storedMe.value?.roles?.[0]?.roleKey || '老师'
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
      role: !activeLoginRole.value || activeLoginRole.value === teacher.role ? teacher.role : activeLoginRole.value
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
  const loginAccount = computed(() => pendingAuth.value?.me?.user || teachers.find((teacher) => sameId(teacher.id, verifiedLoginUserId.value)) || null)
  const loginRoleOptions = computed(() => {
    const account = loginAccount.value
    const roles = pendingAuth.value?.me?.roles?.length
      ? pendingAuth.value.me.roles
      : account?.availableRoles?.length ? account.availableRoles.map((role) => ({ name: role, roleKey: role })) : account?.role ? [{ name: account.role, roleKey: account.role }] : []
    return roles.map((role) => {
      const value = role.roleKey || role.name || role
      const label = role.name || role.label || value
      return {
        value,
        label,
        description: label === '管理员' || value === 'ADMIN' ? '管理基础数据、课次、模板和系统配置' : '处理本人授权班级的课后交付',
        scope: label === '管理员' || value === 'ADMIN' ? '全部课次与后台配置' : `${account?.classes?.length || 0} 个授权班级`
      }
    })
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
  const visibleNavItems = computed(() => {
    const permissions = new Set(storedMe.value?.permissions || [])
    const can = (...keys) => isAdmin.value || keys.some((key) => permissions.has(key))
    const requiredPermissions = {
      tasks: ['lesson.read'],
      supervision: ['quality.read', 'quality.review'],
      production: ['portfolio.template.read', 'portfolio.export'],
      students: ['masterdata.read'],
      classes: ['masterdata.read'],
      teachers: ['masterdata.read'],
      externalLinks: ['masterdata.read'],
      courses: ['masterdata.read'],
      archives: ['archive.read'],
      extraTasks: ['extra-task.read'],
      imports: ['import.create', 'import.preview', 'import.confirm'],
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
  const activeTask = computed(() => visibleTasks.value.find((task) => sameId(task.id, activeTaskId.value)) || visibleTasks.value[0] || {
    id: null, classId: null, className: '', courseId: null, courseTitle: '', teacherId: null, teacher: '', date: '', dateValue: '', time: '', lessonType: '其他', status: '待处理', version: 0, wheatStatus: '未生成'
  })
  const activeClass = computed(() => classes.find((item) => sameId(item.id, activeTask.value?.classId)) || { id: activeTask.value?.classId || null, name: activeTask.value?.className || '未选择班级', studentIds: [], time: '' })
  const activeCourse = computed(() => courses.find((item) => sameId(item.id, activeTask.value?.courseId)) || { id: activeTask.value?.courseId || null, title: activeTask.value?.courseTitle || '待配置', materials: '', defaultFocus: '' })
  const activeSessionStudent = computed(() => sessionStudents.value.find((item) => sameId(item.studentId, activeStudentId.value)))
  const activeStudent = computed(() => students.find((item) => sameId(item.id, activeStudentId.value)) || sessionStudents.value.find((item) => sameId(item.studentId, activeStudentId.value)) && {
    id: activeStudentId.value,
    name: sessionStudents.value.find((item) => sameId(item.studentId, activeStudentId.value))?.studentName || '未命名学生',
    parent: sessionStudents.value.find((item) => sameId(item.studentId, activeStudentId.value))?.parent || ''
  })
  const classStudents = computed(() => (activeClass.value.studentIds || []).map((id) => students.find((item) => sameId(item.id, id))).filter(Boolean))
  const attendingRows = computed(() => sessionStudents.value.filter((item) => item.attendance === '到课'))
  const activeImageTemplates = computed(() => {
    const picked = selectedImageTemplates.value.map((index) => templates.image[index]).filter(Boolean)
    return picked.length ? picked : templates.image[0] ? [templates.image[0]] : []
  })
  const activeImageTemplate = computed(() => activeImageTemplates.value[0] || null)
  const activeCommentTemplate = computed(() => templates.comment[selectedCommentTemplate.value] || { name: '默认课评', tone: '', length: '' })
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
  const enabledCloudProviders = computed(() =>
    (cloudDriveSetting.value?.value?.providers || []).filter((provider) => provider.enabled)
  )
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
      label: '小麦留痕待办',
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
      const studentWorks = (savedWorks.length ? savedWorks : workspace.studentDeliveries.filter((row) => row.attendance === '到课').map((row) => {
        const student = students.find((item) => sameId(item.id, row.studentId))
        return {
          id: `${task.id}-${row.studentId}`,
          lessonId: task.id,
          studentId: row.studentId,
          studentName: student?.name || row.studentName || '学生',
          fileId: row.processedFileId || row.originalFileId || row.imageFileIds?.[0] || null,
          artwork: row.image,
          feedback: row.comment,
          highlight: row.highlight,
          highlightNote: row.highlightNote,
          shareReady: row.shareReady,
          archived: row.archived,
          imageMatched: row.imageMatched,
          imageConfirmed: row.imageConfirmed
        }
      })).map((record) => ({
        ...record,
        imageMatched: record.imageMatched ?? Boolean(record.artwork),
        imageConfirmed: record.imageConfirmed ?? Boolean(record.artwork),
        shareReady: record.shareReady ?? Boolean(record.shareUrl),
        archived: record.archived ?? task.archived
      }))
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
        worksCount: studentWorks.filter((item) => item.imageMatched).length,
        shareReadyCount: studentWorks.filter((item) => item.shareReady).length,
        archivedCount: studentWorks.filter((item) => item.archived).length,
        highlights: studentWorks.filter((item) => item.highlight).length,
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
          studentWorks: relatedWorks.map((record) => ({
            ...record,
            imageMatched: Boolean(record.artwork),
            imageConfirmed: Boolean(record.artwork),
            shareReady: Boolean(record.shareUrl),
            archived: true
          })),
          worksCount: archive.works || relatedWorks.length,
          shareReadyCount: relatedWorks.filter((record) => record.shareUrl).length,
          archivedCount: archive.works || relatedWorks.length,
          highlights: archive.highlights || relatedWorks.filter((record) => record.highlight).length,
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
      .filter((lesson) => lesson.teacherEffect?.status && lesson.teacherEffect.status !== '待生成')
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

  const counts = computed(() => ({
    total: classStudents.value.length,
    attend: sessionStudents.value.filter((item) => item.attendance === '到课').length,
    matched: sessionStudents.value.filter((item) => item.attendance === '到课' && item.imageMatched).length,
    imageConfirmed: sessionStudents.value.filter((item) => item.attendance === '到课' && item.imageConfirmed).length,
    records: sessionStudents.value.filter((item) => item.attendance === '到课' && item.record).length,
    processed: sessionStudents.value.filter((item) => item.attendance === '到课' && item.processed).length,
    comments: sessionStudents.value.filter((item) => item.attendance === '到课' && item.comment).length,
    confirmed: sessionStudents.value.filter((item) => item.attendance === '到课' && item.confirmed).length,
    highlights: sessionStudents.value.filter((item) => item.attendance === '到课' && item.highlight).length,
    shareReady: sessionStudents.value.filter((item) => item.attendance === '到课' && item.shareReady).length,
    archived: sessionStudents.value.filter((item) => item.attendance === '到课' && item.archived).length,
    homeworkReady: displayConfig.value.showHomework !== false && !homework.value.content.trim() ? 0 : 1,
    referenceMaterials: referenceMaterials.value.length,
    coursewares: coursewareMaterials.value.length,
    classroomMaterials: materials.value.length,
    classroomMaterialsDone: materials.value.length || materialsConfirmedEmpty.value ? 1 : 0,
    artworks: materials.value.filter((item) => item.type === '范画').length,
    visibleMaterials: materials.value.filter((item) => item.visible).length
  }))

  const steps = computed(() => [
    { title: '课次确认', done: counts.value.attend ? 1 : 0, total: 1 },
    { title: '课堂资料', done: counts.value.classroomMaterialsDone, total: 1 },
    { title: '上传作品', done: counts.value.matched, total: counts.value.attend },
    { title: '课堂记录', done: counts.value.records, total: counts.value.attend },
    { title: '图文生成', done: Math.min(counts.value.processed, counts.value.confirmed), total: counts.value.attend },
    { title: '课后任务', done: counts.value.homeworkReady, total: 1 },
    { title: '归档留痕', done: counts.value.archived, total: counts.value.attend }
  ])

  const taskProgress = computed(() => {
    const total = counts.value.attend * 7 || 1
    const done =
      counts.value.attend +
      (counts.value.classroomMaterialsDone ? counts.value.attend : 0) +
      counts.value.matched +
      counts.value.records +
      Math.min(counts.value.processed, counts.value.confirmed) +
      (counts.value.homeworkReady ? counts.value.attend : 0) +
      counts.value.archived
    return Math.min(100, Math.round((done / total) * 100))
  })

  const progressForTask = (task) => {
    const workspace = ensureLessonWorkspace(task)
    const rows = workspace.studentDeliveries.filter((row) => row.attendance === '到课')
    if (task.status === '已完成') return 100
    if (!rows.length) return 0
    const completed =
      rows.length +
      (workspace.materials.length || workspace.materialsConfirmedEmpty ? rows.length : 0) +
      rows.filter((row) => row.imageMatched).length +
      rows.filter((row) => row.record).length +
      Math.min(rows.filter((row) => row.processed).length, rows.filter((row) => row.confirmed).length) +
      (workspace.homework?.visible && !workspace.homework.content.trim() ? 0 : rows.length) +
      rows.filter((row) => row.archived).length
    const workspaceProgress = Math.min(100, Math.round((completed / (rows.length * 7)) * 100))
    if (sameId(task.id, activeTaskId.value)) return taskProgress.value
    return workspaceProgress
  }

  const currentWarnings = computed(() => {
    const warnings = []
    if (!materials.value.length && !materialsConfirmedEmpty.value) warnings.push('课堂资料待上传或确认无资料')
    if (displayConfig.value.showHomework !== false && !homework.value.content.trim()) warnings.push('课后任务内容为空')
    attendingRows.value.forEach((row) => {
      const student = students.find((item) => sameId(item.id, row.studentId))
      const name = student?.name || row.studentName || '学生'
      if (!row.imageMatched) warnings.push(`${name}缺作品`)
      if (!row.imageConfirmed) warnings.push(`${name}图片待确认`)
      if (!row.record) warnings.push(`${name}缺课堂记录`)
      if (!row.comment) warnings.push(`${name}缺课评`)
      if (row.comment && !row.confirmed) warnings.push(`${name}课评待确认`)
    })
    return warnings
  })

  const archiveDoneStatuses = ['已同步', '已上传', '已归档', '已生成', '已确认', '已跳过', '待老师确认发送', '已发送', '人工触达', '发送失败']
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
      title: '家长展示发布与企微触达',
      meta: wecomEnabled.value
        ? '发布展示页快照并创建企业微信触达任务'
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
      action: '生成并归档',
      required: false,
      item: archiveChecklist.value.teacherEffectArchive
    },
    {
      key: 'wheatTrace',
      title: '小麦留痕待办',
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
    ensureLessonWorkspace(task)
    activeTaskId.value = task.id
  }

  const clearLoginVerification = () => {
    verifiedLoginUserId.value = null
    loginForm.role = ''
  }

  const verifyLogin = () => {
    const identifier = String(loginForm.phone || '').trim()
    const password = String(loginForm.password || '')
    const account = teachers.find((item) =>
      item.status === '启用' &&
      item.password === password &&
      (item.phone === identifier || item.username === identifier)
    )
    if (!account) {
      clearLoginVerification()
      notify('手机号或密码不正确，请检查后重试')
      return false
    }
    verifiedLoginUserId.value = account.id
    activeLoginRole.value = null
    loginForm.role = loginRoleOptions.value[0]?.value || account.role
    return true
  }

  const loginWithRole = (role = loginForm.role) => {
    const account = loginAccount.value
    const selectedRole = loginRoleOptions.value.find((option) => option.value === role)
    if (!account || !selectedRole) {
      notify('请选择当前账号可用的身份')
      return false
    }

    currentUserId.value = account.id
    activeLoginRole.value = selectedRole.value
    loginForm.role = selectedRole.value
    isLoggedIn.value = true
    const firstTask = visibleTasks.value[0]
    if (firstTask) selectTask(firstTask)
    notify(`已登录：${account.name}（${selectedRole.label}）`)
    return true
  }

  const loginAs = (teacherId) => {
    const teacher = teachers.find((item) => item.id === Number(teacherId))
    if (!teacher) return false
    loginForm.phone = teacher.phone
    loginForm.password = teacher.password || ''
    verifiedLoginUserId.value = teacher.id
    loginForm.role = teacher.availableRoles?.[0] || teacher.role
    return loginWithRole(loginForm.role)
  }

  const loginWithForm = () => {
    if (!verifiedLoginUserId.value) return verifyLogin()
    return loginWithRole(loginForm.role)
  }

  const logout = () => {
    isLoggedIn.value = false
    currentUserId.value = 1
    activeLoginRole.value = null
    verifiedLoginUserId.value = null
    loginForm.phone = ''
    loginForm.password = ''
    loginForm.role = ''
    notify('已退出登录')
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

  const addMaterial = (type = '范画') => {
    materials.value.push({
      id: Date.now(),
      lessonId: activeTaskId.value,
      type,
      title: `新上传${type} ${materials.value.length + 1}`,
      image: '',
      visible: true,
      libraryId: null
    })
    notify(`已上传一张${type}`)
  }

  const uploadLessonMaterial = (event, type = '范画') => {
    const files = [...(event.target.files || [])]
    if (!files.length) return
    files.forEach((file, index) => {
      const url = URL.createObjectURL(file)
      const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : ''
      materials.value.push({
        id: Date.now() + index,
        lessonId: activeTaskId.value,
        type,
        title: type === '课件' ? file.name : file.name.replace(/\.[^.]+$/, ''),
        image: type === '课件' ? '' : url,
        fileUrl: url,
        fileName: file.name,
        fileExt: extension,
        fileSize: file.size,
        visible: type !== '课件',
        libraryId: null
      })
    })
    materialsConfirmedEmpty.value = false
    event.target.value = ''
    notify(`已上传 ${files.length} 个${type}`)
  }

  const removeLessonMaterial = (material) => {
    const index = materials.value.findIndex((item) => item.id === material.id)
    if (index < 0) return
    materials.value.splice(index, 1)
    if (!materials.value.length) materialsConfirmedEmpty.value = false
    notify(`已删除${material.title}`)
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
    materials.value.push({ id: Date.now(), lessonId: activeTaskId.value, type: item.type, title: item.title, image: item.image, visible: true, libraryId: item.id })
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
    const index = homework.value.externalLinkIds.indexOf(id)
    if (index >= 0) homework.value.externalLinkIds.splice(index, 1)
    else homework.value.externalLinkIds.push(id)
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
    const missing = attendingRows.value.filter((row) => !row.confirmed || !row.imageConfirmed)
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
      note: '请回到小麦助教人工标记课程完成状态'
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
      if (!selectedArchiveTargets.value.includes('cloud:baidu')) selectedArchiveTargets.value = [...selectedArchiveTargets.value, 'cloud:baidu']
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
      if (enabledCloudProviders.value.length && !selectedArchiveTargets.value.includes('cloud:baidu')) selectedArchiveTargets.value = [...selectedArchiveTargets.value, 'cloud:baidu']
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
      notify('小麦留痕待办已经生成')
      return false
    }
    setArchiveChecklistItem('wheatTrace', { status: '生成中' })
    await runAction('正在生成小麦留痕待办...', '小麦留痕待办已生成', async () => {
      const trace = ensureWheatTrace()
      activeTask.value.wheatStatus = trace.status
      setArchiveChecklistItem('wheatTrace', { status: '已生成', traceId: trace.id, detail: '待老师或教务回到小麦助教人工处理' })
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
    const missing = attendingRows.value.filter((row) => !row.confirmed || !row.imageConfirmed)
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
      notify(`重复提交已拦截：该留痕已经是“${status}”`)
      return false
    }
    const isCorrection = ['已人工处理', '无需处理'].includes(before)
    if ((status === '异常' || status === '无需处理' || isCorrection) && !reason?.trim()) {
      notify(isCorrection ? '更正已完成状态必须填写更正原因' : '该状态变更必须填写说明')
      return false
    }
    if (isCorrection && !isAdmin.value) {
      notify('操作未执行：只有管理员可以更正已完成的留痕状态')
      return false
    }
    trace.status = status
    trace.note = reason?.trim() || (status === '已人工处理' ? '已在小麦助教人工处理完成' : trace.note)
    trace.lastReason = reason?.trim() || '人工确认已处理'
    trace.operator = currentUser.value?.name
    trace.processedAt = nowText()
    const lesson = `${activeTask.value.date} ${activeTask.value.time} · ${activeClass.value.name}`
    if (trace.lesson === lesson) activeTask.value.wheatStatus = status
    addStatusLog('小麦留痕', trace.id, before, status, trace.lastReason, '小麦留痕页', trace.lessonId || null)
    notify(`小麦留痕已标记为：${status}`)
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
      prompt: { model: '学生记录 + 课程参考 + 模板规则', scene: 'feedback', systemPrompt: '', userPrompt: '', temperature: 0.7, maxTokens: 220, status: '启用' },
      watermark: { value: school.watermark, position: '右下角', opacity: '80%', font: '授权字体', color: '#0018A8', status: '启用' }
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
      time: normalized.time || normalized.scheduleText || value.rawValues?.time || '',
      course: normalized.course || normalized.courseTitle || value.rawValues?.course || '',
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
    return {
      ...provider,
      category: mapProviderCategory({ ...provider, providerType }),
      endpoint: provider.endpoint || provider.config?.endpoint || '',
      appKey: provider.appKey || provider.config?.appKey || '',
      authType: provider.authType || provider.config?.authType || '',
      id: fromApiId(provider.id),
      type: providerType,
      providerType,
      version: Number(provider.version || 0),
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
          directoryRule: '',
          defaultArchiveTargets: []
        }
      }
    }))
  }

  const mapProviderGroups = (groups = []) => {
    replaceReactive(providerGroups, groups.map((group) => {
      const providers = (group.providers || []).map(mapProvider)
      return {
        ...group,
        id: group.key || group.id,
        name: group.name,
        category: String(group.category || '').toLowerCase(),
        status: ['ENABLED', 'ACTIVE'].includes(group.status) ? '已启用' : group.status === 'UNCONFIGURED' ? '未配置' : ['DISABLED', '停用'].includes(group.status) ? '未启用' : group.status || providerGroupStatusLabel(providers),
        value: {
          providers,
          directoryRule: group.directoryRule || '',
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

  const statusForArchiveItem = (value) => ({
    PENDING: '待处理', QUEUED: '创建中', CREATING: '创建中', RUNNING: '推送中', GENERATING: '生成中', GENERATED: '已生成', CONFIRMED: '已确认', SUCCEEDED: '已同步', SYNCED: '已同步', COMPLETED: '已归档', SKIPPED: '已跳过', FAILED: '发送失败', CANCELED: '已取消'
  }[value] || value || '待处理')

  const applyRemoteLesson = async (lessonId, value) => {
    const lesson = mapLesson(value?.lesson || tasks.find((item) => sameId(item.id, lessonId)) || {})
    if (lesson.id) {
      const existing = tasks.findIndex((item) => sameId(item.id, lesson.id))
      if (existing >= 0) tasks.splice(existing, 1, { ...tasks[existing], ...lesson })
      else tasks.unshift(lesson)
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
    const touchTasks = (parentModule.touchTasks || []).map((value) => {
      const task = mapTouchTask(value)
      const student = students.find((item) => sameId(item.id, task.studentId))
      return {
        ...task,
        studentName: student?.name || task.studentName,
        targetName: student?.parent || task.targetName || '家长',
        parent: student?.parent || task.targetName || '',
        lesson: `${lesson.date} ${lesson.time} · ${lesson.className || ''}`.trim()
      }
    })
    const wheat = mapWheat(parentModule.wheatTrace || {})
    const teacherEffect = value?.teacherEffect?.teacherEffect || value?.m3?.teacherEffect?.teacherEffect || {}
    const cloudJobs = value?.cloudArchive?.jobs || value?.m3?.cloudArchive?.jobs || []
    const archiveVersions = (value?.archive?.versions || []).map(mapArchiveVersion)
    const workspace = ensureLessonWorkspace(lesson)
    const draftDisplayConfig = {
      ...workspace.displayConfig,
      ...(currentDraft.displayConfig || draft.displayConfig || {})
    }
    ;['showMaterials', 'showHomework', 'showHighlight', 'showLessonType'].forEach((key) => {
      if (currentDraft[key] !== undefined) draftDisplayConfig[key] = Boolean(currentDraft[key])
    })
    const artworkByStudent = new Map(artworks.map((artwork) => [String(artwork.studentId), artwork]))
    const feedbackByStudent = new Map(feedbacks.map((feedback) => [String(feedback.studentId), feedback]))
    const assetsByStudent = new Map()
    assets.filter((asset) => asset.studentId).forEach((asset) => {
      const key = String(asset.studentId)
      if (!assetsByStudent.has(key)) assetsByStudent.set(key, [])
      assetsByStudent.get(key).push(asset)
    })
    const rows = attendance.map((attendanceRow) => {
      const artwork = artworkByStudent.get(String(attendanceRow.studentId))
      const feedback = feedbackByStudent.get(String(attendanceRow.studentId))
      const studentAssets = assetsByStudent.get(String(attendanceRow.studentId)) || []
      const versions = artwork?.versions || []
      const latestVersionJob = versions.filter((version) => version.jobId).at(-1)
      const selectedVersion = versions.find((version) => sameId(version.id, artwork?.selectedVersionId)) || versions.at(-1)
      const processedVersion = versions.find((version) => version.versionKind === 'PROCESSED') || selectedVersion
      const originalVersion = versions.find((version) => version.versionKind === 'ORIGINAL') || selectedVersion
      return {
        id: attendanceRow.studentId,
        lessonId: lesson.id,
        studentId: attendanceRow.studentId,
        studentName: attendanceRow.studentName || '',
        studentArchived: Boolean(attendanceRow.studentArchived),
        attendance: attendanceRow.attendance,
        attendanceVersion: attendanceRow.version,
        note: attendanceRow.note || '',
        imageFileIds: [...studentAssets.map((asset) => asset.fileId), selectedVersion?.fileId].filter(Boolean),
        images: [],
        image: '',
        originalImage: '',
        processedImage: '',
        originalFileId: originalVersion?.fileId || null,
        processedFileId: processedVersion?.fileId || null,
        imageMatched: Boolean(artwork || studentAssets.length),
        imageConfirmed: artwork?.confirmationStatus === 'CONFIRMED' || artwork?.status === 'CONFIRMED',
        artworkId: artwork?.id || null,
        artworkVersion: artwork?.version || 0,
        selectedVersionId: selectedVersion?.id || null,
        originalVersionId: originalVersion?.id || null,
        processedVersionId: processedVersion?.id || null,
        processed: Boolean(processedVersion && processedVersion.versionKind === 'PROCESSED'),
        imageProcessStatus: artwork?.job?.statusLabel || latestVersionJob?.job?.statusLabel || artwork?.statusLabel || '未处理',
        imageProcessError: artwork?.job?.failureReason || latestVersionJob?.job?.failureReason || artwork?.failureReason || '',
        record: feedback?.classroomRecord || '',
        comment: feedback?.content || '',
        feedbackId: feedback?.id || null,
        feedbackVersion: feedback?.version || 0,
        feedbackVersionId: feedback?.currentVersionId || null,
        confirmed: feedback?.status === 'CONFIRMED' || Boolean(feedback?.confirmedVersionId),
        highlight: false,
        highlightNote: '',
        shareReady: Boolean(draft.accessLinks?.some((link) => sameId(link.studentId, attendanceRow.studentId))),
        archived: lesson.status === '已完成'
      }
    })
    const materialItems = assets.filter((asset) => !asset.studentId).map((asset) => ({
      ...asset,
      image: '',
      lessonId: lesson.id
    }))
    const homeworkData = parentModule.homework || draft.homework || draft.publishedSnapshot?.homework || {}
    Object.assign(workspace, {
      lessonId: lesson.id,
      studentDeliveries: rows,
      materials: materialItems,
      materialsConfirmedEmpty: Boolean(assetsModule.materialsConfirmedEmpty),
      materialsVersion: workspace.materialsVersion ?? null,
      homework: { ...workspace.homework, ...homeworkData, externalLinkIds: fromApiIds(homeworkData.externalLinkIds || []) },
      displayConfig: draftDisplayConfig,
      sharePage: mergeSharePageForWorkspace(workspace, draft),
      teacherEffect,
      cloudJobs,
      archiveVersions,
      artworkJobs: {},
      completion: value?.completion || value?.completionCheck || null,
      availableCommands: value?.availableCommands || []
    })
    const touchStatus = touchTasks.length && touchTasks.every((task) => ['已发送', '人工触达'].includes(task.status)) ? '已发送' : touchTasks.some((task) => task.status === '发送失败') ? '发送失败' : touchTasks.length ? '待老师确认发送' : '待创建'
    Object.assign(workspace.archiveChecklist, {
      parentTouch: { ...workspace.archiveChecklist.parentTouch, status: touchStatus, sentCount: touchTasks.filter((task) => ['已发送', '人工触达'].includes(task.status)).length, detail: touchTasks.length ? `已创建 ${touchTasks.length} 个触达任务` : '' },
      studentCloudArchive: { ...workspace.archiveChecklist.studentCloudArchive, status: statusForArchiveItem(cloudJobs.find((job) => job.required || ['LESSON_ASSET', 'ARCHIVE_RECORD', 'TEACHER_EFFECT'].includes(job.sourceType))?.status) },
      teacherEffectArchive: { ...workspace.archiveChecklist.teacherEffectArchive, status: statusForArchiveItem(teacherEffect.status), title: teacherEffect.title || '', imageCount: teacherEffect.sources?.length || 0, detail: teacherEffect.failureReason || '' },
      wheatTrace: { ...workspace.archiveChecklist.wheatTrace, status: wheat.status === '已人工处理' || wheat.status === '无需处理' ? wheat.status : wheat.id ? '已生成' : '待生成', traceId: wheat.id || null, detail: wheat.note || '' }
    })
    replaceReactive(wheatTraces, [...wheatTraces.filter((item) => !sameId(item.lessonId, lesson.id)), wheat.id ? { ...wheat, lesson: `${lesson.date} ${lesson.time} · ${lesson.className}`, course: lesson.courseTitle, teacher: lesson.teacher } : null].filter(Boolean))
    replaceReactive(wecomSendTasks, touchTasks)
    return workspace
  }

  const lessonWorkspacePromises = new Map()
  const lessonWorkspaceControllers = new Map()
  const lessonWorkspaceEpochs = new Map()
  const lessonWorkspaceLoaded = new Set()
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

  const waitForJobs = async (jobIds = [], lessonId) => {
    const pendingIds = jobIds.filter(Boolean).map(String)
    if (!pendingIds.length) return
    const terminal = new Set(['SUCCEEDED', 'FAILED', 'CANCELED', 'STALE'])
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (attempt > 0) await wait(700)
      const results = await Promise.allSettled([api.jobs.list({ ids: pendingIds })])
      const snapshots = results[0]?.status === 'fulfilled' ? (results[0].value || []) : []
      if (!snapshots.length) break
      if (snapshots.length && snapshots.every((job) => terminal.has(job.status))) break
    }
    if (lessonId) await refreshRemoteLesson(lessonId)
  }

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
      if (!filters.status) filters.status = 'COMPLETED'
      filters.archived = true
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
    const page = mapPage(await api.todo.wheatTraces({ status: ['PENDING', 'EXCEPTION'], page: 1, pageSize: 20 }), mapWheatListItem)
    replaceReactive(wheatTraces, page.items.filter(Boolean))
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
        api.todo.wheatTraces({ status: ['PENDING', 'EXCEPTION'], page: 1, pageSize: 20 }),
        api.todo.list({ status: 'OPEN', page: 1, pageSize: 20 }),
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
      const wheatPage = mapPage(valueAt(2), mapWheatListItem)
      replaceReactive(wheatTraces, wheatPage.items.filter(Boolean))
      updatePageMeta(shellPages.wheatTraces, wheatPage)
      updateListPageMeta('wheatTraces', wheatPage)
      const todoPage = mapPage(valueAt(3), mapTodo)
      replaceReactive(todos, todoPage.items)
      updatePageMeta(shellPages.todos, todoPage)
      updateListPageMeta('todos', todoPage)
      if (valueAt(4)) Object.assign(shellSummary, valueAt(4))
      if (!activeTaskId.value && tasks[0]) activeTaskId.value = tasks[0].id
      pageLoaded.shell = true
      remoteReady.value = true
      return shellSummary
    } finally {
      remoteLoading.value = false
    }
  }

  const loadTemplates = async ({ force = false } = {}) => {
    if (pageLoaded.templates && !force) return templates
    const value = await api.workbench.templates()
    templates.comment = (value?.comment || []).map((item) => ({ ...item, length: item.hint || item.lengthHint || '', tone: item.category || item.tone || '' }))
    templates.image = (value?.image || []).map((item) => ({ ...item }))
    templates.prompt = (value?.prompt || []).map((item) => ({ ...item }))
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
              api.master.teachers({ page: 1, pageSize: 20 }), api.master.students({ page: 1, pageSize: 20 }),
              api.master.classes({ page: 1, pageSize: 20 }), api.master.courses({ page: 1, pageSize: 20 })
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
            const [archivePage, , studentPage, classPage] = await Promise.all([
              api.archive.records({ page: 1, pageSize: 20 }),
              portfolioStudioRef?.loadPortfolioData?.(),
              api.master.students({ page: 1, pageSize: 20 }),
              api.master.classes({ page: 1, pageSize: 20 })
            ])
            const mappedArchives = mapPage(archivePage, mapArchiveRecord)
            const mappedStudents = mapPage(studentPage, mapStudent)
            const mappedClasses = mapPage(classPage, mapClass)
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
            const [providers, providerTypes, groups] = await Promise.all([api.m5.providers({ page: 1, pageSize: 20 }), api.m5.providerTypes(), api.m5.providerGroups()])
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
      case 'wheat-traces': return refreshWheatTraces()
      case 'todos': return refreshTodos()
      case 'lesson.workspace': return lessonId ? refreshRemoteLesson(lessonId, { force }) : null
      case 'archive.records': return loadPageData('archives', { force })
      case 'imports': return loadPageData('imports', { force })
      default: return loadPageData(key, { force })
    }
  }

  const remoteVerifyLogin = async () => {
    try {
      const auth = await api.auth.login({ account: loginForm.phone.trim(), password: loginForm.password })
      setSession(auth)
      pendingAuth.value = auth
      verifiedLoginUserId.value = auth.me?.user?.id || null
      return true
    } catch (error) {
      notify(remoteErrorMessage(error, '账号或密码不正确'))
      return false
    }
  }

  const remoteLoginWithRole = async (role = loginForm.role) => {
    if (!pendingAuth.value?.me) return false
    activeLoginRole.value = role || pendingAuth.value.me.roles?.[0]?.name || '老师'
    loginForm.role = activeLoginRole.value
    storedMe.value = pendingAuth.value.me
    currentUserId.value = pendingAuth.value.me.user?.id || null
    isLoggedIn.value = true
    try {
      await loadShellData({ initialMe: pendingAuth.value.me })
    } catch (error) {
      notify(remoteErrorMessage(error, '登录后加载数据失败'))
      return false
    }
    notify(`欢迎回来，${currentUser.value?.name || '用户'}`)
    return true
  }

  const remoteLoginWithForm = async () => {
    if (!(await remoteVerifyLogin())) return false
    const role = loginRoleOptions.value[0]?.value || ''
    return remoteLoginWithRole(role)
  }

  const remoteClearLoginVerification = () => {
    pendingAuth.value = null
    verifiedLoginUserId.value = null
    activeLoginRole.value = null
    loginForm.role = ''
    clearSession()
  }

  const remoteLogout = async () => {
    try {
      if (getAccessToken()) await api.auth.logout()
    } catch {
      // 服务端会话失效时仍清理本地凭据。
    }
    clearSession()
    lessonWorkspaceControllers.forEach((controller) => controller.abort())
    lessonWorkspaceControllers.clear()
    lessonWorkspacePromises.clear()
    lessonWorkspaceEpochs.clear()
    lessonWorkspaceLoaded.clear()
    clearProtectedMediaCache()
    portfolioStudioRef?.clearPortfolioSession?.()
    storedMe.value = null
    pendingAuth.value = null
    isLoggedIn.value = false
    remoteReady.value = false
    replaceReactive(teachers)
    replaceReactive(students)
    replaceReactive(classes)
    replaceReactive(courses)
    replaceReactive(tasks)
    replaceReactive(archiveRecords)
    replaceReactive(artworkLibrary)
    replaceReactive(communicationRecords)
    replaceReactive(extraTaskArchives)
    replaceReactive(extraTaskWorks)
    replaceReactive(externalLinks)
    replaceReactive(wheatTraces)
    replaceReactive(todos)
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
    Object.keys(pageLoaded).forEach((key) => delete pageLoaded[key])
    Object.keys(pageErrors).forEach((key) => delete pageErrors[key])
    Object.keys(pageMeta).forEach((key) => delete pageMeta[key])
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
    activeTaskId.value = task.id
    const workspace = ensureLessonWorkspace(task)
    if (workspace) workspace.currentStep = 0
    if (!pageLoaded.tasks) await loadPageData('tasks')
    return runRemote('正在加载课次工作区...', () => loadLessonWorkspace(task.id))
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
    const mapped = mapLesson(result)
    const index = tasks.findIndex((item) => sameId(item.id, task.id))
    if (index >= 0) tasks.splice(index, 1, { ...tasks[index], ...mapped })
    await refreshRemoteLesson(task.id)
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

  const remoteUploadLessonMaterial = async (event, type = '范画') => {
    const files = [...(event.target.files || [])]
    event.target.value = ''
    if (!files.length || !activeTask.value?.id) return false
    const result = await runRemote('正在上传课堂资料...', async () => {
      const items = []
      for (const file of files) {
        const uploaded = await uploadFile(file, `lesson-${activeTask.value.id}-asset`)
        items.push({
          fileId: String(uploaded.id),
          assetType: toApiAssetType(type),
          title: file.name,
          visible: type !== '课堂视频',
          sortOrder: materials.value.length + items.length
        })
      }
      await api.assets.createBatch(activeTask.value.id, items)
      await refreshRemoteLesson(activeTask.value.id)
      return true
    }, `已上传 ${files.length} 个课堂资料`)
    return result === true
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

  const remoteUpdateImage = async (event, row, replaceIndex = null) => {
    const files = [...(event.target.files || [])]
    event.target.value = ''
    if (!files.length || !row?.studentId || !activeTask.value?.id) return
    await runRemote('正在上传学生作品...', async () => {
      const items = []
      const baseSortOrder = Number(row.imageFileIds?.length || row.images?.length || 0)
      for (const file of files) {
        const uploaded = await uploadFile(file, `lesson-${activeTask.value.id}-artwork-${row.studentId}`)
        items.push({ studentId: String(row.studentId), fileId: String(uploaded.id), sortOrder: replaceIndex === null ? baseSortOrder + items.length : replaceIndex })
      }
      await api.assets.createArtworksBatch(activeTask.value.id, items)
      await refreshRemoteLesson(activeTask.value.id)
    }, `已为${students.find((item) => sameId(item.id, row.studentId))?.name || '学生'}上传作品`)
  }

  const remoteRemoveStudentImage = async (row) => {
    if (!row?.artworkId) return false
    const result = await runRemote('正在删除作品...', () => api.assets.removeArtwork(row.artworkId, row.artworkVersion))
    if (!result) return false
    await refreshRemoteLesson(activeTask.value.id)
    return true
  }

  const remoteConfirmCurrentImage = async (mode = 'processed') => {
    const row = activeSessionStudent.value
    if (!row?.artworkId) return false
    const versionId = mode === 'processed' ? (row.processedVersionId || row.selectedVersionId) : (row.originalVersionId || row.selectedVersionId)
    if (!versionId) {
      notify('当前学生没有可确认的图片版本')
      return false
    }
    const result = await runRemote('正在确认作品图片...', () => api.assets.confirmArtwork(row.artworkId, { versionId: String(versionId), version: row.artworkVersion }))
    if (!result) return false
    await refreshRemoteLesson(activeTask.value.id)
    return true
  }

  const remoteProcessImages = async () => {
    const rows = attendingRows.value.filter((row) => row.artworkId)
    if (!rows.length) {
      notify('请先上传学生作品')
      return false
    }
    const result = await runRemote('正在提交图片处理任务...', async () => {
      const jobs = await api.assets.processArtworksBatch(activeTask.value.id, rows.map((row) => row.artworkId), {
        templateKey: activeImageTemplate.value?.templateKey || activeImageTemplate.value?.name || undefined,
        parameters: JSON.stringify({})
      })
      const jobIds = (Array.isArray(jobs) ? jobs : jobs?.items || []).map((job) => job?.jobId).filter(Boolean)
      await waitForJobs(jobIds, activeTask.value.id)
      return true
    }, '图片处理任务已提交')
    return result === true
  }

  const remoteRetryCurrentImageProcess = async () => {
    const row = activeSessionStudent.value
    if (!row?.artworkId) return false
    const result = await runRemote('正在重试图片处理...', () => api.assets.processArtwork(row.artworkId, { templateKey: activeImageTemplate.value?.templateKey || undefined, parameters: JSON.stringify({}) }), '图片处理任务已重新提交')
    if (!result) return false
    await waitForJobs([result.jobId], activeTask.value.id)
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
      const feedback = row.feedbackId
        ? row
        : await api.feedback.saveForStudent(activeTask.value.id, row.studentId, feedbackBodyFor(row))
      if (!feedback?.id && !row.feedbackId) throw new Error('课堂记录保存失败，无法生成课评')
      const generation = await api.feedback.regenerate(feedback.id || row.feedbackId, {
        templateId: templates.comment[selectedCommentTemplate.value]?.id,
        promptTemplateId: templates.prompt[0]?.id
      })
      await waitForJobs([generation?.jobId], activeTask.value.id)
      return generation
    })
    if (result) await refreshRemoteLesson(activeTask.value.id)
    return result
  }

  const remoteGenerateAll = async () => {
    const rows = attendingRows.value
    if (!rows.length) {
      notify('当前课次没有到课学生')
      return false
    }
    const result = await runRemote('正在保存课堂记录并生成全班 1v1 课评...', async () => {
      await api.feedback.saveBatch(activeTask.value.id, rows.map((row) => ({ studentId: String(row.studentId), ...feedbackBodyFor(row) })))
      const generation = await api.feedback.generate(activeTask.value.id, {
        templateId: templates.comment[selectedCommentTemplate.value]?.id,
        promptTemplateId: templates.prompt[0]?.id
      })
      await waitForJobs((generation?.items || []).map((item) => item.jobId), activeTask.value.id)
      return generation
    }, '课评生成任务已提交')
    if (result) await refreshRemoteLesson(activeTask.value.id)
    return result
  }

  const remoteConfirmCurrentComment = async () => {
    const row = activeSessionStudent.value
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
    notify(`${activeStudent.value?.name || '当前学生'}课评已确认`)
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
    showHomework: displayConfig.value.showHomework !== false,
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
      highlightNote: row.highlightNote || ''
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
    homework: { ...clone(homework.value), visible: displayConfig.value.showHomework !== false, externalLinkIds: (homework.value.externalLinkIds || []).map(String) },
    displayConfig: clone(displayConfig.value),
    school: clone(school),
    externalLinks: selectedExternalLinks.value.map((link) => ({
      ...clone(link),
      id: String(link.id),
      courseId: link.courseId === null || link.courseId === undefined ? null : String(link.courseId)
    }))
  })

  const remoteSaveShareDraft = async (reason = '调整展示内容') => {
    if (!activeTask.value?.id) return false
    const payload = remoteShareDraftPayload()
    const result = await runRemote('正在保存家长展示草稿...', () => api.parent.saveDraft(activeTask.value.id, payload), '展示草稿已保存')
    if (!result) return false
    const workspace = ensureLessonWorkspace(activeTask.value)
    const page = mapSharePage(result)
    workspace.sharePage = mergeSharePageForWorkspace(workspace, page)
    if (page.homework) workspace.homework = { ...workspace.homework, ...page.homework }
    workspace.sharePage.draftSnapshot = payload
    addStatusLog('家长展示页', activeTask.value.id, '已发布', '草稿', reason)
    return true
  }

  const remoteToggleHighlight = async (row) => {
    if (!row || !activeTask.value?.id) return false
    const previous = { highlight: Boolean(row.highlight), highlightNote: row.highlightNote || '' }
    row.highlight = !previous.highlight
    if (row.highlight && !row.highlightNote) row.highlightNote = '作品表现突出，可作为本节课高光展示。'
    const saved = await remoteSaveShareDraft('更新作品高光')
    if (!saved) Object.assign(row, previous)
    return saved
  }

  const remoteGenerateSharePages = async () => {
    const missing = attendingRows.value.filter((row) => !row.confirmed || !row.imageConfirmed)
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
    await refreshRemoteLesson(activeTask.value.id)
    return true
  }

  const remoteManualCopyStudentLink = async (row) => {
    const task = wecomTaskFor(activeTask.value.id, row.studentId)
    if (!task) return remoteCopyStudentLink(row)
    const result = await runRemote('正在记录人工触达...', () => api.parent.fallbackManual(task.id, { reason: '复制链接人工发送', version: task.version, shareUrl: task.shareUrl }))
    if (!result) return false
    await refreshRemoteLesson(activeTask.value.id)
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
    await refreshRemoteLesson(task.lessonId)
    return remoteCopyStudentLink({ studentId: task.studentId })
  }

  const remoteMarkWecomSendTask = async (task, status, reason = '') => {
    if (!task?.id) return false
    const action = status === '已发送' ? api.parent.markSent : status === '人工触达' ? api.parent.fallbackManual : status === '已取消' ? api.parent.cancelTouch : null
    if (!action) return false
    const body = status === '已发送' ? { version: task.version } : { reason: reason.trim() || '人工操作', version: task.version }
    const result = await runRemote('正在更新触达任务...', () => action(task.id, body))
    if (!result) return false
    await refreshRemoteLesson(task.lessonId)
    return true
  }

  const remoteRetryWecomSendTask = async (task) => {
    if (!task?.id) return false
    const result = await runRemote('正在重试触达任务...', () => api.parent.retryTouch(task.id, { version: task.version }), '触达任务已重新提交')
    if (!result) return false
    await refreshRemoteLesson(task.lessonId)
    return true
  }

  const remoteGenerateWheatTraceTask = async () => {
    if (!activeTask.value?.id) return false
    const result = await runRemote('正在创建小麦留痕...', () => api.todo.createWheat(activeTask.value.id, createIdempotencyKey(`wheat:${activeTask.value.id}`)), '小麦留痕已创建')
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
    const result = await runRemote('正在更新小麦留痕...', () => api.todo.transitionWheat(trace.id, {
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
    const source = materials.value.find((item) => item.id && item.fileId)
    if (!source) {
      notify('请先上传至少一份课堂资料，再创建云归档任务')
      return false
    }
    const failedJob = (activeWorkspace.value.cloudJobs || []).find((job) => ['FAILED', 'CANCELED'].includes(job.status) && job.retryable)
    const result = failedJob
      ? await runRemote('正在重试云归档任务...', () => api.m5.retryCloud(failedJob.id, { version: failedJob.version }, createIdempotencyKey(`cloud-archive-retry:${failedJob.id}`)), '云归档任务已重新提交')
      : await runRemote('正在创建云归档任务...', () => api.m5.cloudArchive(activeTask.value.id, {
          sourceType: 'LESSON_ASSET', sourceId: String(source.id), fileId: String(source.fileId), required: false
        }, createIdempotencyKey(`cloud-archive:${activeTask.value.id}`)), '云归档任务已创建')
    if (!result) return false
    await refreshRemoteLesson(activeTask.value.id)
    return true
  }

  const remoteArchiveTeacherEffectImage = async () => {
    let effect = activeWorkspace.value.teacherEffect
    if (!effect) {
      try {
        effect = await api.m5.teacherEffect(activeTask.value.id)
      } catch (error) {
        if (error?.status !== 404 && error?.code !== 'RESOURCE_NOT_FOUND') {
          notify(remoteErrorMessage(error, '老师课效图加载失败'))
          return false
        }
      }
    }
    if (!effect?.id) {
      const draft = await runRemote('正在保存课效图草稿...', () => api.m5.saveTeacherEffectDraft(activeTask.value.id, {
        sourceAssetIds: materials.value.map((item) => String(item.id)).filter(Boolean),
        title: `${activeTask.value.date} ${activeClass.value.name}`,
        version: effect?.version || 0
      }))
      if (!draft?.id) return false
      const job = await runRemote('正在生成老师课效长图...', () => api.m5.generateTeacherEffect(activeTask.value.id, { version: draft.version }, createIdempotencyKey(`teacher-effect:${activeTask.value.id}`)), '课效图生成任务已提交')
      if (!job) return false
    } else {
      const job = await runRemote('正在生成老师课效长图...', () => api.m5.generateTeacherEffect(activeTask.value.id, { version: effect.version }, createIdempotencyKey(`teacher-effect:${activeTask.value.id}`)), '课效图生成任务已提交')
      if (!job) return false
    }
    await refreshRemoteLesson(activeTask.value.id)
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
    if (!effect?.id) return remoteArchiveTeacherEffectImage()
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
      invalidateResource('workbench.summary')
    ])
    return true
  }

  const apiStudentStatus = (value) => ({ 在读: 'ACTIVE', 停课: 'SUSPENDED', 请假: 'LEAVE', 退费: 'REFUNDED' }[value] || value || 'ACTIVE')
  const apiEnabledStatus = (value) => ({ 启用: 'ENABLED', 停用: 'DISABLED' }[value] || value || 'ENABLED')
  const apiClassStatus = (value) => ({ 筹备中: 'PREPARING', 开班中: 'ACTIVE', 停课: 'SUSPENDED', 结课: 'COMPLETED' }[value] || value || 'PREPARING')
  const apiLessonSource = (value) => ({ 手动补录: 'MANUAL', 小麦课表复制: 'WHEAT_COPY', '小麦 Excel 导入': 'WHEAT_EXCEL' }[value] || value || 'MANUAL')
  const apiExtraTaskStatus = (value) => ({
    待发布: 'DRAFT',
    已发布: 'PUBLISHED',
    进行中: 'IN_PROGRESS',
    待归档: 'PENDING_ARCHIVE',
    已归档: 'ARCHIVED',
    已取消: 'CANCELED'
  }[value] || value || 'DRAFT')

  const remoteAddLesson = async (payload) => {
    const result = await runRemote('正在创建课次...', () => api.lessons.create({
      classId: String(payload.classId), teacherId: payload.teacherId ? String(payload.teacherId) : undefined, courseId: payload.courseId ? String(payload.courseId) : undefined,
      dateValue: payload.dateValue, startTime: String(payload.time || '00:00').slice(0, 5), endTime: payload.endTime || undefined,
      lessonType: toApiLessonType(payload.lessonType || '其他'), sourceType: apiLessonSource(payload.importedFrom), sourceAttendanceCount: payload.sourceAttendanceCount
    }), '课次已创建', () => Promise.all([invalidateResource('lessons.today'), invalidateResource('workbench.summary')]))
    if (!result) return null
    const lesson = mapLesson(result)
    tasks.unshift(lesson)
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
        scheduleText: klass.scheduleText || klass.time || '',
        status: apiClassStatus(klass.status),
        studentIds: nextStudentIds,
        version: klass.version
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
      courseId: payload.courseId ? String(payload.courseId) : undefined, name: payload.name, scheduleText: payload.time || payload.scheduleText || '',
      status: apiClassStatus(payload.status), studentIds: (payload.studentIds || []).map(String)
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
      courseId: payload.courseId ? String(payload.courseId) : undefined, name: payload.name, scheduleText: payload.time || payload.scheduleText || '',
      status: apiClassStatus(payload.status), studentIds: (payload.studentIds || []).map(String), version: current?.version || 0
    }), '班级信息已保存', () => invalidateResource('classes'))
    if (!result) return null
    const klass = mapClass(result)
    const index = classes.findIndex((item) => sameId(item.id, classId))
    classes.splice(index, 1, klass)
    return klass
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
    const result = await runRemote('正在创建外部课程链接...', () => api.master.createExternalLink({ courseId: payload.courseIds?.[0] ? String(payload.courseIds[0]) : payload.courseId ? String(payload.courseId) : undefined, title: payload.title, url: payload.url, note: payload.note || undefined }), '外部课程链接已创建', () => invalidateResource('externalLinks'))
    if (!result) return null
    const link = mapExternalLink(result)
    externalLinks.push(link)
    return link
  }

  const remoteUpdateExternalLink = async (linkId, payload) => {
    const current = externalLinks.find((item) => sameId(item.id, linkId))
    const result = await runRemote('正在保存外部课程链接...', () => api.master.updateExternalLink(linkId, {
      courseId: payload.courseIds?.[0] ? String(payload.courseIds[0]) : payload.courseId ? String(payload.courseId) : undefined, title: payload.title, url: payload.url, note: payload.note || undefined, status: apiEnabledStatus(payload.status), version: current?.version || 0
    }), '外部课程链接已保存', () => invalidateResource('externalLinks'))
    if (!result) return null
    const link = mapExternalLink(result)
    const index = externalLinks.findIndex((item) => sameId(item.id, linkId))
    externalLinks.splice(index, 1, link)
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

  const remoteUpdateSetting = async (settingId, payload) => {
    const providers = payload.value?.providers || []
    if (!providers.length) {
      notify('请先添加配置通道')
      return null
    }
    for (const provider of providers) {
      const providerType = provider.providerType || provider.type
      if (!providerType) {
        notify('缺少服务端提供的通道类型，无法保存配置')
        return null
      }
      const config = {
        ...(provider.config || {}),
        endpoint: provider.endpoint || provider.config?.endpoint || '',
        appKey: provider.appKey || provider.config?.appKey || '',
        authType: provider.authType || provider.config?.authType || ''
      }
      if (!provider.id || String(provider.id).startsWith('provider-')) {
        const saved = await runRemote('正在创建通道配置...', () => api.m5.createProvider({ scopeType: 'CAMPUS', providerType, name: provider.name, capabilities: provider.capabilities || [], config, status: provider.enabled ? 'ENABLED' : 'DISABLED' }), '', () => invalidateResource('settings'))
        if (!saved) return null
      } else {
        const saved = await runRemote('正在保存通道配置...', () => api.m5.updateProvider(provider.id, { name: provider.name, capabilities: provider.capabilities || [], config, status: provider.enabled ? 'ENABLED' : 'DISABLED', version: provider.version || 0 }), '', () => invalidateResource('settings'))
        if (!saved) return null
      }
    }
    const latest = await runRemote('正在刷新通道配置...', () => api.m5.providers(), '', () => invalidateResource('settings'))
    if (!latest) return null
    mapProviderSetting(latest)
    return settings[0]
  }

  const remoteTestProvider = async (provider) => {
    if (!provider?.id || String(provider.id).startsWith('provider-')) {
      notify('请先保存通道配置后再测试')
      return null
    }
    const result = await runRemote('正在测试通道连接...', () => api.m5.testProvider(provider.id), '通道测试完成', () => invalidateResource('settings'))
    if (result) provider.tokenStatus = result.success ? '连接正常' : (result.message || '连接失败')
    return result
  }

  const remoteAddTemplate = () => {
    notify('模板暂不可新增')
    return null
  }

  const remoteUpdateTemplate = () => {
    notify('模板暂不可编辑')
    return null
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
    const skipRowIds = importPreviewRows.filter((row) => row.status !== '可导入').map((row) => String(row.id))
    const result = await runRemote('正在确认导入...', () => api.imports.confirm(pendingImportMeta.batchId, { version: pendingImportMeta.version, skipRowIds }, createIdempotencyKey(`import-confirm:${pendingImportMeta.batchId}`)), '导入已确认', () => Promise.all([invalidateResource('imports'), invalidateResource('lessons.today'), invalidateResource('workbench.summary')]))
    if (!result) return false
    replaceReactive(importBatches, [mapImportBatch(result), ...importBatches.filter((item) => !sameId(item.id, result.id))])
    pendingImportMeta.batchId = null
    pendingImportFile.value = null
    await Promise.all([
      invalidateResource('imports'),
      invalidateResource('lessons.today'),
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
      : api.m6.createQualityReview({ lessonId: String(payload.lessonId), score, comment: payload.comment?.trim() || '', version: payload.version }), '质量评分已保存', () => invalidateResource('supervision'))
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
    if (!current) return null
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
    templates,
    classTypes,
    tasks,
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
    referenceMaterials,
    coursewareMaterials,
    materialsConfirmedEmpty,
    homework,
    displayConfig,
    externalLinks,
    wheatTraces,
    todos,
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
    toast,
    previewPulse,
    commentPulse,
    reportPulse,
    bulkRecord,
    activeShareMode,
    activeTask,
    currentUser,
    loginAccount,
    loginRoleOptions,
    isAdmin,
    canManageIdentityUsers,
    canManageIdentityRoles,
    canManageIdentityMemberships,
    canQualityReview,
    canQualityRead,
    canEditExtraTaskArtwork,
    authorizedClassIds,
    visibleTasks,
    visibleNavItems,
    activeClass,
    activeCourse,
    activeSessionStudent,
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
    manualCopyWecomTask: remoteManualCopyWecomTask,
    manualCopyStudentLink,
    parentShareUrl: remoteParentShareUrl,
    studentShareUrlFor: remoteStudentShareUrlFor,
    qrText,
    exportText: remoteExportText,
    fileNameFor: remoteFileNameFor,
    selectTask: remoteSelectTask,
    transitionLesson: remoteTransitionLesson,
    loginAs: () => {
      notify('请使用服务端账号登录')
      return false
    },
    verifyLogin: remoteVerifyLogin,
    loginWithRole: remoteLoginWithRole,
    loginWithForm: remoteLoginWithForm,
    clearLoginVerification: remoteClearLoginVerification,
    logout: remoteLogout,
    savePreferences: remoteSavePreferences,
    setAttendance: remoteSetAttendance,
    toggleMaterialVisible: remoteToggleMaterialVisible,
    addMaterial: remoteUploadLessonMaterial,
    uploadLessonMaterial: remoteUploadLessonMaterial,
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
    processImages: remoteProcessImages,
    failCurrentImageProcess: () => notify('图片处理失败请根据服务端任务状态重试'),
    retryCurrentImageProcess: remoteRetryCurrentImageProcess,
    generateOne: remoteGenerateOne,
    generateAll: remoteGenerateAll,
    confirmAll: remoteConfirmAll,
    confirmCurrentComment: remoteConfirmCurrentComment,
    saveSessionRecord: remoteSaveRecord,
    toggleHighlight: remoteToggleHighlight,
    toggleHomeworkLink,
    saveShareDraft: remoteSaveShareDraft,
    generateSharePages: remoteGenerateSharePages,
    revokeSharePage: remoteRevokeSharePage,
    getLessonWorkspace: (lessonId) => lessonWorkspaces[String(lessonId)] || null,
    isShareAccessible: () => false,
    pushArchiveItem: remotePushArchiveItem,
    archiveTeacherEffectImage: remoteArchiveTeacherEffectImage,
    confirmTeacherEffect: remoteConfirmTeacherEffect,
    retryTeacherEffect: remoteRetryTeacherEffect,
    skipTeacherEffect: remoteSkipTeacherEffect,
    generateWheatTraceTask: remoteGenerateWheatTraceTask,
    archiveAll: remoteArchiveAll,
    copyExport: remoteCopyExport,
    copyStudentLink: remoteCopyStudentLink,
    updateImage: remoteUpdateImage,
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
    loadDirectoryDetail,
    loadDirectoryExtraTaskWorks,
    loadClassTypes,
    shellSummary,
    shellPages,
    invalidateResource
  }
}
