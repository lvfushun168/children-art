// 制作中心横向 A4 页卡模板。
// 槽位坐标为页面百分比 [x, y, w, h]，右上角 34mm 打孔安全区由模板统一避让。

export const pageSizes = {
  A4_LANDSCAPE: {
    label: 'A4 横版',
    widthMm: 297,
    heightMm: 210,
    punchSafeArea: { x: 88.55, y: 0, w: 11.45, h: 16.2, label: '右上角打孔安全区' }
  }
}

export const bookThemes = [
  { id: 'dream', label: '梦地标准', desc: '白底、轻阴影、品牌页眉，适合纸质作品册' },
  { id: 'clean', label: '清爽留白', desc: '更少装饰，突出作品本身' }
]

export const bodySources = [
  { id: 'feedback', label: '课评原文' },
  { id: 'highlightNote', label: '高光说明' },
  { id: 'description', label: '作品说明' },
  { id: 'none', label: '不放正文' }
]

// pageType：cover 封面 / overview 成长概览 / work 作品页 / closing 寄语
// role：title 标题 / subtitle 副标题 / body 正文 / meta 课次信息 / caption 图注 / stat 统计
// bind：绑定项目级字段；work：绑定本页第几件作品（0 开始）
export const portfolioLayouts = [
  {
    id: 'cover-landscape-hero',
    pageType: 'cover',
    name: '学期封面',
    desc: '大标题 + 代表作品',
    imageSlots: 1,
    brandLocked: true,
    slots: [
      { key: 'cover-title', type: 'text', role: 'title', bind: 'title', area: [7, 23, 43, 14] },
      { key: 'cover-subtitle', type: 'text', role: 'subtitle', bind: 'subtitle', area: [7, 39, 42, 6] },
      { key: 'cover-summary', type: 'text', role: 'body', bind: 'intro', area: [7, 53, 36, 19] },
      { key: 'cover-image', type: 'image', role: 'cover', area: [54, 16, 34, 56] },
      { key: 'cover-meta', type: 'text', role: 'meta', bind: 'meta', area: [7, 78, 38, 6] }
    ]
  },
  {
    id: 'overview-growth-report',
    pageType: 'overview',
    name: '成长概览',
    desc: '学期作品统计 + 课程摘要',
    imageSlots: 1,
    brandLocked: true,
    slots: [
      { key: 'overview-title', type: 'text', role: 'title', text: '本学期成长概览', area: [7, 17, 38, 9] },
      { key: 'overview-stats', type: 'text', role: 'stat', bind: 'stats', area: [7, 32, 39, 21] },
      { key: 'overview-summary', type: 'text', role: 'body', bind: 'summary', area: [7, 59, 40, 23] },
      { key: 'overview-image', type: 'image', role: 'cover', area: [57, 20, 27, 42] },
      { key: 'overview-caption', type: 'text', role: 'caption', text: '课堂作品节选', area: [57, 65, 27, 5] }
    ]
  },
  {
    id: 'work-1-landscape',
    pageType: 'work',
    name: '单幅作品',
    desc: '一页一件作品，适合重点展示',
    imageSlots: 1,
    brandLocked: true,
    slots: [
      { key: 'w0-image', type: 'image', role: 'cover', work: 0, area: [7, 18, 48, 63] },
      { key: 'w0-title', type: 'text', role: 'title', work: 0, area: [60, 24, 25, 8] },
      { key: 'w0-meta', type: 'text', role: 'meta', work: 0, area: [60, 35, 25, 5] },
      { key: 'w0-body', type: 'text', role: 'body', work: 0, area: [60, 45, 25, 24] }
    ]
  },
  {
    id: 'work-2-landscape',
    pageType: 'work',
    name: '双幅对照',
    desc: '一页两件作品，适合阶段对比',
    imageSlots: 2,
    brandLocked: true,
    slots: [
      { key: 'w0-image', type: 'image', role: 'cover', work: 0, area: [7, 19, 37, 42] },
      { key: 'w0-title', type: 'text', role: 'title', work: 0, area: [7, 64, 37, 5] },
      { key: 'w0-body', type: 'text', role: 'body', work: 0, area: [7, 71, 37, 10] },
      { key: 'w1-image', type: 'image', role: 'cover', work: 1, area: [50, 19, 35, 42] },
      { key: 'w1-title', type: 'text', role: 'title', work: 1, area: [50, 64, 35, 5] },
      { key: 'w1-body', type: 'text', role: 'body', work: 1, area: [50, 71, 35, 10] }
    ]
  },
  {
    id: 'work-4-landscape',
    pageType: 'work',
    name: '四宫格作品',
    desc: '一页四件作品，适合学期作品浏览',
    imageSlots: 4,
    brandLocked: true,
    slots: [
      { key: 'w0-image', type: 'image', role: 'cover', work: 0, area: [7, 18, 34, 28] },
      { key: 'w0-caption', type: 'text', role: 'caption', work: 0, area: [7, 48, 34, 6] },
      { key: 'w1-image', type: 'image', role: 'cover', work: 1, area: [48, 18, 34, 28] },
      { key: 'w1-caption', type: 'text', role: 'caption', work: 1, area: [48, 48, 34, 6] },
      { key: 'w2-image', type: 'image', role: 'cover', work: 2, area: [7, 57, 34, 27] },
      { key: 'w2-caption', type: 'text', role: 'caption', work: 2, area: [7, 86, 34, 6] },
      { key: 'w3-image', type: 'image', role: 'cover', work: 3, area: [48, 57, 34, 27] },
      { key: 'w3-caption', type: 'text', role: 'caption', work: 3, area: [48, 86, 34, 6] }
    ]
  },
  {
    id: 'closing-landscape-message',
    pageType: 'closing',
    name: '老师寄语',
    desc: '寄语 + 代表作品',
    imageSlots: 1,
    brandLocked: true,
    slots: [
      { key: 'closing-title', type: 'text', role: 'title', text: '老师寄语', area: [7, 20, 28, 8] },
      { key: 'closing-body', type: 'text', role: 'body', bind: 'teacherMessage', area: [7, 35, 38, 32] },
      { key: 'closing-footer', type: 'text', role: 'meta', bind: 'teacherSignature', area: [7, 73, 36, 6] },
      { key: 'closing-image', type: 'image', role: 'cover', area: [55, 18, 30, 52] }
    ]
  }
]

