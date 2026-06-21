import { computed, reactive, ref } from 'vue'
import {
  archives as archiveSeed,
  archiveRecords as archiveRecordSeed,
  aiCallLogs as aiCallLogSeed,
  classes as classSeed,
  courses as courseSeed,
  displayConfigSeed,
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
  const teachers = reactive(clone(teacherSeed))
  const students = reactive(clone(studentSeed))
  const classes = reactive(clone(classSeed))
  const courses = reactive(clone(courseSeed))
  const templates = reactive(clone(templateSeed))
  const tasks = reactive(clone(taskSeed))
  const sessionStudents = reactive(clone(initialSessionStudents))
  const archives = reactive(clone(archiveSeed))
  const archiveRecords = reactive(clone(archiveRecordSeed))
  const aiCallLogs = reactive(clone(aiCallLogSeed))
  const materials = reactive(clone(lessonMaterialSeed))
  const homework = reactive(clone(homeworkSeed))
  const displayConfig = reactive(clone(displayConfigSeed))
  const externalLinks = reactive(clone(externalLinkSeed))
  const wheatTraces = reactive(clone(wheatTraceSeed))
  const importBatches = reactive(clone(importBatchSeed))
  const importPreviewRows = reactive(clone(importPreviewSeed))
  const settings = reactive(clone(settingSeed))

  const activeTaskId = ref(1)
  const activeStudentId = ref(1)
  const currentStep = ref(0)
  const selectedImageTemplate = ref(0)
  const selectedCommentTemplate = ref(0)
  const copied = ref(false)
  const isLoggedIn = ref(false)
  const currentUserId = ref(1)
  const loginForm = reactive({ phone: '137****9011', role: '老师' })
  const showReport = ref(false)
  const processingAction = ref('')
  const toast = ref('')
  const previewPulse = ref(false)
  const commentPulse = ref(false)
  const reportPulse = ref(false)
  const bulkRecord = ref(initialBulkRecord)
  const activeShareMode = ref('student')

  const currentUser = computed(() => teachers.find((teacher) => teacher.id === currentUserId.value))
  const isAdmin = computed(() => currentUser.value?.role === '管理员')
  const authorizedClassIds = computed(() => (isAdmin.value ? classes.map((klass) => klass.id) : currentUser.value?.classes || []))
  const visibleTasks = computed(() =>
    tasks.filter((task) => isAdmin.value || authorizedClassIds.value.includes(task.classId) || task.teacher === currentUser.value?.name)
  )
  const visibleNavItems = computed(() => {
    const adminOnly = ['settings']
    return isAdmin.value ? [] : adminOnly
  })
  const activeTask = computed(() => visibleTasks.value.find((task) => task.id === activeTaskId.value) || visibleTasks.value[0] || tasks[0])
  const activeClass = computed(() => classes.find((item) => item.id === activeTask.value.classId))
  const activeCourse = computed(() => courses.find((item) => item.id === activeTask.value.courseId))
  const activeSessionStudent = computed(() => sessionStudents.find((item) => item.id === activeStudentId.value))
  const activeStudent = computed(() => students.find((item) => item.id === activeStudentId.value))
  const classStudents = computed(() => activeClass.value.studentIds.map((id) => students.find((item) => item.id === id)).filter(Boolean))
  const attendingRows = computed(() => sessionStudents.filter((item) => item.attendance === '到课'))
  const activeImageTemplate = computed(() => templates.image[selectedImageTemplate.value])
  const activeCommentTemplate = computed(() => templates.comment[selectedCommentTemplate.value])
  const isProcessing = computed(() => Boolean(processingAction.value))
  const selectedExternalLinks = computed(() => externalLinks.filter((link) => homework.externalLinkIds.includes(link.id)))
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
    attend: sessionStudents.filter((item) => item.attendance === '到课').length,
    matched: sessionStudents.filter((item) => item.attendance === '到课' && item.imageMatched).length,
    imageConfirmed: sessionStudents.filter((item) => item.attendance === '到课' && item.imageConfirmed).length,
    records: sessionStudents.filter((item) => item.attendance === '到课' && item.record).length,
    processed: sessionStudents.filter((item) => item.attendance === '到课' && item.processed).length,
    comments: sessionStudents.filter((item) => item.attendance === '到课' && item.comment).length,
    confirmed: sessionStudents.filter((item) => item.attendance === '到课' && item.confirmed).length,
    highlights: sessionStudents.filter((item) => item.attendance === '到课' && item.highlight).length,
    shareReady: sessionStudents.filter((item) => item.attendance === '到课' && item.shareReady).length,
    archived: sessionStudents.filter((item) => item.attendance === '到课' && item.archived).length,
    visibleMaterials: materials.filter((item) => item.visible).length
  }))

  const steps = computed(() => [
    { title: '课次确认', hint: '确认课次类型、范画和出勤', done: counts.value.attend && counts.value.visibleMaterials ? 1 : 0, total: 1 },
    { title: '作品匹配', hint: '按学生上传作品并确认图片', done: Math.min(counts.value.matched, counts.value.imageConfirmed), total: counts.value.attend },
    { title: '课堂记录', hint: '批量解析或逐个录入关键词', done: counts.value.records, total: counts.value.attend },
    { title: '图文生成', hint: '图片处理、AI 课评和人工确认', done: Math.min(counts.value.processed, counts.value.confirmed), total: counts.value.attend },
    { title: '家长展示', hint: '任务、高光、展示页和二维码', done: counts.value.shareReady, total: counts.value.attend },
    { title: '归档留痕', hint: '保存档案并生成小麦待办', done: counts.value.archived, total: counts.value.attend }
  ])

  const taskProgress = computed(() => {
    const total = counts.value.attend * 6 || 1
    const done =
      counts.value.attend +
      Math.min(counts.value.matched, counts.value.imageConfirmed) +
      counts.value.records +
      Math.min(counts.value.processed, counts.value.confirmed) +
      counts.value.shareReady +
      counts.value.archived
    return Math.min(100, Math.round((done / total) * 100))
  })

  const progressForTask = (task) => {
    if (task.id === activeTaskId.value) return taskProgress.value
    if (task.status === '已完成') return 100
    if (task.status === '处理中') return 28
    return 0
  }

  const currentWarnings = computed(() => {
    const warnings = []
    if (!materials.some((item) => item.visible)) warnings.push('缺少可展示的范画或步骤图')
    if (homework.visible && !homework.content.trim()) warnings.push('课后任务内容为空')
    attendingRows.value.forEach((row) => {
      const student = students.find((item) => item.id === row.id)
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
    const suffix = activeShareMode.value === 'class' ? `class-${activeTask.value.id}` : `student-${activeTask.value.id}-${activeStudentId.value}`
    return `https://share.xinghe-art.local/${suffix}`
  })

  const qrText = computed(() => `QR · ${activeShareMode.value === 'class' ? activeClass.value.name : activeStudent.value?.name || ''}`)

  const fileNameFor = (row) => {
    const student = students.find((item) => item.id === row.id)
    return `${activeTask.value.date}-${activeClass.value.name}-${student.name}-${activeCourse.value.title}.jpg`
  }

  const exportText = computed(() =>
    attendingRows.value
      .map((row, index) => {
        const student = students.find((item) => item.id === row.id)
        const link = `https://share.xinghe-art.local/student-${activeTask.value.id}-${row.id}`
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

  const resetSessionForTask = (task) => {
    const targetClass = classes.find((item) => item.id === task.classId)
    const rows = targetClass.studentIds.map((studentId) => {
      const seed = sessionSeed[studentId]
      const student = students.find((item) => item.id === studentId)
      const isAbsent = student.status === '请假'
      return {
        id: studentId,
        attendance: isAbsent ? '请假' : '到课',
        originalImage: seed.image,
        processedImage: '',
        imageProcessStatus: '未处理',
        imageProcessError: '',
        image: seed.image,
        imageMatched: !isAbsent,
        processed: false,
        imageConfirmed: false,
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
    sessionStudents.splice(0, sessionStudents.length, ...rows)
    activeStudentId.value = rows.find((row) => row.attendance === '到课')?.id || rows[0]?.id || 1
    currentStep.value = 0
    showReport.value = false
    activeShareMode.value = 'student'
  }

  const selectTask = (task) => {
    if (!isAdmin.value && !authorizedClassIds.value.includes(task.classId) && task.teacher !== currentUser.value?.name) {
      notify('无权限查看该课次，请联系管理员授权班级')
      return
    }
    activeTaskId.value = task.id
    resetSessionForTask(task)
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
    } else if (!row.image) {
      row.image = sessionSeed[row.id].image
    }
  }

  const toggleMaterialVisible = (material) => {
    material.visible = !material.visible
    notify(`${material.title}${material.visible ? '会展示给家长' : '已隐藏'}`)
  }

  const addMaterial = () => {
    materials.push({
      id: Date.now(),
      type: '步骤图',
      title: `新增步骤图 ${materials.length + 1}`,
      image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=720&q=80',
      visible: true
    })
    notify('已补充一张步骤图')
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
        const row = student ? sessionStudents.find((item) => item.id === student.id) : null
        if (row && rest.length) row.record = rest.join('：').trim()
      })
    notify('课堂记录已匹配到学生')
  }

  const simulateVoice = async () => {
    await runAction('正在识别课堂语音...', '已识别并匹配课堂记录', async () => {
      bulkRecord.value =
        '彤彤：今天向日葵颜色很大胆，叶子比上次更舒展，背景留白再注意\n浩浩：恐龙世界很有故事感，涂色均匀很多，爪子细节可以更细\n安安：海底世界构图完整，小鱼排列有节奏，水草层次可以再丰富'
      parseBulkRecord()
    })
  }

  const matchImages = async () => {
    await runAction('正在匹配作品图片...', `已匹配 ${counts.value.attend} 张作品`, async () => {
      sessionStudents.forEach((row) => {
        if (row.attendance === '到课') row.imageMatched = true
      })
    })
  }

  const addAiLog = (type, target, status, message, retry = 0) => {
    aiCallLogs.unshift({
      id: Date.now() + aiCallLogs.length,
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
      sessionStudents.forEach((row) => {
        if (row.attendance === '到课' && row.imageMatched) {
          const student = students.find((item) => item.id === row.id)
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
    const student = students.find((item) => item.id === row.id)
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
    row.comment = `${student.nickname}今天表现很棒，${complimentMap[row.focus] || complimentMap.色彩}。本节课围绕“${activeCourse.value.title}”完成练习，能看到他认真跟着课堂节奏推进，也保留了自己的表达。${suggestionMap[row.focus] || suggestionMap.色彩}。继续保持这份专注和大胆。`
    if (activeCommentTemplate.value.name === '低龄鼓励版') {
      row.comment = `${student.nickname}今天特别投入，${complimentMap[row.focus] || complimentMap.色彩}。老师能看到他一直在认真完成自己的小作品，也很愿意大胆尝试。下次我们继续鼓励他把喜欢的细节画得更多一些，相信会越来越棒。`
    }
    if (activeCommentTemplate.value.name === '专业简洁版') {
      row.comment = `${student.nickname}本节课能围绕“${activeCourse.value.title}”完成主体表达，${complimentMap[row.focus] || complimentMap.色彩}。下一步建议继续关注画面层次和细节完整度，让作品呈现更稳定。整体完成度不错，课堂专注度也值得肯定。`
    }
  }

  const generateAll = async () => {
    processingAction.value = '正在生成全班 1v1 课评...'
    for (const row of attendingRows.value) {
      await wait(260)
      generateOne(row)
      activeStudentId.value = row.id
      addAiLog('课评生成', students.find((item) => item.id === row.id)?.name || '学生', '成功', '生成 1v1 课评，等待老师确认')
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
    const index = homework.externalLinkIds.indexOf(id)
    if (index >= 0) homework.externalLinkIds.splice(index, 1)
    else homework.externalLinkIds.push(id)
  }

  const generateSharePages = async () => {
    await runAction('正在生成家长展示页和二维码...', `已生成 ${counts.value.attend} 个学生展示页`, async () => {
      attendingRows.value.forEach((row) => {
        if (row.confirmed && row.imageConfirmed) row.shareReady = true
      })
      activeTask.value.shareGenerated = true
      pulsePreview()
    })
  }

  const ensureWheatTrace = () => {
    const lesson = `${activeTask.value.date} ${activeTask.value.time} · ${activeClass.value.name}`
    const exists = wheatTraces.find((item) => item.lesson === lesson)
    if (exists) return exists
    const trace = {
      id: Date.now(),
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
    await runAction('正在保存档案并生成小麦留痕待办...', '本节课已归档，小麦留痕待办已生成', async () => {
      attendingRows.value.forEach((row) => {
        if (row.shareReady) row.archived = true
      })
      const trace = ensureWheatTrace()
      activeTask.value.wheatStatus = trace.status
      activeTask.value.archived = true
      activeTask.value.status = '已完成'
      showReport.value = true
      reportPulse.value = true
      setTimeout(() => {
        reportPulse.value = false
      }, 1200)
      if (!archives.some((item) => item.date === activeTask.value.date && item.course === activeCourse.value.title)) {
        archives.unshift({
          id: Date.now() + 1,
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
        const student = students.find((item) => item.id === row.id)
        if (!student || archiveRecords.some((record) => record.date === activeTask.value.date && record.studentId === row.id && record.course === activeCourse.value.title)) return
        archiveRecords.unshift({
          id: Date.now() + row.id,
          date: activeTask.value.date,
          time: activeTask.value.time,
          classId: activeClass.value.id,
          className: activeClass.value.name,
          teacher: activeTask.value.teacher,
          course: activeCourse.value.title,
          lessonType: activeTask.value.lessonType,
          studentId: row.id,
          studentName: student.name,
          artwork: row.image,
          feedback: row.comment,
          homework: homework.content,
          highlight: row.highlight,
          highlightNote: row.highlightNote,
          shareUrl: `https://share.xinghe-art.local/student-${activeTask.value.id}-${row.id}`,
          wheatStatus: trace.status
        })
      })
    })
  }

  const copyExport = async () => {
    await navigator.clipboard.writeText(exportText.value)
    copied.value = true
    notify('家长展示链接和文案已复制')
    setTimeout(() => {
      copied.value = false
    }, 1600)
  }

  const updateImage = (event, row) => {
    const file = event.target.files?.[0]
    if (!file) return
    row.image = URL.createObjectURL(file)
    row.imageMatched = true
    row.imageConfirmed = false
    row.processed = false
  }

  const markTrace = (trace, status) => {
    trace.status = status
    if (status === '已人工处理') trace.note = '已在小麦助教人工处理完成'
    if (status === '无需处理') trace.note = '本课次无需回小麦处理'
    const lesson = `${activeTask.value.date} ${activeTask.value.time} · ${activeClass.value.name}`
    if (trace.lesson === lesson) activeTask.value.wheatStatus = status
    notify(`小麦留痕已标记为：${status}`)
  }

  const nextId = (collection) => Math.max(0, ...collection.map((item) => item.id || 0)) + 1

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

  const nextStep = () => {
    if (currentStep.value < steps.value.length - 1) currentStep.value += 1
  }

  const prevStep = () => {
    if (currentStep.value > 0) currentStep.value -= 1
  }

  return {
    school,
    teachers,
    students,
    classes,
    courses,
    templates,
    tasks,
    sessionStudents,
    archives,
    archiveRecords,
    aiCallLogs,
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
    loginAs,
    loginWithForm,
    logout,
    setAttendance,
    toggleMaterialVisible,
    addMaterial,
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
    generateSharePages,
    archiveAll,
    copyExport,
    updateImage,
    markTrace,
    addStudent,
    updateStudent,
    addClass,
    updateClass,
    addCourse,
    updateCourse,
    addTeacher,
    updateTeacher,
    applyImportRows,
    updateSetting,
    nextStep,
    prevStep,
    notify,
    pulseComment
  }
}
