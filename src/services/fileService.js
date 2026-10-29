import { api } from './api.js'
import { createIdempotencyKey, request } from './apiClient.js'
import { mapFile } from './mappers.js'

const SHA256_INITIAL_HASH = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
]

const SHA256_ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]

// 默认 1 MiB，在直传和 Tunnel 回退之间保持一致的分片粒度。
export const UPLOAD_CHUNK_SIZE_BYTES = 1024 * 1024
export const UPLOAD_CONCURRENCY = 4
const MAX_UPLOAD_RETRIES = 3
const UPLOAD_RETRY_DELAYS_MS = [500, 1000, 2000]
const DIRECT_UPLOAD_PROBE_TIMEOUT_MS = 2500
const DIRECT_UPLOAD_REQUEST_TIMEOUT_MS = 20000
const DIRECT_UPLOAD_PROBE_CACHE_MS = 30000
const DIRECT_UPLOAD_ORIGIN = String(import.meta.env?.VITE_UPLOAD_DIRECT_ORIGIN || '')
  .trim()
  .replace(/\/+$/, '')
const directProbeCache = new Map()
const directProbePromises = new Map()

const rightRotate = (value, bits) => (value >>> bits) | (value << (32 - bits))

const bytesToHex = (bytes) => [...bytes]
  .map((byte) => byte.toString(16).padStart(2, '0'))
  .join('')

const sha256Fallback = (input) => {
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64
  const padded = new Uint8Array(paddedLength)
  padded.set(input)
  padded[input.length] = 0x80

  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, Math.floor(input.length / 0x20000000))
  view.setUint32(paddedLength - 4, input.length << 3)

  const hash = Uint32Array.from(SHA256_INITIAL_HASH)
  const words = new Uint32Array(64)

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4)
    }

    for (let index = 16; index < 64; index += 1) {
      const word15 = words[index - 15]
      const word2 = words[index - 2]
      const smallSigma0 = rightRotate(word15, 7) ^ rightRotate(word15, 18) ^ (word15 >>> 3)
      const smallSigma1 = rightRotate(word2, 17) ^ rightRotate(word2, 19) ^ (word2 >>> 10)
      words[index] = (words[index - 16] + smallSigma0 + words[index - 7] + smallSigma1) >>> 0
    }

    let [a, b, c, d, e, f, g, h] = hash
    for (let index = 0; index < 64; index += 1) {
      const bigSigma1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)
      const choose = (e & f) ^ (~e & g)
      const temp1 = (h + bigSigma1 + choose + SHA256_ROUND_CONSTANTS[index] + words[index]) >>> 0
      const bigSigma0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (bigSigma0 + majority) >>> 0

      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }

    hash[0] = (hash[0] + a) >>> 0
    hash[1] = (hash[1] + b) >>> 0
    hash[2] = (hash[2] + c) >>> 0
    hash[3] = (hash[3] + d) >>> 0
    hash[4] = (hash[4] + e) >>> 0
    hash[5] = (hash[5] + f) >>> 0
    hash[6] = (hash[6] + g) >>> 0
    hash[7] = (hash[7] + h) >>> 0
  }

  const digest = new Uint8Array(hash.length * 4)
  hash.forEach((word, index) => {
    const offset = index * 4
    digest[offset] = word >>> 24
    digest[offset + 1] = word >>> 16
    digest[offset + 2] = word >>> 8
    digest[offset + 3] = word
  })
  return bytesToHex(digest)
}

const sha256 = async (file) => {
  const buffer = await file.arrayBuffer()
  const subtle = globalThis.crypto?.subtle
  if (typeof subtle?.digest === 'function') {
    const digest = await subtle.digest('SHA-256', buffer)
    return bytesToHex(new Uint8Array(digest))
  }
  return sha256Fallback(new Uint8Array(buffer))
}

const isRetryableUploadError = (error) => {
  const status = Number(error?.status || 0)
  return error?.code === 'NETWORK_ERROR' || status === 0 || status === 408 || status === 429 || status >= 500
}

