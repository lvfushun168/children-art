import assert from 'node:assert/strict'
import test from 'node:test'

const storage = new Map()
globalThis.window = {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
  }
}

const { clearSession } = await import('../src/services/apiClient.js')
const { api } = await import('../src/services/api.js')
const { identityRoleNames } = await import('../src/services/mappers.js')

const response = (status, payload) => ({
  status,
  ok: status >= 200 && status < 300,
  statusText: status === 200 ? 'OK' : 'Error',
  headers: { get: () => 'application/json' },
  text: async () => JSON.stringify(payload),
  json: async () => payload
})

test.afterEach(() => {
  clearSession()
  delete globalThis.fetch
})

test('summarizes every enabled account role for display without selecting one', () => {
  assert.equal(identityRoleNames([
    { name: '管理员', roleKey: 'system_admin' },
    { name: '老师', roleKey: 'teacher' },
    { name: '管理员', roleKey: 'system_admin' }
  ]), '管理员、老师')
  assert.equal(identityRoleNames([]), '')
  assert.equal(identityRoleNames([{ roleKey: 'teacher' }]), 'teacher')
})

test('login request contains credentials but no client-selected role', async () => {
  let received
  globalThis.fetch = async (url, options) => {
    received = { url, options }
    return response(200, {
      data: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 1800,
        me: {
          user: { id: '1', displayName: '管理员' },
          roles: [
            { name: '管理员', roleKey: 'system_admin' },
            { name: '老师', roleKey: 'teacher' }
          ],
          permissions: ['identity.role.manage', 'lesson.read']
        }
      },
      meta: {},
      error: null
    })
  }

  const auth = await api.auth.login({ account: 'admin', password: 'secret' })
  const body = JSON.parse(received.options.body)

  assert.match(received.url, /\/auth\/login$/)
  assert.deepEqual(body, { account: 'admin', password: 'secret' })
  assert.equal(auth.me.roles.length, 2)
  assert.deepEqual(auth.me.permissions, ['identity.role.manage', 'lesson.read'])
})

test('keeps account campus relationships on the existing campusIds protocol', async () => {
  const received = []
  globalThis.fetch = async (url, options) => {
    received.push({ url, options })
    return response(200, { data: null, meta: {}, error: null })
  }

  await api.auth.createUser({
    phone: '13800000000',
    displayName: '新老师',
    password: 'secret',
    roleIds: ['5'],
    campusIds: ['2']
  })
  await api.auth.replaceMemberships('11', {
    version: 0,
    campusIds: ['2']
  })

  assert.deepEqual(JSON.parse(received[0].options.body).campusIds, ['2'])
  assert.deepEqual(JSON.parse(received[1].options.body), { version: 0, campusIds: ['2'] })
  assert.match(received[1].url, /\/users\/11\/campus-memberships$/)
})
