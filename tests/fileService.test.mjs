import assert from 'node:assert/strict'
import test from 'node:test'

const { sha256ForFile, uploadCoursewareFile, uploadFile } = await import('../src/services/fileService.js')

const withTemporaryCrypto = async (cryptoValue, callback) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: cryptoValue
  })

  try {
    return await callback()
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, 'crypto', descriptor)
    } else {
      delete globalThis.crypto
    }
  }
}

const jsonResponse = (payload, status = 200) => ({
  status,
  ok: status >= 200 && status < 300,
  statusText: '',
  headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
  text: async () => JSON.stringify(payload)
})

const withTemporaryFetch = async (fetchValue, callback) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch')
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchValue })

  try {
    return await callback()
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'fetch', descriptor)
    else delete globalThis.fetch
  }
}

test('uses the pure JavaScript SHA-256 fallback when Web Crypto is unavailable', async () => {
  await withTemporaryCrypto({}, async () => {
    assert.equal(
      await sha256ForFile(new Blob(['abc'])),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
  })
})

test('keeps the SHA-256 output compatible with Web Crypto for binary content', async () => {
  const content = new Uint8Array([0, 1, 2, 127, 128, 254, 255])
  const expected = '7bb6463b30f9e301fed333cdf8960ca9497b602ccd8eeb46ae42693fdea15a4d'

  await withTemporaryCrypto({}, async () => {
    assert.equal(await sha256ForFile(new Blob([content])), expected)
  })
})

test('sends the courseware validation profile through the three-step chunked upload', async () => {
  const file = new Blob([new Uint8Array([0, 1, 2])], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  })
  Object.defineProperty(file, 'name', { value: '课堂课件.pptx' })
  const calls = []

  await withTemporaryFetch(async (url, options) => {
    calls.push({ url, options })
    if (String(url).endsWith('/files/upload-sessions')) {
      return jsonResponse({ data: {
        sessionId: '12', fileId: '34', expectedSize: file.size,
        mediaType: file.type, originalFilename: file.name,
        expiresAt: '2026-08-31T00:00:00Z', status: 'OPEN',
        uploadUrl: '/api/v1/files/upload-sessions/12/content'
      }, meta: {} })
    }
    if (String(url).endsWith('/content') && options.method === 'PATCH') {
      return jsonResponse({ data: { receivedBytes: file.size }, meta: {} })
    }
    return jsonResponse({ data: { id: '34', originalFilename: file.name, sizeBytes: file.size }, meta: {} })
  }, async () => {
    const result = await uploadFile(file, 'lesson-7-asset', {
      sha256: 'a'.repeat(64),
      validationProfile: 'COURSEWARE'
    })

    assert.equal(result.id, 34)
    assert.equal(JSON.parse(calls[0].options.body).validationProfile, 'COURSEWARE')
    assert.equal(calls.length, 3)
    assert.equal(calls[1].options.method, 'PATCH')
    assert.equal(calls[1].options.headers['X-Upload-Offset'], '0')
  })
})

test('uses the dedicated courseware chunk endpoint for courseware uploads', async () => {
  const file = new Blob([new Uint8Array([0, 1, 2, 3])], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  })
  Object.defineProperty(file, 'name', { value: '课件.pptx' })
  const calls = []

  await withTemporaryFetch(async (url, options) => {
    calls.push({ url, options })
    const path = String(url)
    if (path.endsWith('/courseware/upload-sessions')) {
      return jsonResponse({ data: {
        sessionId: '31', fileId: '41', expectedSize: file.size,
        mediaType: file.type, originalFilename: file.name,
        expiresAt: '2026-08-31T00:00:00Z', status: 'OPEN', receivedBytes: 0,
        uploadUrl: '/api/v1/courseware/upload-sessions/31/content'
      }, meta: {} })
    }
    if (path.endsWith('/courseware/upload-sessions/31/content')) {
      return jsonResponse({ data: { receivedBytes: file.size }, meta: {} })
    }
    return jsonResponse({ data: { id: '41', originalFilename: file.name, sizeBytes: file.size }, meta: {} })
  }, async () => {
    await uploadCoursewareFile(file, { sha256: 'd'.repeat(64) })
  })

  assert.equal(calls[1].options.method, 'PATCH')
  assert.match(String(calls[1].url), /courseware\/upload-sessions\/31\/content$/)
  assert.equal(calls[1].options.headers['X-Upload-Offset'], '0')
})

