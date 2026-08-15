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

const { clearSession, createIdempotencyKey, getAccessToken, request, setSession } = await import('../src/services/apiClient.js')
const { mapArchiveRecord, mapArchiveVersion, mapArtwork, mapCourse, mapExternalLink, mapFeedback, mapIdentityPermission, mapJob, mapLesson, mapPage, mapQualityReview, mapSharePage, mapSupervisionLesson, mapTeacherArchive, mapTodo, mapTouchTask, sameId } = await import('../src/services/mappers.js')

const response = (status, payload, contentType = 'application/json') => ({
  status,
  ok: status >= 200 && status < 300,
  statusText: status === 200 ? 'OK' : 'Error',
  headers: { get: (name) => name.toLowerCase() === 'content-type' ? contentType : null },
  text: async () => typeof payload === 'string' ? payload : JSON.stringify(payload),
  json: async () => payload,
  blob: async () => payload
})

test.afterEach(() => {
  clearSession()
  delete globalThis.fetch
})

test('unwraps API envelopes and adds idempotency keys to writes', async () => {
  let received
  globalThis.fetch = async (_url, options) => {
    received = options
    return response(200, { data: { id: '7' }, meta: { requestId: 'req-1' }, error: null })
  }

  const result = await request('/students', { method: 'POST', body: { name: '小明' } })

  assert.deepEqual(result, { id: '7' })
  assert.match(received.headers['Idempotency-Key'], /^children-art:/)
  assert.equal(JSON.parse(received.body).name, '小明')
})

test('keeps idempotency keys ASCII-safe for Chinese filenames and labels', () => {
  const key = createIdempotencyKey('file:小麦导出:在读学员名单.xls')

  assert.match(key, /^[\x00-\x7F]+$/)
  assert.match(key, /^children-art:file%3A%E5%B0%8F%E9%BA%A6%E5%AF%BC%E5%87%BA%3A/)
})

test('sanitizes caller-provided idempotency keys before fetch', async () => {
  let received
  globalThis.fetch = async (_url, options) => {
    received = options
    return response(200, { data: { ok: true }, meta: {}, error: null })
  }

  await request('/imports/1/confirm', {
    method: 'POST',
    body: { version: 1 },
    idempotencyKey: '导入:在读学员名单.xls'
  })

  assert.match(received.headers['Idempotency-Key'], /^[\x00-\x7F]+$/)
  assert.match(received.headers['Idempotency-Key'], /^%E5%AF%BC%E5%85%A5%3A/)
})

test('refreshes once for concurrent 401 responses and retries both requests', async () => {
  setSession({ accessToken: 'old-token', refreshToken: 'refresh-token', me: { user: { id: '1' } } })
  const calls = []
  let protectedCalls = 0
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    if (url.endsWith('/auth/refresh')) {
      await new Promise((resolve) => setTimeout(resolve, 5))
      return response(200, { data: { accessToken: 'new-token', refreshToken: 'new-refresh', me: { user: { id: '1' } } }, meta: {}, error: null })
    }
    protectedCalls += 1
    return protectedCalls <= 2
      ? response(401, { data: null, meta: {}, error: { code: 'TOKEN_EXPIRED', message: 'expired' } })
      : response(200, { data: { ok: true }, meta: {}, error: null })
  }

  const [first, second] = await Promise.all([request('/lessons/1'), request('/lessons/2')])

  assert.deepEqual(first, { ok: true })
  assert.deepEqual(second, { ok: true })
  assert.equal(calls.filter((call) => call.url.endsWith('/auth/refresh')).length, 1)
  assert.equal(getAccessToken(), 'new-token')
})

test('returns binary responses without envelope parsing and exposes conflict metadata', async () => {
  globalThis.fetch = async (url) => {
    if (url.endsWith('/file')) return response(200, new Blob(['pdf']), 'application/pdf')
    return response(409, { data: null, meta: { requestId: 'req-conflict' }, error: { code: 'VERSION_CONFLICT', message: '版本冲突' } })
  }

  const blob = await request('/file', { responseType: 'blob' })
  assert.equal(await blob.text(), 'pdf')

  await assert.rejects(
    request('/lesson', { method: 'PATCH', body: { version: 1 } }),
    (error) => error.status === 409 && error.code === 'VERSION_CONFLICT' && error.requestId === 'req-conflict'
  )
})

test('maps protocol IDs, statuses and pages into stable view values', () => {
  assert.equal(sameId('9007199254740993', 9007199254740993n), true)
  assert.equal(mapLesson({ id: '9007199254740993', status: 'PROCESSING', lessonType: 'PAID', dateValue: '2026-08-12', startTime: '18:30:00' }).status, '处理中')
  assert.equal(mapLesson({ lessonType: 'PAID' }).lessonType, '收费课')
  assert.deepEqual(mapPage({ items: [{ id: '1' }], page: 2, pageSize: 20, total: 41 }, (item) => item), {
    items: [{ id: '1' }],
    page: 2,
    pageSize: 20,
    total: 41
  })
})

