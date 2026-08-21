import { fromApiId } from './mappers.js'

const clone = (value) => JSON.parse(JSON.stringify(value))

export const parseTemplateJson = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return clone(value)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}

export const textField = (value) => value === null || value === undefined ? '' : String(value)

export const mapFeedbackTemplate = (item = {}) => {
  const templateJson = parseTemplateJson(item.templateJson)
  const prompt = item.prompt && typeof item.prompt === 'object' ? item.prompt : {}
  const rules = Array.isArray(templateJson.rules) ? templateJson.rules.filter(Boolean).join('\n') : ''
  return {
    ...item,
    id: fromApiId(item.id),
    templateVersion: Number(item.templateVersion || 1),
    version: Number(item.version || 0),
    length: textField(item.lengthHint),
    tone: textField(item.tone),
    structure: textField(templateJson.structure || rules),
    taboo: textField(templateJson.taboo),
    sample: textField(templateJson.sample),
    model: textField(prompt.modelName ?? item.modelName),
    systemPrompt: textField(prompt.systemPrompt ?? item.systemPrompt),
    userPrompt: textField(prompt.userPrompt ?? item.userPrompt),
    temperature: prompt.temperature ?? item.temperature ?? '',
    maxTokens: prompt.maxTokens ?? item.maxTokens ?? '',
    _templateJson: templateJson
  }
}

export const feedbackTemplateJsonFor = (payload = {}, current = {}) => {
  const source = parseTemplateJson(payload._templateJson || payload.templateJson || current._templateJson || current.templateJson)
  return {
    ...source,
    scene: 'FEEDBACK',
    structure: textField(payload.structure),
    taboo: textField(payload.taboo),
    sample: textField(payload.sample)
  }
}

const apiTemplateStatus = (value) => String(value || '').toUpperCase() === 'DISABLED' || value === '停用'
  ? 'DISABLED' : 'ENABLED'

export const feedbackTemplateBodyFor = (payload = {}, current = {}) => ({
  templateKey: payload.templateKey || current.templateKey || `feedback-${Date.now()}`,
  name: payload.name?.trim() || '新课评生成模板',
  templateVersion: Number(payload.templateVersion || 1),
  tone: textField(payload.tone),
  lengthHint: textField(payload.length),
  templateJson: feedbackTemplateJsonFor(payload, current),
  prompt: {
    modelName: textField(payload.model !== undefined ? payload.model : current.model),
    systemPrompt: textField(payload.systemPrompt !== undefined ? payload.systemPrompt : current.systemPrompt),
    userPrompt: textField(payload.userPrompt !== undefined ? payload.userPrompt : current.userPrompt),
    temperature: payload.temperature === '' || payload.temperature === null || payload.temperature === undefined
      ? (current.temperature === '' || current.temperature === null || current.temperature === undefined ? null : Number(current.temperature))
      : Number(payload.temperature),
    maxTokens: payload.maxTokens === '' || payload.maxTokens === null || payload.maxTokens === undefined
      ? (current.maxTokens === '' || current.maxTokens === null || current.maxTokens === undefined ? null : Number(current.maxTokens))
      : Number(payload.maxTokens)
  },
  status: apiTemplateStatus(payload.status)
})

export const feedbackTemplateUpdateBodyFor = (payload = {}, current = {}) => {
  const { templateKey, templateVersion, ...editable } = feedbackTemplateBodyFor(payload, current)
  return editable
}
