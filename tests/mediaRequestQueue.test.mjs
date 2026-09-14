import assert from 'node:assert/strict'
import test from 'node:test'

import {
  enqueueMediaRequest,
  mediaRequestQueueStats,
  MAX_MEDIA_REQUESTS
} from '../src/services/mediaRequestQueue.js'

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

test('limits protected media work to three active requests', async () => {
  let active = 0
  let maximum = 0
  const requests = Array.from({ length: 8 }, (_, index) => enqueueMediaRequest(async () => {
    active += 1
    maximum = Math.max(maximum, active)
    await wait(5)
    active -= 1
    return index
  }))

  assert.deepEqual((await Promise.all(requests)).sort((left, right) => left - right), [0, 1, 2, 3, 4, 5, 6, 7])
  assert.equal(maximum, MAX_MEDIA_REQUESTS)
  assert.equal(mediaRequestQueueStats().active, 0)
  assert.equal(mediaRequestQueueStats().pending, 0)
})

test('starts high priority original work before pending previews', async () => {
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  const started = []
  const blockers = Array.from({ length: MAX_MEDIA_REQUESTS }, (_, index) => enqueueMediaRequest(async () => {
    started.push(`blocker-${index}`)
    await gate
  }))

  const low = enqueueMediaRequest(async () => started.push('preview'))
  const high = enqueueMediaRequest(async () => started.push('original'), 'high')
  await wait(0)
  assert.equal(started.length, MAX_MEDIA_REQUESTS)

  release()
  await Promise.all([blockers[0], blockers[1], blockers[2], low, high])

  assert.equal(started.at(-2), 'original')
  assert.equal(started.at(-1), 'preview')
})