test('keeps identity permission points visible across API field shapes', () => {
  const permission = mapIdentityPermission({
    id: '7',
    permission_key: 'lesson.read',
    module_key: 'lesson',
    label: '读取课次',
    status: 'ENABLED'
  })

  assert.equal(permission.id, 7)
  assert.equal(permission.permissionKey, 'lesson.read')
  assert.equal(permission.module, 'lesson')
  assert.equal(permission.description, '读取课次')
  assert.equal(mapIdentityPermission('lesson.edit').description, 'lesson.edit')
})

test('maps master data and touch-task DTOs to protocol-safe view models', () => {
  const course = mapCourse({ id: '9007199254740993', ageRange: '5-7岁', status: 'DISABLED', version: 3 })
  assert.equal(course.id, '9007199254740993')
  assert.equal(course.age, '5-7岁')
  assert.equal(course.status, '停用')
  assert.equal(course.version, 3)

  const link = mapExternalLink({ id: '4', courseId: '9007199254740993', status: 'ENABLED' })
  assert.deepEqual(link.courseIds, ['9007199254740993'])
  assert.equal(link.status, '启用')

  const touch = mapTouchTask({ id: '5', lessonId: '6', studentId: '7', sharePageVersionId: '8', status: 'PENDING_MEMBER_CONFIRM' })
  assert.equal(touch.shareVersion, 8)
  assert.equal(touch.status, '待老师确认发送')
})

test('maps archive, todo and teacher archive DTOs without losing string IDs', () => {
  const archive = mapArchiveRecord({
    id: '1',
    studentId: '2',
    snapshot: {
      students: [{
        studentId: 2,
        name: '小明',
        highlight: true,
        highlightNote: '构图突出',
        artworks: [{ fileId: '9007199254740993' }]
      }]
    }
  })
  assert.equal(archive.fileId, '9007199254740993')
  assert.equal(archive.studentName, '小明')
  assert.equal(archive.highlight, true)
  assert.equal(archive.highlightNote, '构图突出')

  const archiveVersion = mapArchiveVersion({ id: '9007199254740993', lessonId: '12', versionNo: 2, createdAt: '2026-08-12T10:00:00Z' })
  assert.equal(archiveVersion.id, '9007199254740993')
  assert.equal(archiveVersion.lessonId, 12)
  assert.equal(archiveVersion.versionNo, 2)

  const todo = mapTodo({ id: '7', lessonId: '8', sourceId: '9007199254740993', status: 'CANCELED', dueAt: '2026-08-12T10:00:00Z' })
  assert.equal(todo.id, 7)
  assert.equal(todo.sourceId, '9007199254740993')
  assert.equal(todo.status, '已取消')

  const teacherArchive = mapTeacherArchive({ teacherEffectId: '9', lessonId: '10', status: 'CONFIRMED', dateValue: '2026-08-12', startTime: '18:30:00' })
  assert.equal(teacherArchive.id, 9)
  assert.equal(teacherArchive.status, '已确认')
  assert.equal(teacherArchive.time, '18:30')
})

test('maps supervision and quality review enums', () => {
  const dashboard = mapSupervisionLesson({
    lessonId: '9007199254740993',
    reviewId: '9007199254740993',
    lessonStatus: 'COMPLETED',
    reviewStatus: 'RETURNED',
    score: '8.5',
    dateValue: '2026-08-12',
    reviewedAt: '2026-08-12T10:00:00Z'
  })
  assert.equal(dashboard.lessonId, '9007199254740993')
  assert.equal(dashboard.status, '已完成')
  assert.equal(dashboard.reviewStatus, '已退回')
  assert.equal(dashboard.score, 8.5)
  assert.equal(dashboard.review.id, '9007199254740993')
  assert.equal(dashboard.review.comment, '')

  const review = mapQualityReview({ id: '7', status: 'PENDING_REVIEW', reviewedBy: '12' })
  assert.equal(review.status, '待评分')
  assert.equal(review.reviewer, 12)
})

test('maps artwork, feedback, job and share DTOs while preserving protocol codes', () => {
  const artwork = mapArtwork({
    id: '9007199254740993',
    lessonId: '12',
    studentId: '13',
    status: 'ACTIVE',
    confirmationStatus: 'CONFIRMED',
    selectedVersionId: '14',
    versions: [{ id: '14', versionKind: 'PROCESSED', status: 'SUCCEEDED', fileId: '15' }]
  })
  assert.equal(artwork.id, '9007199254740993')
  assert.equal(artwork.confirmationStatus, 'CONFIRMED')
  assert.equal(artwork.confirmationStatusLabel, '已确认')
  assert.equal(artwork.versions[0].versionKindLabel, '处理版')

  const feedback = mapFeedback({ id: '16', studentId: '13', status: 'CONFIRMED', content: '很好', version: 2 })
  assert.equal(feedback.id, 16)
  assert.equal(feedback.status, 'CONFIRMED')
  assert.equal(feedback.statusLabel, '已确认')
  assert.equal(feedback.version, 2)

  assert.equal(mapJob({ id: '17', status: 'SUCCEEDED' }).statusLabel, '成功')
  const share = mapSharePage({ id: '18', status: 'PUBLISHED', accessLinks: [{ studentId: '13', token: 'token' }] })
  assert.equal(share.status, '已发布')
  assert.equal(share.statusCode, 'PUBLISHED')
  assert.equal(share.studentTokens['13'], 'token')
})
