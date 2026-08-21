import { protectedMediaUrl } from './protectedMediaCache.js'

const DEFAULT_CONFIG = {
  schemaVersion: 1,
  renderer: 'CLIENT_CANVAS',
  canvas: { aspectRatio: 'original', fit: 'contain', background: '#ffffff' },
  adjustments: { brightness: 1, contrast: 1 },
  border: { enabled: false, width: 0, color: '#ffffff' },
  watermark: {
    enabled: false,
    position: 'bottomRight',
    opacity: 0.8,
    text: '{{campusName}}',
    fontSize: 28,
    padding: 24,
    color: '#ffffff'
  },
  output: { format: 'image/jpeg', quality: 0.9 }
}

const clone = (value) => JSON.parse(JSON.stringify(value))
const numberOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback
const boolOr = (value, fallback) => value === undefined || value === null ? fallback : Boolean(value)

const legacyRatio = (value) => ({ '原比例': 'original', '不裁切': 'original', '方形': '1:1' }[value] || value)
const legacyPosition = (value) => ({
  '左上角': 'topLeft',
  '右上角': 'topRight',
  '左下角': 'bottomLeft',
  '右下角': 'bottomRight',
  '居中': 'center'
}[value] || value)

const readConfig = (template = {}) => {
  if (template.config && typeof template.config === 'object') return template.config
  if (typeof template.content === 'object' && template.content) return template.content
  if (typeof template.content === 'string') {
    try { return JSON.parse(template.content) } catch { /* use defaults */ }
  }
  return {}
}

export const normalizeImageTemplate = (template = {}) => {
  const source = readConfig(template)
  const legacyOperation = String(source.operation || '').toUpperCase()
  const legacyIdentity = legacyOperation === 'IDENTITY' || template.templateKey === 'original'
  const config = clone(DEFAULT_CONFIG)
  const canvas = source.canvas || {}
  const adjustments = source.adjustments || {}
  const border = source.border || {}
  const watermark = source.watermark && typeof source.watermark === 'object' ? source.watermark : {}
  const output = source.output || {}

  config.schemaVersion = numberOr(source.schemaVersion, 1)
  config.renderer = String(source.renderer || (legacyIdentity ? 'CLIENT_CANVAS' : 'AI_ASYNC')).toUpperCase()
  config.canvas.aspectRatio = legacyRatio(canvas.aspectRatio || source.ratio || template.ratio || (legacyIdentity ? 'original' : '4:5'))
  config.canvas.fit = canvas.fit || source.cropMode || 'contain'
  config.canvas.background = canvas.background || source.background || '#ffffff'
  config.adjustments.brightness = numberOr(adjustments.brightness, numberOr(source.brightness, 1))
  config.adjustments.contrast = numberOr(adjustments.contrast, numberOr(source.contrast, 1))
  config.border.enabled = boolOr(border.enabled, Boolean(source.border && source.border !== ''))
  config.border.width = numberOr(border.width, 0)
  config.border.color = border.color || '#ffffff'
  config.watermark.enabled = boolOr(watermark.enabled, Boolean(source.watermark && source.watermark !== '隐藏水印'))
  config.watermark.position = legacyPosition(watermark.position || source.watermarkPosition || 'bottomRight')
  config.watermark.opacity = numberOr(watermark.opacity, 0.8)
  config.watermark.text = watermark.text || source.watermarkText || '{{campusName}}'
  config.watermark.fontSize = numberOr(watermark.fontSize, 28)
  config.watermark.padding = numberOr(watermark.padding, 24)
  config.watermark.color = watermark.color || '#ffffff'
  config.output.format = output.format || 'image/jpeg'
  config.output.quality = numberOr(output.quality, numberOr(source.quality, 0.9))
  return config
}

export const isClientCanvasTemplate = (template) => normalizeImageTemplate(template).renderer === 'CLIENT_CANVAS'

export const imageTemplateSummary = (template) => {
  const config = normalizeImageTemplate(template)
  const ratio = config.canvas.aspectRatio === 'original' ? '原比例' : config.canvas.aspectRatio
  const effects = []
  if (config.border.enabled) effects.push('边框')
  if (config.watermark.enabled) effects.push('水印')
  if (config.adjustments.brightness !== 1) effects.push('亮度')
  if (config.renderer === 'AI_ASYNC') effects.push('AI 异步')
  return `${ratio} · ${effects.length ? effects.join('、') : '保留原图'}`
}

export const buildClientImageTemplateConfig = (draft = {}) => ({
  schemaVersion: 1,
  renderer: 'CLIENT_CANVAS',
  canvas: {
    aspectRatio: legacyRatio(draft.ratio || '4:5'),
    fit: draft.fit || 'contain',
    background: draft.background || '#ffffff'
  },
  adjustments: {
    brightness: numberOr(draft.brightness, 1),
    contrast: numberOr(draft.contrast, 1)
  },
  border: {
    enabled: Boolean(draft.borderEnabled),
    width: numberOr(draft.borderWidth, 0),
    color: draft.borderColor || '#f3e5d8'
  },
  watermark: {
    enabled: Boolean(draft.watermarkEnabled),
    text: draft.watermarkText || '{{campusName}}',
    position: legacyPosition(draft.watermarkPosition || 'bottomRight'),
    opacity: numberOr(draft.watermarkOpacity, 0.8),
    fontSize: numberOr(draft.watermarkFontSize, 28),
    padding: numberOr(draft.watermarkPadding, 24),
    color: draft.watermarkColor || '#ffffff'
  },
  output: {
    format: draft.outputFormat || 'image/jpeg',
    quality: numberOr(draft.quality, 0.9)
  }
})

