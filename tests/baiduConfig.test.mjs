import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_BAIDU_BACKEND_BASE_URL,
  DEFAULT_BAIDU_FRONTEND_RETURN_PATH,
  normalizeBaiduBaseUrl,
  normalizeBaiduReturnPath
} from '../src/services/baiduConfig.js'

test('migrates legacy local Baidu endpoints to the public development endpoint', () => {
  assert.equal(normalizeBaiduBaseUrl('http://localhost:8080'), DEFAULT_BAIDU_BACKEND_BASE_URL)
  assert.equal(normalizeBaiduBaseUrl('http://localhost:5173'), 'http://mengdi.ccwu.cc:10001')
  assert.equal(normalizeBaiduBaseUrl(''), 'http://mengdi.ccwu.cc:10001')
})

test('migrates the legacy settings return path to the actual settings route', () => {
  assert.equal(normalizeBaiduReturnPath('/settings'), DEFAULT_BAIDU_FRONTEND_RETURN_PATH)
  assert.equal(normalizeBaiduReturnPath(''), DEFAULT_BAIDU_FRONTEND_RETURN_PATH)
  assert.equal(normalizeBaiduReturnPath('/custom-return'), '/custom-return')
})
