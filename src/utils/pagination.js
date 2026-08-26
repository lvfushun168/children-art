export const loadAllPageItems = async (loader, mapper = (value) => value, params = {}, pageSize = 200) => {
  const first = await loader({ ...params, page: 1, pageSize })
  const firstItems = Array.isArray(first?.items) ? first.items.map(mapper) : []
  const total = Number(first?.total || 0)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (totalPages === 1) return { items: firstItems, total }
  const rest = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) =>
    loader({ ...params, page: index + 2, pageSize }).then((value) =>
      (Array.isArray(value?.items) ? value.items : []).map(mapper))
  ))
  return { items: [...firstItems, ...rest.flat()], total }
}
