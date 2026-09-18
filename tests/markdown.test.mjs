import test from 'node:test'
import assert from 'node:assert/strict'
import {
  homeworkFileIdsFromMarkdown,
  markdownToPlainText,
  renderMarkdown
} from '../src/services/markdown.js'

test('任务 Markdown 的纯文本统计不包含格式和图片地址', () => {
  const content = '## 观察记录\n\n**暖色**物品 ![作品](homework-file://12)'
  assert.equal(markdownToPlainText(content), '观察记录 暖色物品')
  assert.deepEqual(homeworkFileIdsFromMarkdown(content), ['12'])
})

test('任务 Markdown 支持原始 HTML 和图片占位地址', () => {
  const html = renderMarkdown('<p>图文任务</p>\n\n![作品](homework-file://12)')
  assert.match(html, /<p>图文任务<\/p>/)
  assert.match(html, /https:\/\/children-art\.invalid\/homework-file\/12/)
})
