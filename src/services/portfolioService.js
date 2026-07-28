const clone = (value) => JSON.parse(JSON.stringify(value))

const nextId = (items) => Math.max(0, ...items.map((item) => Number(item.id) || 0)) + 1

export function createMockPortfolioService(context) {
  const {
    archiveRecords,
    portfolioProjects,
    exportJobs,
    currentUser,
    isAdmin,
    canEditArchiveRecord,
    nowText
  } = context

  const listAccessibleRecords = () => archiveRecords.filter((record) => canEditArchiveRecord(record))

  const listVisibleProjects = () =>
    portfolioProjects.filter((project) => isAdmin.value || project.owner === currentUser.value?.name)

  const createProject = (payload) => {
    const project = {
      id: nextId(portfolioProjects),
      projectType: payload.projectType,
      templateId: payload.templateId,
      title: payload.title,
      studentId: payload.studentId,
      classId: payload.classId,
      termLabel: payload.termLabel,
      dateStart: payload.dateStart || '',
      dateEnd: payload.dateEnd || '',
      owner: currentUser.value?.name || '老师',
      ownerId: currentUser.value?.id || null,
      target: payload.target || '',
      status: '草稿',
      stage: 0,
      version: 1,
      createdAt: nowText(),
      updatedAt: nowText(),
      exportedAt: '',
      recordIds: [...(payload.recordIds || [])],
      intro: payload.intro || '',
      summary: payload.summary || '',
      teacherMessage: payload.teacherMessage || '',
      book: clone(payload.book || {}),
      deck: payload.deck ? clone(payload.deck) : null,
      pages: []
    }
    portfolioProjects.unshift(project)
    return project
  }

  const touchProject = (project) => {
    if (!project) return
    project.updatedAt = nowText()
    if (project.status === '已导出') project.status = '已生成'
  }

  const removeProject = (project) => {
    const index = portfolioProjects.findIndex((item) => item.id === project.id)
    if (index >= 0) portfolioProjects.splice(index, 1)
  }

  const duplicateProject = (project) => {
    const copy = {
      ...clone(project),
      id: nextId(portfolioProjects),
      title: `${project.title}（副本）`,
      status: '已生成',
      version: 1,
      exportedAt: '',
      createdAt: nowText(),
      updatedAt: nowText()
    }
    portfolioProjects.unshift(copy)
    return copy
  }

  const createExportRecord = (project, result) => {
    const job = {
      id: nextId(exportJobs),
      sourceType: 'portfolio',
      sourceId: project.id,
      title: project.title,
      exportType: 'PDF',
      status: '已导出',
      pages: result.pageCount,
      fileName: result.fileName,
      fileUrl: result.fileUrl,
      cloudPath: result.cloudPath,
      createdBy: currentUser.value?.name || '老师',
      createdAt: result.exportedAt,
      finishedAt: result.exportedAt,
      failureReason: ''
    }
    exportJobs.unshift(job)
    project.status = '已导出'
    project.exportedAt = result.exportedAt
    project.version += 1
    project.updatedAt = nowText()
    return job
  }

  return {
    listAccessibleRecords,
    listVisibleProjects,
    createProject,
    touchProject,
    removeProject,
    duplicateProject,
    createExportRecord
  }
}
