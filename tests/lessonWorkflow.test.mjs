import assert from 'node:assert/strict'
import test from 'node:test'

import {
  finishArchiveAndExit,
  isLessonArchiveComplete,
  lessonArchiveGuard,
  parentTouchHistoryFor,
  studentDeliveryReadiness
} from '../src/services/lessonWorkflow.js'

test('allows archive preparation only for processing lessons', () => {
  assert.deepEqual(lessonArchiveGuard('PROCESSING'), {
    status: 'PROCESSING',
    action: 'PROCEED',
    message: ''
  })
})

test('marks pending lessons for one automatic processing transition', () => {
  assert.deepEqual(lessonArchiveGuard('待处理'), {
    status: 'PENDING',
    action: 'START_PROCESSING',
    message: ''
  })
})

test('blocks exception and completed lessons with contextual messages', () => {
  assert.equal(lessonArchiveGuard('EXCEPTION').message, '请先恢复异常课次')
  assert.equal(lessonArchiveGuard('COMPLETED').message, '课次已完成，无需重复归档')
})

test('treats completed lesson statuses as an archive terminal state', () => {
  assert.equal(isLessonArchiveComplete('COMPLETED'), true)
  assert.equal(isLessonArchiveComplete('已完成'), true)
  assert.equal(isLessonArchiveComplete('PROCESSING'), false)
})

test('closes the archive run and exits after archive succeeds', async () => {
  const events = []
  const result = await finishArchiveAndExit({
    archive: async () => {
      events.push('archive')
      return true
    },
    close: () => events.push('close'),
    exit: () => events.push('back')
  })

  assert.equal(result, true)
  assert.deepEqual(events, ['archive', 'close', 'back'])
})

test('stays in the workspace when archive validation fails', async () => {
  const events = []
  const result = await finishArchiveAndExit({
    archive: async () => false,
    close: () => events.push('close'),
    exit: () => events.push('back')
  })

  assert.equal(result, false)
  assert.deepEqual(events, [])
})

test('marks student delivery ready without requiring manual confirmations', () => {
  assert.deepEqual(studentDeliveryReadiness({
    artworkReady: true,
    record: '今天完成了构图练习',
    recordStatus: 'SAVED',
    comment: '孩子今天很专注，颜色搭配很有想法。',
    commentStatus: 'SAVED',
    commentJobStatus: 'SUCCEEDED'
  }), { ready: true, failures: [] })
})

test('does not require optional classroom records or personal feedback', () => {
  assert.deepEqual(studentDeliveryReadiness({
    artworkReady: false,
    record: '',
    comment: '已有课评',
    commentStatus: 'SAVED'
  }), {
    ready: false,
    failures: ['作品待准备']
  })
})

test('keeps saving and asynchronous failures from being reported as complete', () => {
  assert.equal(studentDeliveryReadiness({
    artworkReady: true,
    record: '课堂记录',
    recordStatus: 'SAVING',
    comment: '家长课评',
    commentStatus: 'SAVED',
    commentJobStatus: 'RUNNING'
  }).ready, false)
  assert.deepEqual(studentDeliveryReadiness({
    artworkReady: true,
    record: '课堂记录',
    recordStatus: 'ERROR',
    comment: '家长课评',
    commentStatus: 'SAVED',
    commentJobStatus: 'SUCCEEDED'
  }).failures, ['课堂记录保存失败'])
  assert.deepEqual(studentDeliveryReadiness({
    artworkReady: true,
    record: '课堂记录',
    recordStatus: 'CONFIRMING',
    comment: '家长课评',
    commentStatus: 'SAVED',
    commentJobStatus: 'SUCCEEDED'
  }).failures, ['课堂记录保存中'])
})

test('reports a feedback generation failure even before content exists', () => {
  assert.deepEqual(studentDeliveryReadiness({
    artworkReady: true,
    record: '课堂记录',
    recordStatus: 'SAVED',
    comment: '',
    commentStatus: 'SAVED',
    commentJobStatus: 'FAILED'
  }), {
    ready: false,
    failures: ['课评生成失败']
  })
})

test('uses the send checklist when a completed lesson has no old notification tasks', () => {
  const result = parentTouchHistoryFor({
    fallbackItem: { status: '待创建', sentCount: 0, detail: '' },
    lessonId: 17,
    checklistLessonId: 17,
    checklistStudents: [
      { studentId: 101, checked: true },
      { studentId: 102, checked: true }
    ],
    attendingStudentIds: [101, 102]
  })

  assert.deepEqual(result, {
    status: '已发送',
    sentCount: 2,
    detail: '已确认 2/2 位到课学生'
  })
})

test('keeps the legacy notification-task status when the checklist is incomplete', () => {
  const fallback = { status: '待创建', sentCount: 0, detail: '' }

  const result = parentTouchHistoryFor({
    fallbackItem: fallback,
    lessonId: 17,
    checklistLessonId: 17,
    checklistStudents: [{ studentId: 101, checked: true }, { studentId: 102, checked: false }],
    attendingStudentIds: [101, 102]
  })

  assert.strictEqual(result, fallback)
})
