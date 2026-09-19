/**
 * Merges one AI text stream event into the latest job state.
 *
 * A snapshot can arrive again after a reconnect and replaces the text at the
 * same or a newer sequence. A delta is accepted only when it is the immediate
 * next sequence, so an out-of-order event cannot duplicate or corrupt text.
 */
export const mergeJobStream = (previous = {}, value, eventName) => {
  let source = value
  if (typeof source === 'string') {
    try { source = JSON.parse(source) } catch { return null }
  }
  if (!source || typeof source !== 'object') return null
  const jobId = source.jobId ?? source.id
  const seq = Number(source.seq)
  if (jobId === null || jobId === undefined || jobId === '' || !Number.isFinite(seq)) return null

  const key = String(jobId)
  const currentSeq = Number.isFinite(Number(previous.streamSeq)) ? Number(previous.streamSeq) : 0
  const status = String(source.status || 'RUNNING').toUpperCase()
  let content
  if (eventName === 'stream-snapshot') {
    if (seq < currentSeq) return null
    content = String(source.content ?? '')
    if (seq === currentSeq && content === String(previous.streamContent ?? '') && status === previous.streamStatus) return null
  } else if (eventName === 'stream-delta') {
    if (seq <= currentSeq || seq !== currentSeq + 1) return null
    content = `${String(previous.streamContent ?? '')}${String(source.delta ?? '')}`
  } else {
    return null
  }

  return {
    state: {
      ...previous,
      jobId: key,
      streamSeq: seq,
      streamContent: content,
      streamStatus: status
    },
    jobId: key,
    seq,
    text: content,
    delta: eventName === 'stream-delta' ? String(source.delta ?? '') : '',
    status,
    event: eventName
  }
}
