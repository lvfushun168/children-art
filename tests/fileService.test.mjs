import assert from 'node:assert/strict'
import test from 'node:test'

const { sha256ForFile, uploadFile } = await import('../src/services/fileService.js')

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

test('sends the courseware validation profile through the three-step upload', async () => {
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
    if (String(url).endsWith('/content')) return jsonResponse({ data: null, meta: {} })
    return jsonResponse({ data: { id: '34', originalFilename: file.name, sizeBytes: file.size }, meta: {} })
  }, async () => {
    const result = await uploadFile(file, 'lesson-7-asset', {
      sha256: 'a'.repeat(64),
      validationProfile: 'COURSEWARE'
    })

    assert.equal(result.id, 34)
    assert.equal(JSON.parse(calls[0].options.body).validationProfile, 'COURSEWARE')
    assert.equal(calls.length, 3)
  })
})
