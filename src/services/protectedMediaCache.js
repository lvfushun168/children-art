import { loadProtectedBlobUrl } from './fileService.js'
import { recordApiCacheHit } from './apiClient.js'

export const protectedMediaCache = new Map()

export const protectedMediaUrl = (fileId) => {
  if (!fileId) return Promise.resolve('')
  const key = String(fileId)
  if (!protectedMediaCache.has(key)) {
    const promise = loadProtectedBlobUrl(fileId).catch((error) => {
      if (protectedMediaCache.get(key) === promise) protectedMediaCache.delete(key)
      throw error
    })
    protectedMediaCache.set(key, promise)
  } else {
    recordApiCacheHit(`/api/v1/files/${encodeURIComponent(key)}/content`)
  }
  return protectedMediaCache.get(key)
}

export const clearProtectedMediaCache = () => {
  protectedMediaCache.forEach((value) => {
    Promise.resolve(value).then((url) => {
      if (url) URL.revokeObjectURL(url)
    }).catch(() => {})
  })
  protectedMediaCache.clear()
}