const normalizeDirectUploadOrigin = (value) => {
  const origin = String(value || '').trim().replace(/\/+$/, '')
  return /^https?:\/\//i.test(origin) ? origin : ''
}

const directUploadApiBase = (origin) => `${normalizeDirectUploadOrigin(origin)}/api/v1`

const requestWithTimeout = (path, options, timeoutMs = DIRECT_UPLOAD_REQUEST_TIMEOUT_MS) => {
  if (typeof AbortController !== 'function') return request(path, options)
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs)
  return request(path, { ...options, signal: controller.signal }).finally(() => {
    globalThis.clearTimeout(timer)
  })
}

const probeDirectUpload = async (origin) => {
  const normalizedOrigin = normalizeDirectUploadOrigin(origin)
  if (!normalizedOrigin || typeof fetch !== 'function') return false

  const now = Date.now()
  const cached = directProbeCache.get(normalizedOrigin)
  if (cached && now - cached.checkedAt < DIRECT_UPLOAD_PROBE_CACHE_MS) return cached.available

  const pending = directProbePromises.get(normalizedOrigin)
  if (pending) return pending

  const promise = (async () => {
    let controller
    let timer
    try {
      controller = typeof AbortController === 'function' ? new AbortController() : null
      if (controller) timer = globalThis.setTimeout(() => controller.abort(), DIRECT_UPLOAD_PROBE_TIMEOUT_MS)
      const response = await fetch(`${normalizedOrigin}/actuator/health/liveness`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller?.signal
      })
      return response.ok
    } catch {
      return false
    } finally {
      if (timer) globalThis.clearTimeout(timer)
    }
  })().then((available) => {
    directProbeCache.set(normalizedOrigin, { available, checkedAt: Date.now() })
    return available
  }).finally(() => {
    directProbePromises.delete(normalizedOrigin)
  })

  directProbePromises.set(normalizedOrigin, promise)
  return promise
}

const directChunkApi = (origin, pathPrefix) => {
  const baseUrl = directUploadApiBase(origin)
  const prefix = String(pathPrefix || 'files').replace(/^\/+|\/+$/g, '')
  const sessionPath = (sessionId) => `${baseUrl}/${prefix}/upload-sessions/${encodeURIComponent(String(sessionId))}`

  return {
    uploadChunk: (sessionId, offset, body, contentType) => requestWithTimeout(`${sessionPath(sessionId)}/content`, {
      method: 'PATCH',
      body,
      rawBody: true,
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
        'X-Upload-Offset': String(offset)
      }
    }),
    uploadPart: (sessionId, partIndex, offset, body, contentType) => requestWithTimeout(
      `${sessionPath(sessionId)}/parts/${encodeURIComponent(String(partIndex))}`,
      {
        method: 'PUT',
        body,
        rawBody: true,
        headers: {
          'Content-Type': contentType || 'application/octet-stream',
          'X-Upload-Offset': String(offset)
        }
      }
    )
  }
}

const fallbackOnTransportError = (directRequest, tunnelRequest, state) => async (...args) => {
  if (!state.direct) return tunnelRequest(...args)
  try {
    return await directRequest(...args)
  } catch (error) {
    if (!isRetryableUploadError(error)) throw error
    state.direct = false
    return tunnelRequest(...args)
  }
}

/**
 * 创建当前上传会话使用的分片传输接口，直连失败时切换到 Tunnel。
 */
export const createUploadTransport = async ({
  directOrigin = DIRECT_UPLOAD_ORIGIN,
  directPathPrefix = 'files',
  uploadChunk,
  uploadPart,
  uploadStatus,
  directUpload = true
} = {}) => {
  const tunnel = { uploadChunk, uploadPart, uploadStatus, direct: false }
  const normalizedOrigin = normalizeDirectUploadOrigin(directOrigin)
  if (!directUpload || !normalizedOrigin || (!uploadChunk && !uploadPart)) return tunnel
  if (!(await probeDirectUpload(normalizedOrigin))) return tunnel

  const direct = directChunkApi(normalizedOrigin, directPathPrefix)
  const state = { direct: true }
  return {
    uploadChunk: uploadChunk
      ? fallbackOnTransportError(direct.uploadChunk, uploadChunk, state)
      : uploadChunk,
    uploadPart: uploadPart
      ? fallbackOnTransportError(direct.uploadPart, uploadPart, state)
      : uploadPart,
    uploadStatus,
    direct: true,
    isDirectActive: () => state.direct
  }
}

