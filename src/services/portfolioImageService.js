import { protectedMediaUrl } from './protectedMediaCache.js'

const fallbackImageSource = (value = {}) =>
  value.artwork || value.fileUrl || value.image || value.src || ''

export const resolvePortfolioImageSource = async (value = {}, loadProtectedSource = protectedMediaUrl) => {
  const fallback = fallbackImageSource(value)
  if (!value.fileId) return fallback
  try {
    return await loadProtectedSource(value.fileId) || fallback
  } catch {
    return fallback
  }
}

export const hydratePortfolioRecords = async (records = [], loadProtectedSource = protectedMediaUrl) => {
  if (!Array.isArray(records)) return []
  return Promise.all(records.map(async (record) => ({
    ...record,
    artwork: await resolvePortfolioImageSource(record, loadProtectedSource)
  })))
}
