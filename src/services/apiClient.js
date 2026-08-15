const API_BASE_URL = String(import.meta.env?.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
const ACCESS_TOKEN_KEY = 'children-art-access-token'
const REFRESH_TOKEN_KEY = 'children-art-refresh-token'
const SESSION_KEY = 'children-art-session'

let refreshPromise = null
const listeners = new Set()
const requestListeners = new Set()
const requestStats = new Map()

const isBrowser = typeof window !== 'undefined'

const readStorage = (key) => {
  if (!isBrowser) return ''
  try {
    return window.localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

const writeStorage = (key, value) => {
  if (!isBrowser) return
  try {
    if (value === null || value === undefined || value === '') window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // 浏览器禁用存储时仍允许当前会话工作。
  }
}

const jsonHeaders = { Accept: 'application/json' }

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message || '请求失败')
    this.name = 'ApiError'
    this.status = options.status || 0
    this.code = options.code || 'UNKNOWN_ERROR'
    this.details = options.details || null
    this.requestId = options.requestId || ''
    this.url = options.url || ''
  }
}

export const getApiBaseUrl = () => API_BASE_URL
export const getAccessToken = () => readStorage(ACCESS_TOKEN_KEY)
export const getRefreshToken = () => readStorage(REFRESH_TOKEN_KEY)
export const getSession = () => {
  const value = readStorage(SESSION_KEY)
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export const onSessionChanged = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const onApiRequest = (listener) => {
  requestListeners.add(listener)
  return () => requestListeners.delete(listener)
}

export const getApiRequestStats = () => [...requestStats.entries()].map(([key, value]) => ({ key, ...value }))
export const resetApiRequestStats = () => requestStats.clear()

const notifyApiRequest = (event) => {
  const key = `${event.method} ${event.path}`
  const previous = requestStats.get(key) || { count: 0, cacheHits: 0, totalMs: 0, lastAt: 0 }
  const now = Date.now()
  const next = {
    ...previous,
    count: previous.count + (event.cached ? 0 : 1),
    cacheHits: previous.cacheHits + (event.cached ? 1 : 0),
    totalMs: previous.totalMs + (event.durationMs || 0),
    lastAt: now
  }
  requestStats.set(key, next)
  requestListeners.forEach((listener) => {
    try { listener({ ...event, count: next.count, averageMs: next.count ? next.totalMs / next.count : 0 }) } catch { /* observer must not affect requests */ }
  })
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV && !event.cached && event.method === 'GET'
    && previous.lastAt && now - previous.lastAt < 5000) {
    console.warn(`[api] duplicate GET ${event.path} (${next.count})`)
  }
}

/** Records a cache hit without creating a network request entry. */
export const recordApiCacheHit = (path, method = 'GET') => {
  notifyApiRequest({ method: String(method).toUpperCase(), path: String(path), status: 200, ok: true, cached: true, durationMs: 0 })
}

const emitSession = (session) => listeners.forEach((listener) => listener(session))

export const setSession = (auth) => {
  if (!auth) return
  writeStorage(ACCESS_TOKEN_KEY, auth.accessToken || '')
  writeStorage(REFRESH_TOKEN_KEY, auth.refreshToken || '')
  if (auth.me) writeStorage(SESSION_KEY, JSON.stringify(auth.me))
  emitSession(auth.me || getSession())
}

export const updateStoredMe = (me) => {
  if (me) writeStorage(SESSION_KEY, JSON.stringify(me))
  emitSession(me || getSession())
}

export const clearSession = () => {
  writeStorage(ACCESS_TOKEN_KEY, '')
  writeStorage(REFRESH_TOKEN_KEY, '')
  writeStorage(SESSION_KEY, '')
  emitSession(null)
}

const toHeaderSafeValue = (value, fallback = 'request') => {
  const text = String(value ?? fallback)
  if (/^[\t\x20-\x7E]*$/.test(text)) return text
  try {
    // Idempotency-Key is an HTTP header. Keep user-controlled scope values
    // ASCII-only so fetch does not reject filenames or labels containing CJK.
    return encodeURIComponent(text)
  } catch {
    return fallback
  }
}

export const createIdempotencyKey = (scope = 'request') => {
  const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `children-art:${toHeaderSafeValue(scope)}:${uuid}`
}

const isWriteMethod = (method) => !['GET', 'HEAD', 'OPTIONS'].includes(String(method || 'GET').toUpperCase())

