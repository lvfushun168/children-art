import assert from 'node:assert/strict'
import test from 'node:test'

const {
  putUploadSessionContent,
  sha256ForFile,
  uploadCoursewareFile,
  uploadFile,
  UPLOAD_CHUNK_SIZE_BYTES,
  UPLOAD_CONCURRENCY
} =
  await import('../src/services/fileService.js')

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
  json: async () => payload,
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

test('uses 256 KiB as the default upload chunk size for slow public links', () => {
  assert.equal(UPLOAD_CHUNK_SIZE_BYTES, 256 * 1024)
  assert.equal(UPLOAD_CONCURRENCY, 4)
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
    if (String(url).endsWith('/parts/0') && options.method === 'PUT') {
      return jsonResponse({ data: { chunkSizeBytes: file.size, receivedBytes: file.size }, meta: {} })
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
    assert.equal(calls[1].options.method, 'PUT')
    assert.match(String(calls[1].url), /files\/upload-sessions\/12\/parts\/0$/)
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
    if (path.endsWith('/courseware/upload-sessions/31/parts/0')) {
      return jsonResponse({ data: { chunkSizeBytes: file.size, receivedBytes: file.size }, meta: {} })
    }
    return jsonResponse({ data: { id: '41', originalFilename: file.name, sizeBytes: file.size }, meta: {} })
  }, async () => {
    await uploadCoursewareFile(file, { sha256: 'd'.repeat(64) })
  })

  assert.equal(calls[1].options.method, 'PUT')
  assert.match(String(calls[1].url), /courseware\/upload-sessions\/31\/parts\/0$/)
  assert.equal(calls[1].options.headers['X-Upload-Offset'], '0')
})

test('uploads a file in concurrent chunks and completes with the original digest', async () => {
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
    if (String(url).includes('/parts/') && options.method === 'PUT') {
      const partIndex = Number(String(url).match(/\/parts\/(\d+)$/)[1])
      const offset = Number(options.headers['X-Upload-Offset'])
      const bytes = new Uint8Array(await options.body.arrayBuffer())
      chunks.push({ partIndex, offset, bytes: [...bytes] })
      return jsonResponse({ data: { partIndex, offset, chunkSizeBytes: bytes.length, receivedBytes: bytes.length }, meta: {} })
    }
    return jsonResponse({ data: { id: '34', originalFilename: file.name, sizeBytes: file.size }, meta: {} })
  }, async () => {
    const result = await uploadFile(file, 'artwork', {
      sha256: 'b'.repeat(64),
      chunkSizeBytes: 2
    })

    assert.equal(result.id, 34)
    assert.deepEqual(chunks.sort((left, right) => left.partIndex - right.partIndex), [
      { partIndex: 0, offset: 0, bytes: [0, 1] },
      { partIndex: 1, offset: 2, bytes: [2, 3] },
      { partIndex: 2, offset: 4, bytes: [4] }
    ])
    assert.equal(calls.at(-1).options.method, 'POST')
    assert.deepEqual(JSON.parse(calls.at(-1).options.body), {
      sizeBytes: file.size,
      sha256: 'b'.repeat(64)
    })
  })
})

test('retries the same concurrent part when its response is lost', async () => {
  const file = new Blob([new Uint8Array([10, 11, 12, 13])], { type: 'image/jpeg' })
  Object.defineProperty(file, 'name', { value: '断线.jpg' })
  const partAttempts = []

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
    if (path.includes('/parts/') && options.method === 'PUT') {
      const offset = Number(options.headers['X-Upload-Offset'])
      partAttempts.push(offset)
      if (offset === 0 && partAttempts.filter((value) => value === 0).length === 1) {
        return jsonResponse({ error: { message: '网关超时' }, meta: {} }, 502)
      }
      const size = (await options.body.arrayBuffer()).byteLength
      return jsonResponse({ data: { chunkSizeBytes: size, receivedBytes: size }, meta: {} })
    }
    return jsonResponse({ data: { id: '35', sizeBytes: file.size }, meta: {} })
  }, async () => {
    await uploadFile(file, 'artwork', { sha256: 'c'.repeat(64), chunkSizeBytes: 2, maxRetries: 1 })
  })

  assert.deepEqual(partAttempts.sort((left, right) => left - right), [0, 0, 2])
})

test('keeps the ordered append path available when no parallel endpoint is supplied', async () => {
  const file = new Blob([new Uint8Array([10, 11, 12, 13])], { type: 'image/jpeg' })
  const patchOffsets = []
  let statusCalls = 0

  await withTemporaryFetch(async (url, options) => {
    const path = String(url)
    if (options.method === 'PATCH' && path.endsWith('/content')) {
      const offset = Number(options.headers['X-Upload-Offset'])
      patchOffsets.push(offset)
      return jsonResponse({ data: { receivedBytes: offset + (await options.body.arrayBuffer()).byteLength }, meta: {} })
    }
    if (path.endsWith('/upload-sessions/22')) {
      statusCalls += 1
      return jsonResponse({ data: { receivedBytes: 2 }, meta: {} })
    }
    return jsonResponse({ data: { id: '35', sizeBytes: file.size }, meta: {} })
  }, async () => {
    await putUploadSessionContent(
      { sessionId: '22', expectedSize: file.size, receivedBytes: 0 },
      file,
      file.type,
      'legacy',
      undefined,
      {
        chunkSizeBytes: 2,
        uploadChunk: async (sessionId, offset, body, contentType) => {
          const response = await fetch(`/api/v1/files/upload-sessions/${sessionId}/content`, {
            method: 'PATCH',
            headers: { 'X-Upload-Offset': String(offset), 'Content-Type': contentType },
            body
          })
          return (await response.json()).data
        },
        uploadStatus: async (sessionId) => {
          const response = await fetch(`/api/v1/files/upload-sessions/${sessionId}`)
          return (await response.json()).data
        }
      }
    )
  })

  assert.deepEqual(patchOffsets, [0, 2])
  assert.equal(statusCalls, 0)
})
