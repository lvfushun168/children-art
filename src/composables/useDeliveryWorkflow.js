import { computed, reactive, ref } from 'vue'
import {
  artworkLibrary as artworkLibrarySeed,
  archives as archiveSeed,
  archiveRecords as archiveRecordSeed,
  aiCallLogs as aiCallLogSeed,
  classes as classSeed,
  courses as courseSeed,
  displayConfigSeed,
  extraTaskArchives as extraTaskArchiveSeed,
  externalLinks as externalLinkSeed,
  homeworkSeed,
  importBatches as importBatchSeed,
  importPreviewRows as importPreviewSeed,
  initialBulkRecord,
  initialSessionStudents,
  lessonMaterials as lessonMaterialSeed,
  school as schoolSeed,
  sessionSeed,
  settings as settingSeed,
  students as studentSeed,
  tasks as taskSeed,
  templates as templateSeed,
  teachers as teacherSeed,
  wheatTraces as wheatTraceSeed
} from '../data/mockData'

const clone = (value) => JSON.parse(JSON.stringify(value))
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function useDeliveryWorkflow() {
  const school = reactive(clone(schoolSeed))
  const artworkLibrary = reactive(clone(artworkLibrarySeed))
  const teachers = reactive(clone(teacherSeed))
  const students = reactive(clone(studentSeed))
  const classes = reactive(clone(classSeed))
  const courses = reactive(clone(courseSeed))
  const templates = reactive(clone(templateSeed))
  const tasks = reactive(clone(taskSeed))
  const archives = reactive(clone(archiveSeed))
  const archiveRecords = reactive(clone(archiveRecordSeed))
  const aiCallLogStore = reactive(clone(aiCallLogSeed).map((log) => ({ ...log, lessonId: log.lessonId || 1 })))
  const extraTaskArchives = reactive(clone(extraTaskArchiveSeed))
  const externalLinks = reactive(clone(externalLinkSeed))
  const wheatTraces = reactive(clone(wheatTraceSeed))
  const importBatches = reactive(clone(importBatchSeed))
  const importPreviewRows = reactive(clone(importPreviewSeed))
  const settings = reactive(clone(settingSeed))
  const statusChangeLogs = reactive([])

  const activeTaskId = ref(1)
  const copied = ref(false)
  const isLoggedIn = ref(false)
  const currentUserId = ref(1)
  const loginForm = reactive({ phone: '137****9011', role: '老师' })
  const processingAction = ref('')
  const toast = ref('')
  const previewPulse = ref(false)
  const commentPulse = ref(false)
  const reportPulse = ref(false)

  const createStudentDeliveries = (task, useInitialSeed = false) => {
    const targetClass = classes.find((item) => item.id === task.classId)
    if (useInitialSeed) {
      return clone(initialSessionStudents).map((row) => ({
        ...row,
        lessonId: task.id,
        studentId: row.id,
        images: row.image && row.attendance === '到课' ? [row.image] : [],
        imageConfirmed: Boolean(row.imageMatched) && row.attendance === '到课'
      }))
    }

    return (targetClass?.studentIds || []).map((studentId) => {
      const seed = sessionSeed[studentId] || { image: '', record: '', focus: '色彩' }
      const student = students.find((item) => item.id === studentId)
      const isAbsent = student?.status === '请假'
      return {
        id: studentId,
        lessonId: task.id,
        studentId,
        attendance: isAbsent ? '请假' : '到课',
        originalImage: seed.image,
        processedImage: '',
        imageProcessStatus: '未处理',
        imageProcessError: '',
        image: seed.image,
        images: seed.image && !isAbsent ? [seed.image] : [],
        imageMatched: Boolean(seed.image) && !isAbsent,
        processed: false,
        imageConfirmed: Boolean(seed.image) && !isAbsent,
        record: isAbsent ? '' : seed.record,
        focus: seed.focus,
        comment: '',
        confirmed: false,
        highlight: false,
        highlightNote: '',
        shareReady: false,
        archived: false
      }
    })
  }

  const createLessonWorkspace = (task, useInitialSeed = false) => ({
    lessonId: task.id,
    studentDeliveries: createStudentDeliveries(task, useInitialSeed),
    materials: clone(lessonMaterialSeed).map((material) => ({ ...material, lessonId: task.id })),
    homework: { ...clone(homeworkSeed), lessonId: task.id },
    displayConfig: { ...clone(displayConfigSeed), lessonId: task.id },
    bulkRecord: useInitialSeed ? initialBulkRecord : '',
    selectedImageTemplate: 0,
    selectedCommentTemplate: 0,
    activeShareMode: 'student',
    activeStudentId: null,
    currentStep: 0,
    showReport: false,
    sharePage: {
      status: '草稿',
      draftVersion: 1,
      publishedVersion: 0,
      publishedSnapshot: null,
      lastPublishedHash: '',
      revokedReason: '',
      publishedAt: '',
      revokedAt: ''
    }
  })

  const lessonWorkspaces = reactive(
    Object.fromEntries(tasks.map((task) => [task.id, createLessonWorkspace(task, task.id === activeTaskId.value)]))
  )

  const ensureLessonWorkspace = (task) => {
    if (!lessonWorkspaces[task.id]) lessonWorkspaces[task.id] = createLessonWorkspace(task)
    const workspace = lessonWorkspaces[task.id]
    if (!workspace.activeStudentId) {
      workspace.activeStudentId =
        workspace.studentDeliveries.find((row) => row.attendance === '到课')?.studentId ||
        workspace.studentDeliveries[0]?.studentId ||
        null
    }
    return workspace
  }

  tasks.forEach((task) => ensureLessonWorkspace(task))

  const persistSharePage = (lessonId, page) => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(`children-art-share-${lessonId}`, JSON.stringify(page))
  }

  if (typeof window !== 'undefined') {
    tasks.forEach((task) => {
      try {
        const saved = window.localStorage.getItem(`children-art-share-${task.id}`)
        if (saved) Object.assign(lessonWorkspaces[task.id].sharePage, JSON.parse(saved))
      } catch {
        // 原型存储损坏时回退为本课次初始草稿，不影响其他课次。
      }
    })
  }

  const activeWorkspace = computed(() => ensureLessonWorkspace(activeTask.value))
  const sessionStudents = computed(() => activeWorkspace.value.studentDeliveries)
  const materials = computed(() => activeWorkspace.value.materials)
  const homework = computed(() => activeWorkspace.value.homework)
  const displayConfig = computed(() => activeWorkspace.value.displayConfig)
  const sharePage = computed(() => activeWorkspace.value.sharePage)
  const activeStudentId = computed({
    get: () => activeWorkspace.value.activeStudentId,
    set: (value) => { activeWorkspace.value.activeStudentId = Number(value) }
  })
  const currentStep = computed({
    get: () => activeWorkspace.value.currentStep,
    set: (value) => { activeWorkspace.value.currentStep = Number(value) }
  })
  const selectedImageTemplate = computed({
    get: () => activeWorkspace.value.selectedImageTemplate,
    set: (value) => { activeWorkspace.value.selectedImageTemplate = Number(value) }
  })
  const selectedCommentTemplate = computed({
    get: () => activeWorkspace.value.selectedCommentTemplate,
    set: (value) => { activeWorkspace.value.selectedCommentTemplate = Number(value) }
  })
  const bulkRecord = computed({
    get: () => activeWorkspace.value.bulkRecord,
    set: (value) => { activeWorkspace.value.bulkRecord = value }
  })
  const activeShareMode = computed({
    get: () => activeWorkspace.value.activeShareMode,
    set: (value) => { activeWorkspace.value.activeShareMode = value }
  })
  const showReport = computed({
    get: () => activeWorkspace.value.showReport,
    set: (value) => { activeWorkspace.value.showReport = Boolean(value) }
  })
  const aiCallLogs = computed(() => aiCallLogStore.filter((log) => log.lessonId === activeTaskId.value))

  const currentUser = computed(() => teachers.find((teacher) => teacher.id === currentUserId.value))
  const isAdmin = computed(() => currentUser.value?.role === '管理员')
  const authorizedClassIds = computed(() => (isAdmin.value ? classes.map((klass) => klass.id) : currentUser.value?.classes || []))
  const visibleTasks = computed(() =>
    tasks.filter((task) => isAdmin.value || authorizedClassIds.value.includes(task.classId) || task.teacher === currentUser.value?.name)
  )
  const visibleNavItems = computed(() => {
    const adminOnly = ['imports', 'settings']
    return isAdmin.value ? [] : adminOnly
  })
  const activeTask = computed(() => visibleTasks.value.find((task) => task.id === activeTaskId.value) || visibleTasks.value[0] || tasks[0])
  const activeClass = computed(() => classes.find((item) => item.id === activeTask.value.classId))
  const activeCourse = computed(() => courses.find((item) => item.id === activeTask.value.courseId))
  const activeSessionStudent = computed(() => sessionStudents.value.find((item) => item.studentId === activeStudentId.value))
  const activeStudent = computed(() => students.find((item) => item.id === activeStudentId.value))
  const classStudents = computed(() => activeClass.value.studentIds.map((id) => students.find((item) => item.id === id)).filter(Boolean))
  const attendingRows = computed(() => sessionStudents.value.filter((item) => item.attendance === '到课'))
  const activeImageTemplate = computed(() => templates.image[selectedImageTemplate.value])
  const activeCommentTemplate = computed(() => templates.comment[selectedCommentTemplate.value])
  const isProcessing = computed(() => Boolean(processingAction.value))
  const selectedExternalLinks = computed(() => externalLinks.filter((link) => homework.value.externalLinkIds.includes(link.id)))
  const permissionSummary = computed(() => ({
    role: currentUser.value?.role || '未登录',
    visibleClasses: authorizedClassIds.value.map((id) => classes.find((klass) => klass.id === id)?.name).filter(Boolean),
    taskScope: isAdmin.value ? '全部课次' : '本人授权班级课次',
    canManageSettings: isAdmin.value,
    canProcessLesson: Boolean(activeTask.value && (isAdmin.value || authorizedClassIds.value.includes(activeTask.value.classId)))
  }))
  const importStats = computed(() => ({
    total: importPreviewRows.length,
    ok: importPreviewRows.filter((row) => row.status === '可导入').length,
    warning: importPreviewRows.filter((row) => row.status !== '可导入').length
  }))
  const archiveFilter = reactive({
    studentId: 'all',
    classId: 'all',
    teacher: 'all',
    date: 'all'
  })
  const archiveDates = computed(() => [...new Set(archiveRecords.map((record) => record.date))])
  const filteredArchiveRecords = computed(() =>
    archiveRecords.filter((record) => {
      const studentOk = archiveFilter.studentId === 'all' || record.studentId === Number(archiveFilter.studentId)
      const classOk = archiveFilter.classId === 'all' || record.classId === Number(archiveFilter.classId)
      const teacherOk = archiveFilter.teacher === 'all' || record.teacher === archiveFilter.teacher
      const dateOk = archiveFilter.date === 'all' || record.date === archiveFilter.date
      return studentOk && classOk && teacherOk && dateOk
    })
  )
  const studentHistoryFor = (studentId) => archiveRecords.filter((record) => record.studentId === Number(studentId))

  const counts = computed(() => ({
    total: classStudents.value.length,
    attend: sessionStudents.value.filter((item) => item.attendance === '到课').length,
    matched: sessionStudents.value.filter((item) => item.attendance === '到课' && item.imageMatched).length,
    imageConfirmed: sessionStudents.value.filter((item) => item.attendance === '到课' && item.imageConfirmed).length,
    records: sessionStudents.value.filter((item) => item.attendance === '到课' && item.record).length,
    processed: sessionStudents.value.filter((item) => item.attendance === '到课' && item.processed).length,
    comments: sessionStudents.value.filter((item) => item.attendance === '到课' && item.comment).length,
    confirmed: sessionStudents.value.filter((item) => item.attendance === '到课' && item.confirmed).length,
    highlights: sessionStudents.value.filter((item) => item.attendance === '到课' && item.highlight).length,
    shareReady: sessionStudents.value.filter((item) => item.attendance === '到课' && item.shareReady).length,
    archived: sessionStudents.value.filter((item) => item.attendance === '到课' && item.archived).length,
    artworks: materials.value.filter((item) => item.type === '范画').length,
    visibleMaterials: materials.value.filter((item) => item.visible).length
  }))

  const steps = computed(() => [
    { title: '课次确认', hint: '核对课次信息和学生出勤', done: counts.value.attend ? 1 : 0, total: 1 },
    { title: '上传范画', hint: '至少上传 1 张本节范画', done: counts.value.artworks ? 1 : 0, total: 1 },
    { title: '上传作品', hint: '逐个学生上传至少 1 张作品', done: counts.value.matched, total: counts.value.attend },
    { title: '课堂记录', hint: '逐个录入学生课堂表现', done: counts.value.records, total: counts.value.attend },
    { title: '图文生成', hint: '图片处理、AI 课评和人工确认', done: Math.min(counts.value.processed, counts.value.confirmed), total: counts.value.attend },
    { title: '家长展示', hint: '任务、高光、展示页和二维码', done: counts.value.shareReady, total: counts.value.attend },
    { title: '归档留痕', hint: '保存档案并生成小麦待办', done: counts.value.archived, total: counts.value.attend }
  ])

  const taskProgress = computed(() => {
    const total = counts.value.attend * 7 || 1
    const done =
      counts.value.attend +
      (counts.value.artworks ? counts.value.attend : 0) +
      counts.value.matched +
      counts.value.records +
      Math.min(counts.value.processed, counts.value.confirmed) +
      counts.value.shareReady +
      counts.value.archived
    return Math.min(100, Math.round((done / total) * 100))
  })

  const progressForTask = (task) => {
    const workspace = ensureLessonWorkspace(task)
    const rows = workspace.studentDeliveries.filter((row) => row.attendance === '到课')
    if (task.status === '已完成') return 100
    if (!rows.length) return 0
    const completed =
      rows.length +
      (workspace.materials.some((item) => item.type === '范画') ? rows.length : 0) +
      rows.filter((row) => row.imageMatched).length +
      rows.filter((row) => row.record).length +
      Math.min(rows.filter((row) => row.processed).length, rows.filter((row) => row.confirmed).length) +
      rows.filter((row) => row.shareReady).length +
      rows.filter((row) => row.archived).length
    const workspaceProgress = Math.min(100, Math.round((completed / (rows.length * 7)) * 100))
    if (task.id === activeTaskId.value) return taskProgress.value
    return workspaceProgress
  }

  const currentWarnings = computed(() => {
    const warnings = []
    if (!materials.value.some((item) => item.type === '范画')) warnings.push('本节课至少需要上传 1 张范画')
    if (homework.value.visible && !homework.value.content.trim()) warnings.push('课后任务内容为空')
    attendingRows.value.forEach((row) => {
      const student = students.find((item) => item.id === row.studentId)
      if (!row.imageMatched) warnings.push(`${student.name}缺作品`)
      if (!row.imageConfirmed) warnings.push(`${student.name}图片待确认`)
      if (!row.record) warnings.push(`${student.name}缺课堂记录`)
      if (!row.comment) warnings.push(`${student.name}缺课评`)
      if (row.comment && !row.confirmed) warnings.push(`${student.name}课评待确认`)
      if (!row.shareReady) warnings.push(`${student.name}展示页待生成`)
    })
    return warnings
  })

  const parentShareUrl = computed(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:5174'
    if (activeShareMode.value === 'class') return `${base}/#/share/lesson/${activeTask.value.id}?token=lesson-demo-${activeTask.value.id}`
    return `${base}/#/share/student/${activeTask.value.id}/${activeStudentId.value}?token=student-demo-${activeTask.value.id}-${activeStudentId.value}`
  })

  const qrText = computed(() => `QR · ${activeShareMode.value === 'class' ? activeClass.value.name : activeStudent.value?.name || ''}`)

  const fileNameFor = (row) => {
    const student = students.find((item) => item.id === row.studentId)
    return `${activeTask.value.date}-${activeClass.value.name}-${student.name}-${activeCourse.value.title}.jpg`
  }

  const exportText = computed(() =>
    attendingRows.value
      .map((row, index) => {
        const student = students.find((item) => item.id === row.studentId)
        const link = `https://share.xinghe-art.local/student-${activeTask.value.id}-${row.studentId}`
        return `${index + 1}. ${student.name}\n作品文件：${fileNameFor(row)}\n展示页：${link}\n课评：${row.comment || '待生成'}`
      })
      .join('\n\n')
  )

  const notify = (message) => {
    toast.value = message
    setTimeout(() => {
      if (toast.value === message) toast.value = ''
    }, 2200)
  }

  const nowText = () => new Date().toLocaleString('zh-CN', { hour12: false })
  const nextId = (collection) => Math.max(0, ...collection.map((item) => item.id || 0)) + 1
  const addStatusLog = (objectType, objectId, before, after, reason, source = '工作台', lessonId = activeTask.value?.id || null) => {
    statusChangeLogs.unshift({
      id: nextId(statusChangeLogs),
      lessonId,
      objectType,
      objectId,
      before,
      after,
      operator: currentUser.value?.name || '未登录用户',
      time: nowText(),
      reason,
      source
    })
  }

  const lessonStatusLogs = computed(() => statusChangeLogs.filter((log) => log.lessonId === activeTask.value.id))

  const transitionLesson = (action, reason, exceptionType = '') => {
    const task = activeTask.value
    const before = task.status
    const rules = {
      start: { from: ['待处理'], to: '处理中' },
      exception: { from: ['待处理', '处理中'], to: '异常' },
      recover: { from: ['异常'], to: '处理中' },
      reopen: { from: ['已完成'], to: '处理中', admin: true }
    }
    const rule = rules[action]
    if (!rule || !rule.from.includes(before)) {
      notify(`操作未执行：课次当前为“${before}”，不满足状态前置条件`)
      return false
    }
    if (rule.admin && !isAdmin.value) {
      notify('操作未执行：只有管理员可以重新打开已完成课次')
      return false
    }
    if (action !== 'start' && !reason?.trim()) {
      notify('请填写本次状态变更原因')
      return false
    }
    if (action === 'exception' && !exceptionType) {
      notify('请先选择异常类型')
      return false
    }
    task.status = rule.to
    task.exceptionType = action === 'exception' ? exceptionType : task.exceptionType || ''
    task.exceptionReason = action === 'exception' ? reason.trim() : task.exceptionReason || ''
    if (action === 'recover') task.recoveryReason = reason.trim()
    if (action === 'reopen') {
      task.reopenReason = reason.trim()
      task.archived = false
      showReport.value = false
    }
    addStatusLog('课次', task.id, before, rule.to, action === 'start' ? '开始课后处理' : reason.trim())
    notify(`课次状态已由“${before}”变更为“${rule.to}”`)
    return true
  }

  const runAction = async (label, message, action) => {
    processingAction.value = label
    await wait(420)
    await action()
    await wait(220)
    processingAction.value = ''
    notify(message)
  }

  const pulsePreview = () => {
    previewPulse.value = false
    requestAnimationFrame(() => {
      previewPulse.value = true
      setTimeout(() => {
        previewPulse.value = false
      }, 900)
    })
  }

  const pulseComment = () => {
    commentPulse.value = false
    requestAnimationFrame(() => {
      commentPulse.value = true
      setTimeout(() => {
        commentPulse.value = false
      }, 900)
    })
  }

  const selectTask = (task) => {
    if (!isAdmin.value && !authorizedClassIds.value.includes(task.classId) && task.teacher !== currentUser.value?.name) {
      notify('无权限查看该课次，请联系管理员授权班级')
      return
    }
    ensureLessonWorkspace(task)
    activeTaskId.value = task.id
  }

  const loginAs = (teacherId) => {
    const teacher = teachers.find((item) => item.id === Number(teacherId))
    if (!teacher) return
    currentUserId.value = teacher.id
    loginForm.phone = teacher.phone
    loginForm.role = teacher.role
    isLoggedIn.value = true
    const firstTask = visibleTasks.value[0]
    if (firstTask) selectTask(firstTask)
    notify(`已登录：${teacher.name}（${teacher.role}）`)
  }

  const loginWithForm = () => {
    const teacher = teachers.find((item) => item.phone === loginForm.phone && item.role === loginForm.role) || teachers.find((item) => item.role === loginForm.role)
    loginAs(teacher?.id || teachers[0]?.id)
  }

  const logout = () => {
    isLoggedIn.value = false
    notify('已退出登录')
  }

  const setAttendance = (row, value) => {
    row.attendance = value
    if (value !== '到课') {
      row.imageMatched = false
      row.imageConfirmed = false
      row.processed = false
      row.confirmed = false
      row.shareReady = false
      row.archived = false
    } else {
      if (!row.image) row.image = sessionSeed[row.studentId]?.image || ''
      if (!row.images?.length && row.image) row.images = [row.image]
      row.imageMatched = Boolean(row.images?.length)
      row.imageConfirmed = row.imageMatched
    }
  }

  const toggleMaterialVisible = (material) => {
    material.visible = !material.visible
    notify(`${material.title}${material.visible ? '会展示给家长' : '已隐藏'}`)
  }

  const addMaterial = (type = '范画') => {
    materials.value.push({
      id: Date.now(),
      lessonId: activeTaskId.value,
      type,
      title: `新上传${type} ${materials.value.length + 1}`,
      image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=720&q=80',
      visible: true,
      libraryId: null
    })
    notify(`已上传一张${type}`)
  }

  const uploadLessonMaterial = (event, type = '范画') => {
    const file = event.target.files?.[0]
    if (!file) return
    materials.value.push({ id: Date.now(), lessonId: activeTaskId.value, type, title: file.name.replace(/\.[^.]+$/, ''), image: URL.createObjectURL(file), visible: true, libraryId: null })
    event.target.value = ''
    notify(`已上传${type}：${file.name}`)
  }

  const useArtworkFromLibrary = (item) => {
    if (materials.value.some((material) => material.libraryId === item.id)) {
      notify(`${item.title}已在本节课中`)
      return
    }
    materials.value.push({ id: Date.now(), lessonId: activeTaskId.value, type: item.type, title: item.title, image: item.image, visible: true, libraryId: item.id })
    item.usage += 1
    notify(`已从范画库选择：${item.title}`)
  }

  const saveMaterialToLibrary = (material) => {
    if (material.libraryId) return notify('这项素材已经在范画库中')
    const item = { id: nextId(artworkLibrary), type: material.type, title: material.title, theme: activeCourse.value.title, age: activeCourse.value.age, uploader: currentUser.value.name, usage: 1, image: material.image }
    artworkLibrary.unshift(item)
    material.libraryId = item.id
    notify(`已保存到范画库：${material.title}`)
  }

  const addArtworkLibraryItem = (payload) => {
    const item = { id: nextId(artworkLibrary), type: payload.type || '范画', title: payload.title || '新范画', theme: payload.theme || '未分类', age: payload.age || '不限', uploader: currentUser.value.name, usage: 0, image: payload.image || 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=720&q=80' }
    artworkLibrary.unshift(item)
    notify(`已加入范画库：${item.title}`)
    return item
  }

  const chooseImageTemplate = (index) => {
    selectedImageTemplate.value = index
    pulsePreview()
    notify(`已切换图片模板：${templates.image[index].name}`)
  }

  const chooseCommentTemplate = (index) => {
    selectedCommentTemplate.value = index
    pulseComment()
    notify(`已切换课评模板：${templates.comment[index].name}`)
  }

  const parseBulkRecord = () => {
    bulkRecord.value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const [rawName, ...rest] = line.split(/[:：]/)
        const student = students.find((item) => item.name === rawName.trim() || item.nickname === rawName.trim())
        const row = student ? sessionStudents.value.find((item) => item.studentId === student.id) : null
        if (row && rest.length) row.record = rest.join('：').trim()
      })
    notify('课堂记录已匹配到学生')
  }

  const simulateVoice = async () => {
    const row = activeSessionStudent.value
    const student = activeStudent.value
    if (!row || row.attendance !== '到课') return
    await runAction('正在将语音转成文字...', '语音内容已添加到当前学生记录', async () => {
      const samples = {
        彤彤: '今天用色很大胆，叶子比上次更舒展，背景留白可以再注意。',
        浩浩: '今天的画面很有故事感，涂色均匀了很多，细节可以继续深入。',
        安安: '今天构图很完整，画面排列有节奏，背景层次可以再丰富。'
      }
      const text = samples[student?.name] || '今天课堂参与认真，能够跟随步骤完成作品，也有自己的表达。'
      row.record = row.record?.trim() ? `${row.record.trim()} ${text}` : text
    })
  }

  const matchImages = async () => {
    await runAction('正在匹配作品图片...', `已匹配 ${counts.value.attend} 张作品`, async () => {
      sessionStudents.value.forEach((row) => {
        if (row.attendance === '到课') row.imageMatched = true
      })
    })
  }

  const addAiLog = (type, target, status, message, retry = 0) => {
    aiCallLogStore.unshift({
      id: Date.now() + aiCallLogStore.length,
      lessonId: activeTaskId.value,
      time: '刚刚',
      type,
      target,
      status,
      retry,
      cost: status === '成功' ? '0.012' : '0.000',
      message
    })
  }

  const confirmImages = () => {
    attendingRows.value.forEach((row) => {
      if (row.imageMatched) {
        if (row.processedImage && row.imageProcessStatus === '成功') row.image = row.processedImage
        row.imageConfirmed = true
      }
    })
    notify('已确认全部可用图片，处理图已生效')
  }

  const processImages = async () => {
    await runAction('正在进行作品美化和水印处理...', `已按“${activeImageTemplate.value.name}”处理 ${counts.value.matched} 张作品`, async () => {
      sessionStudents.value.forEach((row) => {
        if (row.attendance === '到课' && row.imageMatched) {
          const student = students.find((item) => item.id === row.studentId)
          row.imageProcessStatus = '成功'
          row.imageProcessError = ''
          row.processedImage = row.originalImage || row.image
          row.processed = true
          row.imageConfirmed = false
          addAiLog('图片处理', student?.name || '学生', '成功', '已生成处理图，等待老师确认')
        }
      })
      pulsePreview()
    })
  }

  const failCurrentImageProcess = () => {
    const row = activeSessionStudent.value
    const student = activeStudent.value
    row.imageProcessStatus = '失败'
    row.imageProcessError = '接口返回质量不足，请重试或保留原图'
    row.processed = false
    row.processedImage = ''
    row.imageConfirmed = false
    addAiLog('图片处理', student?.name || '当前学生', '失败', row.imageProcessError, 1)
    notify(`${student?.name || '当前学生'}图片处理失败，可重试或确认原图`)
  }

  const retryCurrentImageProcess = async () => {
    const row = activeSessionStudent.value
    const student = activeStudent.value
    await runAction('正在重试图片处理...', `${student?.name || '当前学生'}处理图已重新生成`, async () => {
      row.imageProcessStatus = '成功'
      row.imageProcessError = ''
      row.processedImage = row.originalImage || row.image
      row.processed = true
      row.imageConfirmed = false
      addAiLog('图片处理', student?.name || '当前学生', '成功', '重试成功，等待老师确认', 1)
      pulsePreview()
    })
  }

  const generateOne = (row) => {
    const student = students.find((item) => item.id === row.studentId)
    const record = row.record || ''
    const inferredFocus = /色|涂|暖|冷/.test(record) ? '色彩' : /想法|故事|创意|想象/.test(record) ? '想象力' : /构图|画面|主体|层次|空间/.test(record) ? '构图' : '细节'
    const complimentMap = {
      色彩: '今天的色彩选择很大胆，画面一下子就亮了起来',
      想象力: '今天的想法很丰富，能把自己的故事放进画面里',
      构图: '今天画面安排很完整，主体和周围元素关系更清楚了',
      细节: '今天观察得很认真，小细节处理得比之前更稳定'
    }
    const suggestionMap = {
      色彩: '下次可以试着让背景留白更舒服，画面会更透气',
      想象力: '下次可以把关键角色的细节再刻画得更明确',
      构图: '下次可以继续加强前后层次，让画面更有空间感',
      细节: '下次可以在主体和背景之间做一点更清楚的区分'
    }
    const observation = record.trim() ? `课堂记录中可以看到：${record.trim()}` : '课堂中能够认真跟随步骤完成作品'
    row.comment = `${student.nickname}今天表现很棒，${complimentMap[inferredFocus]}。${observation} 本节课围绕“${activeCourse.value.title}”完成练习，也保留了自己的表达。${suggestionMap[inferredFocus]}。继续保持这份专注和大胆。`
    if (activeCommentTemplate.value.name === '低龄鼓励版') {
      row.comment = `${student.nickname}今天特别投入，${complimentMap[inferredFocus]}。${observation} 老师能看到他很愿意大胆尝试。下次我们继续鼓励他把喜欢的细节画得更多一些，相信会越来越棒。`
    }
    if (activeCommentTemplate.value.name === '专业简洁版') {
      row.comment = `${student.nickname}本节课能围绕“${activeCourse.value.title}”完成主体表达，${complimentMap[inferredFocus]}。${observation} 下一步建议继续关注画面层次和细节完整度，让作品呈现更稳定。`
    }
  }

  const generateAll = async () => {
    processingAction.value = '正在生成全班 1v1 课评...'
    for (const row of attendingRows.value) {
      await wait(260)
      generateOne(row)
      activeStudentId.value = row.studentId
      addAiLog('课评生成', students.find((item) => item.id === row.studentId)?.name || '学生', '成功', '生成 1v1 课评，等待老师确认')
      pulseComment()
    }
    await wait(180)
    processingAction.value = ''
    notify(`已按“${activeCommentTemplate.value.name}”生成 ${counts.value.comments} 条课评`)
  }

  const confirmAll = () => {
    attendingRows.value.forEach((row) => {
      if (row.comment) row.confirmed = true
    })
    notify('已确认全部课评')
  }

  const toggleHighlight = (row) => {
    row.highlight = !row.highlight
    if (row.highlight && !row.highlightNote) row.highlightNote = '作品表现突出，可作为本节课高光展示。'
    notify(row.highlight ? '已标记高光作品' : '已取消高光标记')
  }

  const toggleHomeworkLink = (id) => {
    const index = homework.value.externalLinkIds.indexOf(id)
    if (index >= 0) homework.value.externalLinkIds.splice(index, 1)
    else homework.value.externalLinkIds.push(id)
  }

  const shareDraftPayload = () => ({
    lesson: clone(activeTask.value),
    klass: clone(activeClass.value),
    course: clone(activeCourse.value),
    studentDeliveries: clone(sessionStudents.value),
    students: clone(students),
    materials: clone(materials.value),
    homework: clone(homework.value),
    displayConfig: clone(displayConfig.value),
    school: clone(school),
    externalLinks: clone(selectedExternalLinks.value)
  })

  const shareContentHash = () => JSON.stringify({
    lesson: {
      id: activeTask.value.id,
      date: activeTask.value.date,
      time: activeTask.value.time,
      lessonType: activeTask.value.lessonType,
      classId: activeTask.value.classId,
      courseId: activeTask.value.courseId
    },
    studentDeliveries: sessionStudents.value.map(({ shareReady, archived, ...row }) => row),
    materials: materials.value,
    homework: homework.value,
    displayConfig: Object.fromEntries(Object.entries(displayConfig.value).filter(([key]) => key !== 'publicStatus')),
    externalLinks: selectedExternalLinks.value
  })

  const saveShareDraft = (reason = '调整展示内容') => {
    const before = sharePage.value.status
    if (before === '草稿') {
      notify(`展示页已经是草稿状态（V${sharePage.value.draftVersion}），重复保存未新建版本`)
      return false
    }
    sharePage.value.status = '草稿'
    sharePage.value.draftVersion = Math.max(sharePage.value.draftVersion, sharePage.value.publishedVersion + 1)
    displayConfig.value.publicStatus = '草稿'
    persistSharePage(activeTask.value.id, sharePage.value)
    addStatusLog('家长展示页', activeTask.value.id, before, '草稿', reason)
    notify(`已保存为 V${sharePage.value.draftVersion} 草稿；家长仍可访问上一发布版本`)
    return true
  }

  const generateSharePages = async () => {
    const missing = attendingRows.value.filter((row) => !row.confirmed || !row.imageConfirmed)
    if (missing.length) {
      notify(`发布失败：还有 ${missing.length} 名学生的作品或课评未确认`)
      return false
    }
    const payload = shareDraftPayload()
    const payloadHash = shareContentHash()
    if (sharePage.value.publishedVersion && sharePage.value.lastPublishedHash === payloadHash) {
      const before = sharePage.value.status
      sharePage.value.status = '已发布'
      sharePage.value.draftVersion = sharePage.value.publishedVersion
      displayConfig.value.publicStatus = '已发布'
      persistSharePage(activeTask.value.id, sharePage.value)
      if (before !== '已发布') addStatusLog('家长展示页', activeTask.value.id, before, '已发布', '草稿内容与已发布版本一致，恢复原发布状态')
      notify(`重复发布已拦截：内容与 V${sharePage.value.publishedVersion} 一致，未生成重复链接或版本`)
      return false
    }
    await runAction('正在发布家长展示页和二维码...', '', async () => {
      const before = sharePage.value.status
      attendingRows.value.forEach((row) => { row.shareReady = true })
      sharePage.value.publishedVersion += 1
      sharePage.value.draftVersion = sharePage.value.publishedVersion
      sharePage.value.status = '已发布'
      sharePage.value.publishedSnapshot = payload
      sharePage.value.lastPublishedHash = payloadHash
      sharePage.value.publishedAt = nowText()
      sharePage.value.revokedAt = ''
      sharePage.value.revokedReason = ''
      persistSharePage(activeTask.value.id, sharePage.value)
      activeTask.value.shareGenerated = true
      displayConfig.value.publicStatus = '已发布'
      addStatusLog('家长展示页', activeTask.value.id, before, '已发布', `发布 V${sharePage.value.publishedVersion}`)
      pulsePreview()
    })
    notify(`家长展示页 V${sharePage.value.publishedVersion} 已发布，共 ${counts.value.attend} 个学生链接`)
    return true
  }

  const revokeSharePage = (reason) => {
    if (!isAdmin.value) {
      notify('操作未执行：只有管理员可以撤销家长展示页')
      return false
    }
    if (!reason?.trim()) {
      notify('请填写撤销原因')
      return false
    }
    if (sharePage.value.status === '已失效') {
      notify(`重复撤销已拦截：展示页已于 ${sharePage.value.revokedAt} 失效`)
      return false
    }
    const before = sharePage.value.status
    sharePage.value.status = '已失效'
    sharePage.value.revokedAt = nowText()
    sharePage.value.revokedReason = reason.trim()
    displayConfig.value.publicStatus = '已失效'
    persistSharePage(activeTask.value.id, sharePage.value)
    addStatusLog('家长展示页', activeTask.value.id, before, '已失效', reason.trim())
    notify('家长展示页已撤销，所有现有链接立即失效')
    return true
  }

  const getLessonWorkspace = (lessonId) => lessonWorkspaces[Number(lessonId)]
  const expectedShareToken = (route) => route.type === 'lesson'
    ? `lesson-demo-${route.lessonId}`
    : `student-demo-${route.lessonId}-${route.studentId}`
  const isShareAccessible = (route) => {
    const workspace = getLessonWorkspace(route.lessonId)
    return Boolean(
      workspace?.sharePage?.publishedSnapshot &&
      workspace.sharePage.status !== '已失效' &&
      route.token === expectedShareToken(route)
    )
  }

  const ensureWheatTrace = () => {
    const lesson = `${activeTask.value.date} ${activeTask.value.time} · ${activeClass.value.name}`
    const exists = wheatTraces.find((item) => item.lessonId === activeTask.value.id || item.lesson === lesson)
    if (exists) return exists
    const trace = {
      id: Date.now(),
      lessonId: activeTask.value.id,
      lesson,
      course: activeCourse.value.title,
      teacher: activeTask.value.teacher,
      type: activeTask.value.lessonType,
      status: '待处理',
      source: '课后归档生成',
      note: '请回到小麦助教人工标记课程完成状态'
    }
    wheatTraces.unshift(trace)
    return trace
  }

  const archiveAll = async () => {
    if (activeTask.value.status === '已完成' || activeTask.value.archived) {
      const trace = wheatTraces.find((item) => item.lessonId === activeTask.value.id)
      notify(`重复提交已拦截：归档和小麦待办均未重复生成${trace ? `（待办 #${trace.id}）` : ''}`)
      return false
    }
    if (activeTask.value.status === '异常') {
      notify('归档失败：请先恢复异常课次再完成交付')
      return false
    }
    if (activeTask.value.status !== '处理中') {
      notify(`归档失败：课次当前为“${activeTask.value.status}”，请先开始处理`)
      return false
    }
    if (currentWarnings.value.length) {
      notify(`归档失败：仍有 ${currentWarnings.value.length} 项完成门槛未通过`)
      return false
    }
    await runAction('正在保存档案并生成小麦留痕待办...', '本节课已归档，小麦留痕待办已生成', async () => {
      const before = activeTask.value.status
      attendingRows.value.forEach((row) => {
        if (row.shareReady) row.archived = true
      })
      const trace = ensureWheatTrace()
      activeTask.value.wheatStatus = trace.status
      activeTask.value.archived = true
      activeTask.value.archiveVersion = (activeTask.value.archiveVersion || 0) + 1
      activeTask.value.status = '已完成'
      addStatusLog('课次', activeTask.value.id, before, '已完成', '完成门槛校验通过，归档与小麦待办同次生成')
      showReport.value = true
      reportPulse.value = true
      setTimeout(() => {
        reportPulse.value = false
      }, 1200)
      if (!archives.some((item) => item.lessonId === activeTask.value.id)) {
        archives.unshift({
          id: Date.now() + 1,
          lessonId: activeTask.value.id,
          date: activeTask.value.date,
          className: activeClass.value.name,
          course: activeCourse.value.title,
          works: counts.value.attend,
          comments: counts.value.comments || counts.value.attend,
          highlights: counts.value.highlights,
          teacher: activeTask.value.teacher,
          wheatStatus: trace.status
        })
      }
      attendingRows.value.forEach((row) => {
        const student = students.find((item) => item.id === row.studentId)
        if (!student || archiveRecords.some((record) => record.lessonId === activeTask.value.id && record.studentId === row.studentId)) return
        archiveRecords.unshift({
          id: Date.now() + row.studentId,
          lessonId: activeTask.value.id,
          date: activeTask.value.date,
          time: activeTask.value.time,
          classId: activeClass.value.id,
          className: activeClass.value.name,
          teacher: activeTask.value.teacher,
          course: activeCourse.value.title,
          lessonType: activeTask.value.lessonType,
          studentId: row.studentId,
          studentName: student.name,
          artwork: row.image,
          feedback: row.comment,
          homework: homework.value.content,
          highlight: row.highlight,
          highlightNote: row.highlightNote,
          shareUrl: `https://share.xinghe-art.local/student-${activeTask.value.id}-${row.studentId}`,
          wheatStatus: trace.status
        })
      })
    })
    return true
  }

  const copyExport = async () => {
    await navigator.clipboard.writeText(exportText.value)
    copied.value = true
    notify('家长展示链接和文案已复制')
    setTimeout(() => {
      copied.value = false
    }, 1600)
  }

  const updateImage = (event, row, replaceIndex = null) => {
    const files = [...(event.target.files || [])]
    if (!files.length) return
    if (!Array.isArray(row.images)) row.images = row.image ? [row.image] : []
    const urls = files.map((file) => URL.createObjectURL(file))
    if (replaceIndex === null) row.images.push(...urls)
    else row.images.splice(replaceIndex, 1, urls[0])
    row.image = row.images[0] || ''
    row.originalImage = row.image
    row.imageMatched = row.images.length > 0
    row.imageConfirmed = row.imageMatched
    row.processed = false
    row.processedImage = ''
    row.imageProcessStatus = '未处理'
    row.imageProcessError = ''
    event.target.value = ''
    notify(`已为${students.find((item) => item.id === row.studentId)?.name || '学生'}上传 ${files.length} 张作品`)
  }

  const removeStudentImage = (row, index) => {
    if (!Array.isArray(row.images)) row.images = row.image ? [row.image] : []
    row.images.splice(index, 1)
    row.image = row.images[0] || ''
    row.originalImage = row.image
    row.imageMatched = row.images.length > 0
    row.imageConfirmed = row.imageMatched
    row.processed = false
    row.processedImage = ''
    row.imageProcessStatus = '未处理'
    row.imageProcessError = ''
    notify(row.imageMatched ? '已删除这张作品' : '该学生暂无作品，请重新上传')
  }

  const markTrace = (trace, status, reason = '') => {
    const before = trace.status
    if (before === status) {
      notify(`重复提交已拦截：该留痕已经是“${status}”`)
      return false
    }
    const isCorrection = ['已人工处理', '无需处理'].includes(before)
    if ((status === '异常' || status === '无需处理' || isCorrection) && !reason?.trim()) {
      notify(isCorrection ? '更正已完成状态必须填写更正原因' : '该状态变更必须填写说明')
      return false
    }
    if (isCorrection && !isAdmin.value) {
      notify('操作未执行：只有管理员可以更正已完成的留痕状态')
      return false
    }
    trace.status = status
    trace.note = reason?.trim() || (status === '已人工处理' ? '已在小麦助教人工处理完成' : trace.note)
    trace.lastReason = reason?.trim() || '人工确认已处理'
    trace.operator = currentUser.value?.name
    trace.processedAt = nowText()
    const lesson = `${activeTask.value.date} ${activeTask.value.time} · ${activeClass.value.name}`
    if (trace.lesson === lesson) activeTask.value.wheatStatus = status
    addStatusLog('小麦留痕', trace.id, before, status, trace.lastReason, '小麦留痕页', trace.lessonId || null)
    notify(`小麦留痕已标记为：${status}`)
    return true
  }

  const addLesson = (payload) => {
    const klass = classes.find((item) => item.id === Number(payload.classId))
    const course = courses.find((item) => item.id === Number(payload.courseId))
    const teacher = teachers.find((item) => item.id === Number(payload.teacherId))
    const lesson = {
      id: nextId(tasks),
      date: payload.date || '6月21日',
      time: payload.time || '17:40',
      classId: klass?.id || classes[0]?.id,
      courseId: course?.id || courses[0]?.id,
      teacher: teacher?.name || klass?.teacher || '待配置',
      lessonType: payload.lessonType || '收费课',
      status: payload.status || '待处理',
      wheatStatus: '未生成',
      importedFrom: payload.importedFrom || '手动补录',
      shareGenerated: false,
      archived: false
    }
    tasks.unshift(lesson)
    activeTaskId.value = lesson.id
    ensureLessonWorkspace(lesson)
    notify(`已补录课次：${klass?.name || '班级'} · ${course?.title || '课程'}`)
    return lesson
  }

  const addStudent = (payload) => {
    const student = {
      id: nextId(students),
      name: payload.name || '新学生',
      nickname: payload.nickname || payload.name || '新学生',
      age: Number(payload.age) || 6,
      parent: payload.parent || '待补充',
      phone: payload.phone || '',
      classId: Number(payload.classId) || classes[0]?.id,
      status: payload.status || '在读',
      note: payload.note || '',
      works: 0,
      highlights: 0
    }
    students.push(student)
    const klass = classes.find((item) => item.id === student.classId)
    if (klass && !klass.studentIds.includes(student.id)) klass.studentIds.push(student.id)
    notify(`已新增学生：${student.name}`)
    return student
  }

  const updateStudent = (id, payload) => {
    const student = students.find((item) => item.id === id)
    if (!student) return null
    const oldClassId = student.classId
    Object.assign(student, {
      ...payload,
      age: Number(payload.age) || student.age,
      classId: Number(payload.classId) || student.classId
    })
    if (oldClassId !== student.classId) {
      const oldClass = classes.find((item) => item.id === oldClassId)
      const nextClass = classes.find((item) => item.id === student.classId)
      if (oldClass) oldClass.studentIds = oldClass.studentIds.filter((studentId) => studentId !== student.id)
      if (nextClass && !nextClass.studentIds.includes(student.id)) nextClass.studentIds.push(student.id)
    }
    notify(`已保存学生：${student.name}`)
    return student
  }

  const addClass = (payload) => {
    const teacher = teachers.find((item) => item.id === Number(payload.teacherId))
    const klass = {
      id: nextId(classes),
      name: payload.name || '新班级',
      time: payload.time || '待排课',
      teacherId: Number(payload.teacherId) || teachers[0]?.id,
      teacher: teacher?.name || payload.teacher || '待配置',
      group: payload.group || '待创建家长群',
      status: payload.status || '筹备中',
      studentIds: payload.studentIds || [],
      courseId: Number(payload.courseId) || courses[0]?.id
    }
    classes.push(klass)
    notify(`已新增班级：${klass.name}`)
    return klass
  }

  const updateClass = (id, payload) => {
    const klass = classes.find((item) => item.id === id)
    if (!klass) return null
    const teacher = teachers.find((item) => item.id === Number(payload.teacherId))
    Object.assign(klass, {
      ...payload,
      teacherId: Number(payload.teacherId) || klass.teacherId,
      teacher: teacher?.name || klass.teacher,
      courseId: Number(payload.courseId) || klass.courseId,
      studentIds: payload.studentIds || klass.studentIds
    })
    students.forEach((student) => {
      if (klass.studentIds.includes(student.id)) student.classId = klass.id
    })
    notify(`已保存班级：${klass.name}`)
    return klass
  }

  const addCourse = (payload) => {
    const course = {
      id: nextId(courses),
      title: payload.title || '新课程主题',
      age: payload.age || '5-7岁',
      goal: payload.goal || '',
      materials: payload.materials || '',
      reference: payload.reference || '',
      defaultFocus: payload.defaultFocus || '色彩',
      commentTemplate: payload.commentTemplate || templates.comment[0]?.name,
      imageTemplate: payload.imageTemplate || templates.image[0]?.name,
      onlineLinks: payload.onlineLinks || []
    }
    courses.push(course)
    notify(`已新增课程：${course.title}`)
    return course
  }

  const updateCourse = (id, payload) => {
    const course = courses.find((item) => item.id === id)
    if (!course) return null
    Object.assign(course, payload)
    notify(`已保存课程：${course.title}`)
    return course
  }

  const addExternalLink = (payload) => {
    const link = {
      id: nextId(externalLinks),
      title: payload.title || '新外部课程',
      url: payload.url || 'https://example.com/course',
      platform: payload.platform || '通用链接',
      note: payload.note || '',
      courseIds: payload.courseIds || [],
      status: payload.status || '启用'
    }
    externalLinks.push(link)
    notify(`已新增外部课程链接：${link.title}`)
    return link
  }

  const updateExternalLink = (id, payload) => {
    const link = externalLinks.find((item) => item.id === id)
    if (!link) return null
    Object.assign(link, payload, { courseIds: payload.courseIds || [] })
    notify(`已保存外部课程链接：${link.title}`)
    return link
  }

  const addTeacher = (payload) => {
    const teacher = {
      id: nextId(teachers),
      name: payload.name || '新老师',
      phone: payload.phone || '',
      role: payload.role || '老师',
      status: payload.status || '启用',
      classes: []
    }
    teachers.push(teacher)
    notify(`已新增账号：${teacher.name}`)
    return teacher
  }

  const updateTeacher = (id, payload) => {
    const teacher = teachers.find((item) => item.id === id)
    if (!teacher) return null
    Object.assign(teacher, payload)
    notify(`已保存账号：${teacher.name}`)
    return teacher
  }

  const applyImportRows = () => {
    const rows = importPreviewRows.filter((row) => row.status === '可导入')
    rows.forEach((row) => {
      if (row.type === 'student') {
        const klass = classes.find((item) => item.name === row.className)
        addStudent({ name: row.name, nickname: row.nickname, parent: row.parent, phone: row.phone, classId: klass?.id, status: '在读' })
      }
      if (row.type === 'class') {
        const teacher = teachers.find((item) => item.name === row.teacher)
        const course = courses.find((item) => item.title === row.course)
        addClass({ name: row.name, teacherId: teacher?.id, time: row.time, courseId: course?.id, status: '筹备中' })
      }
    })
    importBatches.unshift({
      id: Date.now(),
      source: '导入预览确认',
      time: '6月21日 16:30',
      success: rows.length,
      failed: importPreviewRows.length - rows.length,
      note: '可导入记录已写入基础数据，异常记录保留待补录'
    })
    notify(`已导入 ${rows.length} 条基础数据`)
  }

  const updateSetting = (id, payload) => {
    const setting = settings.find((item) => item.id === id)
    if (!setting) return null
    Object.assign(setting, payload)
    if (setting.name === 'AI 接口') school.aiProvider = setting.value
    if (setting.name === '作品存储') school.objectStorage = setting.value
    if (setting.name === '水印配置') school.watermark = setting.value
    notify(`已保存配置：${setting.name}`)
    return setting
  }

  const addTemplate = (type, payload) => {
    const defaults = {
      image: { ratio: '4:5', brightness: '+10%', watermark: '右下角校区水印', border: '米白作品框', crop: '居中裁切', quality: '高清', status: '启用' },
      comment: { tone: '温暖自然', length: '60-80字', structure: '亮点、建议、鼓励', taboo: '不夸大、不排名', sample: '', status: '启用' },
      prompt: { model: '学生记录 + 课程参考 + 模板规则', scene: 'feedback', systemPrompt: '', userPrompt: '', temperature: 0.7, maxTokens: 220, status: '启用' },
      watermark: { value: school.watermark, position: '右下角', opacity: '80%', font: '授权字体', color: '#315d53', status: '启用' }
    }
    const template = { name: payload.name || '新模板', ...defaults[type], ...payload }
    templates[type].push(template)
    notify(`已新增模板：${template.name}`)
    return template
  }

  const updateTemplate = (type, index, payload) => {
    if (!templates[type]?.[index]) return null
    Object.assign(templates[type][index], payload)
    notify(`已保存模板：${templates[type][index].name}`)
    return templates[type][index]
  }

  const addExtraTask = (payload) => {
    const lesson = tasks.find((task) => task.id === Number(payload.relatedLessonId))
    const klass = lesson ? classes.find((item) => item.id === lesson.classId) : null
    const task = {
      id: nextId(extraTaskArchives),
      title: payload.title || '新课外任务',
      taskType: payload.taskType || '非课堂任务',
      owner: payload.owner || currentUser.value?.name || '待分配',
      relatedLessonId: payload.relatedLessonId ? Number(payload.relatedLessonId) : null,
      relatedLesson: lesson ? `${lesson.date} ${lesson.time} · ${klass?.name || '班级'}` : '无归属课次',
      content: payload.content || '',
      dueDate: payload.dueDate || '',
      status: payload.status || '待归档',
      note: payload.note || '一期仅归档查询，不计入绩效工资。'
    }
    extraTaskArchives.unshift(task)
    notify(`已新增课外任务：${task.title}`)
    return task
  }

  const updateExtraTask = (id, payload) => {
    const task = extraTaskArchives.find((item) => item.id === id)
    if (!task) return null
    const lesson = tasks.find((item) => item.id === Number(payload.relatedLessonId))
    const klass = lesson ? classes.find((item) => item.id === lesson.classId) : null
    Object.assign(task, payload, {
      relatedLessonId: payload.relatedLessonId ? Number(payload.relatedLessonId) : null,
      relatedLesson: lesson ? `${lesson.date} ${lesson.time} · ${klass?.name || '班级'}` : '无归属课次'
    })
    notify(`已保存课外任务：${task.title}`)
    return task
  }

  const nextStep = () => {
    if (currentStep.value < steps.value.length - 1) currentStep.value += 1
  }

  const prevStep = () => {
    if (currentStep.value > 0) currentStep.value -= 1
  }

  return {
    school,
    artworkLibrary,
    teachers,
    students,
    classes,
    courses,
    templates,
    tasks,
    lessonWorkspaces,
    activeWorkspace,
    sharePage,
    statusChangeLogs,
    lessonStatusLogs,
    sessionStudents,
    archives,
    archiveRecords,
    aiCallLogs,
    extraTaskArchives,
    archiveFilter,
    archiveDates,
    filteredArchiveRecords,
    materials,
    homework,
    displayConfig,
    externalLinks,
    wheatTraces,
    importBatches,
    importPreviewRows,
    settings,
    activeTaskId,
    activeStudentId,
    currentStep,
    selectedImageTemplate,
    selectedCommentTemplate,
    copied,
    isLoggedIn,
    currentUserId,
    loginForm,
    showReport,
    processingAction,
    toast,
    previewPulse,
    commentPulse,
    reportPulse,
    bulkRecord,
    activeShareMode,
    activeTask,
    currentUser,
    isAdmin,
    authorizedClassIds,
    visibleTasks,
    visibleNavItems,
    activeClass,
    activeCourse,
    activeSessionStudent,
    activeStudent,
    classStudents,
    attendingRows,
    activeImageTemplate,
    activeCommentTemplate,
    isProcessing,
    selectedExternalLinks,
    permissionSummary,
    studentHistoryFor,
    importStats,
    counts,
    steps,
    taskProgress,
    progressForTask,
    currentWarnings,
    parentShareUrl,
    qrText,
    exportText,
    fileNameFor,
    selectTask,
    transitionLesson,
    loginAs,
    loginWithForm,
    logout,
    setAttendance,
    toggleMaterialVisible,
    addMaterial,
    uploadLessonMaterial,
    useArtworkFromLibrary,
    saveMaterialToLibrary,
    addArtworkLibraryItem,
    chooseImageTemplate,
    chooseCommentTemplate,
    parseBulkRecord,
    simulateVoice,
    matchImages,
    confirmImages,
    processImages,
    failCurrentImageProcess,
    retryCurrentImageProcess,
    generateOne,
    generateAll,
    confirmAll,
    toggleHighlight,
    toggleHomeworkLink,
    saveShareDraft,
    generateSharePages,
    revokeSharePage,
    getLessonWorkspace,
    isShareAccessible,
    archiveAll,
    copyExport,
    updateImage,
    removeStudentImage,
    markTrace,
    addLesson,
    addStudent,
    updateStudent,
    addClass,
    updateClass,
    addCourse,
    updateCourse,
    addExternalLink,
    updateExternalLink,
    addTeacher,
    updateTeacher,
    applyImportRows,
    updateSetting,
    addTemplate,
    updateTemplate,
    addExtraTask,
    updateExtraTask,
    nextStep,
    prevStep,
    notify,
    pulseComment
  }
}
