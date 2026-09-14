export const MAX_MEDIA_REQUESTS = 3

const pending = []
let active = 0
let sequence = 0

const priorityValue = (priority) => priority === 'high' ? 1 : 0

const pump = () => {
  while (active < MAX_MEDIA_REQUESTS && pending.length) {
    const item = pending.shift()
    active += 1
    Promise.resolve()
      .then(item.task)
      .then(item.resolve, item.reject)
      .finally(() => {
        active -= 1
        pump()
      })
  }
}

export const enqueueMediaRequest = (task, priority = 'low') => new Promise((resolve, reject) => {
  pending.push({ task, priority: priorityValue(priority), sequence: sequence++, resolve, reject })
  pending.sort((left, right) => right.priority - left.priority || left.sequence - right.sequence)
  pump()
})

export const mediaRequestQueueStats = () => ({
  active,
  pending: pending.length,
  maxConcurrent: MAX_MEDIA_REQUESTS
})

export const clearMediaRequestQueue = (reason = '媒体请求已取消') => {
  const error = new Error(reason)
  while (pending.length) pending.shift().reject(error)
}
