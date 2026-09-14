import { loadProtectedBlobUrl } from './fileService.js'
import { recordApiCacheHit } from './apiClient.js'
import { clearMediaRequestQueue, enqueueMediaRequest } from './mediaRequestQueue.js'

export const protectedMediaCache = new Map()

const normalizeVariant = (variant) => variant === 'preview' ? 'preview' : 'original'
const cacheKey = (fileId, variant) => `${String(fileId)}:${variant}`
const contentPath = (fileId, variant) => variant === 'preview'
  ? `/api/v1/files/${encodeURIComponent(String(fileId))}/preview`
  : `/api/v1/files/${encodeURIComponent(String(fileId))}/content`

export const protectedMediaUrl = (fileId, { variant = 'original', priority = 'low' } = {}) => {
  if (!fileId) return Promise.resolve('')
  const normalizedVariant = normalizeVariant(variant)
  const key = cacheKey(fileId, normalizedVariant)
  if (!protectedMediaCache.has(key)) {
    const promise = enqueueMediaRequest(
      () => loadProtectedBlobUrl(fileId, { variant: normalizedVariant }),
      priority
    ).catch((error) => {
      if (protectedMediaCache.get(key) === promise) protectedMediaCache.delete(key)
      throw error
    })
    protectedMediaCache.set(key, promise)
  } else {
    recordApiCacheHit(contentPath(fileId, normalizedVariant))
  }
  return protectedMediaCache.get(key)
}

export const invalidateProtectedMedia = (fileId, { variant = 'original' } = {}) => {
  if (!fileId) return
  const key = cacheKey(fileId, normalizeVariant(variant))
  const value = protectedMediaCache.get(key)
  protectedMediaCache.delete(key)
  if (!value) return
  Promise.resolve(value).then((url) => {
    if (url) URL.revokeObjectURL(url)
  }).catch(() => {})
}

export const clearProtectedMediaCache = () => {
  protectedMediaCache.forEach((value) => {
    Promise.resolve(value).then((url) => {
      if (url) URL.revokeObjectURL(url)
    }).catch(() => {})
  })
  protectedMediaCache.clear()
  clearMediaRequestQueue()
}
