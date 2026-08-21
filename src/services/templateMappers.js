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
    _templateJson: templateJson
  }
}

export const mapPromptTemplate = (item = {}) => ({
  ...item,
  id: fromApiId(item.id),
  templateKey: item.templateKey || '',
  templateVersion: Number(item.templateVersion || 1),
  version: Number(item.version || 0),
  model: textField(item.modelName),
  scene: textField(item.scene || 'FEEDBACK').toLowerCase(),
  systemPrompt: textField(item.systemPrompt),
  userPrompt: textField(item.userPrompt),
  temperature: item.temperature ?? '',
  maxTokens: item.maxTokens ?? ''
})

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
  name: payload.name?.trim() || '新课评模板',
  templateVersion: Number(payload.templateVersion || 1),
  tone: textField(payload.tone),
  lengthHint: textField(payload.length),
  templateJson: feedbackTemplateJsonFor(payload, current),
  status: apiTemplateStatus(payload.status)
})

export const promptTemplateBodyFor = (payload = {}, current = {}) => ({
  templateKey: payload.templateKey || current.templateKey || `prompt-${Date.now()}`,
  name: payload.name?.trim() || '新提示词模板',
  scene: textField(payload.scene !== undefined ? payload.scene : current.scene || 'feedback').toUpperCase(),
  modelName: textField(payload.model !== undefined ? payload.model : current.model),
  systemPrompt: textField(payload.systemPrompt !== undefined ? payload.systemPrompt : current.systemPrompt),
  userPrompt: textField(payload.userPrompt !== undefined ? payload.userPrompt : current.userPrompt),
  temperature: payload.temperature === '' || payload.temperature === null || payload.temperature === undefined
    ? null : Number(payload.temperature),
  maxTokens: payload.maxTokens === '' || payload.maxTokens === null || payload.maxTokens === undefined
    ? null : Number(payload.maxTokens),
  templateVersion: Number(payload.templateVersion || 1),
  status: apiTemplateStatus(payload.status)
})

export const promptTemplateUpdateBodyFor = (payload = {}, current = {}) => {
  const { templateKey, templateVersion, ...editable } = promptTemplateBodyFor(payload, current)
  return editable
}
