import { computed, reactive, ref } from 'vue'
import {
  bodySources,
  bookThemes,
  pageSizes,
  portfolioLayouts,
  portfolioTemplates as builtInPortfolioTemplates
} from '../data/portfolioData'
import { createPortfolioPptistDocument } from '../services/portfolioPptistAdapter'
import { createPortfolioDraftService } from '../services/portfolioService'
import { hydratePortfolioRecords } from '../services/portfolioImageService.js'
import { isPersistedPortfolioTemplateId } from '../services/portfolioTemplateSupport.js'
import { api } from '../services/api'
import { createIdempotencyKey } from '../services/apiClient'
import { fromApiId, mapArchiveRecord, mapFile, sameId } from '../services/mappers'
import { putUploadSessionContent, sha256ForFile, uploadFile } from '../services/fileService'
import { loadAllPageItems } from '../utils/pagination'

const clone = (value) => JSON.parse(JSON.stringify(value))

const temporaryResourcePattern = /^(?:blob:|data:)/i
const temporaryQueryPattern = /(?:[?&#]|^)(?:x-amz-signature|x-amz-credential|x-goog-signature|x-goog-credential|expires|signature|token|sig)=/i

const sanitizeTemplateDeck = (deck) => {
  const copy = clone(deck)
  const visit = (value) => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (value.type === 'image' && typeof value.src === 'string' && value.src) {
      const temporary = temporaryResourcePattern.test(value.src) || temporaryQueryPattern.test(value.src)
      if (value.name?.startsWith('slot:')) {
        // 作品槽位会在打开新作品册时由当前归档记录重新填充，不能保存当前会话的 Blob URL。
        value.src = ''
      } else if (temporary) {
        throw new Error('模板包含无法持久化的临时图片，请改用作品槽位或先上传正式素材')
      }
    }
    Object.values(value).forEach(visit)
  }
  visit(copy)
  return copy
}

export const layoutById = (layoutId) => portfolioLayouts.find((layout) => layout.id === layoutId)
export const layoutsForType = (pageType) => portfolioLayouts.filter((layout) => layout.pageType === pageType)
export const slotCapacity = (slot) => {
  const [, , width, height] = slot.area
  const factor = { title: 0.06, subtitle: 0.11, body: 0.2, meta: 0.2, caption: 0.18, stat: 0.16 }
  return Math.max(12, Math.round(width * height * (factor[slot.role] || 0.18)))
}

const intersects = (a, b) =>
  a[0] < b.x + b.w && a[0] + a[2] > b.x && a[1] < b.y + b.h && a[1] + a[3] > b.y

const compactText = (value) => String(value || '').replace(/\s+/g, '')

const mapPortfolioTemplate = (value = {}) => ({
  ...value,
  id: fromApiId(value.id),
  name: value.name || '未命名模板',
  desc: value.description || value.desc || '',
  projectType: value.projectType || 'TERM_BOOK',
  pageSize: value.pageSize || 'A4_LANDSCAPE',
  slideCount: value.slideCount || value.deck?.slides?.length || 0,
  book: {
    termLabel: '',
    showDate: true,
    showCourse: true,
    showComment: true,
    showHighlight: true,
    showWatermark: true,
    bodySource: 'feedback',
    ...(value.book || {})
  },
  layouts: value.layouts || null,
  version: Number(value.version || 0)
})

const builtInTemplateRecords = builtInPortfolioTemplates.map((template) =>
  mapPortfolioTemplate({ ...template, builtIn: true }))

const mergePortfolioTemplates = (remoteTemplates = []) => {
  const mappedRemoteTemplates = (Array.isArray(remoteTemplates) ? remoteTemplates : [])
    .map(mapPortfolioTemplate)
  const remoteIds = new Set(mappedRemoteTemplates.map((template) => String(template.id)))
  return [
    ...mappedRemoteTemplates,
    ...builtInTemplateRecords.filter((template) => !remoteIds.has(String(template.id)))
  ]
}

export function usePortfolioStudio(context) {
  const {
    archiveRecords,
    students,
    classes,
    school,
    currentUser,
    isAdmin,
    canEditArchiveRecord,
    notify,
    nowText
  } = context

  const portfolioProjects = reactive([])
  const portfolioTemplates = reactive(builtInTemplateRecords.map(clone))
  const exportJobs = reactive([])
  const portfolioSourceRecords = reactive([])
  const portfolioRecordsLoadedStudentId = ref(null)
  const portfolioRecordsLoadingStudentId = ref(null)
  const portfolioRecordsLoading = ref(false)
  const portfolioRecordsError = ref('')
  const activePortfolioProjectId = ref(null)
  const portfolioFilter = reactive({
    studentId: 'all',
    classId: 'all',
    dateStart: '',
    dateEnd: '',
    highlightOnly: false
  })

  const service = createPortfolioDraftService({
    archiveRecords,
    portfolioProjects,
    exportJobs,
    currentUser,
    isAdmin,
    canEditArchiveRecord,
    nowText
  })

  let seq = Date.now()
  let portfolioRecordsRequestId = 0
  let portfolioRecordsPromise = null
  const nextSeq = () => ++seq
  const defaultTemplate = builtInTemplateRecords[0] || null

  const templateFor = (project) => portfolioTemplates.find((item) => sameId(item.id, project?.templateId)) || defaultTemplate
  const pageSizeFor = (project) => pageSizes[templateFor(project)?.pageSize] || pageSizes.A4_LANDSCAPE
  const portfolioRecordSource = () => portfolioRecordsLoadedStudentId.value
    ? portfolioSourceRecords
    : archiveRecords
  const recordById = (recordId) => portfolioRecordSource().find((record) => sameId(record.id, recordId))
  const studentById = (studentId) => students.find((student) => sameId(student.id, studentId))
  const classById = (classId) => classes.find((klass) => sameId(klass.id, classId))

  const artworkItemsForRecord = (record = {}) => {
    const artworks = Array.isArray(record.artworks) && record.artworks.length
      ? record.artworks
      : record.fileId || record.artwork ? [{
          artworkId: record.artworkId || record.sourceId || record.id,
          fileId: record.fileId,
          fileUrl: record.artwork || '',
          title: record.title || '学生作品',
          sortOrder: 0,
          highlight: Boolean(record.highlight),
          highlightNote: record.highlightNote || ''
        }]
      : []
    return artworks
      .map((artwork, index) => {
        const artworkId = artwork.artworkId || artwork.id || `${record.id || 'record'}-${index}`
        const itemId = index === 0 ? record.id : `${record.id}:artwork:${artworkId}`
        const image = artwork.fileUrl || artwork.artwork || artwork.image || ''
        return {
          ...record,
          id: itemId,
          sourceRecordId: record.id,
          sourceArtworkId: artworkId,
          artworkId,
          fileId: artwork.fileId || artwork.artworkFileId || record.fileId || null,
          artwork: image || record.artwork || '',
          title: artwork.title || record.title || `${record.studentName || '学生'}的${record.course || '课堂作品'}`,
          highlight: artwork.highlight !== undefined ? Boolean(artwork.highlight) : Boolean(record.highlight),
          highlightNote: artwork.highlightNote || (artwork.highlight === undefined ? record.highlightNote || '' : ''),
          sortOrder: Number(artwork.sortOrder ?? index),
          artworkCount: 1
        }
      })
      .sort((left, right) => left.sortOrder - right.sortOrder
        || String(left.sourceArtworkId || left.id).localeCompare(String(right.sourceArtworkId || right.id), undefined, { numeric: true }))
  }

  const portfolioWorkItems = (records = []) => records.flatMap(artworkItemsForRecord)
  const portfolioWorkItemById = (workId) => {
    const exact = portfolioWorkItems(portfolioRecordSource()).find((item) => sameId(item.id, workId))
    if (exact) return exact
    const record = recordById(workId)
    return record ? artworkItemsForRecord(record)[0] || null : null
  }
  const expandPortfolioWorkIds = (workIds = []) => [...new Set((workIds || []).flatMap((workId) => {
    const record = recordById(workId)
    if (record) return artworkItemsForRecord(record).map((item) => item.id)
    const exact = portfolioWorkItemById(workId)
    return exact ? [exact.id] : []
  }).map(String))]

  const visiblePortfolioProjects = computed(() => service.listVisibleProjects())
  const activePortfolioProject = computed(() =>
    visiblePortfolioProjects.value.find((project) => sameId(project.id, activePortfolioProjectId.value)) || null
  )
  const portfolioStats = computed(() => ({
    total: visiblePortfolioProjects.value.length,
    drafting: visiblePortfolioProjects.value.filter((project) => project.status !== '已导出').length,
    exported: visiblePortfolioProjects.value.filter((project) => project.status === '已导出').length,
    jobs: exportJobs.length
  }))

  const loadPortfolioData = async () => {
    const loadTemplates = async () => {
      try {
        const templates = await api.portfolio.templates()
        portfolioTemplates.splice(0, portfolioTemplates.length, ...mergePortfolioTemplates(templates))
      } catch {
        // 远程模板是可选配置，内置模板必须保证制作中心仍可使用。
        portfolioTemplates.splice(0, portfolioTemplates.length, ...builtInTemplateRecords.map(clone))
      }
    }
    const loadExports = async () => {
      try {
        const exports = await api.portfolio.exports({})
        exportJobs.splice(0, exportJobs.length, ...((exports?.items || []).map((value) => ({
          ...value,
          id: fromApiId(value.id),
          fileName: value.fileName,
          fileUrl: value.downloadUrl || '',
          pageCount: value.pageCount,
          exportedAt: value.exportedAt || '',
          status: value.status || '已导出'
        }))))
      } catch {
        // 导出历史只影响辅助展示，不能阻断新建作品册。
        exportJobs.splice(0, exportJobs.length)
      }
    }
    await Promise.all([loadTemplates(), loadExports()])
  }

  const loadPortfolioRecordsForStudent = async (studentId) => {
    const key = studentId === null || studentId === undefined || studentId === '' ? '' : String(studentId)
    if (!key) {
      portfolioRecordsRequestId += 1
      portfolioRecordsLoadedStudentId.value = null
      portfolioRecordsLoadingStudentId.value = null
      portfolioRecordsLoading.value = false
      portfolioRecordsError.value = ''
      portfolioSourceRecords.splice(0, portfolioSourceRecords.length)
      return []
    }
    if (portfolioRecordsLoading.value
      && portfolioRecordsLoadingStudentId.value === key
      && portfolioRecordsPromise) return portfolioRecordsPromise
    if (!portfolioRecordsLoading.value && portfolioRecordsLoadedStudentId.value === key) {
      return [...portfolioSourceRecords]
    }

    const requestId = ++portfolioRecordsRequestId
    portfolioRecordsLoadedStudentId.value = key
    portfolioRecordsLoadingStudentId.value = key
    portfolioRecordsLoading.value = true
    portfolioRecordsError.value = ''
    portfolioSourceRecords.splice(0, portfolioSourceRecords.length)

    let request
    request = loadAllPageItems(
      api.archive.records,
      mapArchiveRecord,
      { studentId: key, sourceType: 'ALL', includeCurrent: true },
      200
    ).then((result) => {
      if (requestId !== portfolioRecordsRequestId) return []
      portfolioSourceRecords.splice(0, portfolioSourceRecords.length, ...result.items)
      return result.items
    }).catch((error) => {
      if (requestId === portfolioRecordsRequestId) {
        portfolioRecordsError.value = error?.message || '学生作品加载失败'
      }
      return []
    }).finally(() => {
      if (requestId !== portfolioRecordsRequestId) return
      portfolioRecordsLoading.value = false
      portfolioRecordsLoadingStudentId.value = null
      portfolioRecordsPromise = null
    })
    portfolioRecordsPromise = request
    return request
  }

  const portfolioRecordPool = computed(() =>
    portfolioWorkItems(portfolioRecordSource())
      .slice()
      .sort((a, b) => String(a.dateValue).localeCompare(String(b.dateValue)))
  )

  const projectRecords = (project) =>
    (project?.recordIds || []).map((id) => portfolioWorkItemById(id)).filter(Boolean)

  const orderedProjectRecords = (project) =>
    projectRecords(project).sort((a, b) => String(a.dateValue).localeCompare(String(b.dateValue)))

  const usedRecordIds = (project) => {
    const ids = new Set()
    ;(project?.pages || []).forEach((page) => {
      page.recordIds.forEach((id) => id && ids.add(id))
      Object.values(page.slots).forEach((slot) => slot.recordId && ids.add(slot.recordId))
    })
    return ids
  }

  const unusedProjectRecords = (project) => {
    const used = usedRecordIds(project)
    return orderedProjectRecords(project).filter((record) => !used.has(record.id))
  }

  const projectSubjectLabel = (project) => {
    if (!project) return ''
    if (project.studentId) return studentById(project.studentId)?.name || '未知学生'
    if (project.classId) return classById(project.classId)?.name || '未知班级'
    return '未选择学生'
  }

  const projectClassLabel = (project) => classById(project?.classId)?.name || '未分班'

  const projectDateRangeLabel = (project) => {
    if (project?.termLabel) return project.termLabel
    const records = orderedProjectRecords(project)
    if (!records.length) return '未选择作品'
    const first = records[0]
    const last = records[records.length - 1]
    return first.date === last.date ? first.date : `${first.date} - ${last.date}`
  }

  const defaultIntro = (project) => {
    const records = orderedProjectRecords(project)
    if (!records.length) return ''
    return `${projectSubjectLabel(project)}本学期共整理 ${records.length} 幅课堂作品。每一页记录了一段课堂中的观察、尝试和表达，也留下了孩子在创作过程里的阶段变化。`
  }

  const defaultSummary = (project) => {
    const records = orderedProjectRecords(project)
    if (!records.length) return ''
    const courses = [...new Set(records.map((record) => record.course).filter(Boolean))]
    const highlights = records.map((record) => record.highlightNote).filter(Boolean)
    return `本册覆盖${courses.slice(0, 4).join('、') || '多个课堂主题'}等内容，可以看到${projectSubjectLabel(project)}在构图、色彩和细节表达上的持续积累。${highlights[0] || '作品中保留了清晰的课堂目标和个人表达。'}`
  }

  const defaultTeacherMessage = (project) =>
    `谢谢家长一直配合课后的观察和鼓励。接下来我们会继续关注${projectSubjectLabel(project)}的画面层次、表达完整度，也期待他继续保持自己的创作想法。`

  const ensureProjectCopy = (project) => {
    if (!project.intro) project.intro = defaultIntro(project)
    if (!project.summary) project.summary = defaultSummary(project)
    if (!project.teacherMessage) project.teacherMessage = defaultTeacherMessage(project)
  }

  const openPortfolioProject = (project) => {
    activePortfolioProjectId.value = project?.id || null
  }

  const closePortfolioProject = () => {
    activePortfolioProjectId.value = null
  }

  const clearPortfolioSession = () => {
    portfolioRecordsRequestId += 1
    portfolioRecordsPromise = null
    portfolioRecordsLoadedStudentId.value = null
    portfolioRecordsLoadingStudentId.value = null
    portfolioRecordsLoading.value = false
    portfolioRecordsError.value = ''
    portfolioSourceRecords.splice(0, portfolioSourceRecords.length)
    portfolioProjects.splice(0, portfolioProjects.length)
    exportJobs.splice(0, exportJobs.length)
    activePortfolioProjectId.value = null
  }

  const createPortfolioProject = (payload = {}) => {
    const template = portfolioTemplates.find((item) => sameId(item.id, payload.templateId)) || defaultTemplate
    if (!template) {
      notify('当前校区还没有可用的作品集模板，请先由管理员配置模板')
      return null
    }
    const studentId = payload.studentId || null
    const student = studentById(studentId)
    const klass = classById(payload.classId || student?.classId)
    const recordIds = expandPortfolioWorkIds(payload.recordIds || [])
    const project = service.createProject({
      projectType: template.projectType,
      templateId: template.id,
      title: payload.title?.trim() || `${student?.name || '学生'} · ${payload.termLabel || template.book.termLabel}作品册`,
      studentId,
      classId: klass?.id || null,
      termLabel: payload.termLabel || template.book.termLabel,
      dateStart: payload.dateStart || '',
      dateEnd: payload.dateEnd || '',
      target: student ? `${student.name}家长` : '',
      recordIds,
      book: { ...template.book, termLabel: payload.termLabel || template.book.termLabel },
      deck: payload.deck ? clone(payload.deck) : null
    })
    activePortfolioProjectId.value = project.id
    if (project.studentId) {
      portfolioFilter.studentId = String(project.studentId)
      portfolioFilter.classId = 'all'
    }
    return project
  }

  const removePortfolioProject = (project) => {
    service.removeProject(project)
    if (sameId(activePortfolioProjectId.value, project.id)) activePortfolioProjectId.value = null
    notify(`已删除制作项目：${project.title}`)
  }

  const duplicatePortfolioProject = (project) => {
    const copy = service.duplicateProject(project)
    notify(`已复制：${copy.title}`)
    return copy
  }

  const toggleProjectRecord = (project, recordId) => {
    if (!project) return
    const index = project.recordIds.findIndex((id) => sameId(id, recordId))
    if (index >= 0) project.recordIds.splice(index, 1)
    else project.recordIds.push(recordId)
    service.touchProject(project)
  }

  const selectAllPoolRecords = (project) => {
    if (!project) return
    const ids = portfolioRecordPool.value.map((record) => record.id)
    const allPicked = ids.length && ids.every((id) => project.recordIds.some((recordId) => sameId(recordId, id)))
    project.recordIds = allPicked
      ? project.recordIds.filter((id) => !ids.some((recordId) => sameId(recordId, id)))
      : [...new Set([...project.recordIds, ...ids].map(String))]
    service.touchProject(project)
  }

  const applyTemplate = (project, templateId) => {
    const template = portfolioTemplates.find((item) => sameId(item.id, templateId))
    if (!project || !template) return
    project.templateId = template.id
    project.projectType = template.projectType
    project.book = { ...template.book, termLabel: project.termLabel || template.book.termLabel }
    service.touchProject(project)
  }

  const makePage = (pageType, layoutId, recordIds = []) => ({
    id: nextSeq(),
    pageType,
    layoutId,
    recordIds: [...recordIds],
    slots: {}
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

  const workLayoutForCount = (project, count) => {
    const template = templateFor(project)
    if (!template?.layouts) return portfolioLayouts.find((layout) => layout.pageType === 'work') || portfolioLayouts[0]
    if (count >= 4) return layoutById(template.layouts.work4)
    if (count === 2) return layoutById(template.layouts.work2)
    return layoutById(template.layouts.work1)
  }

  const autoPaginate = (project) => {
    if (!project) return
    const template = templateFor(project)
    if (!template?.layouts) {
      notify('当前模板缺少页面布局定义')
      return
    }
    const records = orderedProjectRecords(project)
    if (!records.length) {
      notify('请先选择要进入作品册的作品')
      return
    }
    ensureProjectCopy(project)
    const pages = []
    const cover = makePage('cover', template.layouts.cover)
    cover.slots['cover-image'] = { recordId: records[0].id, crop: defaultCrop() }
    pages.push(cover)
    const overview = makePage('overview', template.layouts.overview)
    overview.slots['overview-image'] = { recordId: (records.find((record) => record.highlight) || records[0]).id, crop: defaultCrop() }
    pages.push(overview)
    workGroups(records).forEach((group) => {
      const layout = workLayoutForCount(project, group.length)
      pages.push(makePage('work', layout.id, group.map((record) => record.id)))
    })
    const closing = makePage('closing', template.layouts.closing)
    closing.slots['closing-image'] = { recordId: records[records.length - 1].id, crop: defaultCrop() }
    pages.push(closing)
    project.pages = pages
    project.deck = buildPortfolioDeck(project)
    project.status = portfolioReadyFor(project) ? '待导出' : '已生成'
    project.stage = 1
    service.touchProject(project)
    notify(`已生成 ${pages.length} 页横向 A4 作品册`)
  }

  const buildPortfolioDeck = (project, records = null) => {
    if (!project) return null
    ensureProjectCopy(project)
    const template = templateFor(project)
    if (!template) return null
    const sourceRecords = records || orderedProjectRecords(project)
    const student = studentById(project.studentId)
    const klass = classById(project.classId || student?.classId)
    return createPortfolioPptistDocument({ project, template, records: sourceRecords, student, klass, school })
  }

  const generatePortfolioDeck = async (project) => {
    if (!project) return null
    const records = orderedProjectRecords(project)
    if (!records.length) {
      notify('请先选择要进入作品册的作品')
      return null
    }
    const hydratedRecords = await hydratePortfolioRecords(records)
    project.deck = buildPortfolioDeck(project, hydratedRecords)
    if (!project.deck) {
      notify('当前模板没有可生成的页面结构')
      return null
    }
    project.status = '待导出'
    project.stage = 1
    service.touchProject(project)
    notify(`已生成 ${project.deck.slides.length} 页 A4 横向作品册`)
    return project.deck
  }

  const setPortfolioDeck = (project, document) => {
    if (!project || !document) return
    project.deck = clone(document)
    service.touchProject(project)
  }

  const savePortfolioDeckAsTemplate = (project, payload = {}) => {
    if (!project?.deck) return null
    const name = payload.name?.trim() || `${projectSubjectLabel(project)}作品册模板`
    try {
      const deck = sanitizeTemplateDeck(project.deck)
      return api.portfolio.createTemplate({
        name,
        projectType: project.projectType || 'TERM_BOOK',
        scopeType: 'USER',
        description: payload.desc?.trim() || `由 ${project.title} 保存，可复用当前页面和元素位置`,
        deck,
        isDefault: false
      }).then((saved) => {
        const remoteTemplate = mapPortfolioTemplate(saved)
        portfolioTemplates.unshift(remoteTemplate)
        notify(`已保存模板：${remoteTemplate.name}`)
        return remoteTemplate
      }).catch((error) => {
        notify(error?.message || '模板保存失败')
        return null
      })
    } catch (error) {
      notify(error?.message || '模板包含无法持久化的临时图片')
      return null
    }
  }

  const defaultCrop = () => ({ scale: 1, x: 50, y: 50 })
  const pageLayout = (page) => layoutById(page?.layoutId) || portfolioLayouts[0]

  const slotData = (page, slot) => {
    if (!page.slots[slot.key]) page.slots[slot.key] = {}
    return page.slots[slot.key]
  }

  const slotRecord = (project, page, slot) => {
    if (slot.work !== undefined) return recordById(page.recordIds[slot.work])
    const stored = page.slots[slot.key]
    return stored?.recordId ? recordById(stored.recordId) : null
  }

  const projectStatText = (project) => {
    const records = orderedProjectRecords(project)
    const courses = new Set(records.map((record) => record.course).filter(Boolean))
    const highlights = records.filter((record) => record.highlight).length
    return `作品 ${records.length} 幅\n课程主题 ${courses.size} 个\n高光作品 ${highlights} 幅\n页面 ${project.pages.length || '待生成'} 页`
  }

  const boundText = (project, page, slot) => {
    const record = slotRecord(project, page, slot)
    if (slot.text) return slot.text
    if (slot.bind === 'title') return project.title
    if (slot.bind === 'subtitle') return `${projectSubjectLabel(project)} · ${projectClassLabel(project)} · ${projectDateRangeLabel(project)}`
    if (slot.bind === 'meta') return `${school.name} · ${school.campus}`
    if (slot.bind === 'intro') return project.intro
    if (slot.bind === 'summary') return project.summary
    if (slot.bind === 'teacherMessage') return project.teacherMessage
    if (slot.bind === 'teacherSignature') return `${project.owner}  ${projectDateRangeLabel(project)}`
    if (slot.bind === 'stats') return projectStatText(project)
    if (!record) return ''
    if (slot.role === 'title') return record.title || `${record.studentName}的${record.course}`
    if (slot.role === 'meta') {
      return [project.book.showDate ? record.date : '', project.book.showCourse ? record.course : '', record.className].filter(Boolean).join(' · ')
    }
    if (slot.role === 'caption') {
      return [record.title || record.course, project.book.showDate ? record.date : ''].filter(Boolean).join(' · ')
    }
    if (slot.role === 'body') {
      if (project.book.bodySource === 'none') return ''
      return record[project.book.bodySource] || ''
    }
    return ''
  }

  const projectFieldForSlot = (page, slot) => {
    if (slot.type !== 'text') return ''
    if (slot.bind === 'title') return 'title'
    if (slot.bind === 'intro') return 'intro'
    if (slot.bind === 'summary') return 'summary'
    if (slot.bind === 'teacherMessage') return 'teacherMessage'
    return ''
  }

  const resolveSlot = (project, page, slot) => {
    const record = slotRecord(project, page, slot)
    const stored = page.slots[slot.key] || {}
    if (slot.type === 'image') {
      return {
        record,
        imageUrl: record?.artwork || '',
        crop: stored.crop || defaultCrop(),
        empty: !record?.artwork
      }
    }
    const text = stored.edited ? stored.text || '' : boundText(project, page, slot)
    return { record, text, edited: Boolean(stored.edited), empty: !compactText(text) }
  }

  const setSlotText = (project, page, slot, text) => {
    const field = projectFieldForSlot(page, slot)
    if (field) project[field] = text
    else {
      const data = slotData(page, slot)
      data.text = text
      data.edited = true
    }
    service.touchProject(project)
  }

  const resetSlotText = (project, page, slot) => {
    const data = slotData(page, slot)
    data.edited = false
    data.text = ''
    service.touchProject(project)
  }

  const setSlotCrop = (project, page, slot, crop) => {
    const data = slotData(page, slot)
    data.crop = { ...(data.crop || defaultCrop()), ...crop }
    service.touchProject(project)
  }

  const assignRecordToSlot = (project, page, slot, recordId) => {
    if (!project || !page || !slot) return
    if (!project.recordIds.includes(recordId)) project.recordIds.push(recordId)
    if (slot.work !== undefined) {
      const next = [...page.recordIds]
      while (next.length <= slot.work) next.push(null)
      next[slot.work] = recordId
      page.recordIds = next
    } else {
      slotData(page, slot).recordId = recordId
    }
    slotData(page, slot).crop = defaultCrop()
    service.touchProject(project)
  }

  const clearSlotRecord = (project, page, slot) => {
    if (slot.work !== undefined) {
      const next = [...page.recordIds]
      next[slot.work] = null
      page.recordIds = next
    } else {
      slotData(page, slot).recordId = null
    }
    service.touchProject(project)
  }

  const switchPageLayout = (project, page, layoutId) => {
    const layout = layoutById(layoutId)
    if (!project || !page || !layout) return
    page.layoutId = layout.id
    page.pageType = layout.pageType
    if (layout.pageType === 'work') {
      while (page.recordIds.length < layout.imageSlots) page.recordIds.push(null)
      if (page.recordIds.length > layout.imageSlots) page.recordIds = page.recordIds.slice(0, layout.imageSlots)
    }
    service.touchProject(project)
  }

  const movePage = (project, index, direction) => {
    const target = index + direction
    if (!project?.pages[index] || target < 0 || target >= project.pages.length) return
    const [page] = project.pages.splice(index, 1)
    project.pages.splice(target, 0, page)
    service.touchProject(project)
  }

  const reorderPage = (project, fromIndex, toIndex) => {
    if (!project || fromIndex === toIndex) return
    if (!project.pages[fromIndex] || toIndex < 0 || toIndex >= project.pages.length) return
    const [page] = project.pages.splice(fromIndex, 1)
    project.pages.splice(toIndex, 0, page)
    service.touchProject(project)
  }

  const removePage = (project, index) => {
    if (!project?.pages[index]) return
    project.pages.splice(index, 1)
    service.touchProject(project)
  }

  const layoutHitsPunchArea = (project, page) => {
    const safe = pageSizeFor(project).punchSafeArea
    return pageLayout(page).slots.filter((slot) => intersects(slot.area, safe))
  }

  const portfolioIssuesFor = (project) => {
    const issues = []
    if (!project?.pages?.length) return issues
    const emptyImages = []
    const emptyTexts = []
    const punchHits = []
    project.pages.forEach((page, index) => {
      pageLayout(page).slots.forEach((slot) => {
        const resolved = resolveSlot(project, page, slot)
        if (slot.type === 'image' && resolved.empty) emptyImages.push(index + 1)
        if (slot.type === 'text' && resolved.empty) {
          const bodyOff = slot.role === 'body' && page.pageType === 'work' && project.book.bodySource === 'none'
          if (!bodyOff) emptyTexts.push(index + 1)
        }
      })
      if (layoutHitsPunchArea(project, page).length) punchHits.push(index + 1)
    })
    if (emptyImages.length) {
      issues.push({
        key: 'emptyImage',
        level: 'error',
        title: `${emptyImages.length} 个图片位为空`,
        detail: `第 ${[...new Set(emptyImages)].join('、')} 页`,
        pageNos: [...new Set(emptyImages)]
      })
    }
    if (emptyTexts.length) {
      issues.push({
        key: 'emptyText',
        level: 'error',
        title: `${emptyTexts.length} 处关键文字为空`,
        detail: `第 ${[...new Set(emptyTexts)].join('、')} 页`,
        pageNos: [...new Set(emptyTexts)]
      })
    }
    if (punchHits.length) {
      issues.push({
        key: 'punchSafeArea',
        level: 'error',
        title: '有内容进入右上角打孔安全区',
        detail: `第 ${[...new Set(punchHits)].join('、')} 页需要换模板或调整槽位`,
        pageNos: [...new Set(punchHits)]
      })
    }
    return issues
  }

  const portfolioIssuePagesFor = (project) => {
    const map = {}
    portfolioIssuesFor(project).forEach((issue) => {
      issue.pageNos.forEach((pageNo) => { map[pageNo] = issue.level })
    })
    return map
  }

  const portfolioReadyFor = (project) => {
    if (project?.deck?.slides?.length) return true
    return Boolean(project?.pages?.length) && !portfolioIssuesFor(project).some((issue) => issue.level === 'error')
  }

  const generateProjectCopy = (project) => {
    if (!project) return
    project.intro = defaultIntro(project)
    project.summary = defaultSummary(project)
    project.teacherMessage = defaultTeacherMessage(project)
    service.touchProject(project)
    notify('已根据作品档案生成作品册文案')
  }

  const sanitizeFilePart = (value) => String(value || '').replace(/[\\/:*?"<>|\s]+/g, '')
  const portfolioFileNameFor = (project) =>
    [
      school.campus,
      projectSubjectLabel(project),
      projectClassLabel(project),
      projectDateRangeLabel(project),
      '作品册',
      `v${project.version}`
    ].map(sanitizeFilePart).filter(Boolean).join('-') + '.pdf'

  const portfolioCloudPathFor = (project) =>
    `${school.campus}/教学资料归档/作品册导出/${projectDateRangeLabel(project)}/${projectClassLabel(project)}`

  const recordPortfolioExport = async (project, result) => {
    if (!project?.studentId || !result?.blob) {
      notify('请先生成浏览器端 PDF 文件')
      return null
    }
    try {
      const blob = result.blob
      const digest = await sha256ForFile(blob)
      const session = await api.portfolio.createExportSession({
        studentId: String(project.studentId),
        classId: project.classId ? String(project.classId) : undefined,
        termId: project.termId ? String(project.termId) : undefined,
        dateStart: project.dateStart || undefined,
        dateEnd: project.dateEnd || undefined,
        templateId: isPersistedPortfolioTemplateId(project.templateId) ? String(project.templateId) : undefined,
        sourceRecordIds: [...new Set(orderedProjectRecords(project)
          .map((record) => record.sourceRecordId ?? record.id)
          .map((recordId) => String(recordId)))],
        sourceRecordRefs: [...new Map(orderedProjectRecords(project)
          .map((record) => {
            const recordId = record.sourceRecordId ?? record.id
            const sourceId = record.sourceId ?? recordId
            const sourceType = String(record.sourceType || 'LESSON').toUpperCase()
            return [`${sourceType}:${recordId}:${sourceId}`, {
              sourceType,
              recordId: String(recordId),
              sourceId: String(sourceId)
            }]
          }))
          .values()],
        expectedSize: blob.size,
        expectedSha256: digest,
        requestedPageCount: result.pageCount
      })
      await putUploadSessionContent(session, blob, 'application/pdf')
      const exportRecord = await api.portfolio.completeExport(session.fileUploadSessionId, { sizeBytes: blob.size, sha256: digest }, createIdempotencyKey(`portfolio-export:${project.studentId}:${digest}`))
      const job = { ...exportRecord, id: fromApiId(exportRecord.id), fileName: exportRecord.fileName || result.fileName, fileUrl: exportRecord.downloadUrl || '', pageCount: exportRecord.pageCount || result.pageCount, exportedAt: exportRecord.exportedAt || new Date().toISOString(), status: '已导出' }
      exportJobs.unshift(job)
      project.status = '已导出'
      notify(`PDF 已登记：${job.fileName}`)
      return job
    } catch (error) {
      notify(error?.message || '作品集导出登记失败')
      return null
    }
  }

  return {
    portfolioTemplates,
    portfolioLayouts,
    portfolioPageSizes: pageSizes,
    bookThemes,
    bodySources,
    portfolioProjects,
    visiblePortfolioProjects,
    exportJobs,
    portfolioStats,
    portfolioFilter,
    portfolioRecordPool,
    portfolioRecordsLoading,
    portfolioRecordsError,
    loadPortfolioRecordsForStudent,
    activePortfolioProjectId,
    activePortfolioProject,
    portfolioTemplateFor: templateFor,
    portfolioLayoutById: layoutById,
    portfolioLayoutsForScope: layoutsForType,
    portfolioPageLayout: pageLayout,
    portfolioPageSizeFor: pageSizeFor,
    portfolioSlotCapacity: slotCapacity,
    projectRecords,
    orderedProjectRecords,
    unusedProjectRecords,
    projectUsedRecordIds: usedRecordIds,
    projectSubjectLabel,
    projectClassLabel,
    projectDateRangeLabel,
    createPortfolioProject,
    openPortfolioProject,
    closePortfolioProject,
    clearPortfolioSession,
    removePortfolioProject,
    duplicatePortfolioProject,
    toggleProjectRecord,
    selectAllPoolRecords,
    applyTemplate,
    autoPaginate,
    buildPortfolioDeck,
    generatePortfolioDeck,
    setPortfolioDeck,
    savePortfolioDeckAsTemplate,
    generateProjectCopy,
    resolveSlot,
    projectFieldForSlot,
    setSlotText,
    resetSlotText,
    setSlotCrop,
    assignRecordToSlot,
    clearSlotRecord,
    switchPageLayout,
    movePage,
    reorderPage,
    removePage,
    portfolioIssuesFor,
    portfolioIssuePagesFor,
    portfolioReadyFor,
    portfolioFileNameFor,
    portfolioCloudPathFor,
    recordPortfolioExport,
    loadPortfolioData
  }
}
