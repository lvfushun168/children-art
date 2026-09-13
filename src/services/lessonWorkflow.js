import { toApiLessonStatus } from './mappers.js'

const lessonStatusLabel = {
  PENDING: '待处理',
  PROCESSING: '处理中',
  EXCEPTION: '异常',
  COMPLETED: '已完成'
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
