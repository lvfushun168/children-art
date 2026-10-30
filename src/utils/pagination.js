export const DEFAULT_PAGE_SIZE_OPTIONS = [20, 50, 100]

export const loadAllPageItems = async (loader, mapper = (value) => value, params = {}, pageSize = 200, concurrency = 2) => {
  const first = await loader({ ...params, page: 1, pageSize })
  const firstItems = Array.isArray(first?.items) ? first.items.map(mapper) : []
  const total = Number(first?.total || 0)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (totalPages === 1) return { items: firstItems, total }
  const rest = []
  const pageConcurrency = Math.max(1, Number(concurrency) || 1)
  const pages = Array.from({ length: totalPages - 1 }, (_, index) => index + 2)
  for (let index = 0; index < pages.length; index += pageConcurrency) {
    const batch = await Promise.all(pages.slice(index, index + pageConcurrency).map((page) =>
      loader({ ...params, page, pageSize }).then((value) =>
        (Array.isArray(value?.items) ? value.items : []).map(mapper))
    ))
    rest.push(...batch)
  }
  return { items: [...firstItems, ...rest.flat()], total }
}

export const countPages = (total, pageSize) =>
  Math.max(1, Math.ceil(Number(total || 0) / Math.max(1, Number(pageSize) || 20)))

// 页码条：首页、末页和当前页前后各 siblings 页始终显示，中间用 null 表示省略号。
export const buildPageItems = (page, pageCount, siblings = 1) => {
  const current = Math.min(Math.max(1, Number(page) || 1), pageCount)
  const slots = siblings * 2 + 5
  if (pageCount <= slots) return Array.from({ length: pageCount }, (_, index) => index + 1)
  const left = Math.max(current - siblings, 2)
  const right = Math.min(current + siblings, pageCount - 1)
  const items = [1]
  if (left > 2) items.push(left === 3 ? 2 : null)
  for (let value = left; value <= right; value += 1) items.push(value)
  if (right < pageCount - 1) items.push(right === pageCount - 2 ? pageCount - 1 : null)
  items.push(pageCount)
  return items
}
