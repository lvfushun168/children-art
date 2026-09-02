const safeUiId = (value) => {
  if (value === null || value === undefined || value === '') return null
  const text = String(value)
  const numeric = Number(text)
  return Number.isSafeInteger(numeric) && String(numeric) === text ? numeric : text
}

export const sameId = (left, right) => String(left ?? '') === String(right ?? '')
export const fromApiId = safeUiId
export const fromApiIds = (values = []) => (Array.isArray(values) ? values.map(safeUiId).filter((value) => value !== null) : [])
export const displayDate = (value) => {
  if (!value) return ''
  const [year, month, day] = String(value).slice(0, 10).split('-')
  return year && month && day ? `${Number(month)}月${Number(day)}日` : String(value)
}
export const displayTime = (value) => String(value || '').slice(0, 5)
export const displayDateTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', { hour12: false })
}

const lessonStatus = { PENDING: '待处理', PROCESSING: '处理中', COMPLETED: '已完成', EXCEPTION: '异常' }
const lessonStatusReverse = Object.fromEntries(Object.entries(lessonStatus).map(([key, value]) => [value, key]))
const lessonType = { PAID: '收费课', FREE: '免费课', TRIAL: '体验课', OTHER: '其他' }
const lessonTypeReverse = Object.fromEntries(Object.entries(lessonType).map(([key, value]) => [value, key]))
const qualityReviewStatus = { PENDING_REVIEW: '待评分', REVIEWED: '已评分', SUBMITTED: '已评分', RETURNED: '已退回' }
const attendanceStatus = { ATTENDED: '到课', ABSENT: '旷课', LEAVE: '请假', UNMARKED: '未标记' }
const attendanceReverse = Object.fromEntries(Object.entries(attendanceStatus).map(([key, value]) => [value, key]))
const assetType = { DEMO_IMAGE: '范画', STEP_IMAGE: '步骤图', COURSEWARE: '课件', STUDENT_PHOTO: '学生照片', CLASSROOM_PHOTO: '课堂照片', CLASSROOM_VIDEO: '课堂视频' }
const assetTypeReverse = Object.fromEntries(Object.entries(assetType).map(([key, value]) => [value, key]))
const artworkStatus = { ACTIVE: '已绑定', CONFIRMED: '已确认', PROCESSING: '处理中', FAILED: '处理失败', DELETED: '已删除' }
const artworkConfirmationStatus = { PENDING: '待确认', CONFIRMED: '已确认', REJECTED: '已退回' }
const feedbackStatus = { DRAFT: '草稿', GENERATED: '已生成', CONFIRMED: '已确认', FAILED: '生成失败' }
const jobStatus = { PENDING: '待处理', QUEUED: '排队中', RUNNING: '处理中', SUCCEEDED: '成功', FAILED: '失败', CANCELED: '已取消', STALE: '已过期' }
const versionKind = { ORIGINAL: '原图', PROCESSED: '处理版', GENERATED: '生成版', CONFIRMED: '已确认' }
const shareStatus = { UNPUBLISHED: '草稿', DRAFT: '草稿', PUBLISHED: '已发布', REVOKED: '已失效', SKIPPED: '已跳过' }
const touchStatus = { PENDING: '待老师确认发送', PENDING_GROUP_BINDING: '待绑定家长群', PENDING_CREATE: '待老师确认发送', PENDING_MEMBER_CONFIRM: '待老师确认发送', SENT: '已发送', FAILED: '发送失败', CANCELED: '已取消', CANCELLED: '已取消', MANUAL: '人工发送', MANUALLY_COMPLETED: '人工发送', SKIPPED: '已跳过' }

export const toApiLessonStatus = (value) => lessonStatusReverse[value] || value
export const toApiLessonType = (value) => lessonTypeReverse[value] || value
export const toApiAttendanceStatus = (value) => attendanceReverse[value] || value
export const toApiAssetType = (value) => assetTypeReverse[value] || value
export const toApiWheatCommand = (value) => ({
  '已人工处理': 'MARK_MANUALLY_COMPLETED',
  '无需处理': 'MARK_NOT_REQUIRED',
  '异常': 'MARK_EXCEPTION',
  '待处理': 'CORRECT_TO_PENDING'
}[value] || value)

