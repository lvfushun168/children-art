// 制作中心的版式引擎配置。
// 每个版式由若干「槽位」组成，槽位坐标为页面百分比 [x, y, w, h]，
// 老师只能换版式、换图、改文字，不能自由拖动槽位，以此保证版面永远不会错位。

export const pageSizes = {
  A4: { label: 'A4 竖版', widthMm: 210, heightMm: 297 },
  square: { label: '方形', widthMm: 210, heightMm: 210 }
}

export const bookThemes = [
  { id: 'warm', label: '暖米', desc: '米白底 + 暖棕字，适合成长手册' },
  { id: 'plain', label: '素白', desc: '纯白底 + 黑灰字，适合作品集' },
  { id: 'ink', label: '墨蓝', desc: '深蓝底 + 浅字，适合纪念册' }
]

export const bodySources = [
  { id: 'feedback', label: '课评原文' },
  { id: 'highlightNote', label: '高光说明' },
  { id: 'description', label: '作品说明' },
  { id: 'none', label: '不放正文' }
]

// scope：cover 封面 / intro 引言 / work 作品页 / closing 寄语 / blank 空白页
// role：title 标题 / subtitle 副标题 / body 正文 / meta 课次信息 / caption 图注 / footer 页脚
// work：该槽位属于本页第几件作品（0 开始），文字与图片按这个序号绑定同一件作品
export const portfolioLayouts = [
  {
    id: 'cover-classic',
    scope: 'cover',
    name: '经典封面',
    desc: '居中主图 + 标题',
    imageSlots: 1,
    slots: [
      { key: 'cover-image', type: 'image', role: 'cover', area: [10, 12, 80, 46] },
      { key: 'cover-title', type: 'text', role: 'title', align: 'center', area: [10, 62, 80, 9] },
      { key: 'cover-subtitle', type: 'text', role: 'subtitle', align: 'center', area: [10, 71.5, 80, 6] },
      { key: 'cover-footer', type: 'text', role: 'footer', align: 'center', area: [10, 88, 80, 5] }
    ]
  },
  {
    id: 'cover-frame',
    scope: 'cover',
    name: '满版封面',
    desc: '整页大图 + 压字色带',
    imageSlots: 1,
    slots: [
      { key: 'cover-image', type: 'image', role: 'cover', area: [0, 0, 100, 100] },
      { key: 'cover-title', type: 'text', role: 'title', style: 'band', area: [8, 62, 84, 12] },
      { key: 'cover-subtitle', type: 'text', role: 'subtitle', style: 'band', area: [8, 75, 84, 7] },
      { key: 'cover-footer', type: 'text', role: 'footer', style: 'band', area: [8, 89, 84, 5] }
    ]
  },
  {
    id: 'cover-quiet',
    scope: 'cover',
    name: '文字封面',
    desc: '大标题 + 小图，适合低龄',
    imageSlots: 1,
    slots: [
      { key: 'cover-title', type: 'text', role: 'title', area: [10, 15, 80, 14] },
      { key: 'cover-subtitle', type: 'text', role: 'subtitle', area: [10, 30.5, 80, 7] },
      { key: 'cover-image', type: 'image', role: 'cover', area: [10, 42, 80, 40] },
      { key: 'cover-footer', type: 'text', role: 'footer', area: [10, 88, 80, 5] }
    ]
  },
  {
    id: 'intro-text',
    scope: 'intro',
    name: '纯文字引言',
    desc: '开场说明 + 成长总结',
    imageSlots: 0,
    slots: [
      { key: 'intro-title', type: 'text', role: 'title', area: [12, 12, 76, 8] },
      { key: 'intro-body', type: 'text', role: 'body', area: [12, 24, 76, 30] },
      { key: 'intro-summary', type: 'text', role: 'body', bind: 'summary', area: [12, 56, 76, 32] }
    ]
  },
  {
    id: 'intro-text-photo',
    scope: 'intro',
    name: '引言配图',
    desc: '说明文字 + 一张课堂照片',
    imageSlots: 1,
    slots: [
      { key: 'intro-title', type: 'text', role: 'title', area: [12, 10, 76, 8] },
      { key: 'intro-body', type: 'text', role: 'body', area: [12, 21, 76, 22] },
      { key: 'intro-image', type: 'image', role: 'cover', area: [12, 45, 76, 34] },
      { key: 'intro-caption', type: 'text', role: 'caption', align: 'center', area: [12, 80.5, 76, 5] }
    ]
  },
  {
    id: 'work-1up',
    scope: 'work',
    name: '整页单图',
    desc: '一页一件作品，带课评',
    imageSlots: 1,
    slots: [
      { key: 'w0-image', type: 'image', work: 0, area: [9, 8, 82, 58] },
      { key: 'w0-title', type: 'text', role: 'title', work: 0, area: [9, 69, 82, 7] },
      { key: 'w0-meta', type: 'text', role: 'meta', work: 0, area: [9, 76.5, 82, 4.5] },
      { key: 'w0-body', type: 'text', role: 'body', work: 0, area: [9, 82, 82, 12] }
    ]
  },
  {
    id: 'work-1up-full',
    scope: 'work',
    name: '满版单图',
    desc: '整页大图 + 压字图注',
    imageSlots: 1,
    slots: [
      { key: 'w0-image', type: 'image', work: 0, area: [0, 0, 100, 100] },
      { key: 'w0-title', type: 'text', role: 'title', work: 0, style: 'band', area: [8, 77, 84, 8] },
      { key: 'w0-meta', type: 'text', role: 'meta', work: 0, style: 'band', area: [8, 86, 84, 5] }
    ]
  },
  {
    id: 'work-2up',
    scope: 'work',
    name: '上下两图',
    desc: '一页两件作品，各带课评',
    imageSlots: 2,
    slots: [
      { key: 'w0-image', type: 'image', work: 0, area: [9, 6, 82, 32] },
      { key: 'w0-title', type: 'text', role: 'title', work: 0, area: [9, 39, 82, 4.5] },
      { key: 'w0-body', type: 'text', role: 'body', work: 0, area: [9, 43.8, 82, 7] },
      { key: 'w1-image', type: 'image', work: 1, area: [9, 53, 82, 32] },
      { key: 'w1-title', type: 'text', role: 'title', work: 1, area: [9, 86, 82, 4.5] },
      { key: 'w1-body', type: 'text', role: 'body', work: 1, area: [9, 90.8, 82, 7] }
    ]
  },
  {
    id: 'work-2up-lr',
    scope: 'work',
    name: '左右两图',
    desc: '并排对比，适合同一主题',
    imageSlots: 2,
    slots: [
      { key: 'page-label', type: 'text', role: 'meta', work: 0, area: [8, 7, 84, 5] },
      { key: 'w0-image', type: 'image', work: 0, area: [8, 14, 40, 38] },
      { key: 'w0-title', type: 'text', role: 'title', work: 0, area: [8, 54, 40, 5] },
      { key: 'w0-body', type: 'text', role: 'body', work: 0, area: [8, 60, 40, 26] },
      { key: 'w1-image', type: 'image', work: 1, area: [52, 14, 40, 38] },
      { key: 'w1-title', type: 'text', role: 'title', work: 1, area: [52, 54, 40, 5] },
      { key: 'w1-body', type: 'text', role: 'body', work: 1, area: [52, 60, 40, 26] }
    ]
  },
  {
    id: 'work-4up',
    scope: 'work',
    name: '四宫格',
    desc: '一页四件作品，只留图注',
    imageSlots: 4,
    slots: [
      { key: 'w0-image', type: 'image', work: 0, area: [8, 10, 40, 28] },
      { key: 'w0-caption', type: 'text', role: 'caption', work: 0, area: [8, 39, 40, 8] },
      { key: 'w1-image', type: 'image', work: 1, area: [52, 10, 40, 28] },
      { key: 'w1-caption', type: 'text', role: 'caption', work: 1, area: [52, 39, 40, 8] },
      { key: 'w2-image', type: 'image', work: 2, area: [8, 52, 40, 28] },
      { key: 'w2-caption', type: 'text', role: 'caption', work: 2, area: [8, 81, 40, 8] },
      { key: 'w3-image', type: 'image', work: 3, area: [52, 52, 40, 28] },
      { key: 'w3-caption', type: 'text', role: 'caption', work: 3, area: [52, 81, 40, 8] }
    ]
  },
  {
    id: 'closing-message',
    scope: 'closing',
    name: '寄语页',
    desc: '老师寄语 + 署名',
    imageSlots: 0,
    slots: [
      { key: 'closing-title', type: 'text', role: 'title', area: [12, 14, 76, 8] },
      { key: 'closing-body', type: 'text', role: 'body', area: [12, 26, 76, 44] },
      { key: 'closing-footer', type: 'text', role: 'footer', align: 'right', area: [12, 80, 76, 8] }
    ]
  },
  {
    id: 'closing-message-photo',
    scope: 'closing',
    name: '寄语配图',
    desc: '寄语 + 一张合照',
    imageSlots: 1,
    slots: [
      { key: 'closing-title', type: 'text', role: 'title', area: [10, 10, 80, 7] },
      { key: 'closing-body', type: 'text', role: 'body', area: [10, 20, 80, 26] },
      { key: 'closing-image', type: 'image', role: 'cover', area: [10, 49, 80, 34] },
      { key: 'closing-footer', type: 'text', role: 'footer', align: 'right', area: [10, 86, 80, 6] }
    ]
  },
  {
    id: 'blank-page',
    scope: 'blank',
    name: '空白页',
    desc: '用于补齐骑马钉页数',
    imageSlots: 0,
    slots: []
  }
]

