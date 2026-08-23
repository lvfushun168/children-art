import assert from 'node:assert/strict'
import test from 'node:test'

import {
  feedbackTemplateBodyFor,
  feedbackTemplateUpdateBodyFor,
  mapFeedbackTemplate,
} from '../src/services/templateMappers.js'

test('maps feedback template fields and keeps legacy rules plus extension fields', () => {
  const mapped = mapFeedbackTemplate({
    id: '7',
    templateKey: 'standard',
    lengthHint: '100-160字',
    tone: '温暖',
    templateJson: JSON.stringify({
      scene: 'FEEDBACK',
      rules: ['先肯定', '再建议'],
      extension: { keep: true }
    }),
    version: 2
  })

  assert.equal(mapped.id, 7)
  assert.equal(mapped.length, '100-160字')
  assert.equal(mapped.structure, '先肯定\n再建议')
  assert.equal(mapped.taboo, '')
  assert.equal(mapped.sample, '')
  assert.deepEqual(mapped._templateJson.extension, { keep: true })
})

test('maps merged feedback content and prompt configuration', () => {
  const mapped = mapFeedbackTemplate({
    id: '8',
    templateKey: 'standard',
    templateJson: { scene: 'FEEDBACK', rules: ['先肯定'] },
    prompt: {
      modelName: 'qwen3.8-max',
      systemPrompt: 'system',
      userPrompt: 'user',
      temperature: 0.7,
      maxTokens: 220
    },
    templateVersion: 3,
    version: 4
  })

  assert.equal(mapped.model, 'qwen3.8-max')
  assert.equal(mapped.systemPrompt, 'system')
  assert.equal(mapped.userPrompt, 'user')
  assert.equal(mapped.temperature, 0.7)
  assert.equal(mapped.maxTokens, 220)
})

test('builds merged feedback create and update payloads with legal keys and versions', () => {
  const feedback = feedbackTemplateBodyFor({
    name: '新课评',
    tone: '自然',
    length: '80-120字',
    structure: '亮点、建议',
    taboo: '',
    sample: '',
    model: 'qwen3.8-max',
    systemPrompt: 'system',
    userPrompt: 'user',
    temperature: 0.7,
    maxTokens: 220
  })
  assert.match(feedback.templateKey, /^feedback-\d+$/)
  assert.equal(feedback.templateJson.scene, 'FEEDBACK')
  assert.equal(feedback.templateJson.structure, '亮点、建议')
  assert.equal(feedback.prompt.modelName, 'qwen3.8-max')
  assert.equal(feedback.prompt.systemPrompt, 'system')

  const update = feedbackTemplateUpdateBodyFor({ ...feedback, model: 'qwen3.8-max' }, {
    templateKey: 'old-key',
    version: 3
  })
  assert.equal(update.prompt.modelName, 'qwen3.8-max')
  assert.equal('templateKey' in update, false)
  assert.equal('templateVersion' in update, false)
})