export const mapCampus = (value = {}) => ({ ...value, id: safeUiId(value.id), organizationId: safeUiId(value.organizationId), version: Number(value.version || 0) })
export const mapIdentityPermission = (value = {}) => {
  const source = typeof value === 'string' ? { permissionKey: value } : (value || {})
  const permissionKey = String(
    source.permissionKey || source.permission_key || source.key || source.code || ''
  ).trim()
  const description = String(
    source.description || source.name || source.label || permissionKey
  ).trim()

  return {
    ...source,
    id: safeUiId(source.id ?? source.permissionId ?? source.permission_id),
    permissionKey,
    module: String(source.module || source.moduleKey || source.module_key || source.group || 'other').trim() || 'other',
    description: description || permissionKey,
    status: source.status || 'ENABLED'
  }
}
export const mapIdentityRole = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  roleKey: value.roleKey || '',
  name: value.name || value.roleKey || '',
  description: value.description || '',
  status: value.status || 'ENABLED',
  system: Boolean(value.system),
  version: Number(value.version || 0),
  permissions: Array.isArray(value.permissions) ? value.permissions.map((permission) => String(permission)) : []
})
export const identityRoleNames = (roles = []) => (Array.isArray(roles) ? roles : [])
  .map((role) => typeof role === 'string' ? role : role?.name || role?.roleKey || '')
  .map((name) => String(name).trim())
  .filter(Boolean)
  .filter((name, index, values) => values.indexOf(name) === index)
  .join('、')