const finiteOffset = (value, fallback = 0) => {
  const offset = Number(value)
  return Number.isFinite(offset) && offset >= 0 ? Math.floor(offset) : fallback
}

const notifyUploadProgress = (callback, receivedBytes, totalBytes) => {
  if (typeof callback !== 'function') return
  try {
    callback({
      receivedBytes,
      totalBytes,
      percent: totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 100) : 100
    })
  } catch {
    // 上传进度展示不能影响文件上传本身。
  }
}

const waitBeforeRetry = (attempt) => new Promise((resolve) => {
  const delay = UPLOAD_RETRY_DELAYS_MS[Math.min(attempt, UPLOAD_RETRY_DELAYS_MS.length - 1)]
  globalThis.setTimeout(resolve, delay)
})

const uploadBlobBySequentialChunks = async (session, body, {
  contentType = 'application/octet-stream',
  uploadChunk,
  uploadStatus,
  chunkSizeBytes = UPLOAD_CHUNK_SIZE_BYTES,
  maxRetries = MAX_UPLOAD_RETRIES,
  onProgress
} = {}) => {
  if (!(body instanceof Blob)) throw new Error('分片上传内容必须是 Blob')
  if (typeof uploadChunk !== 'function') throw new Error('分片上传接口不可用')

  const sessionId = session?.fileUploadSessionId || session?.sessionId || session?.id
  if (!sessionId) throw new Error('上传会话不存在')

  const totalBytes = body.size
  const expectedSize = session?.expectedSize == null
    ? totalBytes
    : finiteOffset(session.expectedSize, totalBytes)
  if (expectedSize !== totalBytes) throw new Error('上传文件大小与会话预期不一致')

  const requestedChunkSize = finiteOffset(chunkSizeBytes, UPLOAD_CHUNK_SIZE_BYTES)
  const effectiveChunkSize = Math.max(1, requestedChunkSize)
  const retryLimit = Math.max(0, finiteOffset(maxRetries, MAX_UPLOAD_RETRIES))
  let offset = Math.min(finiteOffset(session?.receivedBytes), totalBytes)
  notifyUploadProgress(onProgress, offset, totalBytes)

  const readRemoteOffset = async (fallback) => {
    if (typeof uploadStatus !== 'function') return fallback
    try {
      const status = await uploadStatus(sessionId)
      const remoteOffset = finiteOffset(status?.receivedBytes, -1)
      return remoteOffset >= 0 && remoteOffset <= totalBytes ? remoteOffset : fallback
    } catch {
      return fallback
    }
  }

  while (offset < totalBytes) {
    const end = Math.min(offset + effectiveChunkSize, totalBytes)
    let attempt = 0

    while (true) {
      const chunk = body.slice(offset, end, contentType)
      try {
        const result = await uploadChunk(sessionId, offset, chunk, contentType)
        const receivedBytes = finiteOffset(result?.receivedBytes, -1)
        if (receivedBytes < end || receivedBytes > totalBytes) {
          throw new Error('服务器返回的上传进度无效')
        }
        offset = receivedBytes
        notifyUploadProgress(onProgress, offset, totalBytes)
        break
      } catch (error) {
        const remoteOffset = await readRemoteOffset(offset)
        if (remoteOffset !== offset) {
          offset = remoteOffset
          notifyUploadProgress(onProgress, offset, totalBytes)
          break
        }
        if (!isRetryableUploadError(error) || attempt >= retryLimit) throw error
        await waitBeforeRetry(attempt)
        attempt += 1
      }
    }
  }

  return { sessionId, sizeBytes: offset }
}

