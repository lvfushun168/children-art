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
