import assert from 'node:assert/strict'
import test from 'node:test'

import { lessonArchiveGuard } from '../src/services/lessonWorkflow.js'

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
