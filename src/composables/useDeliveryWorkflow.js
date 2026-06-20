import { computed, reactive, ref } from 'vue'
import {
  archives as archiveSeed,
  channels as channelSeed,
  classes as classSeed,
  courses as courseSeed,
  initialBulkRecord,
  initialSessionStudents,
  school as schoolSeed,
  sessionSeed,
  students as studentSeed,
  tasks as taskSeed,
  templates as templateSeed
} from '../data/mockData'

const clone = (value) => JSON.parse(JSON.stringify(value))
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function useDeliveryWorkflow() {
  const school = reactive(clone(schoolSeed))
  const students = reactive(clone(studentSeed))
  const classes = reactive(clone(classSeed))
  const courses = reactive(clone(courseSeed))
  const templates = reactive(clone(templateSeed))
  const channels = reactive(clone(channelSeed))
  const tasks = reactive(clone(taskSeed))
  const sessionStudents = reactive(clone(initialSessionStudents))
  const archives = reactive(clone(archiveSeed))

  const activeTaskId = ref(1)
  const activeStudentId = ref(1)
  const currentStep = ref(0)
  const selectedImageTemplate = ref(0)
  const selectedCommentTemplate = ref(0)
  const copied = ref(false)
  const showReport = ref(false)
  const processingAction = ref('')
  const toast = ref('')
  const previewPulse = ref(false)
  const commentPulse = ref(false)
  const reportPulse = ref(false)
  const bulkRecord = ref(initialBulkRecord)

  const activeTask = computed(() => tasks.find((task) => task.id === activeTaskId.value))
  const activeClass = computed(() => classes.find((item) => item.id === activeTask.value.classId))
  const activeCourse = computed(() => courses.find((item) => item.id === activeTask.value.courseId))
  const activeSessionStudent = computed(() => sessionStudents.find((item) => item.id === activeStudentId.value))
  const activeStudent = computed(() => students.find((item) => item.id === activeStudentId.value))
  const classStudents = computed(() => activeClass.value.studentIds.map((id) => students.find((item) => item.id === id)).filter(Boolean))
  const attendingRows = computed(() => sessionStudents.filter((item) => item.attendance === '到课'))
  const activeImageTemplate = computed(() => templates.image[selectedImageTemplate.value])
  const activeCommentTemplate = computed(() => templates.comment[selectedCommentTemplate.value])
  const isProcessing = computed(() => Boolean(processingAction.value))

  const counts = computed(() => ({
    total: classStudents.value.length,
    attend: sessionStudents.filter((item) => item.attendance === '到课').length,
    matched: sessionStudents.filter((item) => item.attendance === '到课' && item.imageMatched).length,
    records: sessionStudents.filter((item) => item.attendance === '到课' && item.record).length,
    processed: sessionStudents.filter((item) => item.attendance === '到课' && item.processed).length,
    comments: sessionStudents.filter((item) => item.attendance === '到课' && item.comment).length,
    confirmed: sessionStudents.filter((item) => item.attendance === '到课' && item.confirmed).length,
    archived: sessionStudents.filter((item) => item.attendance === '到课' && item.archived).length
  }))

  const steps = computed(() => [
    { title: '课次确认', hint: '从课表带出班级、课程和学生', done: counts.value.attend, total: counts.value.total },
    { title: '作品匹配', hint: '批量上传并匹配学生作品', done: counts.value.matched, total: counts.value.attend },
    { title: '课堂记录', hint: '语音、粘贴或逐个录入', done: counts.value.records, total: counts.value.attend },
    { title: '图文生成', hint: '批处理图片并生成课评', done: Math.min(counts.value.processed, counts.value.comments), total: counts.value.attend },
    { title: '审核分发', hint: '检查异常，推送群聊并归档', done: counts.value.archived, total: counts.value.attend }
  ])

  const taskProgress = computed(() => {
    const total = counts.value.attend * 5
    const done =
      counts.value.attend +
      counts.value.matched +
      counts.value.records +
      counts.value.processed +
      counts.value.archived
    return total ? Math.round((done / total) * 100) : 0
  })

  const currentWarnings = computed(() => {
    const warnings = []
    sessionStudents.forEach((row) => {
      const student = students.find((item) => item.id === row.id)
      if (row.attendance !== '到课') return
      if (!row.imageMatched) warnings.push(`${student.name}缺作品`)
      if (!row.record) warnings.push(`${student.name}缺课堂记录`)
      if (!row.comment) warnings.push(`${student.name}缺课评`)
      if (row.comment && !row.confirmed) warnings.push(`${student.name}课评待确认`)
    })
    return warnings
  })

  const fileNameFor = (row) => {
    const student = students.find((item) => item.id === row.id)
    return `${activeTask.value.date}-${activeClass.value.name}-${student.name}-${activeCourse.value.title}.jpg`
  }

  const exportText = computed(() =>
    attendingRows.value
      .map((row, index) => {
        const student = students.find((item) => item.id === row.id)
        return `${index + 1}. ${student.name}\n作品文件：${fileNameFor(row)}\n课评：${row.comment || '待生成'}`
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
    await wait(520)
    await action()
    await wait(260)
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

  const selectTask = (task) => {
    activeTaskId.value = task.id
    const targetClass = classes.find((item) => item.id === task.classId)
    const rows = targetClass.studentIds.map((studentId) => {
      const seed = sessionSeed[studentId]
      const student = students.find((item) => item.id === studentId)
      const isAbsent = student.status === '请假'
      return {
        id: studentId,
        attendance: isAbsent ? '请假' : '到课',
        image: seed.image,
        imageMatched: !isAbsent,
        processed: task.imagesProcessed && !isAbsent,
        record: isAbsent ? '' : seed.record,
        focus: seed.focus,
        comment: '',
        confirmed: false,
        delivered: false,
        archived: false
      }
    })
    sessionStudents.splice(0, sessionStudents.length, ...rows)
    activeStudentId.value = rows[0]?.id || 1
    currentStep.value = 0
    showReport.value = false
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
    activeTask.value.recordsImported = true
  }

  const simulateVoice = async () => {
    await runAction('正在识别课堂语音...', '已识别并匹配 3 条课堂记录', async () => {
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

  const processImages = async () => {
    await runAction('正在套用图片模板...', `已按“${activeImageTemplate.value.name}”处理 ${counts.value.matched} 张作品`, async () => {
      sessionStudents.forEach((row) => {
        if (row.attendance === '到课' && row.imageMatched) row.processed = true
      })
      activeTask.value.imagesProcessed = true
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
    row.comment = `${student.nickname}今天表现很棒，${complimentMap[row.focus] || complimentMap.色彩}。从作品里能看到他认真跟着课堂节奏推进，也保留了自己的表达。${suggestionMap[row.focus] || suggestionMap.色彩}。继续保持这份专注和大胆，下节课会更有进步。`
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
      await wait(420)
      generateOne(row)
      activeStudentId.value = row.id
      pulseComment()
    }
    activeTask.value.commentsGenerated = true
    await wait(240)
    processingAction.value = ''
    notify(`已按“${activeCommentTemplate.value.name}”生成 ${counts.value.comments} 条课评`)
  }

  const confirmAll = () => {
    attendingRows.value.forEach((row) => {
      if (row.comment) row.confirmed = true
    })
    notify('已确认全部课评，发送前检查通过')
  }

  const archiveAll = async () => {
    await runAction('正在推送企业微信并归档...', '本节课已分发并归档到系统作品库', async () => {
      attendingRows.value.forEach((row) => {
        row.delivered = true
        row.archived = true
        row.confirmed = true
      })
      activeTask.value.distributed = true
      activeTask.value.archived = true
      activeTask.value.status = '已完成'
      showReport.value = true
      reportPulse.value = true
      setTimeout(() => {
        reportPulse.value = false
      }, 1200)
      if (!archives.some((item) => item.date === activeTask.value.date && item.course === activeCourse.value.title)) {
        archives.unshift({
          id: Date.now(),
          date: activeTask.value.date,
          className: activeClass.value.name,
          course: activeCourse.value.title,
          works: counts.value.attend,
          comments: counts.value.comments || counts.value.attend,
          teacher: activeTask.value.teacher
        })
      }
    })
  }

  const copyExport = async () => {
    await navigator.clipboard.writeText(exportText.value)
    copied.value = true
    notify('家长群文案已复制')
    setTimeout(() => {
      copied.value = false
    }, 1600)
  }

  const updateImage = (event, row) => {
    const file = event.target.files?.[0]
    if (!file) return
    row.image = URL.createObjectURL(file)
    row.imageMatched = true
    row.processed = false
  }

  const nextStep = () => {
    if (currentStep.value < steps.value.length - 1) currentStep.value += 1
  }

  const prevStep = () => {
    if (currentStep.value > 0) currentStep.value -= 1
  }

  return {
    school,
    students,
    classes,
    courses,
    templates,
    channels,
    tasks,
    sessionStudents,
    archives,
    activeTaskId,
    activeStudentId,
    currentStep,
    selectedImageTemplate,
    selectedCommentTemplate,
    copied,
    showReport,
    processingAction,
    toast,
    previewPulse,
    commentPulse,
    reportPulse,
    bulkRecord,
    activeTask,
    activeClass,
    activeCourse,
    activeSessionStudent,
    activeStudent,
    classStudents,
    attendingRows,
    activeImageTemplate,
    activeCommentTemplate,
    isProcessing,
    counts,
    steps,
    taskProgress,
    currentWarnings,
    exportText,
    fileNameFor,
    chooseImageTemplate,
    chooseCommentTemplate,
    selectTask,
    parseBulkRecord,
    simulateVoice,
    matchImages,
    processImages,
    generateOne,
    generateAll,
    confirmAll,
    archiveAll,
    copyExport,
    updateImage,
    nextStep,
    prevStep,
    notify,
    pulseComment
  }
}