const resolveUrl = (path) => {
  if (/^https?:\/\//i.test(path)) return path
  if (String(path).startsWith('/api/')) return path
  return `${API_BASE_URL}/${String(path).replace(/^\//, '')}`
}

const parseResponseBody = async (response, responseType) => {
  if (response.status === 204) return null
  if (responseType === 'blob') return response.blob()
  if (responseType === 'arrayBuffer') return response.arrayBuffer()
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json') || contentType.includes('+json')) {
    const text = await response.text()
    return text ? JSON.parse(text) : null
  }
  return response.text()
}

const errorFromResponse = async (response, url) => {
  let payload = null
  try {
    payload = await parseResponseBody(response, 'json')
  } catch {
    payload = null
  }
  const error = payload?.error || payload?.data?.error || {}
  return new ApiError(error.message || response.statusText || '请求失败', {
    status: response.status,
    code: error.code || `HTTP_${response.status}`,
    details: error.details,
    requestId: payload?.meta?.requestId || response.headers.get('x-request-id') || '',
    url
  })
}

const unwrap = (payload, response) => {
  if (payload === null || payload === undefined) return payload
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'error') && payload.error) {
    throw new ApiError(payload.error.message || '请求失败', {
      status: response.status,
      code: payload.error.code,
      details: payload.error.details,
      requestId: payload.meta?.requestId || ''
    })
  }
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'data') && Object.prototype.hasOwnProperty.call(payload, 'meta')) {
    return payload.data
  }
  return payload
}

const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken()
  if (!refreshToken) throw new ApiError('登录状态已失效', { status: 401, code: 'TOKEN_EXPIRED' })
  if (!refreshPromise) {
    refreshPromise = fetch(resolveUrl('/auth/refresh'), {
      method: 'POST',
      headers: { ...jsonHeaders, 'Content-Type': 'application/json', 'Idempotency-Key': createIdempotencyKey('AUTH_REFRESH') },
      body: JSON.stringify({ refreshToken })
    }).then(async (response) => {
      if (!response.ok) throw await errorFromResponse(response, resolveUrl('/auth/refresh'))
      const payload = await response.json()
      const auth = unwrap(payload, response)
      const nextAuth = { ...auth, refreshToken: auth.refreshToken || refreshToken }
      setSession(nextAuth)
      return nextAuth
    }).catch((error) => {
      clearSession()
      throw error
    }).finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

export const request = async (path, options = {}, retry = true) => {
  const {
    method = 'GET',
    body,
    headers = {},
    auth = true,
    responseType,
    rawBody = false,
    idempotencyKey,
    signal
  } = options
  const url = resolveUrl(path)
  const upperMethod = String(method).toUpperCase()
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const requestPath = (() => {
    try {
      const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
      return `${parsed.pathname}${parsed.search}`
    } catch { return String(path) }
  })()
  const requestHeaders = { ...jsonHeaders, ...headers }
  const token = getAccessToken()
  if (auth && token) requestHeaders.Authorization = `Bearer ${token}`
  if (isWriteMethod(upperMethod) && !requestHeaders['Idempotency-Key'] && idempotencyKey !== false) {
    requestHeaders['Idempotency-Key'] = toHeaderSafeValue(idempotencyKey || createIdempotencyKey(`${upperMethod}:${path}`))
  }

  let requestBody = body
  if (body !== undefined && body !== null && !rawBody && !(body instanceof Blob) && !(body instanceof ArrayBuffer)) {
    requestHeaders['Content-Type'] = 'application/json'
    requestBody = JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(url, { method: upperMethod, headers: requestHeaders, body: requestBody, signal })
  } catch (error) {
    notifyApiRequest({ method: upperMethod, path: requestPath, url, status: 0, ok: false, cached: false, durationMs: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt })
    throw new ApiError(error?.message || '网络连接失败', { code: 'NETWORK_ERROR', url })
  }

  notifyApiRequest({ method: upperMethod, path: requestPath, url, status: response.status, ok: response.ok, cached: false, durationMs: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt })

  if (response.status === 401 && auth && retry && !String(path).includes('/auth/')) {
    await refreshAccessToken()
    return request(path, options, false)
  }
  if (!response.ok) throw await errorFromResponse(response, url)

  const payload = await parseResponseBody(response, responseType)
  return responseType ? payload : unwrap(payload, response)
}

export const queryString = (params = {}) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === 'all') return
    if (Array.isArray(value)) value.forEach((item) => search.append(key, String(item)))
    else search.set(key, String(value))
  })
  const value = search.toString()
  return value ? `?${value}` : ''
}

export const pageParams = (params = {}) => ({ page: 1, pageSize: 20, ...params })