export const portfolioTemplates = [
  {
    id: 'growth-a4',
    name: '成长手册 · A4 竖版',
    projectType: '学生成长手册',
    pageSize: 'A4',
    binding: '骑马钉',
    desc: '封面 + 引言 + 作品页 + 寄语，期末交给家长的主力册子',
    structure: ['cover', 'intro', 'work', 'closing'],
    layouts: { cover: 'cover-classic', intro: 'intro-text', work: 'work-1up', closing: 'closing-message' },
    book: { theme: 'warm', worksPerPage: 1, bodySource: 'feedback', showDate: true, showCourse: true, showWatermark: true }
  },
  {
    id: 'term-a4',
    name: '期末作品集 · A4 竖版',
    projectType: '期末作品集',
    pageSize: 'A4',
    binding: '骑马钉',
    desc: '作品密度高，两件一页，只保留高光说明',
    structure: ['cover', 'work', 'closing'],
    layouts: { cover: 'cover-frame', work: 'work-2up', closing: 'closing-message' },
    book: { theme: 'plain', worksPerPage: 2, bodySource: 'highlightNote', showDate: true, showCourse: true, showWatermark: true }
  },
  {
    id: 'camp-square',
    name: '营期纪念册 · 方形',
    projectType: '营期纪念册',
    pageSize: 'square',
    binding: '胶装',
    desc: '方形开本，四宫格铺图，适合营期集体回顾',
    structure: ['cover', 'intro', 'work', 'closing'],
    layouts: { cover: 'cover-frame', intro: 'intro-text-photo', work: 'work-4up', closing: 'closing-message-photo' },
    book: { theme: 'ink', worksPerPage: 4, bodySource: 'none', showDate: true, showCourse: false, showWatermark: true }
  },
  {
    id: 'gift-a4',
    name: '装裱赠品册 · A4 竖版',
    projectType: '装裱赠品册',
    pageSize: 'A4',
    binding: '骑马钉',
    desc: '满版单图，随装裱作品一起交付',
    structure: ['cover', 'work', 'closing'],
    layouts: { cover: 'cover-quiet', work: 'work-1up-full', closing: 'closing-message' },
    book: { theme: 'plain', worksPerPage: 1, bodySource: 'none', showDate: false, showCourse: true, showWatermark: false }
  }
]

export const portfolioProjects = []

export const exportJobs = [
  {
    id: 1,
    sourceType: 'portfolio',
    sourceId: null,
    title: '彤彤 · 春季成长手册',
    exportType: 'PDF',
    status: '已导出',
    pages: 8,
    fileUrl: 'system://exports/2026/06/tongtong-spring.pdf',
    cloudPath: '大学城校区/教学资料归档/作品集导出/2026/2026春季',
    createdBy: '林老师',
    createdAt: '6月22日 20:14',
    finishedAt: '6月22日 20:15',
    failureReason: ''
  }
]
