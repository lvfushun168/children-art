import { computed, reactive, ref } from 'vue'
import {
  bodySources,
  bookThemes,
  exportJobs as exportJobSeed,
  pageSizes,
  portfolioLayouts,
  portfolioProjects as portfolioProjectSeed,
  portfolioTemplates
} from '../data/portfolioData'

const clone = (value) => JSON.parse(JSON.stringify(value))
const chunk = (list, size) => {
  const groups = []
  for (let index = 0; index < list.length; index += size) groups.push(list.slice(index, index + size))
  return groups
}
// 文字容量粗估：按槽位面积和角色字号推算可容纳字数，用于「文字过长」体检
const capacityFactor = { title: 0.07, subtitle: 0.12, body: 0.23, meta: 0.2, caption: 0.2, footer: 0.2 }

export const layoutById = (layoutId) => portfolioLayouts.find((layout) => layout.id === layoutId)
export const layoutsForScope = (scope) => portfolioLayouts.filter((layout) => layout.scope === scope)
export const slotCapacity = (slot) => {
  const [, , width, height] = slot.area
  return Math.max(12, Math.round(width * height * (capacityFactor[slot.role] || 0.2)))
}

/**
 * 制作中心（作品集 / 成长手册）状态与操作。
 * 数据来源是学生作品档案，输出是 PDF / 长图 / 家长链接三个通道。
 */
