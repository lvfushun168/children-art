export const DEFAULT_BAIDU_BACKEND_BASE_URL = 'http://mengdi.ccwu.cc:10001'
export const DEFAULT_BAIDU_FRONTEND_BASE_URL = 'http://mengdi.ccwu.cc:10001'
export const DEFAULT_BAIDU_FRONTEND_RETURN_PATH = '/workspace/operations/settings'

const LEGACY_BAIDU_BASE_URLS = new Set([
  'http://localhost:8080',
  'http://localhost:5173',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5173'
])

export const normalizeBaiduBaseUrl = (value, fallback = DEFAULT_BAIDU_FRONTEND_BASE_URL) => {
  const normalized = String(value || '').trim().replace(/\/+$/, '')
  return !normalized || LEGACY_BAIDU_BASE_URLS.has(normalized) ? fallback : normalized
}

export const normalizeBaiduReturnPath = (value) => {
  const normalized = String(value || '').trim()
  return !normalized || normalized === '/settings' ? DEFAULT_BAIDU_FRONTEND_RETURN_PATH : normalized
}
