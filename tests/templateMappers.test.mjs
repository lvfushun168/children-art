import assert from 'node:assert/strict'
import test from 'node:test'

import {
  feedbackTemplateBodyFor,
  mapFeedbackTemplate,
  mapPromptTemplate,
  promptTemplateBodyFor,
  promptTemplateUpdateBodyFor
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

test('maps prompt API fields and converts scene for the UI', () => {
  const mapped = mapPromptTemplate({
    id: '8',
    templateKey: 'feedback-default',
    scene: 'IMAGE',
    modelName: 'fake-ai',
    systemPrompt: 'system',
    userPrompt: 'user',
    temperature: 0.7,
    maxTokens: 220,
    templateVersion: 3,
    version: 4
  })

  assert.deepEqual(mapped, {
    id: 8,
    templateKey: 'feedback-default',
    scene: 'image',
    modelName: 'fake-ai',
    systemPrompt: 'system',
    userPrompt: 'user',
    temperature: 0.7,
    maxTokens: 220,
    templateVersion: 3,
    version: 4,
    model: 'fake-ai'
  })
})

test('builds type-specific create and update payloads with legal keys and versions', () => {
  const feedback = feedbackTemplateBodyFor({
    name: '新课评',
    tone: '自然',
    length: '80-120字',
    structure: '亮点、建议',
    taboo: '',
    sample: ''
  })
  assert.match(feedback.templateKey, /^feedback-\d+$/)
  assert.equal(feedback.templateJson.scene, 'FEEDBACK')
  assert.equal(feedback.templateJson.structure, '亮点、建议')

  const prompt = promptTemplateBodyFor({
    name: '新提示词',
    scene: 'homework',
    model: 'fake-ai',
    systemPrompt: 'system',
    userPrompt: 'user',
    temperature: 0.4,
    maxTokens: 120
  })
  assert.equal(prompt.scene, 'HOMEWORK')
  assert.match(prompt.templateKey, /^prompt-\d+$/)

  const update = promptTemplateUpdateBodyFor({ ...prompt, model: 'fake-ai-2' }, {
    templateKey: 'old-key',
    version: 3
  })
  assert.equal(update.modelName, 'fake-ai-2')
  assert.equal('templateKey' in update, false)
  assert.equal('templateVersion' in update, false)
})
