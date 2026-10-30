// 返回层：让抽屉、弹层、向导步骤、列表到详情这类“页面内的层级”也能被系统返回手势逐层关闭。
//
// 每打开一层，就往浏览器历史里压一条与当前页面同地址的记录，并在 history.state.__layers
// 里记下深度。系统返回触发 popstate 后，关闭深度大于当前记录的所有层。
// 程序主动关闭某一层（点关闭按钮）时，合并同一时刻的关闭操作，再把多出来的历史记录退回去。
// 页面切换（组件卸载、路由跳转）遗留的记录不主动退回，等用户返回到它时自动跳过。

const STATE_KEY = '__layers'
// 程序主动退回历史记录后，等待 popstate 的最长时间，防止路由导航一直被挂起。
const SETTLE_TIMEOUT = 400

const layers = []
let lastDepth = 0
let lastPosition = 0
let pendingBacks = 0
let waiters = []
let reconcileQueued = false
let installed = false

const hasWindow = () => typeof window !== 'undefined'
const stateDepth = () => Number(window.history.state?.[STATE_KEY]) || 0
// vue-router 写入的历史位置；遗留的层记录与所在页面共用同一个位置。
const statePosition = () => Number(window.history.state?.position) || 0

const flushWaiters = () => {
  const list = waiters
  waiters = []
  list.forEach((resolve) => resolve())
}

// 等程序主动发出的历史回退全部落地，再多等一个宏任务，让路由自己的 popstate 导航先结束。
const whenIdle = async () => {
  while (pendingBacks > 0) {
    await new Promise((resolve) => {
      waiters.push(resolve)
      setTimeout(() => {
        pendingBacks = 0
        flushWaiters()
      }, SETTLE_TIMEOUT)
    })
  }
  await new Promise((resolve) => setTimeout(resolve, 0))
}

const pushEntry = (layer, depth) => {
  window.history.pushState({ ...window.history.state, [STATE_KEY]: depth }, '')
  layer.depth = depth
  layer.open = true
  layers.push(layer)
  lastDepth = depth
}

const removeLayer = (layer) => {
  const index = layers.indexOf(layer)
  if (index >= 0) layers.splice(index, 1)
  layer.open = false
}

const reconcile = () => {
  const target = layers.reduce((max, layer) => Math.max(max, layer.depth), 0)
  const current = stateDepth()
  if (current <= target) return
  pendingBacks += 1
  window.history.go(-(current - target))
}

const queueReconcile = () => {
  if (reconcileQueued) return
  reconcileQueued = true
  queueMicrotask(() => {
    reconcileQueued = false
    reconcile()
  })
}

const onPopState = async (event) => {
  const depth = Number(event.state?.[STATE_KEY]) || 0
  const position = Number(event.state?.position) || 0
  const backward = position < lastPosition || (position === lastPosition && depth < lastDepth)
  lastDepth = depth
  lastPosition = position
  if (pendingBacks > 0) {
    pendingBacks -= 1
    if (!pendingBacks) flushWaiters()
  }

  const closing = layers.filter((layer) => layer.depth > depth).sort((a, b) => b.depth - a.depth)
  const refused = []
  for (const layer of closing) {
    removeLayer(layer)
    await layer.onBack()
    // 关闭被拒绝（例如放弃未保存修改时点了取消），需要把这一层重新补回历史。
    if (layer.isActive()) refused.push(layer)
  }
  refused.sort((a, b) => a.depth - b.depth).forEach((layer, index) => pushEntry(layer, depth + 1 + index))

  // 当前记录属于已经不存在的层（遗留记录），继续后退跳过它。
  if (depth > 0 && backward && !layers.some((layer) => layer.depth === depth)) window.history.back()
}

export const openBackLayer = ({ onBack, isActive, escapable = true }) => {
  if (!hasWindow()) return null
  const layer = { onBack, isActive, escapable, depth: 0, open: false }
  pushEntry(layer, stateDepth() + 1)
  return layer
}

// 程序主动关闭一层：移除并把对应的历史记录退回去。
export const closeBackLayer = (layer) => {
  if (!layer?.open) return
  removeLayer(layer)
  queueReconcile()
}

// 组件卸载：只移除，不动历史，遗留记录之后会被自动跳过。
export const abandonBackLayer = (layer) => {
  if (layer?.open) removeLayer(layer)
}

// 路由跳转前已经决定离开当前页面，所有层静默丢弃。
export const dropBackLayers = () => {
  layers.splice(0).forEach((layer) => { layer.open = false })
}

// “返回上一级”：上一条历史记录恰好是目标页时真正后退，否则才新增一条。
export const navigateUp = (router, location) => {
  const target = router.resolve(location).fullPath
  if (hasWindow() && window.history.state?.back === target) {
    const depth = stateDepth()
    dropBackLayers()
    window.history.go(-(depth + 1))
    return Promise.resolve()
  }
  return router.push(location)
}

// 正在展开的下拉、菜单、日期面板自己会处理 Esc，这时不能连抽屉一起关掉。
const POPUP_SELECTOR = '[aria-expanded="true"], .adaptive-select-menu, .user-popover, .dp__menu, .confirm-backdrop'

// Esc 关闭最上面一层浮层，效果等同系统返回，所以“放弃未保存修改”的确认也会照常触发。
const onEscape = (event) => {
  if (event.key !== 'Escape' || event.isComposing) return
  const top = layers.reduce((best, layer) => (!best || layer.depth > best.depth ? layer : best), null)
  if (!top || top.escapable === false) return
  if (document.querySelector(POPUP_SELECTOR)) return
  const count = layers.length
  // 等其他组件自己的 Esc 处理跑完：它们若已关闭了某一层或阻止了默认行为，这里就不再重复关闭。
  setTimeout(() => {
    if (event.defaultPrevented || layers.length !== count || pendingBacks > 0 || reconcileQueued) return
    if (!layers.includes(top) || document.querySelector('.confirm-backdrop')) return
    window.history.back()
  }, 0)
}

export const installBackLayers = (router) => {
  if (installed || !hasWindow()) return
  installed = true
  window.addEventListener('keydown', onEscape, true)
  // 刷新后历史记录里保留着旧的深度，但对应的层已经不存在。
  if (stateDepth() > 0) window.history.replaceState({ ...window.history.state, [STATE_KEY]: 0 }, '')
  router.beforeEach(async (to, from) => {
    // 地址没变的 popstate（关闭某一层）不能丢弃其余层，也不能被推迟。
    if (to.fullPath === from.fullPath) return undefined
    // 先让同一时刻排队的关闭操作完成合并，再判断是否有历史回退尚未结束。
    await Promise.resolve()
    if (pendingBacks > 0 || reconcileQueued) {
      // 回退会改写当前历史位置，此时直接跳转会被回退覆盖。取消这次导航，等回退结束后重新跳转。
      void whenIdle().then(() => router.push({ path: to.path, query: to.query, hash: to.hash }))
      return false
    }
    dropBackLayers()
    return undefined
  })
  lastPosition = statePosition()
  router.afterEach(() => {
    lastDepth = stateDepth()
    lastPosition = statePosition()
  })
}

// 必须在 vue-router 创建之前注册：同一次 popstate 里路由的导航会更新位置记录，需要先判断方向。
// router/index.js 在创建路由前先引入本模块，以保证注册顺序。
if (hasWindow()) window.addEventListener('popstate', onPopState)