const uploadBlobByConcurrentParts = async (session, body, {
  contentType = 'application/octet-stream',
  uploadPart,
  chunkSizeBytes = UPLOAD_CHUNK_SIZE_BYTES,
  concurrency = UPLOAD_CONCURRENCY,
  maxRetries = MAX_UPLOAD_RETRIES,
  onProgress
} = {}) => {
  if (!(body instanceof Blob)) throw new Error('分片上传内容必须是 Blob')
  if (typeof uploadPart !== 'function') throw new Error('并发分片上传接口不可用')

  const sessionId = session?.fileUploadSessionId || session?.sessionId || session?.id
  if (!sessionId) throw new Error('上传会话不存在')

  const totalBytes = body.size
  const expectedSize = session?.expectedSize == null
    ? totalBytes
    : finiteOffset(session.expectedSize, totalBytes)
  if (expectedSize !== totalBytes) throw new Error('上传文件大小与会话预期不一致')

  const effectiveChunkSize = Math.max(1, finiteOffset(chunkSizeBytes, UPLOAD_CHUNK_SIZE_BYTES))
  const retryLimit = Math.max(0, finiteOffset(maxRetries, MAX_UPLOAD_RETRIES))
  const totalParts = Math.ceil(totalBytes / effectiveChunkSize)
  const workerCount = Math.max(1, Math.min(finiteOffset(concurrency, UPLOAD_CONCURRENCY), totalParts))
  const completedPartSizes = new Map()
  let nextPartIndex = 0
  notifyUploadProgress(onProgress, 0, totalBytes)

  const progressBytes = () => [...completedPartSizes.values()].reduce((sum, value) => sum + value, 0)

  const uploadPartWithRetry = async (partIndex) => {
    const offset = partIndex * effectiveChunkSize
    const end = Math.min(offset + effectiveChunkSize, totalBytes)
    const chunk = body.slice(offset, end, contentType)
    let attempt = 0

    while (true) {
      try {
        const result = await uploadPart(sessionId, partIndex, offset, chunk, contentType)
        const reportedSize = finiteOffset(result?.chunkSizeBytes, chunk.size)
        if (reportedSize !== chunk.size) throw new Error('服务器返回的分片大小无效')
        completedPartSizes.set(partIndex, chunk.size)
        notifyUploadProgress(onProgress, progressBytes(), totalBytes)
        return
      } catch (error) {
        if (!isRetryableUploadError(error) || attempt >= retryLimit) throw error
        await waitBeforeRetry(attempt)
        attempt += 1
      }
    }
  }

  const worker = async () => {
    while (true) {
      const partIndex = nextPartIndex
      nextPartIndex += 1
      if (partIndex >= totalParts) return
      await uploadPartWithRetry(partIndex)
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  notifyUploadProgress(onProgress, totalBytes, totalBytes)
  return { sessionId, sizeBytes: totalBytes }
}

export const uploadBlobByChunks = async (session, body, options = {}) => {
  if (typeof options.uploadPart === 'function') {
    return uploadBlobByConcurrentParts(session, body, options)
  }
  return uploadBlobBySequentialChunks(session, body, options)
}

export const uploadFile = async (file, purpose = 'lesson-asset', options = {}) => {
  if (!file) throw new Error('未选择文件')
  const digest = options.sha256 || await sha256(file)
  const mediaType = file.type || 'application/octet-stream'
  const session = await api.files.createUploadSession({
    originalFilename: file.name,
    mediaType,
    expectedSize: file.size,
    expectedSha256: digest,
    purpose,
    validationProfile: options.validationProfile
  })
  await putUploadSessionContent(session, file, mediaType, 'file-content', api.files.uploadContent, {
    uploadChunk: api.files.uploadChunk,
    uploadPart: api.files.uploadPart,
    uploadStatus: api.files.uploadStatus,
    directOrigin: options.directOrigin,
    directPathPrefix: 'files',
    directUpload: options.directUpload,
    onProgress: options.onProgress,
    chunkSizeBytes: options.chunkSizeBytes,
    concurrency: options.concurrency,
    maxRetries: options.maxRetries
  })
  const fileId = session.fileId || session.id
  const completed = await api.files.completeUpload(session.fileUploadSessionId || session.sessionId, {
    sizeBytes: file.size,
    sha256: digest
  }, options.idempotencyKey || createIdempotencyKey(`file:${purpose}`))
  return mapFile(completed || { ...session, id: fileId, sizeBytes: file.size, sha256: digest, originalFilename: file.name, mediaType })
}

export const uploadCoursewareFile = async (file, options = {}) => {
  if (!file) throw new Error('未选择文件')
  const digest = options.sha256 || await sha256(file)
  const mediaType = file.type || 'application/octet-stream'
  const session = await api.courseware.createUploadSession({
    originalFilename: file.name,
    mediaType,
    expectedSize: file.size,
    expectedSha256: digest
  })
  await putUploadSessionContent(session, file, mediaType, 'courseware', api.courseware.uploadContent, {
    uploadChunk: api.courseware.uploadChunk,
    uploadPart: api.courseware.uploadPart,
    uploadStatus: api.courseware.uploadStatus,
    directOrigin: options.directOrigin,
    directPathPrefix: 'courseware',
    directUpload: options.directUpload,
    onProgress: options.onProgress,
    chunkSizeBytes: options.chunkSizeBytes,
    concurrency: options.concurrency,
    maxRetries: options.maxRetries
  })
  const completed = await api.courseware.completeUpload(
    session.fileUploadSessionId || session.sessionId,
    { sizeBytes: file.size, sha256: digest },
    options.idempotencyKey || createIdempotencyKey('courseware-complete')
  )
  return mapFile(completed || {
    ...session,
    id: session.fileId || session.id,
    sizeBytes: file.size,
    sha256: digest,
    originalFilename: file.name,
    mediaType
  })
}

export const putUploadSessionContent = async (
  session,
  body,
  contentType = 'application/octet-stream',
  scope = 'file-content',
  uploadRequest = api.files.uploadContent,
  options = {}
) => {
  const uploadUrl = session?.uploadUrl || ''
  if (uploadUrl && /^https?:\/\//i.test(uploadUrl)) {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
        'Idempotency-Key': createIdempotencyKey(`${scope}:${session.sessionId || session.fileUploadSessionId || 'upload'}`)
      },
      body
    })
    if (!response.ok) throw new Error(`文件上传失败（${response.status}）`)
    return response
  }

  if (body instanceof Blob && options.uploadChunk) {
    const transport = await createUploadTransport({
      directOrigin: options.directOrigin,
      directPathPrefix: options.directPathPrefix,
      uploadChunk: options.uploadChunk,
      uploadPart: options.uploadPart,
      uploadStatus: options.uploadStatus,
      directUpload: options.directUpload
    })
    return uploadBlobByChunks(session, body, {
      contentType,
      uploadChunk: transport.uploadChunk,
      uploadPart: transport.uploadPart,
      uploadStatus: transport.uploadStatus,
      chunkSizeBytes: options.chunkSizeBytes,
      concurrency: options.concurrency,
      maxRetries: options.maxRetries,
      onProgress: options.onProgress
    })
  }
  return uploadRequest(session?.fileUploadSessionId || session?.sessionId, body, contentType)
}

export const loadProtectedBlobUrl = async (fileId, { variant = 'original' } = {}) => {
  if (!fileId) return ''
  const blob = variant === 'preview' ? await api.files.preview(fileId) : await api.files.content(fileId)
  return URL.createObjectURL(blob)
}

export const downloadProtectedFile = async (fileId, filename = 'download') => {
  if (!fileId) throw new Error('文件不存在')
  const blob = await api.files.content(fileId)
  const urlApi = globalThis.URL
  if (typeof document === 'undefined' || typeof urlApi?.createObjectURL !== 'function') {
    throw new Error('当前环境不支持文件下载')
  }

  const objectUrl = urlApi.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename || 'download'
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    globalThis.setTimeout(() => urlApi.revokeObjectURL(objectUrl), 1000)
  }
}

export const loadPublicBlobUrl = async (token, accessKey) => {
  const blob = await api.parent.publicAsset(token, accessKey)
  return URL.createObjectURL(blob)
}

export const sha256ForFile = sha256
