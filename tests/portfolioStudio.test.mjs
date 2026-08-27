import assert from 'node:assert/strict'
import test from 'node:test'

import { createPortfolioPptistDocument } from '../src/services/portfolioPptistAdapter.js'
import { portfolioTemplates } from '../src/data/portfolioData.js'
import { hydratePortfolioRecords, resolvePortfolioImageSource } from '../src/services/portfolioImageService.js'
import { isPersistedPortfolioTemplateId } from '../src/services/portfolioTemplateSupport.js'

test('内置模板 ID 不作为数据库模板 ID 提交', () => {
  assert.equal(isPersistedPortfolioTemplateId('term-a4-landscape'), false)
  assert.equal(isPersistedPortfolioTemplateId('1'), true)
  assert.equal(isPersistedPortfolioTemplateId(27), true)
})

test('没有数据库模板时仍可用内置模板生成作品册', () => {
  const records = [{
    id: 101,
    studentId: 7,
    classId: 9,
    studentName: '小明',
    className: '创想班',
    course: '书屋精品班',
    date: '8月26日',
    dateValue: '2026-08-26',
    artwork: 'https://example.test/artwork.png',
    feedback: '构图完整，细节表达很有想法。',
    highlight: false
  }]
  const deck = createPortfolioPptistDocument({
    project: {
      title: '小明 · 2026 春季作品册',
      termLabel: '2026 春季',
      owner: '普通老师',
      intro: '',
      summary: '',
      teacherMessage: ''
    },
    template: portfolioTemplates[0],
    records,
    student: { id: 7, name: '小明' },
    klass: { id: 9, name: '创想班' },
    school: { name: '梦地美术', campus: '西盛校区', watermark: '' }
  })

  assert.equal(deck.width, 1000)
  assert.equal(deck.height, 707)
  assert.equal(deck.slides.length, 4)
})

test('作品图片优先解析受保护文件，供 PPT 使用 Blob URL', async () => {
  const calls = []
  const source = await resolvePortfolioImageSource({ fileId: 42, artwork: '/api/v1/files/42/content' }, async (fileId) => {
    calls.push(fileId)
    return 'blob:protected-artwork'
  })

  assert.equal(source, 'blob:protected-artwork')
  assert.deepEqual(calls, [42])

  const records = await hydratePortfolioRecords([
    { id: 1, fileId: 42, artwork: '/api/v1/files/42/content' },
    { id: 2, artwork: 'https://example.test/public.png' }
  ], async (fileId) => `blob:${fileId}`)
  assert.equal(records[0].artwork, 'blob:42')
  assert.equal(records[1].artwork, 'https://example.test/public.png')
})
