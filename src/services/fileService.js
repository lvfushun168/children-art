import { api } from './api.js'
import { createIdempotencyKey } from './apiClient.js'
import { mapFile } from './mappers.js'

const sha256 = async (file) => {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const uploadFile = async (file, purpose = 'lesson-asset', options = {}) => {
  if (!file) throw new Error('未选择文件')
  const digest = options.sha256 || await sha256(file)
  const session = await api.files.createUploadSession({
    originalFilename: file.name,
    mediaType: file.type || 'application/octet-stream',
    expectedSize: file.size,
    expectedSha256: digest,
    purpose
  })
  await putUploadSessionContent(session, file, file.type)
  const fileId = session.fileId || session.id
  const completed = await api.files.completeUpload(session.fileUploadSessionId || session.sessionId, {
    sizeBytes: file.size,
    sha256: digest
  }, options.idempotencyKey || createIdempotencyKey(`file:${purpose}`))
  return mapFile(completed || { ...session, id: fileId, sizeBytes: file.size, sha256: digest, originalFilename: file.name, mediaType: file.type })
}

export const putUploadSessionContent = async (session, body, contentType = 'application/octet-stream') => {
  const uploadUrl = session?.uploadUrl || ''
  if (uploadUrl && /^https?:\/\//i.test(uploadUrl)) {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
        'Idempotency-Key': createIdempotencyKey(`file-content:${session.sessionId || session.fileUploadSessionId || 'upload'}`)
      },
      body
    })
    if (!response.ok) throw new Error(`文件上传失败（${response.status}）`)
    return response
  }
  return api.files.uploadContent(session?.fileUploadSessionId || session?.sessionId, body, contentType)
}

export const loadProtectedBlobUrl = async (fileId) => {
  if (!fileId) return ''
  const blob = await api.files.content(fileId)
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
