import { sameId, toApiLessonStatus } from './mappers.js'

const lessonStatusLabel = {
  PENDING: '待处理',
  PROCESSING: '处理中',
  EXCEPTION: '异常',
  COMPLETED: '已完成'
}

const draftPendingStatuses = new Set(['DIRTY', 'SAVING', 'CONFIRMING'])

/**
 * 汇总学生交付内容的完成条件。
 *
 * 这里刻意不读取“作品确认”或“课评确认”字段。第三步只负责判断内容
 * 是否已经准备好，确认动作由自动保存流程和最终收口保护负责。
 */
export const studentDeliveryReadiness = ({
  artworkReady = false,
  artworkStatus = '',
  record = '',
  recordStatus = 'SAVED',
  comment = '',
  commentStatus = 'SAVED',
  commentJobStatus = ''
} = {}) => {
  const failures = []
  const normalizedArtworkStatus = String(artworkStatus || '').toUpperCase()
  const normalizedRecordStatus = String(recordStatus || 'SAVED').toUpperCase()
  const normalizedCommentStatus = String(commentStatus || 'SAVED').toUpperCase()
  const normalizedCommentJobStatus = String(commentJobStatus || '').toUpperCase()

  if (normalizedArtworkStatus === 'PROCESSING') failures.push('作品处理中')
  else if (normalizedArtworkStatus === 'FAILED') failures.push('作品处理失败')
  else if (!artworkReady) failures.push('作品待准备')

  if (normalizedRecordStatus === 'ERROR' && String(record || '').trim()) failures.push('课堂记录保存失败')
  else if (draftPendingStatuses.has(normalizedRecordStatus)) failures.push('课堂记录保存中')

  if (normalizedCommentJobStatus === 'FAILED' || normalizedCommentJobStatus === 'CANCELED') failures.push('课评生成失败')
  else if (normalizedCommentJobStatus && !['SUCCEEDED', 'COMPLETED'].includes(normalizedCommentJobStatus)) failures.push('课评生成中')
  else if (normalizedCommentStatus === 'ERROR' && String(comment || '').trim()) failures.push('课评保存失败')
  else if (draftPendingStatuses.has(normalizedCommentStatus)) failures.push('课评保存中')

  return { ready: failures.length === 0, failures }
}

export const lessonArchiveGuard = (status) => {
  const normalizedStatus = toApiLessonStatus(status)
  if (normalizedStatus === 'PROCESSING') {
    return { status: normalizedStatus, action: 'PROCEED', message: '' }
  }
  if (normalizedStatus === 'PENDING') {
    return { status: normalizedStatus, action: 'START_PROCESSING', message: '' }
  }
  if (normalizedStatus === 'EXCEPTION') {
    return { status: normalizedStatus, action: 'BLOCK', message: '请先恢复异常课次' }
  }
  if (normalizedStatus === 'COMPLETED') {
    return { status: normalizedStatus, action: 'BLOCK', message: '课次已完成，无需重复归档' }
  }
  return {
    status: normalizedStatus,
    action: 'BLOCK',
    message: `课次当前为“${lessonStatusLabel[normalizedStatus] || normalizedStatus || '未知'}”，暂不能归档`
  }
}

export const isLessonArchiveComplete = (status) => toApiLessonStatus(status) === 'COMPLETED'

/**
 * 为已完成课次恢复家长发送记录展示状态。
 *
 * 新流程使用逐学生发送确认记录，历史课次可能仍只有旧的通知任务记录。
 * 只有确认记录覆盖全部到课学生时才覆盖旧记录，避免影响历史数据回显。
 */
export const parentTouchHistoryFor = ({
  fallbackItem = {},
  lessonId,
  checklistLessonId,
  checklistStudents = [],
  attendingStudentIds = []
} = {}) => {
  if (!sameId(lessonId, checklistLessonId)) return fallbackItem
  const attendingIds = (Array.isArray(attendingStudentIds) ? attendingStudentIds : [])
    .filter((studentId) => studentId !== null && studentId !== undefined)
  if (!attendingIds.length) return fallbackItem
  const checkedIds = new Set((Array.isArray(checklistStudents) ? checklistStudents : [])
    .filter((student) => student?.checked)
    .map((student) => String(student.studentId ?? '')))
  if (!attendingIds.every((studentId) => checkedIds.has(String(studentId)))) return fallbackItem
  const confirmedCount = attendingIds.length
  return {
    ...fallbackItem,
    status: '已发送',
    sentCount: confirmedCount,
    detail: `已确认 ${confirmedCount}/${confirmedCount} 位到课学生`
  }
}

export const finishArchiveAndExit = async ({ archive, close, exit }) => {
  const finished = await archive()
  if (finished !== true) return false

  close?.()
  exit()
  return true
}
