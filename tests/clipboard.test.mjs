import assert from 'node:assert/strict'
import test from 'node:test'

import { copyTextToClipboard } from '../src/services/clipboard.js'

const withTemporaryGlobals = async (values, callback) => {
  const descriptors = new Map()
  Object.entries(values).forEach(([key, value]) => {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  })

  try {
    return await callback()
  } finally {
    descriptors.forEach((descriptor, key) => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    })
  }
}

test('uses the Clipboard API in a secure context', async () => {
  let copiedText = ''
  await withTemporaryGlobals({
    window: { isSecureContext: true },
    navigator: { clipboard: { writeText: async (value) => { copiedText = value } } }
  }, async () => {
    assert.equal(await copyTextToClipboard('家长展示链接'), true)
  })
  assert.equal(copiedText, '家长展示链接')
})

test('falls back to the traditional copy command on an insecure page', async () => {
  let command = ''
  let textarea = null
  const body = {
    appendChild(node) {
      textarea = node
      node.parentNode = body
    },
    removeChild(node) {
      node.parentNode = null
    }
  }
  const documentValue = {
    body,
    createElement: () => ({
      style: {},
      setAttribute() {},
      focus() {},
      select() {}
    }),
    execCommand: (value) => {
      command = value
      return true
    }
  }

  await withTemporaryGlobals({
    window: { isSecureContext: false },
    navigator: { clipboard: { writeText: async () => { throw new Error('insecure context') } } },
    document: documentValue
  }, async () => {
    assert.equal(await copyTextToClipboard('HTTP 页面链接'), true)
  })

  assert.equal(command, 'copy')
  assert.equal(textarea.value, 'HTTP 页面链接')
  assert.equal(textarea.parentNode, null)
})

test('returns false instead of reporting success for empty or blocked copy', async () => {
  await withTemporaryGlobals({
    window: { isSecureContext: true },
    navigator: { clipboard: { writeText: async () => { throw new Error('blocked') } } },
    document: { body: null }
  }, async () => {
    assert.equal(await copyTextToClipboard('  '), false)
    assert.equal(await copyTextToClipboard('无法复制的内容'), false)
  })
})
