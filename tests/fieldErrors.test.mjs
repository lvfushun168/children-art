import assert from 'node:assert/strict'
import test from 'node:test'

import { collectFieldErrors } from '../src/composables/useFieldErrors.js'

test('collectFieldErrors keeps only fields whose rule returns a message', () => {
  const errors = collectFieldErrors(
    { name: ' ', code: 'abc', phone: '' },
    {
      name: (value) => !value?.trim() && '请填写名称',
      code: (value) => !value?.trim() && '请填写编码',
      phone: (value) => (value ? '' : '请填写手机号')
    }
  )
  assert.deepEqual(errors, { name: '请填写名称', phone: '请填写手机号' })
})

test('collectFieldErrors treats false, empty text and undefined as valid and passes the whole form to rules', () => {
  const form = { password: '123', confirm: '123' }
  const errors = collectFieldErrors(form, {
    password: () => false,
    confirm: (value, all) => value !== all.password && '两次密码不一致',
    other: () => undefined
  })
  assert.deepEqual(errors, {})
})
