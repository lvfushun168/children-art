const A4_WIDTH = 1000
const A4_HEIGHT = Math.round((210 / 297) * A4_WIDTH)

const clone = (value) => JSON.parse(JSON.stringify(value))

const htmlEscape = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const paragraph = (value, { size = 24, weight = 400, color = '#24352f', lineHeight = 1.35 } = {}) =>
  `<p><span style="font-size: ${size}px; font-weight: ${weight}; color: ${color}; line-height: ${lineHeight};">${htmlEscape(value)}</span></p>`

const text = (name, content, left, top, width, height, options = {}) => ({
  type: 'text',
  id: `${name}-${Math.random().toString(36).slice(2, 8)}`,
  name,
  left,
  top,
  width,
  height,
  rotate: 0,
  content: paragraph(content, options),
  defaultFontName: 'Microsoft YaHei',
  defaultColor: options.color || '#24352f',
  lineHeight: options.lineHeight || 1.35
})

const image = (name, src, left, top, width, height, options = {}) => ({
  type: 'image',
  id: `${name}-${Math.random().toString(36).slice(2, 8)}`,
  name,
  left,
  top,
  width,
  height,
  rotate: 0,
  fixedRatio: false,
  src: src || '',
  radius: options.radius || 0,
  shadow: options.shadow || { h: 8, v: 12, blur: 18, color: 'rgba(28, 42, 36, 0.16)' },
  outline: options.outline || { style: 'solid', width: 1, color: 'rgba(26, 44, 38, 0.12)' }
})

const line = (name, left, top, width, color = '#1f6b58') => ({
  type: 'line',
  id: `${name}-${Math.random().toString(36).slice(2, 8)}`,
  name,
  left,
  top,
  start: [0, 0],
  end: [width, 0],
  points: ['', ''],
  color,
  style: 'solid',
  width: 2
})

const slide = (id, elements, background = '#fbfaf4') => ({
  id,
  elements,
  background: { type: 'solid', color: background }
})

const workGroups = (records) => {
  const groups = []
  let index = 0
  while (index < records.length) {
    const remaining = records.length - index
    const size = remaining >= 4 ? 4 : remaining === 3 ? 2 : remaining
    groups.push(records.slice(index, index + size))
    index += size
  }
  return groups
}

const statText = (records) => {
  const courses = new Set(records.map((record) => record.course).filter(Boolean))
  const highlights = records.filter((record) => record.highlight).length
  return `作品 ${records.length} 幅\n课程主题 ${courses.size} 个\n高光作品 ${highlights} 幅`
}

const defaultIntro = (studentName, records) =>
  `${studentName}本学期共整理 ${records.length} 幅课堂作品。作品册保留了课堂日期、主题和老师观察，方便家长按学期翻阅成长变化。`

const defaultSummary = (studentName, records) => {
  const courses = [...new Set(records.map((record) => record.course).filter(Boolean))]
  const highlight = records.find((record) => record.highlightNote)?.highlightNote
  return `本册覆盖${courses.slice(0, 4).join('、') || '多个课堂主题'}等内容，可以看到${studentName}在构图、色彩和细节表达上的持续积累。${highlight || '作品中保留了清晰的课堂目标和个人表达。'}`
}

const defaultTeacherMessage = (studentName) =>
  `谢谢家长一直配合课后的观察和鼓励。接下来我们会继续关注${studentName}的画面层次、表达完整度，也期待他继续保持自己的创作想法。`

const recordTitle = (record) => record?.title || record?.course || '课堂作品'

const recordMeta = (record) => [record?.date, record?.course, record?.className].filter(Boolean).join(' · ')

const recordBody = (record) => record?.feedback || record?.highlightNote || record?.description || '老师可在这里补充本页作品说明。'

const applyBrand = (elements, school, pageNo) => [
  text('brand:school', school?.name || '梦地美术', 44, 34, 140, 28, { size: 16, weight: 700, color: '#1f3d34' }),
  text('brand:campus', school?.campus || '校区', 44, 58, 160, 24, { size: 12, color: '#64746e' }),
  text('brand:watermark', school?.watermark || '', 725, 44, 130, 24, { size: 12, weight: 600, color: '#7d8b85' }),
  text('brand:punch', '打孔区', 882, 38, 76, 22, { size: 11, color: '#6b7d75' }),
  text('brand:folio', String(pageNo), 906, 640, 36, 28, { size: 18, weight: 800, color: '#1f3d34' }),
  line('brand:rule', 44, 92, 866, '#d7ded9'),
  ...elements
]