export const mapCampusMembership = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  campusId: safeUiId(value.campusId),
  campusCode: value.campusCode || '',
  campusName: value.campusName || '',
  status: value.status || 'ENABLED',
  version: Number(value.version || 0)
})
export const mapIdentityUser = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  organizationId: safeUiId(value.organizationId),
  username: value.username || '',
  phone: value.phone || '',
  displayName: value.displayName || value.username || value.phone || '',
  status: value.status || 'ENABLED',
  version: Number(value.version || 0),
  roles: Array.isArray(value.roles) ? value.roles.map(mapIdentityRole) : [],
  campuses: Array.isArray(value.campuses) ? value.campuses.map(mapCampus) : []
})
export const mapTeacher = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  userId: safeUiId(value.userId),
  name: value.name || value.displayName || '',
  role: value.role || value.title || '老师',
  availableRoles: value.availableRoles || (value.role ? [value.role] : ['老师']),
  classes: fromApiIds(value.classIds || value.classes || []),
  campusIds: fromApiIds(value.campusIds),
  status: ({ ENABLED: '启用', ACTIVE: '启用', DISABLED: '停用' }[value.status] || value.status || '启用'),
  archived: Boolean(value.archivedAt || value.archived),
  archivedAt: value.archivedAt || null,
  archiveReason: value.archiveReason || '',
  classCount: Number(value.classCount || 0),
  version: Number(value.version || 0)
})
export const mapStudent = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  classId: safeUiId(value.classId || value.classIds?.[0]),
  classIds: fromApiIds(value.classIds),
  parent: value.parent ?? value.parentName ?? '',
  phone: value.phone ?? value.parentPhone ?? '',
  status: ({ ACTIVE: '在读', ENROLLED: '在读', SUSPENDED: '停课', ON_LEAVE: '请假', LEAVE: '请假', REFUNDED: '退费', GRADUATED: '退费', DISABLED: '停课' }[value.status] || value.status || '在读'),
  archived: Boolean(value.archivedAt || value.archived),
  archivedAt: value.archivedAt || null,
  archiveReason: value.archiveReason || '',
  classCount: Number(value.classCount || 0),
  archiveWorkCount: Number(value.archiveWorkCount || value.workCount || 0),
  highlightWorkCount: Number(value.highlightWorkCount || value.highlightCount || 0),
  version: Number(value.version || 0)
})
export const mapProfileField = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  campusId: safeUiId(value.campusId),
  fieldKey: value.fieldKey || '',
  label: value.label || value.fieldKey || '',
  fieldType: value.fieldType || 'TEXT',
  options: value.options || '',
  displayOrder: Number(value.displayOrder || 0),
  version: Number(value.version || 0),
  createdAt: displayDateTime(value.createdAt),
  updatedAt: displayDateTime(value.updatedAt)
})
export const mapProfileValue = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  studentId: safeUiId(value.studentId),
  fieldId: safeUiId(value.fieldId),
  fieldKey: value.fieldKey || '',
  label: value.label || value.fieldKey || '',
  value: value.value ?? '',
  version: Number(value.version || 0),
  createdAt: displayDateTime(value.createdAt),
  updatedAt: displayDateTime(value.updatedAt)
})
export const mapProfileAudit = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  studentId: safeUiId(value.studentId),
  fieldId: safeUiId(value.fieldId),
  changedBy: safeUiId(value.changedBy),
  summary: value.summary || `${value.beforeSummary || '空'} → ${value.afterSummary || '空'}`,
  createdAt: displayDateTime(value.createdAt)
})
export const mapClass = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  classTypeId: safeUiId(value.classTypeId),
  teacherId: safeUiId(value.teacherId),
  courseId: safeUiId(value.courseId),
  studentIds: fromApiIds(value.studentIds),
  scheduleSlots: (Array.isArray(value.scheduleSlots) ? value.scheduleSlots : []).map((slot) => ({
    ...slot,
    id: safeUiId(slot.id),
    weekday: Number(slot.weekday || 0),
    startTime: displayTime(slot.startTime),
    endTime: displayTime(slot.endTime),
    version: Number(slot.version || 0)
  })),
  time: value.time || (Array.isArray(value.scheduleSlots) ? value.scheduleSlots.map((slot) => `${slot.weekday || ''} ${displayTime(slot.startTime)}${slot.endTime ? `-${displayTime(slot.endTime)}` : ''}`).join('、') : ''),
  scheduleText: value.scheduleText || '',
  scheduleConfigured: Boolean(value.scheduleConfigured ?? value.scheduleSlots?.length),
  legacySchedulePending: Boolean(value.legacySchedulePending),
  classTypeName: value.classTypeName || value.classType || '',
  teacherName: value.teacherName || value.teacher || '',
  courseTitle: value.courseTitle || value.course || '',
  studentCount: Number(value.studentCount || 0),
  status: ({ PREPARING: '筹备中', ACTIVE: '开班中', SUSPENDED: '停课', CLOSED: '结课', COMPLETED: '结课' }[value.status] || value.status || '开班中'),
  archived: Boolean(value.archivedAt || value.archived),
  archivedAt: value.archivedAt || null,
  archiveReason: value.archiveReason || '',
  version: Number(value.version || 0)
})
export const mapCourse = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  age: value.age || value.ageRange || '',
  goal: value.goal || value.teachingGoal || '',
  reference: value.reference || value.referenceText || '',
  defaultFocus: value.defaultFocus || '色彩',
  activeClassCount: Number(value.activeClassCount || value.classCount || 0),
  externalLinkCount: Number(value.externalLinkCount || value.linkCount || 0),
  status: ({ ACTIVE: '启用', ENABLED: '启用', DISABLED: '停用' }[value.status] || value.status || '启用'),
  archived: Boolean(value.archivedAt || value.archived),
  archivedAt: value.archivedAt || null,
  archiveReason: value.archiveReason || '',
  version: Number(value.version || 0)
})
export const mapTerm = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  startDate: value.startDate || '',
  endDate: value.endDate || '',
  status: ({ ENABLED: '启用', DISABLED: '停用' }[value.status] || value.status || '启用'),
  version: Number(value.version || 0)
})
export const mapExternalLink = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  courseId: safeUiId(value.courseId),
  courseIds: value.courseId ? [safeUiId(value.courseId)] : [],
  courseTitle: value.courseTitle || value.course || '',
  platform: value.platform || '通用链接',
  status: ({ ENABLED: '启用', DISABLED: '停用' }[value.status] || value.status || '启用'),
  version: Number(value.version || 0)
})
export const mapLesson = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  classId: safeUiId(value.classId),
  teacherId: safeUiId(value.teacherId),
  courseId: safeUiId(value.courseId),
  scheduleSlotId: safeUiId(value.scheduleSlotId),
  scheduleAdjusted: Boolean(value.scheduleAdjusted),
  dateValue: value.dateValue || '',
  date: displayDate(value.dateValue),
  time: displayTime(value.startTime),
  endTime: displayTime(value.endTime),
  teacher: value.teacherName || '',
  classArchived: Boolean(value.classArchived),
  teacherArchived: Boolean(value.teacherArchived),
  courseArchived: Boolean(value.courseArchived),
  className: value.className || '',
  classType: value.classTypeName || value.classType || '',
  course: value.courseTitle || value.course || '',
  topic: value.topic || value.lessonTopic || '',
  archived: Boolean(value.archived),
  archiveStatus: value.status === 'COMPLETED' || value.archived ? 'FORMAL' : 'CURRENT',
  lessonType: lessonType[value.lessonType] || value.lessonType || '其他',
  status: lessonStatus[value.status] || value.status || '待处理',
  sourceType: value.sourceType || '',
  exceptionType: value.exceptionType || '',
  exceptionReason: value.exceptionReason || '',
  materials: Array.isArray(value.materials) ? value.materials : [],
  materialCount: Number(value.materialCount ?? value.materials?.length ?? 0),
  wheat: value.wheat ? {
    ...value.wheat,
    id: safeUiId(value.wheat.id),
    status: value.wheat.status || '',
    todoStatus: value.wheat.todoStatus || '',
    version: Number(value.wheat.version || 0)
  } : null,
  deliverySummary: value.deliverySummary ? {
    totalStudents: Number(value.deliverySummary.totalStudents || 0),
    attendedStudents: Number(value.deliverySummary.attendedStudents || 0),
    artworkReady: Number(value.deliverySummary.artworkReady || 0),
    feedbackConfirmed: Number(value.deliverySummary.feedbackConfirmed || 0),
    shareReady: Number(value.deliverySummary.shareReady || 0),
    archived: Boolean(value.deliverySummary.archived)
  } : null,
  worksCount: Number(value.worksCount ?? value.deliverySummary?.artworkReady ?? 0),
  highlights: Number(value.highlights || 0),
  archived: lessonStatus[value.status] === '已完成',
  version: Number(value.version || 0)
})
export const mapAttendance = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  lessonId: safeUiId(value.lessonId),
  studentId: safeUiId(value.studentId),
  studentArchived: Boolean(value.studentArchived),
  attendance: attendanceStatus[value.status] || value.status || '未标记',
  version: Number(value.version || 0)
})
export const mapFile = (value = {}) => ({ ...value, id: safeUiId(value.id), sizeBytes: Number(value.sizeBytes || 0) })
export const mapAsset = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  lessonId: safeUiId(value.lessonId),
  fileId: safeUiId(value.fileId),
  studentId: safeUiId(value.studentId),
  type: assetType[value.assetType] || value.assetType || '课堂照片',
  visible: value.visible !== false,
  // FileSnapshot.downloadUrl points to the protected content endpoint. Keep it
  // as metadata; ProtectedMedia loads it only when the element is visible.
  image: value.image || '',
  file: value.file ? mapFile(value.file) : null,
  version: Number(value.version || 0)
})
export const mapPreparationMemory = (value = {}) => ({
  ...value,
  source: value.source || 'NONE',
  memorySource: value.memorySource || value.source || 'NONE',
  memoryId: safeUiId(value.memoryId),
  memoryVersion: value.memoryVersion === null || value.memoryVersion === undefined ? null : Number(value.memoryVersion || 0),
  autoApplied: Boolean(value.autoApplied),
  covered: Boolean(value.covered),
  suppressed: Boolean(value.suppressed),
  hasDefault: Boolean(value.hasDefault),
  counts: value.counts && typeof value.counts === 'object' ? Object.fromEntries(
    Object.entries(value.counts).map(([key, count]) => [key, Number(count || 0)])
  ) : {}
})
export const mapArtworkVersion = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  fileId: safeUiId(value.fileId),
  sourceVersionId: safeUiId(value.sourceVersionId),
  jobId: safeUiId(value.jobId),
  versionNo: Number(value.versionNo || 0),
  versionKind: value.versionKind || '',
  versionKindLabel: versionKind[value.versionKind] || value.versionKind || '',
  statusLabel: artworkStatus[value.status] || value.status || '',
  file: value.file ? mapFile(value.file) : null,
  job: value.job ? mapJob(value.job) : null,
  createdAt: displayDateTime(value.createdAt)
})
export const mapArtwork = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  lessonId: safeUiId(value.lessonId),
  studentId: safeUiId(value.studentId),
  title: value.title || '',
  highlight: Boolean(value.highlight),
  highlightNote: value.highlightNote || '',
  selectedVersionId: safeUiId(value.selectedVersionId),
  confirmedBy: safeUiId(value.confirmedBy),
  status: value.status || 'ACTIVE',
  statusLabel: artworkStatus[value.status] || value.status || '已绑定',
  confirmationStatus: value.confirmationStatus || 'PENDING',
  confirmationStatusLabel: artworkConfirmationStatus[value.confirmationStatus] || value.confirmationStatus || '待确认',
  job: value.job ? mapJob(value.job) : null,
  versions: Array.isArray(value.versions) ? value.versions.map(mapArtworkVersion) : [],
  confirmedAt: displayDateTime(value.confirmedAt),
  version: Number(value.version || 0)
})
export const mapFeedbackVersion = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  feedbackId: safeUiId(value.feedbackId),
  jobId: safeUiId(value.jobId),
  versionNo: Number(value.versionNo || 0),
  statusLabel: feedbackStatus[value.status] || value.status || '',
  createdBy: safeUiId(value.createdBy),
  createdAt: displayDateTime(value.createdAt)
})
export const mapFeedback = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  lessonId: safeUiId(value.lessonId),
  studentId: safeUiId(value.studentId),
  currentVersionId: safeUiId(value.currentVersionId),
  confirmedVersionId: safeUiId(value.confirmedVersionId),
  confirmedBy: safeUiId(value.confirmedBy),
  status: value.status || 'DRAFT',
  statusLabel: feedbackStatus[value.status] || value.status || '草稿',
  classroomRecord: value.classroomRecord || '',
  content: value.content || '',
  versions: Array.isArray(value.versions) ? value.versions.map(mapFeedbackVersion) : [],
  confirmedAt: displayDateTime(value.confirmedAt),
  version: Number(value.version || 0)
})
export const mapJob = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  businessObjectId: safeUiId(value.businessObjectId),
  inputVersion: Number(value.inputVersion || 0),
  currentAttempt: Number(value.currentAttempt || 0),
  maxAttempts: Number(value.maxAttempts || 0),
  status: value.status || 'PENDING',
  statusLabel: jobStatus[value.status] || value.status || '待处理',
  availableAt: displayDateTime(value.availableAt),
  startedAt: displayDateTime(value.startedAt),
  finishedAt: displayDateTime(value.finishedAt)
})
export const mapHomework = (value = {}) => {
  const content = String(value.content || '')
  const taskMode = value.taskMode === 'ASSIGNED' || (!value.taskMode && content.trim()) ? 'ASSIGNED' : 'NONE'
  return {
    ...value,
    taskMode,
    content,
    requirement: value.requirement || '',
    dueDate: value.dueDate || '',
    visible: taskMode === 'ASSIGNED' && value.visible !== false,
    externalLinkIds: fromApiIds(value.externalLinkIds || []),
    version: Number(value.version || 0)
  }
}
export const mapSharePage = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  lessonId: safeUiId(value.lessonId),
  statusCode: value.status || 'UNPUBLISHED',
  status: shareStatus[value.status] || value.status || '草稿',
  draftVersion: Number(value.draftVersion || value.version || 1),
  publishedVersion: Number(value.publishedVersion || 0),
  publishedSnapshot: value.publishedSnapshot || null,
  studentTokens: Object.fromEntries((value.accessLinks || []).map((link) => [String(link.studentId), link.token]).filter(([, token]) => token)),
  accessLinks: (value.accessLinks || []).map((link) => ({
    ...link,
    studentId: safeUiId(link.studentId),
    expiresAt: displayDateTime(link.expiresAt)
  })),
  publishedAt: displayDateTime(value.publishedAt),
  revokedAt: displayDateTime(value.revokedAt),
  revokedReason: value.revokedReason || '',
  version: Number(value.version || 0),
  homework: mapHomework(value.homework || {})
})
export const mapTouchTask = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  lessonId: safeUiId(value.lessonId),
  studentId: safeUiId(value.studentId),
  sharePageVersionId: safeUiId(value.sharePageVersionId || value.shareVersion),
  wecomDispatchVersionId: safeUiId(value.wecomDispatchVersionId),
  shareVersion: safeUiId(value.wecomDispatchVersionId || value.shareVersion || value.sharePageVersionId),
  statusCode: value.status || 'PENDING_MEMBER_CONFIRM',
  status: touchStatus[value.status] || value.status || '待老师确认发送',
  wecomDispatchStatus: value.wecomDispatchStatus || value.status || '',
  wecomDispatchStatusCode: value.wecomDispatchStatus || value.status || '',
  wecomAccountId: safeUiId(value.wecomAccountId),
  wecomCustomerGroupId: safeUiId(value.wecomCustomerGroupId),
  wecomGroupName: value.wecomGroupName || '',
  wecomChatId: value.wecomChatId || '',
  wecomSenderUserid: value.wecomSenderUserid || '',
  wecomMsgid: value.wecomMsgid || '',
  wecomRemoteStatus: value.wecomRemoteStatus || '',
  wecomResult: value.wecomResult || {},
  wecomSubmittedAt: displayDateTime(value.wecomSubmittedAt),
  sentAt: displayDateTime(value.sentAt),
  createdAt: displayDateTime(value.createdAt),
  updatedAt: displayDateTime(value.updatedAt),
  version: Number(value.version || 0),
  studentName: value.studentName || value.targetName || '',
  parent: value.targetName || ''
})
export const mapArchiveRecord = (value = {}) => {
  const snapshot = value.snapshot || {}
  const lessonSnapshot = snapshot.lesson || {}
  const studentSnapshot = Array.isArray(snapshot.students)
    ? snapshot.students.find((student) => sameId(student?.studentId, value.studentId)) || {}
    : {}
  const artworkSnapshot = Array.isArray(studentSnapshot.artworks)
    ? studentSnapshot.artworks[0] || {}
    : Array.isArray(snapshot.artworks) ? snapshot.artworks[0] || {} : {}
  const artworks = (Array.isArray(studentSnapshot.artworks)
    ? studentSnapshot.artworks
    : Array.isArray(snapshot.artworks) ? snapshot.artworks : [])
    .map((artwork, index) => ({
      ...artwork,
      artworkId: safeUiId(artwork.artworkId || artwork.id),
      fileId: safeUiId(artwork.fileId || artwork.artworkFileId || artwork.file?.id),
      title: artwork.title || '学生作品',
      sortOrder: Number(artwork.sortOrder ?? index),
      highlight: Boolean(artwork.highlight),
      highlightNote: artwork.highlightNote || '',
      fileUrl: artwork.fileUrl || artwork.artwork || artwork.downloadUrl || artwork.file?.downloadUrl || ''
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder || String(left.artworkId || '').localeCompare(String(right.artworkId || ''), undefined, { numeric: true }))
  const coverArtwork = artworks[0] || artworkSnapshot
  if (Boolean(studentSnapshot.highlight) && artworks.length && !artworks.some((artwork) => artwork.highlight)) {
    artworks[0] = {
      ...artworks[0],
      highlight: true,
      highlightNote: artworks[0].highlightNote || studentSnapshot.highlightNote || ''
    }
  }
  const sourceType = String(value.sourceType || snapshot.sourceType || 'LESSON').toLowerCase()
  const archiveStatus = value.archiveStatus || snapshot.archiveStatus
    || (sourceType === 'lesson' && !value.archiveVersionId && snapshot.current ? 'CURRENT' : 'FORMAL')
  const fileId = safeUiId(value.fileId || snapshot.fileId || snapshot.artworkFileId || snapshot.file?.id || coverArtwork.fileId)
  return {
    ...value,
    id: safeUiId(value.id),
    archiveVersionId: safeUiId(value.archiveVersionId),
    lessonId: safeUiId(value.lessonId),
    studentId: safeUiId(value.studentId),
    studentName: value.studentName || studentSnapshot.name || snapshot.studentName || '',
    className: value.className || snapshot.className || '',
    classId: safeUiId(value.classId || snapshot.classId),
    teacher: value.teacherName || value.teacher || snapshot.teacherName || '',
    course: value.courseTitle || value.course || snapshot.courseTitle || '',
    dateValue: value.dateValue || snapshot.dateValue || lessonSnapshot.dateValue || lessonSnapshot.date || '',
    date: displayDate(value.dateValue || snapshot.dateValue || lessonSnapshot.dateValue || lessonSnapshot.date),
    time: displayTime(value.startTime || snapshot.startTime || lessonSnapshot.startTime),
    lessonType: lessonType[value.lessonType || snapshot.lessonType || lessonSnapshot.lessonType] || value.lessonType || snapshot.lessonType || lessonSnapshot.lessonType || '其他',
    sourceType,
    archiveStatus,
    archiveStatusLabel: archiveStatus === 'CURRENT' ? '进行中' : '正式档案',
    artworkConfirmationStatus: value.artworkConfirmationStatus || snapshot.confirmationStatus || '',
    sourceId: safeUiId(value.sourceId || value.lessonId || value.extraTaskId),
    extraTaskId: safeUiId(value.extraTaskId),
    archivePath: value.archivePath || '',
    fileId,
    artwork: value.artwork || snapshot.artwork || coverArtwork.fileUrl || coverArtwork.downloadUrl || snapshot.file?.downloadUrl || '',
    artworks,
    artworkCount: artworks.length,
    feedback: value.feedback || studentSnapshot.feedback?.content || snapshot.feedback?.content || snapshot.feedback || '',
    tags: Array.isArray(value.tags) ? value.tags : typeof value.tags === 'string' ? value.tags.split(',').filter(Boolean) : [],
    version: Number(value.version || 0),
    highlight: value.highlight !== undefined ? Boolean(value.highlight) : artworks.some((artwork) => artwork.highlight) || Boolean(studentSnapshot.highlight),
    highlightNote: value.highlightNote || artworks.find((artwork) => artwork.highlight)?.highlightNote || studentSnapshot.highlightNote || '',
    framed: ['MOUNTED', '已装裱'].includes(value.mountingStatus),
    framedAt: value.mountedOn || '',
    frameFee: Number(value.mountingFeeMinor || 0) / 100,
    framerName: value.framerName || '',
    frameNote: value.mountingNote || ''
  }
}
export const mapArchiveVersion = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  lessonId: safeUiId(value.lessonId),
  versionNo: Number(value.versionNo || 0),
  sourceLessonVersion: Number(value.sourceLessonVersion || 0),
  createdBy: safeUiId(value.createdBy),
  createdAt: displayDateTime(value.createdAt)
})
export const mapQualityReview = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  lessonId: safeUiId(value.lessonId),
  classId: safeUiId(value.classId),
  teacherId: safeUiId(value.teacherId),
  dateValue: value.dateValue || '',
  date: displayDate(value.dateValue),
  time: displayTime(value.startTime),
  teacher: value.teacherName || value.teacher || '',
  reviewer: value.reviewer || value.reviewedByName || safeUiId(value.reviewedBy) || '',
  reviewedBy: safeUiId(value.reviewedBy),
  returnedBy: safeUiId(value.returnedBy),
  score: value.score === null || value.score === undefined ? null : Number(value.score),
  comment: value.comment || '',
  reviewedAt: displayDateTime(value.reviewedAt),
  status: qualityReviewStatus[value.status] || value.status || '待评分',
  version: Number(value.version || 0)
})
export const mapSupervisionLesson = (value = {}) => {
  const mappedReviewStatus = qualityReviewStatus[value.reviewStatus] || value.reviewStatus || '待评分'
  const mappedScore = value.score === null || value.score === undefined ? null : Number(value.score)
  const review = value.review || (value.reviewId
    ? {
        id: safeUiId(value.reviewId),
        lessonId: safeUiId(value.lessonId),
        score: mappedScore,
        comment: value.reviewComment || value.comment || '',
        status: mappedReviewStatus,
        version: Number(value.reviewVersion || 0),
        reviewedBy: safeUiId(value.reviewerId),
        reviewedAt: displayDateTime(value.reviewedAt)
      }
    : null)
  return {
    ...value,
    lessonId: safeUiId(value.lessonId),
    classId: safeUiId(value.classId),
    teacherId: safeUiId(value.teacherId),
    courseId: safeUiId(value.courseId),
    dateValue: value.dateValue || '',
    date: displayDate(value.dateValue),
    lessonType: lessonType[value.lessonType] || value.lessonType || '其他',
    lessonStatus: lessonStatus[value.lessonStatus] || value.lessonStatus || '待处理',
    status: lessonStatus[value.lessonStatus] || value.lessonStatus || '待处理',
    lessonVersion: Number(value.lessonVersion || 0),
    reviewId: safeUiId(value.reviewId),
    reviewRound: Number(value.reviewRound || 0),
    reviewStatus: mappedReviewStatus,
    score: mappedScore,
    reviewerId: safeUiId(value.reviewerId),
    reviewedAt: displayDateTime(value.reviewedAt),
    reviewVersion: Number(value.reviewVersion || 0),
    review
  }
}
export const mapTeacherArchive = (value = {}) => ({
  ...value,
  id: safeUiId(value.teacherEffectId || value.id),
  teacherEffectId: safeUiId(value.teacherEffectId || value.id),
  lessonId: safeUiId(value.lessonId),
  teacherId: safeUiId(value.teacherId),
  classId: safeUiId(value.classId),
  dateValue: value.dateValue || '',
  date: displayDate(value.dateValue),
  time: displayTime(value.startTime),
  teacher: value.teacherName || value.teacher || '',
  className: value.className || '',
  classType: value.classTypeName || value.classType || '',
  course: value.courseTitle || value.course || '',
  title: value.title || '老师课效长图',
  status: ({ PENDING: '待生成', GENERATING: '生成中', GENERATED: '已生成', CONFIRMED: '已确认', SYNCED: '已同步', SKIPPED: '已跳过', FAILED: '失败' }[value.status] || value.status || '待生成'),
  generatedVersionId: safeUiId(value.generatedVersionId),
  outputFileId: safeUiId(value.outputFileId),
  imageCount: Number(value.imageCount ?? value.sourceCount ?? 0),
  cover: value.outputUrl || '',
  version: Number(value.version || 0),
  updatedAt: displayDateTime(value.updatedAt)
})
export const mapExtraTask = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  relatedLessonId: safeUiId(value.relatedLessonId),
  ownerId: safeUiId(value.ownerId),
  owner: value.owner || value.ownerName || '',
  dueDate: value.dueDate || '',
  relatedLessonDate: value.relatedLessonDate || '',
  relatedClassName: value.relatedClassName || '',
  relatedCourseTitle: value.relatedCourseTitle || '',
  artworkCount: Number(value.artworkCount || 0),
  highlightArtworkCount: Number(value.highlightArtworkCount || 0),
  status: ({
    DRAFT: '待发布',
    PUBLISHED: '已发布',
    IN_PROGRESS: '进行中',
    PENDING_ARCHIVE: '待归档',
    ARCHIVED: '已归档',
    CANCELED: '已取消'
  }[value.status] || value.status || '待发布'),
  version: Number(value.version || 0)
})
export const mapExtraArtwork = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  extraTaskId: safeUiId(value.extraTaskId),
  studentId: safeUiId(value.studentId),
  fileId: safeUiId(value.fileId),
  tags: Array.isArray(value.tags)
    ? value.tags
    : (() => {
        try {
          const parsed = JSON.parse(value.tags || '[]')
          return Array.isArray(parsed) ? parsed : []
        } catch {
          return String(value.tags || '').split(/[，,、]/).map((tag) => tag.trim()).filter(Boolean)
        }
      })(),
  artwork: value.artwork || value.file?.downloadUrl || '',
  status: value.status || 'ACTIVE',
  version: Number(value.version || 0)
})
export const mapWheat = (value = {}) => {
  const source = value.wheat || value
  return {
    ...source,
    id: safeUiId(source.id),
    lessonId: safeUiId(source.lessonId),
    status: ({ PENDING: '待处理', MANUALLY_COMPLETED: '已人工处理', NOT_REQUIRED: '无需处理', EXCEPTION: '异常' }[source.status] || source.status || '待处理'),
    note: source.note === '请回到小麦助教人工处理本节课完成状态'
      ? '请前往小麦助教完成消课，完成后返回本系统确认'
      : source.note || '',
    version: Number(source.version || 0),
    todo: value.todo ? mapTodo(value.todo) : null
  }
}