export function usePortfolioStudio(context) {
  const {
    archiveRecords,
    students,
    classes,
    school,
    currentUser,
    isAdmin,
    authorizedClassIds,
    canEditArchiveRecord,
    createArchiveCollection,
    notify,
    nowText
  } = context

  const portfolioProjects = reactive(clone(portfolioProjectSeed))
  const exportJobs = reactive(clone(exportJobSeed))
  const activePortfolioProjectId = ref(null)
  const portfolioFilter = reactive({
    studentId: 'all',
    classId: 'all',
    dateStart: '',
    dateEnd: '',
    highlightOnly: false
  })
  let seq = Date.now()
  const nextSeq = () => ++seq

  const templateFor = (project) => portfolioTemplates.find((item) => item.id === project?.templateId) || portfolioTemplates[0]
  const recordById = (recordId) => archiveRecords.find((record) => record.id === recordId)
  const studentById = (studentId) => students.find((student) => student.id === Number(studentId))
  const classById = (classId) => classes.find((klass) => klass.id === Number(classId))

  const accessibleRecords = computed(() => archiveRecords.filter((record) => canEditArchiveRecord(record)))
  const visiblePortfolioProjects = computed(() =>
    portfolioProjects.filter((project) => isAdmin.value || project.owner === currentUser.value?.name)
  )
  const activePortfolioProject = computed(() =>
    visiblePortfolioProjects.value.find((project) => project.id === activePortfolioProjectId.value) || null
  )
  const portfolioStats = computed(() => ({
    total: visiblePortfolioProjects.value.length,
    drafting: visiblePortfolioProjects.value.filter((project) => project.status !== '已导出').length,
    exported: visiblePortfolioProjects.value.filter((project) => project.status === '已导出').length,
    jobs: exportJobs.length
  }))

  // ---------- 第 1 步：选料 ----------

  const portfolioRecordPool = computed(() =>
    accessibleRecords.value
      .filter((record) => {
        const studentOk = portfolioFilter.studentId === 'all' || record.studentId === Number(portfolioFilter.studentId)
        const classOk = portfolioFilter.classId === 'all' || record.classId === Number(portfolioFilter.classId)
        const startOk = !portfolioFilter.dateStart || (record.dateValue || '') >= portfolioFilter.dateStart
        const endOk = !portfolioFilter.dateEnd || (record.dateValue || '') <= portfolioFilter.dateEnd
        const highlightOk = !portfolioFilter.highlightOnly || record.highlight
        return studentOk && classOk && startOk && endOk && highlightOk
      })
      .slice()
      .sort((a, b) => String(a.dateValue).localeCompare(String(b.dateValue)))
  )

  const projectRecords = (project) =>
    (project?.recordIds || []).map((id) => recordById(id)).filter(Boolean)

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
    if (!project?.pages?.length) return []
    const used = usedRecordIds(project)
    return orderedProjectRecords(project).filter((record) => !used.has(record.id))
  }

  const projectSubjectLabel = (project) => {
    if (!project) return ''
    if (project.studentId) return studentById(project.studentId)?.name || '未知学生'
    if (project.classId) return classById(project.classId)?.name || '未知班级'
    return '自定义范围'
  }

  const projectDateRangeLabel = (project) => {
    const records = orderedProjectRecords(project)
    if (!records.length) return '未选择作品'
    const first = records[0]
    const last = records[records.length - 1]
    return first.date === last.date ? first.date : `${first.date} - ${last.date}`
  }

  const createPortfolioProject = (payload = {}) => {
    const template = portfolioTemplates.find((item) => item.id === payload.templateId) || portfolioTemplates[0]
    const studentId = payload.studentId ? Number(payload.studentId) : null
    const student = studentById(studentId)
    const klass = classById(payload.classId)
    const project = reactive({
      id: nextSeq(),
      projectType: template.projectType,
      templateId: template.id,
      title: payload.title?.trim() || `${student?.name || klass?.name || '新'} · ${template.projectType}`,
      studentId,
      classId: payload.classId ? Number(payload.classId) : student?.classId || null,
      owner: currentUser.value?.name || '老师',
      ownerId: currentUser.value?.id || null,
      target: payload.target?.trim() || (student ? `${student.name}家长` : ''),
      status: '草稿',
      stage: payload.recordIds?.length ? 1 : 0,
      version: 1,
      createdAt: nowText(),
      updatedAt: nowText(),
      recordIds: [...(payload.recordIds || [])],
      intro: '',
      summary: '',
      teacherMessage: '',
      book: { ...template.book },
      pages: [],
      collectionId: null,
      collectionLink: ''
    })
    portfolioProjects.unshift(project)
    activePortfolioProjectId.value = project.id
    if (project.studentId) {
      portfolioFilter.studentId = String(project.studentId)
      portfolioFilter.classId = 'all'
    } else if (project.classId) {
      portfolioFilter.classId = String(project.classId)
      portfolioFilter.studentId = 'all'
    }
    return project
  }

  const touchProject = (project) => {
    if (!project) return
    project.updatedAt = nowText()
    if (project.status === '已导出') project.status = '制作中'
  }

  const openPortfolioProject = (project) => {
    activePortfolioProjectId.value = project?.id || null
  }

  const closePortfolioProject = () => {
    activePortfolioProjectId.value = null
  }

  const removePortfolioProject = (project) => {
    const index = portfolioProjects.findIndex((item) => item.id === project.id)
    if (index < 0) return
    portfolioProjects.splice(index, 1)
    if (activePortfolioProjectId.value === project.id) activePortfolioProjectId.value = null
    notify(`已删除制作项目：${project.title}`)
  }

  const duplicatePortfolioProject = (project) => {
    const copy = reactive({
      ...clone(project),
      id: nextSeq(),
      title: `${project.title}（副本）`,
      status: '草稿',
      collectionId: null,
      collectionLink: '',
      createdAt: nowText(),
      updatedAt: nowText()
    })
    portfolioProjects.unshift(copy)
    notify(`已复制：${copy.title}`)
    return copy
  }

  const toggleProjectRecord = (project, recordId) => {
    if (!project) return
    const index = project.recordIds.indexOf(recordId)
    if (index >= 0) project.recordIds.splice(index, 1)
    else project.recordIds.push(recordId)
    touchProject(project)
  }

  const selectAllPoolRecords = (project) => {
    if (!project) return
    const ids = portfolioRecordPool.value.map((record) => record.id)
    const allPicked = ids.length && ids.every((id) => project.recordIds.includes(id))
    if (allPicked) project.recordIds = project.recordIds.filter((id) => !ids.includes(id))
    else project.recordIds = [...new Set([...project.recordIds, ...ids])]
    touchProject(project)
  }

  // ---------- 第 2 步：套版 ----------

  const applyTemplate = (project, templateId) => {
    const template = portfolioTemplates.find((item) => item.id === templateId)
    if (!project || !template) return
    project.templateId = template.id
    project.projectType = template.projectType
    project.book = { ...template.book }
    touchProject(project)
  }

  const pickWorkLayout = (project, worksPerPage) => {
    const template = templateFor(project)
    const preferred = layoutById(template.layouts.work)
    if (preferred && preferred.imageSlots === worksPerPage) return preferred
    return layoutsForScope('work').find((layout) => layout.imageSlots === worksPerPage) || preferred || layoutsForScope('work')[0]
  }

  // 最后一页凑不满时，优先换成刚好装得下的版式（9 件按 4 件/页 → 4 + 4 + 1），避免留下空图位
  const pickWorkLayoutForCount = (project, worksPerPage, count) => {
    if (count === worksPerPage) return pickWorkLayout(project, worksPerPage)
    const exact = layoutsForScope('work').find((layout) => layout.imageSlots === count)
    return exact || pickWorkLayout(project, worksPerPage)
  }

  const makePage = (kind, layoutId, recordIds = []) => ({
    id: nextSeq(),
    kind,
    layoutId,
    recordIds: [...recordIds],
    slots: {}
  })

  const autoPaginate = (project) => {
    if (!project) return
    const template = templateFor(project)
    const records = orderedProjectRecords(project)
    if (!records.length) {
      notify('请先在第 1 步选择作品')
      return
    }
    const perPage = project.book.worksPerPage
    const pages = []
    if (template.structure.includes('cover')) {
      const cover = makePage('cover', template.layouts.cover)
      cover.slots['cover-image'] = { recordId: records[0].id, crop: defaultCrop() }
      pages.push(cover)
    }
    if (template.structure.includes('intro')) {
      const intro = makePage('intro', template.layouts.intro)
      const introLayout = layoutById(template.layouts.intro)
      if (introLayout?.slots.some((slot) => slot.key === 'intro-image')) {
        intro.slots['intro-image'] = { recordId: (records[1] || records[0]).id, crop: defaultCrop() }
      }
      pages.push(intro)
    }
    chunk(records, perPage).forEach((group) => {
      const layout = pickWorkLayoutForCount(project, perPage, group.length)
      pages.push(makePage('work', layout.id, group.map((record) => record.id)))
    })
    if (template.structure.includes('closing')) {
      const closing = makePage('closing', template.layouts.closing)
      const closingLayout = layoutById(template.layouts.closing)
      if (closingLayout?.slots.some((slot) => slot.key === 'closing-image')) {
        closing.slots['closing-image'] = { recordId: records[records.length - 1].id, crop: defaultCrop() }
      }
      pages.push(closing)
    }
    project.pages = pages
    project.status = '制作中'
    project.stage = 2
    ensureProjectCopy(project)
    touchProject(project)
    notify(`已自动生成 ${pages.length} 页，可继续微调`)
  }

  const defaultCrop = () => ({ scale: 1, x: 50, y: 50 })

  const defaultIntro = (project) => {
    const records = orderedProjectRecords(project)
    const subject = projectSubjectLabel(project)
    if (!records.length) return ''
    return `这是${subject}在${projectDateRangeLabel(project)}期间完成的 ${records.length} 件作品。老师把其中最能看出变化的部分整理成了这本册子。`
  }

  const defaultTeacherMessage = (project) =>
    `谢谢家长一直配合课后的观察和鼓励。接下来我们会继续关注${projectSubjectLabel(project)}的画面层次、表达完整度，也希望他继续保持自己的创作想法。`

  const defaultSummary = (project) => {
    const records = orderedProjectRecords(project)
    if (!records.length) return ''
    const courses = [...new Set(records.map((record) => record.course))]
    const highlights = records.map((record) => record.highlightNote).filter(Boolean)
    return `从${courses.join('、')}等主题中可以看到，${projectSubjectLabel(project)}在画面组织、色彩表达和细节完整度上都有持续积累。${highlights[0] || '作品里保留了清晰的课堂目标和个人表达。'}`
  }

  // 自动成册后册子文字必须是「基本能用」的，否则批量成册每本都要手写一遍
  const ensureProjectCopy = (project) => {
    if (!project.intro) project.intro = defaultIntro(project)
    if (!project.summary) project.summary = defaultSummary(project)
    if (!project.teacherMessage) project.teacherMessage = defaultTeacherMessage(project)
  }

  const generateProjectCopy = (project) => {
    if (!project) return
    if (!orderedProjectRecords(project).length) return
    project.intro = defaultIntro(project)
    project.summary = defaultSummary(project)
    project.teacherMessage = defaultTeacherMessage(project)
    touchProject(project)
    notify('已根据作品数据生成册子文案')
  }

  // ---------- 第 3 步：微调 ----------

  const pageLayout = (page) => layoutById(page?.layoutId) || layoutById('blank-page')

  const slotData = (page, slot) => {
    if (!page.slots[slot.key]) page.slots[slot.key] = {}
    return page.slots[slot.key]
  }

  const slotRecord = (project, page, slot) => {
    if (slot.work !== undefined) return recordById(page.recordIds[slot.work])
    const stored = page.slots[slot.key]
    return stored?.recordId ? recordById(stored.recordId) : null
  }

  const boundText = (project, page, slot) => {
    const record = slotRecord(project, page, slot)
    const book = project.book
    if (page.kind === 'cover') {
      if (slot.role === 'title') return project.title
      if (slot.role === 'subtitle') return `${projectSubjectLabel(project)} · ${projectDateRangeLabel(project)}`
      if (slot.role === 'footer') return `${school.name} · ${school.campus}`
    }
    if (page.kind === 'intro') {
      if (slot.role === 'title') return '写在前面'
      if (slot.role === 'body') return slot.bind === 'summary' ? project.summary : project.intro
      if (slot.role === 'caption') return '课堂现场'
    }
    if (page.kind === 'closing') {
      if (slot.role === 'title') return '老师寄语'
      if (slot.role === 'body') return project.teacherMessage
      if (slot.role === 'footer') return `${project.owner}　${project.createdAt.split(' ')[0] || ''}`
    }
    if (!record) return ''
    if (slot.role === 'title') return record.title || `${record.studentName}的${record.course}`
    if (slot.role === 'meta') {
      return [book.showDate ? record.date : '', book.showCourse ? record.course : '', record.className]
        .filter(Boolean)
        .join(' · ')
    }
    if (slot.role === 'caption') {
      return [record.studentName, book.showCourse ? record.course : '', book.showDate ? record.date : '']
        .filter(Boolean)
        .join(' · ')
    }
    if (slot.role === 'body') {
      if (book.bodySource === 'none') return ''
      return record[book.bodySource] || ''
    }
    return ''
  }

  // 册子级文字（书名、引言、总结、寄语）直接写回项目字段，保证「一处改动、全册生效」
  const projectFieldForSlot = (page, slot) => {
    if (slot.type !== 'text') return ''
    if (page.kind === 'cover' && slot.role === 'title') return 'title'
    if (page.kind === 'intro' && slot.role === 'body') return slot.bind === 'summary' ? 'summary' : 'intro'
    if (page.kind === 'closing' && slot.role === 'body') return 'teacherMessage'
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
    return { record, text, edited: Boolean(stored.edited), empty: !String(text).trim() }
  }

  const setSlotText = (project, page, slot, text) => {
    const data = slotData(page, slot)
    data.text = text
    data.edited = true
    touchProject(project)
  }

  const resetSlotText = (project, page, slot) => {
    const data = slotData(page, slot)
    data.edited = false
    data.text = ''
    touchProject(project)
    notify('已恢复为档案数据')
  }

  const setSlotCrop = (project, page, slot, crop) => {
    const data = slotData(page, slot)
    data.crop = { ...(data.crop || defaultCrop()), ...crop }
    touchProject(project)
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
    const data = slotData(page, slot)
    data.crop = defaultCrop()
    touchProject(project)
    notify(`已放入作品：${recordById(recordId)?.title || ''}`)
  }

  const clearSlotRecord = (project, page, slot) => {
    if (slot.work !== undefined) {
      const next = [...page.recordIds]
      next[slot.work] = null
      page.recordIds = next
    } else {
      slotData(page, slot).recordId = null
    }
    touchProject(project)
  }

  const switchPageLayout = (project, page, layoutId) => {
    const layout = layoutById(layoutId)
    if (!project || !page || !layout) return
    page.layoutId = layout.id
    page.kind = layout.scope
    if (layout.scope === 'work') {
      const capacity = layout.imageSlots
      if (page.recordIds.length > capacity) page.recordIds = page.recordIds.slice(0, capacity)
      while (page.recordIds.length < capacity) page.recordIds.push(null)
    }
    touchProject(project)
    notify(`已换版式：${layout.name}`)
  }

  const insertPage = (project, kind, atIndex) => {
    if (!project) return null
    const layout = kind === 'work' ? pickWorkLayout(project, project.book.worksPerPage) : layoutsForScope(kind)[0]
    if (!layout) return null
    const page = makePage(kind, layout.id, kind === 'work' ? new Array(layout.imageSlots).fill(null) : [])
    const index = atIndex === undefined ? project.pages.length : atIndex + 1
    project.pages.splice(index, 0, page)
    touchProject(project)
    notify(`已插入${kind === 'blank' ? '空白页' : layout.name}`)
    return page
  }

  const duplicatePage = (project, index) => {
    const page = project.pages[index]
    if (!page) return
    project.pages.splice(index + 1, 0, { ...clone(page), id: nextSeq() })
    touchProject(project)
  }

  const removePage = (project, index) => {
    if (!project?.pages[index]) return
    project.pages.splice(index, 1)
    touchProject(project)
  }

  const movePage = (project, index, direction) => {
    const target = index + direction
    if (!project?.pages[index] || target < 0 || target >= project.pages.length) return
    const [page] = project.pages.splice(index, 1)
    project.pages.splice(target, 0, page)
    touchProject(project)
  }

  const reorderPage = (project, fromIndex, toIndex) => {
    if (!project || fromIndex === toIndex) return
    if (!project.pages[fromIndex] || toIndex < 0 || toIndex >= project.pages.length) return
    const [page] = project.pages.splice(fromIndex, 1)
    project.pages.splice(toIndex, 0, page)
    touchProject(project)
  }

  const pageTitle = (project, page, index) => {
    const kindLabel = { cover: '封面', intro: '引言', work: '作品页', closing: '寄语', blank: '空白页' }
    return `P${index + 1} · ${kindLabel[page.kind] || '页面'}`
  }

  // 对页视图：封面单独成页，其余两两成对，模拟装订后的翻阅效果
  const spreadsFor = (project) => {
    const pages = project?.pages || []
    if (!pages.length) return []
    const spreads = [[{ page: pages[0], index: 0 }]]
    for (let index = 1; index < pages.length; index += 2) {
      const pair = [{ page: pages[index], index }]
      if (pages[index + 1]) pair.push({ page: pages[index + 1], index: index + 1 })
      spreads.push(pair)
    }
    return spreads
  }

  // ---------- 成册体检 ----------

  const printableDpi = (project, slot, record) => {
    if (!record?.pixelWidth) return null
    const size = pageSizes[templateFor(project).pageSize] || pageSizes.A4
    const neededMm = (slot.area[2] / 100) * size.widthMm
    if (neededMm <= 0) return null
    return Math.round(record.pixelWidth / (neededMm / 25.4))
  }

  const portfolioIssuesFor = (project) => {
    const issues = []
    if (!project?.pages?.length) return issues
    const emptyImages = []
    const emptyTexts = []
    const longTexts = []
    const lowRes = []
    const trailingEmpty = []

    project.pages.forEach((page, index) => {
      const layout = pageLayout(page)
      // 作品页凑不满时，末尾多出来的空位属于提醒，不应该阻断导出
      const filledWorks = page.recordIds.filter(Boolean).length
      layout.slots.forEach((slot) => {
        const isTrailing = slot.work !== undefined && filledWorks > 0 && slot.work >= filledWorks
        if (isTrailing) {
          if (slot.type === 'image') trailingEmpty.push(index + 1)
          return
        }
        const resolved = resolveSlot(project, page, slot)
        if (slot.type === 'image') {
          if (resolved.empty) emptyImages.push(index + 1)
          else {
            const dpi = printableDpi(project, slot, resolved.record)
            if (dpi !== null && dpi < 220) lowRes.push({ pageNo: index + 1, name: resolved.record.title || resolved.record.studentName, dpi })
          }
          return
        }
        if (resolved.empty) {
          // 正文来源设为「不放正文」时，空的正文槽属于预期结果
          const bodyOff = slot.role === 'body' && page.kind === 'work' && project.book.bodySource === 'none'
          if (!bodyOff) emptyTexts.push({ pageNo: index + 1, role: slot.role })
          return
        }
        const capacity = slotCapacity(slot)
        if (String(resolved.text).length > capacity) {
          longTexts.push({ pageNo: index + 1, role: slot.role, length: String(resolved.text).length, capacity })
        }
      })
    })

    if (emptyImages.length) {
      issues.push({
        key: 'emptyImage',
        level: 'error',
        title: `${emptyImages.length} 个图片位还是空的`,
        detail: `第 ${[...new Set(emptyImages)].join('、')} 页`,
        pageNos: [...new Set(emptyImages)]
      })
    }
    if (emptyTexts.length) {
      issues.push({
        key: 'emptyText',
        level: 'error',
        title: `${emptyTexts.length} 处文字为空`,
        detail: `第 ${[...new Set(emptyTexts.map((item) => item.pageNo))].join('、')} 页`,
        pageNos: [...new Set(emptyTexts.map((item) => item.pageNo))]
      })
    }
    if (trailingEmpty.length) {
      const pageNos = [...new Set(trailingEmpty)]
      issues.push({
        key: 'trailingEmpty',
        level: 'warn',
        title: `${trailingEmpty.length} 个位置没有排满`,
        detail: `第 ${pageNos.join('、')} 页可以换成刚好装得下的版式，或再加作品`,
        pageNos
      })
    }
    if (longTexts.length) {
      issues.push({
        key: 'longText',
        level: 'warn',
        title: `${longTexts.length} 处文字可能排不下`,
        detail: longTexts
          .slice(0, 3)
          .map((item) => `第 ${item.pageNo} 页约 ${item.length} 字（建议 ${item.capacity} 字内）`)
          .join('；'),
        pageNos: [...new Set(longTexts.map((item) => item.pageNo))]
      })
    }
    if (lowRes.length) {
      issues.push({
        key: 'lowRes',
        level: 'warn',
        title: `${lowRes.length} 张图片打印清晰度偏低`,
        detail: lowRes.slice(0, 3).map((item) => `第 ${item.pageNo} 页 ${item.name} 约 ${item.dpi}dpi`).join('；'),
        pageNos: [...new Set(lowRes.map((item) => item.pageNo))]
      })
    }
    const template = templateFor(project)
    if (template.binding === '骑马钉' && project.pages.length % 4 !== 0) {
      issues.push({
        key: 'binding',
        level: 'warn',
        title: `骑马钉要求页数为 4 的倍数，当前 ${project.pages.length} 页`,
        detail: `还差 ${4 - (project.pages.length % 4)} 页，可补空白页或再加作品页`,
        pageNos: [],
        action: 'pad'
      })
    }
    const unused = unusedProjectRecords(project)
    if (unused.length) {
      issues.push({
        key: 'unused',
        level: 'warn',
        title: `${unused.length} 件已选作品还没上册`,
        detail: unused.slice(0, 3).map((record) => record.title || record.studentName).join('、'),
        pageNos: []
      })
    }
    return issues
  }

  const portfolioIssuePagesFor = (project) => {
    const map = {}
    portfolioIssuesFor(project).forEach((issue) => {
      issue.pageNos.forEach((pageNo) => {
        if (!map[pageNo] || issue.level === 'error') map[pageNo] = issue.level
      })
    })
    return map
  }

  const portfolioReadyFor = (project) =>
    Boolean(project?.pages?.length) && !portfolioIssuesFor(project).some((issue) => issue.level === 'error')

  const padPortfolioPages = (project) => {
    const template = templateFor(project)
    if (template.binding !== '骑马钉') return
    while (project.pages.length % 4 !== 0) {
      const blank = makePage('blank', 'blank-page')
      const closingIndex = project.pages.findIndex((page) => page.kind === 'closing')
      if (closingIndex >= 0) project.pages.splice(closingIndex, 0, blank)
      else project.pages.push(blank)
    }
    touchProject(project)
    notify(`已补齐到 ${project.pages.length} 页`)
  }

  // ---------- 第 4 步：导出 ----------

  const exportTypeMeta = {
    PDF: { ext: 'pdf', label: 'PDF 手册' },
    长图: { ext: 'jpg', label: '整册长图' },
    ZIP: { ext: 'zip', label: '批量 PDF 压缩包' }
  }

  const exportPathFor = (project) => {
    const size = pageSizes[templateFor(project).pageSize] || pageSizes.A4
    return `${school.campus}/教学资料归档/作品集导出/${new Date().getFullYear()}/${project.projectType}（${size.label}）`
  }

  const exportPortfolio = (project, exportType = 'PDF') => {
    if (!project) return null
    if (!portfolioReadyFor(project)) {
      notify('还有必填项没完成，请先处理体检清单中的红色项')
      return null
    }
    const meta = exportTypeMeta[exportType] || exportTypeMeta.PDF
    const job = {
      id: nextSeq(),
      sourceType: 'portfolio',
      sourceId: project.id,
      title: project.title,
      exportType,
      status: '已导出',
      pages: project.pages.length,
      fileUrl: `system://exports/portfolio-${project.id}.${meta.ext}`,
      cloudPath: exportPathFor(project),
      createdBy: currentUser.value?.name || '老师',
      createdAt: nowText(),
      finishedAt: nowText(),
      failureReason: ''
    }
    exportJobs.unshift(job)
    project.status = '已导出'
    project.version += 1
    project.updatedAt = nowText()
    notify(`${meta.label}已导出：${project.title}`)
    return job
  }

  const publishPortfolioLink = (project) => {
    if (!project) return null
    if (!portfolioReadyFor(project)) {
      notify('还有必填项没完成，请先处理体检清单中的红色项')
      return null
    }
    const collection = createArchiveCollection({
      type: project.projectType,
      title: project.title,
      target: project.target,
      intro: project.intro,
      summary: project.summary,
      teacherMessage: project.teacherMessage,
      note: `由制作中心生成，共 ${project.pages.length} 页`,
      recordIds: [...usedRecordIds(project)],
      showDate: project.book.showDate,
      showCourse: project.book.showCourse,
      showHighlight: true,
      showComment: project.book.bodySource === 'feedback',
      showWatermark: project.book.showWatermark
    })
    if (!collection) return null
    project.collectionId = collection.id
    project.collectionLink = collection.link
    project.updatedAt = nowText()
    return collection
  }

  const exportPortfolioBatch = (projectList) => {
    const ready = projectList.filter((project) => portfolioReadyFor(project))
    if (!ready.length) {
      notify('这批册子还没有可导出的项目')
      return null
    }
    const job = {
      id: nextSeq(),
      sourceType: 'portfolioBatch',
      sourceId: null,
      title: `批量导出 ${ready.length} 本 · ${ready[0].projectType}`,
      exportType: 'ZIP',
      status: '已导出',
      pages: ready.reduce((total, project) => total + project.pages.length, 0),
      fileUrl: `system://exports/portfolio-batch-${nextSeq()}.zip`,
      cloudPath: exportPathFor(ready[0]),
      createdBy: currentUser.value?.name || '老师',
      createdAt: nowText(),
      finishedAt: nowText(),
      failureReason: ''
    }
    exportJobs.unshift(job)
    ready.forEach((project) => {
      project.status = '已导出'
      project.version += 1
      project.updatedAt = nowText()
    })
    const skipped = projectList.length - ready.length
    notify(skipped ? `已导出 ${ready.length} 本，${skipped} 本因体检未通过跳过` : `已导出 ${ready.length} 本手册`)
    return job
  }

  // ---------- 批量成册 ----------

  const batchCandidates = (payload) => {
    const klass = classById(payload.classId)
    if (!klass) return []
    return (klass.studentIds || [])
      .map((studentId) => {
        const records = accessibleRecords.value
          .filter((record) => record.studentId === studentId)
          .filter((record) => !payload.dateStart || (record.dateValue || '') >= payload.dateStart)
          .filter((record) => !payload.dateEnd || (record.dateValue || '') <= payload.dateEnd)
          .filter((record) => !payload.highlightOnly || record.highlight)
        return { student: studentById(studentId), records }
      })
      .filter((entry) => entry.student)
  }

  const createBatchPortfolios = (payload) => {
    const candidates = batchCandidates(payload)
    const created = []
    const skipped = []
    candidates.forEach((entry) => {
      if (!entry.records.length) {
        skipped.push(entry.student.name)
        return
      }
      const project = createPortfolioProject({
        templateId: payload.templateId,
        studentId: entry.student.id,
        classId: payload.classId,
        recordIds: entry.records.map((record) => record.id),
        title: `${entry.student.name} · ${payload.titleSuffix || '成长手册'}`
      })
      autoPaginate(project)
      created.push(project)
    })
    activePortfolioProjectId.value = null
    if (created.length) {
      notify(skipped.length ? `已生成 ${created.length} 本，${skipped.length} 名学生无作品已跳过` : `已生成 ${created.length} 本手册`)
    } else {
      notify('所选范围内没有可用作品')
    }
    return { created, skipped }
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
    activePortfolioProjectId,
    activePortfolioProject,
    portfolioTemplateFor: templateFor,
    portfolioLayoutById: layoutById,
    portfolioLayoutsForScope: layoutsForScope,
    portfolioPageLayout: pageLayout,
    portfolioSlotCapacity: slotCapacity,
    projectRecords,
    orderedProjectRecords,
    unusedProjectRecords,
    projectUsedRecordIds: usedRecordIds,
    projectSubjectLabel,
    projectDateRangeLabel,
    createPortfolioProject,
    openPortfolioProject,
    closePortfolioProject,
    removePortfolioProject,
    duplicatePortfolioProject,
    toggleProjectRecord,
    selectAllPoolRecords,
    applyTemplate,
    autoPaginate,
    generateProjectCopy,
    resolveSlot,
    projectFieldForSlot,
    setSlotText,
    resetSlotText,
    setSlotCrop,
    assignRecordToSlot,
    clearSlotRecord,
    switchPageLayout,
    insertPage,
    duplicatePage,
    removePage,
    movePage,
    reorderPage,
    pageTitle,
    spreadsFor,
    portfolioIssuesFor,
    portfolioIssuePagesFor,
    portfolioReadyFor,
    padPortfolioPages,
    exportPortfolio,
    publishPortfolioLink,
    exportPortfolioBatch,
    createBatchPortfolios,
    batchCandidates
  }
}
