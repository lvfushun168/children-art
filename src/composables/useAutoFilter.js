import { onBeforeUnmount, watch } from 'vue'

// 筛选条件变化后自动查询：选择类条件（immediate）当场合并成一次请求，
// 关键词类条件（debounced）停顿 delay 毫秒后再请求。
// 重置时先改完所有条件，再调用 flush()，只会发出一次请求。
export const useAutoFilter = (apply, { immediate = [], debounced = [], delay = 350 } = {}) => {
  let timer = null
  const cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }
  const schedule = (wait) => {
    cancel()
    timer = setTimeout(() => {
      timer = null
      void apply()
    }, wait)
  }
  const flush = () => {
    cancel()
    return apply()
  }

  // flush: 'sync' 保证 flush() 紧跟在改值之后调用时，不会被稍后触发的 watcher 再排一次请求。
  if (immediate.length) watch(immediate, () => schedule(0), { flush: 'sync' })
  if (debounced.length) watch(debounced, () => schedule(delay), { flush: 'sync' })
  onBeforeUnmount(cancel)

  return { flush, cancel }
}