test('uploads a file in ordered chunks and completes with the original digest', async () => {
  const content = new Uint8Array([0, 1, 2, 3, 4])
  const file = new Blob([content], { type: 'image/jpeg' })
  Object.defineProperty(file, 'name', { value: '作品.jpg' })
  const calls = []
  const chunks = []

  await withTemporaryFetch(async (url, options) => {
    calls.push({ url, options })
    if (String(url).endsWith('/files/upload-sessions')) {
      return jsonResponse({ data: {
        sessionId: '21', fileId: '34', expectedSize: file.size,
        mediaType: file.type, originalFilename: file.name,
        expiresAt: '2026-08-31T00:00:00Z', status: 'OPEN', receivedBytes: 0,
        uploadUrl: '/api/v1/files/upload-sessions/21/content'
      }, meta: {} })
    }
    if (String(url).endsWith('/content') && options.method === 'PATCH') {
      const offset = Number(options.headers['X-Upload-Offset'])
      const bytes = new Uint8Array(await options.body.arrayBuffer())
      chunks.push({ offset, bytes: [...bytes] })
      return jsonResponse({ data: { receivedBytes: offset + bytes.length }, meta: {} })
    }
    return jsonResponse({ data: { id: '34', originalFilename: file.name, sizeBytes: file.size }, meta: {} })
  }, async () => {
    const result = await uploadFile(file, 'artwork', {
      sha256: 'b'.repeat(64),
      chunkSizeBytes: 2
    })

    assert.equal(result.id, 34)
    assert.deepEqual(chunks, [
      { offset: 0, bytes: [0, 1] },
      { offset: 2, bytes: [2, 3] },
      { offset: 4, bytes: [4] }
    ])
    assert.equal(calls.at(-1).options.method, 'POST')
    assert.deepEqual(JSON.parse(calls.at(-1).options.body), {
      sizeBytes: file.size,
      sha256: 'b'.repeat(64)
    })
  })
})

test('resynchronizes with the server when a chunk response is lost after the server writes it', async () => {
  const file = new Blob([new Uint8Array([10, 11, 12, 13])], { type: 'image/jpeg' })
  Object.defineProperty(file, 'name', { value: '断线.jpg' })
  const patchOffsets = []
  let statusCalls = 0

  await withTemporaryFetch(async (url, options) => {
    const path = String(url)
    if (path.endsWith('/files/upload-sessions')) {
      return jsonResponse({ data: {
        sessionId: '22', fileId: '35', expectedSize: file.size,
        mediaType: file.type, originalFilename: file.name,
        expiresAt: '2026-08-31T00:00:00Z', status: 'OPEN', receivedBytes: 0,
        uploadUrl: '/api/v1/files/upload-sessions/22/content'
      }, meta: {} })
    }
    if (path.endsWith('/content') && options.method === 'PATCH') {
      const offset = Number(options.headers['X-Upload-Offset'])
      patchOffsets.push(offset)
      if (offset === 0) return jsonResponse({ error: { message: '网关超时' }, meta: {} }, 502)
      return jsonResponse({ data: { receivedBytes: file.size }, meta: {} })
    }
    if (path.endsWith('/upload-sessions/22')) {
      statusCalls += 1
      return jsonResponse({ data: {
        sessionId: '22', fileId: '35', expectedSize: file.size,
        mediaType: file.type, originalFilename: file.name,
        expiresAt: '2026-08-31T00:00:00Z', status: 'OPEN', receivedBytes: 2,
        uploadUrl: '/api/v1/files/upload-sessions/22/content'
      }, meta: {} })
    }
    return jsonResponse({ data: { id: '35', sizeBytes: file.size }, meta: {} })
  }, async () => {
    await uploadFile(file, 'artwork', { sha256: 'c'.repeat(64), chunkSizeBytes: 2 })
  })

  assert.deepEqual(patchOffsets, [0, 2])
  assert.equal(statusCalls, 1)
})
