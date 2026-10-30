// 统一的确认对话框：替代浏览器原生 window.confirm。
// 用法：if (!(await confirmAction({ title, message, tone: 'danger' }))) return
import { reactive } from 'vue'

const defaults = () => ({
  title: '请确认',
  message: '',
  confirmText: '确定',
  cancelText: '取消',
  // default | danger：危险操作用红色按钮，并默认聚焦在“取消”上，避免回车误删。
  tone: 'default',
  // 传入 input 后对话框带一个文本框，确认时返回输入内容（见 promptAction）
  input: null,
  inputValue: ''
})

export const confirmState = reactive({ open: false, ...defaults() })

let resolver = null

export const confirmAction = (options) => {
  // 服务端渲染或测试环境没有界面可确认，保持原来“直接通过”的行为。
  if (typeof window === 'undefined') return Promise.resolve(true)
  const input = typeof options === 'string' ? { message: options } : (options || {})
  // 同一时间只保留一个对话框，新的请求会让旧的按“取消”处理。
  if (resolver) settleConfirm(false)
  Object.assign(confirmState, defaults(), input, { open: true })
  return new Promise((resolve) => {
    resolver = resolve
  })
}

// 带文本框的确认：确认返回输入内容（可能是空字符串），取消返回 null。
export const promptAction = (options) => {
  if (typeof window === 'undefined') return Promise.resolve(options?.value ?? '')
  const { placeholder = '', value = '', label = '', ...rest } = options || {}
  return confirmAction({
    ...rest,
    input: { placeholder, label },
    inputValue: String(value ?? '')
  })
}

export const settleConfirm = (value) => {
  const resolve = resolver
  resolver = null
  const wasPrompt = Boolean(confirmState.input)
  const text = confirmState.inputValue
  confirmState.open = false
  if (!resolve) return
  if (wasPrompt) resolve(value ? text : null)
  else resolve(Boolean(value))
}