const ratioValue = (ratio, sourceWidth, sourceHeight) => {
  if (ratio === 'original' || !ratio) return sourceWidth / sourceHeight
  const [width, height] = String(ratio).split(':').map(Number)
  return width > 0 && height > 0 ? width / height : sourceWidth / sourceHeight
}

const canvasSize = (ratio, sourceWidth, sourceHeight, maxDimension) => {
  const targetRatio = ratioValue(ratio, sourceWidth, sourceHeight)
  if (targetRatio >= 1) {
    return { width: Math.round(maxDimension), height: Math.max(1, Math.round(maxDimension / targetRatio)) }
  }
  return { width: Math.max(1, Math.round(maxDimension * targetRatio)), height: Math.round(maxDimension) }
}

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error('原图加载失败'))
  image.src = src
})

const drawImageFit = (context, image, x, y, width, height, fit) => {
  const sourceRatio = image.width / image.height
  const targetRatio = width / height
  let drawWidth = width
  let drawHeight = height
  if (fit === 'cover' ? sourceRatio > targetRatio : sourceRatio < targetRatio) drawWidth = height * sourceRatio
  else drawHeight = width / sourceRatio
  const offsetX = x + (width - drawWidth) / 2
  const offsetY = y + (height - drawHeight) / 2
  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)
}

const resolveText = (value, context = {}) => String(value || '')
  .replaceAll('{{campusName}}', context.campusName || '')
  .replaceAll('{{schoolName}}', context.schoolName || context.campusName || '')
  .replaceAll('{{studentName}}', context.studentName || '')
  .trim()

const drawWatermark = (context, watermark, canvasWidth, canvasHeight, renderScale, renderContext) => {
  if (!watermark.enabled) return
  const text = resolveText(watermark.text, renderContext) || renderContext.campusName || ''
  if (!text) return
  const fontSize = Math.max(8, watermark.fontSize * renderScale)
  const padding = Math.max(0, watermark.padding * renderScale)
  context.save()
  context.globalAlpha = Math.min(1, Math.max(0, watermark.opacity))
  context.fillStyle = watermark.color || '#ffffff'
  context.font = `600 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  context.textBaseline = 'middle'
  const textWidth = context.measureText(text).width
  let x = padding
  let y = padding + fontSize / 2
  if (watermark.position.includes('Right')) x = canvasWidth - padding
  if (watermark.position === 'center') {
    x = canvasWidth / 2
    y = canvasHeight / 2
  } else if (watermark.position.includes('bottom')) {
    y = canvasHeight - padding - fontSize / 2
  }
  context.textAlign = watermark.position.includes('Right') ? 'right' : watermark.position === 'center' ? 'center' : 'left'
  context.fillText(text, x, y)
  context.restore()
}

export const renderImageElement = async (image, template, renderContext = {}, options = {}) => {
  const config = normalizeImageTemplate(template)
  if (config.renderer !== 'CLIENT_CANVAS') throw new Error('当前模板需要后端异步处理')
  const maxDimension = Math.min(2400, Math.max(320, Number(options.maxDimension || 1600)))
  const size = canvasSize(config.canvas.aspectRatio, image.width, image.height, maxDimension)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器不支持 Canvas 图片处理')
  const renderScale = size.width / 1000
  const borderWidth = config.border.enabled ? Math.max(0, config.border.width * renderScale) : 0
  context.fillStyle = config.canvas.background || '#ffffff'
  context.fillRect(0, 0, size.width, size.height)
  context.save()
  context.filter = `brightness(${config.adjustments.brightness}) contrast(${config.adjustments.contrast})`
  drawImageFit(context, image, borderWidth, borderWidth, size.width - borderWidth * 2, size.height - borderWidth * 2, config.canvas.fit)
  context.restore()
  if (borderWidth > 0) {
    context.strokeStyle = config.border.color || '#ffffff'
    context.lineWidth = borderWidth * 2
    context.strokeRect(borderWidth, borderWidth, size.width - borderWidth * 2, size.height - borderWidth * 2)
  }
  drawWatermark(context, config.watermark, size.width, size.height, renderScale, renderContext)
  const format = config.output.format || 'image/jpeg'
  const quality = Math.min(1, Math.max(0.5, config.output.quality || 0.9))
  const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('处理图导出失败')), format, quality))
  return { blob, width: canvas.width, height: canvas.height, config }
}

export const renderArtworkFile = async (asset, template, renderContext = {}, options = {}) => {
  const source = asset?.fileId ? await protectedMediaUrl(asset.fileId) : asset?.src
  if (!source) throw new Error('没有可处理的原图')
  const image = await loadImage(source)
  return renderImageElement(image, template, renderContext, options)
}
