import assert from 'node:assert/strict'
import test from 'node:test'

const { sha256ForFile } = await import('../src/services/fileService.js')

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
