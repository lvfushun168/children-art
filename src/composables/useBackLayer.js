import { onBeforeUnmount, toValue, watch } from 'vue'
import { abandonBackLayer, closeBackLayer, openBackLayer } from '../services/backLayers'

/**
 * 让一个页面内的层级（抽屉、弹层、向导步骤、列表到详情）响应系统返回手势。
 * isActive 为 true 期间占用一条历史记录；用户返回时调用 onBack 关闭这一层。
 * 如果 onBack 之后 isActive 仍为 true（拒绝关闭，或者像向导那样还有上一层），会自动补回历史记录。
 * 需要在组件 setup 顶层调用。
 *
 * escapable 为 false 表示这一层只是页面里的“步骤”而不是浮层，按 Esc 不应该退回上一步。
 */
export function useBackLayer(isActive, onBack, { escapable = true } = {}) {
  let layer = null
  const active = () => Boolean(toValue(isActive))

  watch(active, (on) => {
    if (on && !layer?.open) layer = openBackLayer({ onBack, isActive: active, escapable })
    else if (!on && layer?.open) closeBackLayer(layer)
  }, { immediate: true })

  onBeforeUnmount(() => abandonBackLayer(layer))
}