export const mapTodo = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  lessonId: safeUiId(value.lessonId),
  sourceId: safeUiId(value.sourceId),
  assignedTo: safeUiId(value.assignedTo),
  completedBy: safeUiId(value.completedBy),
  status: ({
    PENDING: '待处理',
    IN_PROGRESS: '处理中',
    COMPLETED: '已完成',
    CANCELED: '已取消',
    CANCELLED: '已取消',
    FAILED: '失败'
  }[value.status] || value.status || '待处理'),
  priority: value.priority || 'NORMAL',
  dueAt: displayDateTime(value.dueAt),
  completedAt: displayDateTime(value.completedAt),
  version: Number(value.version || 0)
})

export const mapCloudArchiveJob = (value = {}) => ({
  ...value,
  id: safeUiId(value.id),
  lessonId: safeUiId(value.lessonId),
  archiveVersionId: safeUiId(value.archiveVersionId),
  teacherEffectId: safeUiId(value.teacherEffectId),
  teacherEffectVersionId: safeUiId(value.teacherEffectVersionId),
  sourceId: safeUiId(value.sourceId),
  fileId: safeUiId(value.fileId),
  providerConfigId: safeUiId(value.providerConfigId),
  currentJobId: safeUiId(value.currentJobId),
  batchId: safeUiId(value.batchId),
  totalBytes: Number(value.totalBytes || 0),
  uploadedBytes: Number(value.uploadedBytes || 0),
  currentFilename: value.currentFilename || '',
  statusCode: value.status || '',
  status: ({
    QUEUED: '排队中',
    RUNNING: '同步中',
    SYNCED: '已同步',
    SUCCEEDED: '已同步',
    SKIPPED: '已跳过',
    FAILED: '同步失败',
    CANCELED: '已取消'
  }[value.status] || value.status || '待处理'),
  syncAttemptStatus: value.syncAttemptStatus || (['SYNCED', 'SKIPPED'].includes(value.status) ? 'SUCCEEDED' : value.status),
  version: Number(value.version || 0),
  attemptNo: Number(value.attemptNo || 0)
})