const buildFreshDeck = ({ project, records, student, klass, school, template }) => {
  const studentName = student?.name || records[0]?.studentName || '学生'
  const title = project.title || `${studentName} · ${project.termLabel || template?.book?.termLabel || '学期'}作品册`
  const subtitle = `${studentName} · ${klass?.name || records[0]?.className || '班级'} · ${project.termLabel || ''}`
  const intro = project.intro || defaultIntro(studentName, records)
  const summary = project.summary || defaultSummary(studentName, records)
  const teacherMessage = project.teacherMessage || defaultTeacherMessage(studentName)
  const coverRecord = records.find((record) => record.highlight) || records[0]
  const closingRecord = records[records.length - 1] || coverRecord
  const slides = []

  slides.push(slide('portfolio-cover', applyBrand([
    text('field:title', title, 70, 165, 420, 88, { size: 38, weight: 800, color: '#1b2f28', lineHeight: 1.15 }),
    text('field:subtitle', subtitle, 72, 270, 420, 34, { size: 18, weight: 600, color: '#4c5f57' }),
    text('field:intro', intro, 74, 350, 360, 115, { size: 19, color: '#2f4039', lineHeight: 1.45 }),
    image('slot:cover-image', coverRecord?.artwork, 545, 126, 305, 440, { radius: 2 })
  ], school, 1)))

  slides.push(slide('portfolio-overview', applyBrand([
    text('field:overview-title', '本学期成长概览', 70, 140, 360, 54, { size: 34, weight: 800, color: '#1b2f28' }),
    text('field:stats', statText(records), 74, 230, 230, 120, { size: 24, weight: 700, color: '#184d40', lineHeight: 1.45 }),
    text('field:summary', summary, 74, 390, 410, 130, { size: 18, color: '#33443d', lineHeight: 1.45 }),
    image('slot:overview-image', coverRecord?.artwork, 585, 154, 255, 336, { radius: 2 }),
    text('field:overview-caption', '课堂作品节选', 590, 508, 250, 28, { size: 14, color: '#6c7a73' })
  ], school, 2)))

  let slideNo = 3
  workGroups(records).forEach((group, groupIndex) => {
    if (group.length === 1) {
      const record = group[0]
      slides.push(slide(`portfolio-work-${groupIndex + 1}`, applyBrand([
        image(`slot:work-${groupIndex * 4}-image`, record.artwork, 70, 145, 455, 430, { radius: 2 }),
        text(`slot:work-${groupIndex * 4}-title`, recordTitle(record), 585, 178, 300, 48, { size: 30, weight: 800, color: '#1b2f28' }),
        text(`slot:work-${groupIndex * 4}-meta`, recordMeta(record), 588, 242, 300, 28, { size: 14, color: '#66776f' }),
        text(`slot:work-${groupIndex * 4}-body`, recordBody(record), 590, 310, 295, 170, { size: 18, color: '#33443d', lineHeight: 1.45 })
      ], school, slideNo++)))
      return
    }

    const positions = group.length === 2
      ? [[80, 150, 340, 300], [525, 150, 340, 300]]
      : [[74, 138, 365, 200], [510, 138, 365, 200], [74, 402, 365, 182], [510, 402, 365, 182]]
    const elements = []
    group.forEach((record, index) => {
      const [left, top, width, height] = positions[index]
      const workIndex = groupIndex * 4 + index
      elements.push(image(`slot:work-${workIndex}-image`, record.artwork, left, top, width, height, { radius: 2 }))
      elements.push(text(`slot:work-${workIndex}-caption`, `${recordTitle(record)} · ${record.date}`, left, top + height + 16, width, 30, { size: 16, weight: 700, color: '#263932' }))
      if (group.length === 2) {
        elements.push(text(`slot:work-${workIndex}-body`, recordBody(record), left, top + height + 58, width, 78, { size: 15, color: '#53635d', lineHeight: 1.35 }))
      }
    })
    slides.push(slide(`portfolio-work-${groupIndex + 1}`, applyBrand(elements, school, slideNo++)))
  })

  slides.push(slide('portfolio-closing', applyBrand([
    text('field:teacher-message-title', '老师寄语', 80, 175, 280, 58, { size: 36, weight: 800, color: '#1b2f28' }),
    text('field:teacherMessage', teacherMessage, 82, 275, 390, 180, { size: 20, color: '#33443d', lineHeight: 1.5 }),
    text('field:teacherSignature', `${project.owner || '老师'}  ${project.termLabel || ''}`, 84, 500, 320, 32, { size: 16, weight: 700, color: '#4d5f57' }),
    image('slot:closing-image', closingRecord?.artwork, 570, 150, 280, 405, { radius: 2 })
  ], school, slideNo)))

  return {
    title,
    width: A4_WIDTH,
    height: A4_HEIGHT,
    viewport: { size: A4_WIDTH, ratio: A4_HEIGHT / A4_WIDTH },
    theme: {
      backgroundColor: '#fbfaf4',
      fontColor: '#24352f',
      fontName: 'Microsoft YaHei',
      themeColors: ['#1f6b58', '#f1b24a', '#d75f45', '#557c9f']
    },
    slides
  }
}

