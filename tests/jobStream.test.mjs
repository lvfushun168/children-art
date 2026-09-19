import assert from 'node:assert/strict'
import test from 'node:test'

import { mergeJobStream } from '../src/services/jobStream.js'

test('replaces from snapshots, appends consecutive deltas, and ignores duplicates', () => {
  let state = { jobId: '123', status: 'RUNNING' }
  let event = mergeJobStream(state, {
    jobId: '123', status: 'RUNNING', seq: 7, content: '已有完整文本'
  }, 'stream-snapshot')
  assert.equal(event.text, '已有完整文本')
  state = event.state

  event = mergeJobStream(state, { jobId: '123', status: 'RUNNING', seq: 8, delta: '，继续生成' }, 'stream-delta')
  assert.equal(event.text, '已有完整文本，继续生成')
  state = event.state

  assert.equal(mergeJobStream(state, { jobId: '123', status: 'RUNNING', seq: 8, delta: '，继续生成' }, 'stream-delta'), null)
  assert.equal(mergeJobStream(state, { jobId: '123', status: 'RUNNING', seq: 10, delta: '跳过的片段' }, 'stream-delta'), null)
})

test('a newer reconnect snapshot repairs a sequence gap before the next delta', () => {
  const state = { jobId: '123', streamSeq: 7, streamContent: '旧内容', streamStatus: 'RUNNING' }
  const snapshot = mergeJobStream(state, {
    jobId: '123', status: 'SUCCEEDED', seq: 10, content: '恢复后的完整内容'
  }, 'stream-snapshot')
  assert.equal(snapshot.text, '恢复后的完整内容')
  const completed = mergeJobStream(snapshot.state, {
    jobId: '123', status: 'SUCCEEDED', seq: 11, delta: '。'
  }, 'stream-delta')
  assert.equal(completed.text, '恢复后的完整内容。')
})
