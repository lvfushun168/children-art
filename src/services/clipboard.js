/**
 * 复制文本到系统剪贴板。
 *
 * 安全上下文优先使用 Clipboard API；在 HTTP 页面或浏览器不支持该 API 时，
 * 回退到传统的 textarea 复制方式。返回 false 表示浏览器拒绝了两种复制方式。
 */
export const copyTextToClipboard = async (text) => {
  const value = typeof text === 'string' ? text : String(text ?? '')
  if (!value.trim()) return false

  const secureContext = typeof window === 'undefined' || window.isSecureContext !== false
  if (secureContext && typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // 浏览器拒绝异步剪贴板时继续尝试传统复制方式。
    }
  }

  if (typeof document === 'undefined' || !document.body || typeof document.execCommand !== 'function') return false

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '0'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  let copied = false
  try {
    copied = Boolean(document.execCommand('copy'))
  } catch {
    copied = false
  } finally {
    textarea.parentNode?.removeChild(textarea)
  }
  return copied
}