const fillNamedElement = (element, context) => {
  if (!element?.name) return element
  const { project, records, student, klass, school } = context
  const studentName = student?.name || records[0]?.studentName || '学生'
  const coverRecord = records.find((record) => record.highlight) || records[0]
  const closingRecord = records[records.length - 1] || coverRecord
  const name = element.name
  if (element.type === 'image') {
    const indexMatch = name.match(/^slot:work-(\d+)-image$/)
    const record = indexMatch ? records[Number(indexMatch[1])] : null
    if (name === 'slot:cover-image') element.src = coverRecord?.artwork || element.src
    if (name === 'slot:overview-image') element.src = coverRecord?.artwork || element.src
    if (name === 'slot:closing-image') element.src = closingRecord?.artwork || element.src
    if (record) element.src = record.artwork || element.src
  }
  if (element.type === 'text') {
    const indexMatch = name.match(/^slot:work-(\d+)-(title|meta|body|caption)$/)
    const record = indexMatch ? records[Number(indexMatch[1])] : null
    const values = {
      'field:title': project.title,
      'field:subtitle': `${studentName} · ${klass?.name || records[0]?.className || '班级'} · ${project.termLabel || ''}`,
      'field:intro': project.intro || defaultIntro(studentName, records),
      'field:stats': statText(records),
      'field:summary': project.summary || defaultSummary(studentName, records),
      'field:teacherMessage': project.teacherMessage || defaultTeacherMessage(studentName),
      'field:teacherSignature': `${project.owner || '老师'}  ${project.termLabel || ''}`,
      'brand:school': school?.name || '梦地美术',
      'brand:campus': school?.campus || '校区',
      'brand:watermark': school?.watermark || ''
    }
    let value = values[name]
    if (record) {
      const kind = indexMatch[2]
      if (kind === 'title') value = recordTitle(record)
      if (kind === 'meta') value = recordMeta(record)
      if (kind === 'body') value = recordBody(record)
      if (kind === 'caption') value = `${recordTitle(record)} · ${record.date}`
    }
    if (value) element.content = paragraph(value, { size: 18, color: element.defaultColor || '#24352f' })
  }
  return element
}

export const createPortfolioPptistDocument = (context) => {
  const templateDeck = context.template?.deck
  if (!templateDeck) return buildFreshDeck(context)
  const document = clone(templateDeck)
  document.title = context.project.title
  document.width = A4_WIDTH
  document.height = A4_HEIGHT
  document.viewport = { size: A4_WIDTH, ratio: A4_HEIGHT / A4_WIDTH }
  document.slides = (document.slides || []).map((item, slideIndex) => ({
    ...item,
    id: item.id || `portfolio-template-${slideIndex + 1}`,
    elements: (item.elements || []).map((element) => fillNamedElement({ ...element }, context))
  }))
  return document
}

export const createTemplateFromPptistDocument = ({ id, name, desc, deck, termLabel = '2026 春季' }) => ({
  id,
  name,
  projectType: '学期作品册',
  pageSize: 'A4_LANDSCAPE',
  desc,
  slideCount: deck?.slides?.length || 0,
  structure: ['cover', 'overview', 'work', 'closing'],
  layouts: {
    cover: 'cover-landscape-hero',
    overview: 'overview-growth-report',
    work1: 'work-1-landscape',
    work2: 'work-2-landscape',
    work4: 'work-4-landscape',
    closing: 'closing-landscape-message'
  },
  book: {
    theme: 'dream',
    bodySource: 'feedback',
    showDate: true,
    showCourse: true,
    showWatermark: true,
    termLabel
  },
  deck: clone(deck)
})

export const pptistViewport = {
  width: A4_WIDTH,
  height: A4_HEIGHT,
  size: A4_WIDTH,
  ratio: A4_HEIGHT / A4_WIDTH
}