export const portfolioTemplates = [
  {
    id: 'term-a4-landscape',
    name: '学期成长作品册 · A4 横版',
    projectType: '学期作品册',
    pageSize: 'A4_LANDSCAPE',
    desc: '封面 + 成长概览 + 横向作品页 + 老师寄语，适合 A4 双面打印打孔翻阅',
    slideCount: 12,
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
      termLabel: '2026 春季'
    }
  },
  {
    id: 'term-gallery-clean',
    name: '清爽留白作品集 · A4 横版',
    projectType: '学期作品册',
    pageSize: 'A4_LANDSCAPE',
    desc: '少装饰、作品占比更高，适合平均十几幅作品快速排版',
    slideCount: 10,
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
      theme: 'clean',
      bodySource: 'feedback',
      showDate: true,
      showCourse: true,
      showWatermark: true,
      termLabel: '2026 春季'
    }
  },
  {
    id: 'term-highlight-story',
    name: '高光成长记录 · A4 横版',
    projectType: '学期作品册',
    pageSize: 'A4_LANDSCAPE',
    desc: '适合重点展示高光作品，保留更多老师点评和课堂观察空间',
    slideCount: 14,
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
      bodySource: 'highlightNote',
      showDate: true,
      showCourse: true,
      showWatermark: true,
      termLabel: '2026 春季'
    }
  }
]

export const portfolioProjects = []

// 导出记录由 `/portfolio/exports` 加载；浏览器端不再预置虚构下载地址。
export const exportJobs = []
