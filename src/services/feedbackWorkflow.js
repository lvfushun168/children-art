export const feedbackContentFor = (feedback, fallback = '') => {
  if (feedback?.content !== undefined && feedback?.content !== null) return String(feedback.content).trim()
  return String(fallback || '').trim()
}

export const feedbackIsConfirmed = (feedback = {}) =>
  String(feedback.status || '').toUpperCase() === 'CONFIRMED' || Boolean(feedback.confirmedVersionId)

export const feedbackConfirmationPayloadFor = (feedback = {}) => {
  // 只能确认当前版本；不能拿历史已确认版本顶替当前版本。
  const versionId = feedback.currentVersionId || null
  if (!feedback.id || !versionId) return null
  return {
    feedbackId: String(feedback.id),
    versionId: String(versionId),
    version: Number(feedback.version || 0)
  }
}

export const saveAndConfirmFeedback = async ({ save, confirm, body, onSaved } = {}) => {
  if (typeof save !== 'function') throw new TypeError('课评保存方法不可用')
  if (typeof confirm !== 'function') throw new TypeError('课评确认方法不可用')

  const saved = await save(body)
  if (!saved?.id) throw new Error('保存课评未返回课评记录')
  onSaved?.(saved)

  const content = feedbackContentFor(saved, body?.content)
  if (!content || feedbackIsConfirmed(saved)) return { saved, confirmed: null }

  const payload = feedbackConfirmationPayloadFor(saved)
  if (!payload) throw new Error('课评保存后没有可确认版本')
  let confirmed
  try {
    confirmed = await confirm(payload.feedbackId, {
      versionId: payload.versionId,
      version: payload.version
    })
  } catch (error) {
    if (error && typeof error === 'object') {
      try { error.saved = saved } catch { /* 某些错误对象不可扩展，仍保留原始错误。 */ }
    }
    throw error
  }
  if (!confirmed?.id) throw new Error('课评确认未返回课评记录')
  return { saved, confirmed }
}
