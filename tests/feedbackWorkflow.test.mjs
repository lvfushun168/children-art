import assert from 'node:assert/strict'
import test from 'node:test'

import {
  feedbackConfirmationPayloadFor,
  saveAndConfirmFeedback
} from '../src/services/feedbackWorkflow.js'

test('saves feedback before confirming the version returned by the save response', async () => {
  const events = []
  const result = await saveAndConfirmFeedback({
    body: { content: '孩子今天很专注' },
    save: async (body) => {
      events.push(['save', body])
      return {
        id: 152,
        currentVersionId: 145,
        version: 7,
        content: body.content,
        status: 'PENDING_CONFIRMATION'
      }
    },
    confirm: async (feedbackId, body) => {
      events.push(['confirm', feedbackId, body])
      return {
        id: feedbackId,
        currentVersionId: body.versionId,
        confirmedVersionId: body.versionId,
        version: 8,
        content: '孩子今天很专注',
        status: 'CONFIRMED'
      }
    }
  })

  assert.deepEqual(events, [
    ['save', { content: '孩子今天很专注' }],
    ['confirm', '152', { versionId: '145', version: 7 }]
  ])
  assert.equal(result.confirmed.status, 'CONFIRMED')
})

test('does not confirm an empty saved feedback', async () => {
  let confirmCalls = 0
  const result = await saveAndConfirmFeedback({
    body: { content: '' },
    save: async () => ({
      id: 152,
      currentVersionId: 146,
      version: 8,
      content: '',
      status: 'DRAFT'
    }),
    confirm: async () => {
      confirmCalls += 1
      return null
    }
  })

  assert.equal(confirmCalls, 0)
  assert.equal(result.confirmed, null)
})

test('preserves the saved response when confirmation fails', async () => {
  const saved = {
    id: 152,
    currentVersionId: 147,
    version: 9,
    content: '待确认的课评',
    status: 'PENDING_CONFIRMATION'
  }

  await assert.rejects(
    saveAndConfirmFeedback({
      body: { content: saved.content },
      save: async () => saved,
      confirm: async () => {
        throw Object.assign(new Error('没有确认权限'), { code: 'PERMISSION_DENIED', status: 403 })
      }
    }),
    (error) => error.saved === saved && error.status === 403 && error.code === 'PERMISSION_DENIED'
  )
})

test('uses the current version before a confirmed version when building a confirmation request', () => {
  assert.deepEqual(feedbackConfirmationPayloadFor({
    id: 152,
    currentVersionId: 148,
    confirmedVersionId: 145,
    version: 10
  }), {
    feedbackId: '152',
    versionId: '148',
    version: 10
  })
})

test('does not fall back to an old confirmed version when the current version is missing', () => {
  assert.equal(feedbackConfirmationPayloadFor({
    id: 152,
    confirmedVersionId: 145,
    version: 10,
    status: 'PENDING_CONFIRMATION'
  }), null)
})
