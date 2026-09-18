import DOMPurify from 'dompurify'
import { marked } from 'marked'

export const HOMEWORK_FILE_REFERENCE_PREFIX = 'homework-file://'
export const HOMEWORK_FILE_PLACEHOLDER_PREFIX = 'https://children-art.invalid/homework-file/'

const homeworkFileReferencePattern = /homework-file:\/\/(\d+)/g
const sanitizer = typeof window === 'undefined'
  ? null
  : typeof DOMPurify.sanitize === 'function' ? DOMPurify : DOMPurify(window)

const replaceHomeworkFileReferences = (value, replacer) => String(value || '')
  .replace(homeworkFileReferencePattern, (_, fileId) => replacer(fileId))

export const homeworkFileIdsFromMarkdown = (value) => {
  const ids = []
  replaceHomeworkFileReferences(value, (fileId) => {
    if (!ids.includes(fileId)) ids.push(fileId)
    return `${HOMEWORK_FILE_REFERENCE_PREFIX}${fileId}`
  })
  return ids
}

export const markdownToPlainText = (value) => {
  let text = String(value || '')
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  text = text.replace(/<[^>]*>/g, ' ')
  text = text.replace(/^\s{0,3}#{1,6}\s?/gm, '')
  text = text.replace(/^\s{0,3}>\s?/gm, '')
  text = text.replace(/^\s*(?:[-+*]|\d+\.)\s+/gm, '')
  text = text.replace(/[\*_~`]/g, '')
  return text.replace(/\s+/g, ' ').trim()
}

const markdownSourceForRender = (value) => replaceHomeworkFileReferences(
  value,
  (fileId) => `${HOMEWORK_FILE_PLACEHOLDER_PREFIX}${fileId}`
)

export const renderMarkdown = (value) => {
  const source = markdownSourceForRender(value)
  const html = marked.parse(source, { gfm: true, breaks: true, html: true })
  if (!sanitizer) return html
  return sanitizer.sanitize(html, {
    ADD_ATTR: ['target', 'rel'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|data:image\/(?:png|jpeg|gif|webp);|https:\/\/children-art\.invalid\/homework-file\/|\/api\/v1\/public\/share\/)/i
  })
}
