import assert from 'node:assert/strict'
import test from 'node:test'

const { buildClientImageTemplateConfig, imageTemplateSummary, normalizeImageTemplate } = await import('../src/services/imageTemplateRenderer.js')

test('normalizes the legacy keep-original template for browser rendering', () => {
  const config = normalizeImageTemplate({ templateKey: 'original', content: '{"operation":"IDENTITY"}' })

  assert.equal(config.renderer, 'CLIENT_CANVAS')
  assert.equal(config.canvas.aspectRatio, 'original')
  assert.equal(config.border.enabled, false)
  assert.equal(config.watermark.enabled, false)
  assert.match(imageTemplateSummary({ templateKey: 'original' }), /保留原图/)
})

test('builds a canonical client template configuration from form values', () => {
  const config = buildClientImageTemplateConfig({
    ratio: '4:5',
    fit: 'cover',
    brightness: 1.1,
    contrast: 0.95,
    borderEnabled: true,
    borderWidth: 24,
    watermarkEnabled: true,
    watermarkPosition: 'bottomRight',
    outputFormat: 'image/png',
    quality: 1
  })

  assert.equal(config.renderer, 'CLIENT_CANVAS')
  assert.deepEqual(config.canvas, { aspectRatio: '4:5', fit: 'cover', background: '#ffffff' })
  assert.equal(config.border.enabled, true)
  assert.equal(config.watermark.position, 'bottomRight')
  assert.equal(config.output.format, 'image/png')
  assert.equal(config.output.quality, 1)
})