export const mapCloudArchiveBatch = (value = {}) => ({
  ...value,
  id: safeUiId(value.id || value.batchId),
  batchId: safeUiId(value.batchId || value.id),
  lessonId: safeUiId(value.lessonId),
  providerConfigId: safeUiId(value.providerConfigId),
  statusCode: value.status || '',
  status: value.status || 'QUEUED',
  syncAttemptStatus: value.syncAttemptStatus || (value.status === 'SUCCEEDED' ? 'SUCCEEDED' : value.status),
  required: Boolean(value.required),
  totalFiles: Number(value.totalFiles || 0),
  completedFiles: Number(value.completedFiles || 0),
  failedFiles: Number(value.failedFiles || 0),
  totalBytes: Number(value.totalBytes || 0),
  uploadedBytes: Number(value.uploadedBytes || 0),
  currentJobId: safeUiId(value.currentJobId),
  currentFileUploadedBytes: Number(value.currentFileUploadedBytes || 0),
  currentFileTotalBytes: Number(value.currentFileTotalBytes || 0),
  percent: Number.isFinite(Number(value.percent))
    ? Number(value.percent)
    : Number(value.totalBytes || 0) > 0
      ? Math.round((Number(value.uploadedBytes || 0) / Number(value.totalBytes || 0)) * 100)
      : Number(value.totalFiles || 0) > 0
        ? Math.round((Number(value.completedFiles || 0) / Number(value.totalFiles || 0)) * 100)
        : 0,
  version: Number(value.version || 0)
})

export const mapPage = (value, mapper) => ({
  items: Array.isArray(value?.items) ? value.items.map(mapper) : [],
  page: Number(value?.page || 1),
  pageSize: Number(value?.pageSize || 20),
  total: Number(value?.total || 0)
})
