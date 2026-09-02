<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import TaskReport from './TaskReport.vue'
import DeliveryPreview from './DeliveryPreview.vue'
import StudentDeliveryBoard from './StudentDeliveryBoard.vue'
import TeacherEffectPreview from './TeacherEffectPreview.vue'
import ProtectedMedia from '../common/ProtectedMedia.vue'
import { sameId } from '../../services/mappers'
import { MATERIAL_CATEGORIES } from '../../services/materialTypes'

const props = defineProps({
  state: {
    type: Object,
    required: true
  }
})

defineEmits(['navigate', 'back'])

const showResourceDrawer = ref(false)
const showContentSettings = ref(false)
const materialReplaceInput = ref(null)
const replaceTarget = ref(null)
const showSharePreview = ref(false)
const showTeacherEffectDrawer = ref(false)
const teacherEffectPreviewRef = ref(null)
const teacherEffectPreviewState = ref({ status: 'idle', error: '', width: 0, height: 0 })
const teacherEffectSubmitting = ref(false)
const studentDeliveryDrawerOpen = ref(false)
const studentDeliveryMobileDetailOpen = ref(false)
const resourceSearch = ref('')
const resourceFilter = ref('全部')
const resourceLoading = ref(false)
const homeworkEditorOpen = ref(false)
const homeworkEditorField = ref('content')
const homeworkEditorDraft = ref('')
const homeworkEditorTextarea = ref(null)
const homeworkDateInput = ref(null)
const teacherEffectDraft = reactive({
  title: '',
  width: 1080,
  imageGap: 24,
  sourceAssetIds: []
})
const homeworkOptionalFieldEnabled = reactive({ requirement: false, dueDate: false })
const homeworkOptionalFieldLabels = {
  requirement: '完成方式',
  dueDate: '回收日期'
}
const attendanceOptions = ['到课', '请假', '旷课']
const homeworkExamples = [
  {
    label: '观察记录',
    content: '回家观察一种暖色系物品，说一说它的颜色和形状。',
    requirement: '可拍 1 张观察照片，下节课前发给老师。'
  },
  {
    label: '亲子延伸',
    content: '和家长一起完成一幅小练习，尝试使用本节课学到的构图方法。',
    requirement: '完成后拍照上传或带到下节课。'
  },
  {
    label: '材料准备',
    content: '准备下节课需要的彩纸、勾线笔和油画棒，放入自己的材料袋。',
    requirement: '下节课上课前检查材料是否齐全。'
  }
]
const applyHomeworkExample = (example) => {
  props.state.applyHomeworkExample(example)
  homeworkOptionalFieldEnabled.requirement = Boolean(String(example?.requirement || '').trim())
}
const homeworkEditorTitle = computed(() => homeworkEditorField.value === 'content' ? '编辑任务内容' : '编辑完成方式 / 家长配合')
const homeworkEditorPlaceholder = computed(() => homeworkEditorField.value === 'content'
  ? '例如：回家观察一种暖色系物品，说一说它的颜色和形状。'
  : '例如：拍 1 张照片，下节课前发给老师。')
const openHomeworkEditor = (field) => {
  homeworkEditorField.value = field
  homeworkEditorDraft.value = String(props.state.homework?.[field] || '')
  homeworkEditorOpen.value = true
}
const closeHomeworkEditor = () => {
  homeworkEditorOpen.value = false
}
const saveHomeworkEditor = () => {
  const field = homeworkEditorField.value
  const value = homeworkEditorDraft.value.trim()
  props.state.homework[field] = value
  if (field === 'requirement' && !value) homeworkOptionalFieldEnabled.requirement = false
  closeHomeworkEditor()
}
const toggleHomeworkOptionalField = (field, enabled, event) => {
  if (enabled) {
    homeworkOptionalFieldEnabled[field] = true
    return
  }

  const currentValue = String(props.state.homework?.[field] || '').trim()
  if (currentValue && typeof window !== 'undefined' && !window.confirm(`关闭“${homeworkOptionalFieldLabels[field]}”后将清空当前内容，是否继续？`)) {
    if (event?.target) event.target.checked = true
    return
  }

  homeworkOptionalFieldEnabled[field] = false
  props.state.homework[field] = ''
}
const saveHomeworkDraft = () => {
  if (!String(props.state.homework?.requirement || '').trim()) homeworkOptionalFieldEnabled.requirement = false
  if (!String(props.state.homework?.dueDate || '').trim()) homeworkOptionalFieldEnabled.dueDate = false
  props.state.saveShareDraft('保存课后任务配置')
}
const openHomeworkDatePicker = () => {
  const input = homeworkDateInput.value
  if (!input) return
  input.focus({ preventScroll: true })
  if (typeof input.showPicker === 'function') {
    try {
      input.showPicker()
    } catch {
      // Native date controls may already be open or may reject programmatic opening.
    }
  }
}
const resolveStateValue = (value) => value?.value ?? value
const materialSections = computed(() => {
  const materials = resolveStateValue(props.state.materials) || []
  return [
    {
      key: 'demo',
      title: '范画',
      description: '本节课的示范作品',
      category: MATERIAL_CATEGORIES.DEMO,
      uploadLabel: '上传范画',
      accept: 'image/*',
      empty: '尚未上传范画',
      kind: 'image',
      materials: materials.filter((item) => item.type === '范画')
    },
    {
      key: 'step',
      title: '步骤图',
      description: '本节课的绘画步骤',
      category: MATERIAL_CATEGORIES.STEP,
      uploadLabel: '上传步骤图',
      accept: 'image/*',
      empty: '尚未上传步骤图',
      kind: 'image',
      materials: materials.filter((item) => item.type === '步骤图')
    },
    {
      key: 'classroom',
      title: '课堂记录',
      description: '课堂照片和课堂视频',
      category: MATERIAL_CATEGORIES.CLASSROOM,
      uploadLabel: '添加课堂记录',
      accept: 'image/*,video/*',
      empty: '尚未添加课堂记录',
      kind: 'media',
      materials: materials.filter((item) => ['课堂照片', '课堂视频'].includes(item.type))
    },
    {
      key: 'courseware',
      title: '课件',
      description: '仅内部归档，供后续复用',
      category: MATERIAL_CATEGORIES.COURSEWARE,
      uploadLabel: '上传课件',
      accept: '',
      empty: '尚未上传课件',
      kind: 'file',
      materials: materials.filter((item) => item.type === '课件')
    }
  ]
})
const activeMaterialSectionKey = ref('demo')
const activeMaterialSection = computed(() => materialSections.value.find((section) => section.key === activeMaterialSectionKey.value) || materialSections.value[0] || null)
const classroomMaterialSection = computed(() => materialSections.value.find((section) => section.key === 'classroom'))
const classroomMaterialCount = computed(() => classroomMaterialSection.value?.materials.length || 0)
const preparationMemory = computed(() => resolveStateValue(props.state.activeWorkspace?.preparationMemory) || {})
const preparationMemorySource = computed(() => preparationMemory.value.memorySource || preparationMemory.value.source || 'NONE')
const preparationMemoryScopeLabel = computed(() => preparationMemorySource.value === 'CLASS_MEMORY' ? '本班同课程' : '本主题')
const preparationMemoryNextLessonLabel = computed(() => preparationMemorySource.value === 'CLASS_MEMORY' ? '同班同课程课次' : '同主题课次')
const preparationMemoryNoticeTitle = computed(() => {
  if (preparationMemory.value.autoApplied) {
    return preparationMemory.value.covered
      ? '本课已调整，并已更新' + preparationMemoryScopeLabel.value + '默认材料'
      : '已自动带入' + preparationMemoryScopeLabel.value + '上次使用的材料'
  }
  return preparationMemoryScopeLabel.value + '默认材料已记住'
})
const preparationMemorySummary = computed(() => {
  const counts = preparationMemory.value.counts || {}
  const parts = [
    ['DEMO_IMAGE', '范画'],
    ['STEP_IMAGE', '步骤图'],
    ['COURSEWARE', '课件']
  ].map(([key, label]) => Number(counts[key] || 0) > 0 ? `${label} ${counts[key]} 个` : '').filter(Boolean)
  return parts.join('、') || '范画、步骤图和课件'
})
const showPreparationMemoryNotice = computed(() => Boolean(
  preparationMemory.value.autoApplied || preparationMemory.value.hasDefault
))
const canReapplyPreparation = computed(() => {
  const materials = resolveStateValue(props.state.materials) || []
  const hasPreparationMaterials = materials.some((item) => ['范画', '步骤图', '课件'].includes(item.type))
  return Boolean(preparationMemory.value.autoApplied && !hasPreparationMaterials && !resolveStateValue(props.state.materialsConfirmedEmpty))
})
const reapplyPreparation = async () => {
  await props.state.reapplyLessonPreparation?.()
}
const editingMaterialId = ref(null)
const materialNameDraft = ref('')
const materialNameSaving = ref(false)
const materialNameInput = ref(null)

const setMaterialNameInput = (element) => {
  materialNameInput.value = element
}

const startMaterialNameEdit = (material) => {
  if (!material?.id || materialNameSaving.value) return
  editingMaterialId.value = material.id
  materialNameDraft.value = String(material.title || material.file?.originalFilename || '')
  nextTick(() => {
    materialNameInput.value?.focus()
    materialNameInput.value?.select()
  })
}

const cancelMaterialNameEdit = () => {
  editingMaterialId.value = null
  materialNameDraft.value = ''
}

const saveMaterialName = async (material) => {
  if (!material || !sameId(editingMaterialId.value, material.id) || materialNameSaving.value) return false
  const nextTitle = materialNameDraft.value.trim()
  if (!nextTitle) {
    props.state.notify('素材名称不能为空')
    materialNameDraft.value = String(material.title || material.file?.originalFilename || '')
    return false
  }
  if (nextTitle.length > 255) {
    props.state.notify('素材名称不能超过 255 个字符')
    return false
  }
  if (nextTitle === String(material.title || '').trim()) {
    cancelMaterialNameEdit()
    return true
  }
  if (typeof props.state.renameLessonMaterial !== 'function') {
    props.state.notify('素材名称保存功能暂不可用，请稍后重试')
    materialNameDraft.value = String(material.title || material.file?.originalFilename || '')
    editingMaterialId.value = null
    return false
  }
  materialNameSaving.value = true
  try {
    const saved = await props.state.renameLessonMaterial(material, nextTitle)
    if (saved !== false) {
      cancelMaterialNameEdit()
      return true
    }
    materialNameDraft.value = String(material.title || material.file?.originalFilename || '')
    editingMaterialId.value = null
    return false
  } finally {
    materialNameSaving.value = false
  }
}

const materialTabStatusKey = (section) => {
  if (section.materials.length) return 'ready'
  if (section.key === 'classroom') return resolveStateValue(props.state.materialsConfirmedEmpty) ? 'confirmed' : 'pending'
  return 'empty'
}
const materialTabStatusLabel = (section) => {
  const status = materialTabStatusKey(section)
  if (status === 'ready') return '已添加'
  if (status === 'confirmed') return '已确认'
  return section.key === 'classroom' ? '待确认' : '待添加'
}
const selectMaterialSection = (key) => {
  activeMaterialSectionKey.value = key
}
const handleMaterialTabKeydown = (event, currentKey) => {
  const keys = materialSections.value.map((section) => section.key)
  const currentIndex = keys.indexOf(currentKey)
  if (currentIndex < 0) return
  let nextIndex = currentIndex
  if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % keys.length
  else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + keys.length) % keys.length
  else if (event.key === 'Home') nextIndex = 0
  else if (event.key === 'End') nextIndex = keys.length - 1
  else return
  event.preventDefault()
  const nextKey = keys[nextIndex]
  activeMaterialSectionKey.value = nextKey
  if (typeof document !== 'undefined') document.getElementById(`material-tab-${nextKey}`)?.focus()
}
const replaceAccept = computed(() => {
  if (replaceTarget.value?.category === MATERIAL_CATEGORIES.CLASSROOM) return 'image/*,video/*'
  if (replaceTarget.value?.category === MATERIAL_CATEGORIES.COURSEWARE) return undefined
  return 'image/*'
})
const resourceFilterOptions = computed(() => [
  '全部',
  '同主题',
  '最近使用',
  ...Array.from(new Set(props.state.externalLinks.map((link) => link.platform))).filter(Boolean)
])
const studentFor = (studentId) => {
  const activeStudent = props.state.students.find((item) => sameId(item.id, studentId))
  if (activeStudent) return activeStudent
  const sessionStudent = props.state.sessionStudents?.find((item) => sameId(item.studentId, studentId))
  return sessionStudent ? { name: sessionStudent.studentName || '学生', parent: sessionStudent.parent || '' } : { name: '学生', parent: '' }
}
const teacherEffect = computed(() => props.state.activeWorkspace?.teacherEffect || {})
const teacherEffectStatus = computed(() => teacherEffect.value.status || 'PENDING')
const teacherEffectDefaultTitle = computed(() => {
  const task = props.state.activeTask || {}
  const className = props.state.activeClass?.name || task.className || '未命名班级'
  const course = props.state.activeCourse?.title || task.courseTitle || task.course || '未命名课程'
  const teacher = task.teacher || '未命名老师'
  const date = task.dateValue || task.date || ''
  const time = task.time || ''
  return `${date}《${className}--${course}》${teacher}${time ? ` ${time}` : ''}`.trim()
})
const teacherEffectSourceOptions = computed(() => {
  const sourceOptions = []
  const lessonMaterials = resolveStateValue(props.state.materials) || []
  lessonMaterials
    .filter((material) => material?.id && material.fileId && material.type !== '课堂视频' && material.visible !== false)
    .forEach((material) => sourceOptions.push({
      sourceAssetId: String(material.id),
      sourceType: 'LESSON_ASSET',
      fileId: material.fileId,
      image: material.image || '',
      title: material.title || material.file?.originalFilename || '课堂图片',
      meta: `${material.type || '课堂素材'} · 课堂资料`
    }))
  ;(props.state.sessionStudents || []).forEach((row) => {
    const artworks = Array.isArray(row.artworks) && row.artworks.length ? row.artworks : row.artworkId ? [row] : []
    artworks
      .filter((artwork) => artwork?.artworkId && artwork.imageConfirmed && (artwork.displayFileId || artwork.fileId || artwork.processedFileId || artwork.originalFileId))
      .forEach((artwork, index) => sourceOptions.push({
        sourceAssetId: String(artwork.artworkId),
        sourceType: 'ARTWORK',
        fileId: artwork.displayFileId || artwork.fileId || artwork.processedFileId || artwork.originalFileId,
        image: artwork.image || artwork.originalImage || artwork.processedImage || '',
        title: `${studentFor(row.studentId).name}的作品${artworks.length > 1 ? ` · ${index + 1}` : ''}${artwork.artworkTitle ? ` · ${artwork.artworkTitle}` : ''}`,
        meta: '学生作品 · 已确认'
      }))
  })
  ;(props.state.activeWorkspace?.teacherEffect?.sources || []).forEach((source) => {
    if (!source?.sourceAssetId || sourceOptions.some((item) => sameId(item.sourceAssetId, source.sourceAssetId))) return
    sourceOptions.push({
      sourceAssetId: String(source.sourceAssetId),
      sourceType: source.sourceType || 'LESSON_ASSET',
      fileId: source.fileId,
      image: source.downloadUrl || '',
      title: `已选素材 ${source.sourceAssetId}`,
      meta: source.sourceType === 'ARTWORK' ? '学生作品 · 当前版本' : '课堂资料 · 当前版本'
    })
  })
  return [...new Map(sourceOptions.map((source) => [source.sourceAssetId, source])).values()]
})
const selectedTeacherEffectSources = computed(() => teacherEffectDraft.sourceAssetIds
  .map((sourceId) => teacherEffectSourceOptions.value.find((source) => sameId(source.sourceAssetId, sourceId)))
  .filter(Boolean))
const availableTeacherEffectSources = computed(() => teacherEffectSourceOptions.value
  .filter((source) => !teacherEffectDraft.sourceAssetIds.some((sourceId) => sameId(sourceId, source.sourceAssetId))))
const teacherEffectDraftValid = computed(() => {
  const width = Number(teacherEffectDraft.width)
  const imageGap = Number(teacherEffectDraft.imageGap)
  return Boolean(teacherEffectDraft.title.trim()) && teacherEffectDraft.sourceAssetIds.length > 0 && teacherEffectDraft.sourceAssetIds.length <= 40 && Number.isInteger(width) && width >= 320 && width <= 1600 && Number.isInteger(imageGap) && imageGap >= 0 && imageGap <= 80
})
const teacherEffectValidationMessage = computed(() => {
  const width = Number(teacherEffectDraft.width)
  const imageGap = Number(teacherEffectDraft.imageGap)
  if (!teacherEffectDraft.title.trim()) return '请填写长图标题。'
  if (!teacherEffectDraft.sourceAssetIds.length) return '请至少选择一张图片。'
  if (teacherEffectDraft.sourceAssetIds.length > 40) return '最多选择 40 张图片。'
  if (!Number.isInteger(width) || width < 320 || width > 1600) return '宽度需为 320–1600 之间的整数。'
  if (!Number.isInteger(imageGap) || imageGap < 0 || imageGap > 80) return '图片间距需为 0–80 之间的整数。'
  return ''
})
const teacherEffectSourceSelected = (sourceId) => teacherEffectDraft.sourceAssetIds.some((item) => sameId(item, sourceId))
const initializeTeacherEffectDraft = () => {
  const effect = teacherEffect.value || {}
  const existingSourceIds = (effect.sources || [])
    .map((source) => source?.sourceAssetId)
    .filter((sourceId) => sourceId !== null && sourceId !== undefined && sourceId !== '')
    .map((sourceId) => String(sourceId))
  const defaultSourceIds = existingSourceIds.length
    ? existingSourceIds
    : teacherEffectSourceOptions.value.map((source) => source.sourceAssetId)
  Object.assign(teacherEffectDraft, {
    title: effect.title || teacherEffectDefaultTitle.value,
    width: Number(effect.width || 1080),
    imageGap: Number(effect.imageGap ?? 24),
    sourceAssetIds: [...new Set(defaultSourceIds)]
  })
}
const openTeacherEffectDrawer = () => {
  initializeTeacherEffectDraft()
  teacherEffectPreviewState.value = { status: 'idle', error: '', width: 0, height: 0 }
  showTeacherEffectDrawer.value = true
}
const closeTeacherEffectDrawer = () => {
  showTeacherEffectDrawer.value = false
}
const toggleTeacherEffectSource = (sourceId) => {
  const value = String(sourceId)
  const index = teacherEffectDraft.sourceAssetIds.findIndex((item) => sameId(item, value))
  if (index >= 0) teacherEffectDraft.sourceAssetIds.splice(index, 1)
  else teacherEffectDraft.sourceAssetIds.push(value)
}
const moveTeacherEffectSource = (index, offset) => {
  const targetIndex = index + offset
  if (targetIndex < 0 || targetIndex >= teacherEffectDraft.sourceAssetIds.length) return
  const [sourceId] = teacherEffectDraft.sourceAssetIds.splice(index, 1)
  teacherEffectDraft.sourceAssetIds.splice(targetIndex, 0, sourceId)
}
const saveTeacherEffectAndGenerate = async () => {
  if (teacherEffectSubmitting.value || !teacherEffectDraftValid.value) return
  teacherEffectSubmitting.value = true
  try {
    let renderedImage
    try {
      renderedImage = await teacherEffectPreviewRef.value?.renderBlob()
    } catch (error) {
      props.state.notify(error?.message || '课效图预览尚未准备好，请稍候重试')
      return
    }
    if (!renderedImage) {
      props.state.notify('课效图预览尚未准备好，请稍候重试')
      return
    }
    const result = await props.state.generateTeacherEffect({
      sourceAssetIds: [...teacherEffectDraft.sourceAssetIds],
      title: teacherEffectDraft.title.trim() || teacherEffectDefaultTitle.value,
      width: Number(teacherEffectDraft.width),
      imageGap: Number(teacherEffectDraft.imageGap),
      layoutConfig: { renderMode: 'CLIENT_CANVAS', rendererVersion: renderedImage.rendererVersion }
    }, renderedImage)
    if (result) closeTeacherEffectDrawer()
  } finally {
    teacherEffectSubmitting.value = false
  }
}
const filteredExternalResources = computed(() => {
  const keyword = resourceSearch.value.trim().toLowerCase()
  return props.state.externalLinks.filter((link, index) => {
    const filterMatched =
      resourceFilter.value === '全部' ||
      (resourceFilter.value === '同主题' && link.courseIds.some((courseId) => sameId(courseId, props.state.activeCourse.id))) ||
      (resourceFilter.value === '最近使用' && index < 3) ||
      link.platform === resourceFilter.value
    const keywordMatched = !keyword || `${link.title} ${link.note} ${link.platform}`.toLowerCase().includes(keyword)
    return filterMatched && keywordMatched
  })
})
const openResourceDrawer = async () => {
  showResourceDrawer.value = true
  resourceLoading.value = true
  try {
    await props.state.loadResourceExternalLinks?.()
  } catch (error) {
    props.state.notify?.(error?.message || '学习资源加载失败')
  } finally {
    resourceLoading.value = false
  }
}
const openMaterialReplace = (material, category) => {
  replaceTarget.value = { material, category }
  const trigger = () => materialReplaceInput.value?.click()
  if (typeof window !== 'undefined' && window.requestAnimationFrame) window.requestAnimationFrame(trigger)
  else trigger()
}
const handleMaterialReplace = async (event) => {
  const file = event.target.files?.[0]
  const target = replaceTarget.value
  event.target.value = ''
  replaceTarget.value = null
  if (!file || !target) return
  await props.state.replaceLessonMaterial(target.material, file, target.category)
}
watch(() => props.state.activeTask.id, () => {
  props.state.cancelCloudProviderPicker?.()
  showResourceDrawer.value = false
  showContentSettings.value = false
  showTeacherEffectDrawer.value = false
  activeMaterialSectionKey.value = 'demo'
  replaceTarget.value = null
  showSharePreview.value = false
  resourceSearch.value = ''
  resourceFilter.value = '全部'
  resourceLoading.value = false
  studentDeliveryDrawerOpen.value = false
  studentDeliveryMobileDetailOpen.value = false
  homeworkEditorOpen.value = false
  homeworkOptionalFieldEnabled.requirement = Boolean(String(props.state.homework?.requirement || '').trim())
  homeworkOptionalFieldEnabled.dueDate = Boolean(String(props.state.homework?.dueDate || '').trim())
})

watch(
  () => [props.state.homework?.requirement, props.state.homework?.dueDate],
  ([requirement, dueDate], previousValues) => {
    const [previousRequirement, previousDueDate] = previousValues || []
    if (String(requirement || '').trim()) homeworkOptionalFieldEnabled.requirement = true
    if (String(dueDate || '').trim()) homeworkOptionalFieldEnabled.dueDate = true
    if (!String(requirement || '').trim() && String(previousRequirement || '').trim()) homeworkOptionalFieldEnabled.requirement = false
    if (!String(dueDate || '').trim() && String(previousDueDate || '').trim()) homeworkOptionalFieldEnabled.dueDate = false
  },
  { immediate: true }
)

watch(() => props.state.currentStep, (step) => {
  if (step !== 2) {
    studentDeliveryDrawerOpen.value = false
    studentDeliveryMobileDetailOpen.value = false
  }
  if (step !== 4) showTeacherEffectDrawer.value = false
  if (step !== 3) homeworkEditorOpen.value = false
  if (step === 4 && typeof props.state.ensureWecomConfiguration === 'function') {
    void props.state.ensureWecomConfiguration({ force: true }).catch(() => {})
  }
}, { immediate: true })

const parentTouchActionLabel = (item) => {
  const status = item?.item?.status
  if (typeof props.state.isParentTouchResending === 'function' && props.state.isParentTouchResending(item?.item)) return '重新发送中'
  if (['人工发送', '已发送', '待老师确认发送'].includes(status)) return '重新发送'
  if (status === '发送失败') return '重试发送'
  if (status === '待绑定家长群') return '绑定后重新提交'
  return item?.action || '创建企微通知'
}

const cloudArchiveActionLabel = (item) => {
  const batch = props.state.activeWorkspace?.cloudBatch
  const attempt = String(batch?.syncAttemptStatus || '').toUpperCase()
  const isBaidu = typeof props.state.isBaiduCloudBatch === 'function' && props.state.isBaiduCloudBatch(batch)
  if (isBaidu && batch?.status === 'SUCCEEDED') {
    if (['QUEUED', 'RUNNING'].includes(attempt)) return '覆盖同步中'
    if (attempt === 'FAILED') return '再次覆盖'
    return '覆盖同步'
  }
  if (batch?.status === 'SUCCEEDED') return '已同步'
  if (batch?.status === 'FAILED' || batch?.status === 'PARTIAL_FAILED') return '重试同步'
  if (item?.item?.status === '推送中') return '上传中…'
  return item?.action || '推送'
}

const cloudArchiveActionDisabled = (item) => {
  const batch = props.state.activeWorkspace?.cloudBatch
  const isBaidu = typeof props.state.isBaiduCloudBatch === 'function' && props.state.isBaiduCloudBatch(batch)
  return Boolean(props.state.isProcessing
    || item?.item?.status === '已跳过'
    || (typeof props.state.cloudBatchIsWorking === 'function' && props.state.cloudBatchIsWorking(batch))
    || (batch?.status === 'SUCCEEDED' && !isBaidu))
}

watch(homeworkEditorOpen, async (open) => {
  if (!open) return
  await nextTick()
  homeworkEditorTextarea.value?.focus()
})
</script>

<template>
  <section class="wizard panel">
    <div v-if="state.isProcessing" class="processing-bar">
      <span></span>
      <strong>{{ state.processingAction }}</strong>
    </div>
    <header class="wizard-head">
      <div>
        <span>{{ state.activeTask.date }} · {{ state.activeTask.time }} · {{ state.activeTask.lessonType }}</span>
        <h2>{{ state.activeClass.name }} · {{ state.activeCourse.title }}</h2>
        <small v-if="state.activeTask.topic" class="lesson-topic-line">本次课题：{{ state.activeTask.topic }}</small>
      </div>

    </header>


    <TaskReport
      v-if="state.showReport"
      :counts="state.counts"
      :report-pulse="state.reportPulse"
      :active-task="state.activeTask"
      @show-archives="$emit('navigate', 'archives')"
      @show-students="$emit('navigate', 'students')"
      @show-wheat="$emit('navigate', 'wheat')"
    />

    <template v-else>
      <nav class="stepper">
        <button
          v-for="(step, index) in state.steps"
          :key="step.title"
          :class="{ active: state.currentStep === index, finished: step.done === step.total && step.total > 0 }"
          @click="state.currentStep = index"
        >
          <b>{{ index + 1 }}</b>
          <span>
            <strong>{{ step.title }}</strong>
            <small>{{ step.done === step.total && step.total > 0 ? '已完成' : `${step.done}/${step.total}` }}</small>
          </span>
        </button>
      </nav>

      <section v-if="state.currentStep === 0" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 1 步</span>
            <strong>确认课次信息和学生出勤</strong>
          </div>
        </div>
        <div v-if="state.activeTask.status === '异常'" class="lesson-warning">
          <strong>这节课的信息需要确认</strong>
          <span>{{ state.activeTask.exceptionType || '数据异常' }} · {{ state.activeTask.exceptionReason || '未填写原因' }}</span>
        </div>
        <div class="attendance-summary">
          <div>
            <span>本班 {{ state.sessionStudents.length }} 名学生</span>
            <strong>{{ state.counts.attend }} 人到课</strong>
          </div>
        </div>
        <div class="roster-table">
          <button
            v-for="row in state.sessionStudents"
            :key="`${row.lessonId}-${row.studentId}`"
            :class="{ active: sameId(row.studentId, state.activeStudentId) }"
            @click="state.activeStudentId = row.studentId"
          >
            <strong>{{ studentFor(row.studentId).name }}<em v-if="row.studentArchived" class="archived-reference">（已归档）</em></strong>
            <span>{{ studentFor(row.studentId).parent }}</span>
            <AdaptiveSelect
              :model-value="row.attendance"
              :options="attendanceOptions"
              @update:model-value="state.setAttendance(row, $event)"
              @click.stop
            />
          </button>
        </div>
      </section>

      <section v-if="state.currentStep === 1" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 2 步</span>
            <strong>整理本节课的课堂素材</strong>
          </div>
        </div>

        <div v-if="showPreparationMemoryNotice" class="preparation-memory-notice">
          <div>
            <strong>{{ preparationMemoryNoticeTitle }}</strong>
            <span>{{ preparationMemorySummary }} · 下次打开{{ preparationMemoryNextLessonLabel }}会自动带入</span>
          </div>
          <button v-if="canReapplyPreparation" class="secondary" type="button" @click="reapplyPreparation">
            重新带入默认材料
          </button>
        </div>

        <section class="classroom-materials-board">
          <nav class="material-tabs" role="tablist" aria-label="课堂素材分类">
            <button
              v-for="section in materialSections"
              :id="`material-tab-${section.key}`"
              :key="section.key"
              class="material-tab"
              :class="{ active: activeMaterialSectionKey === section.key }"
              type="button"
              role="tab"
              :aria-selected="activeMaterialSectionKey === section.key"
              :aria-controls="`material-panel-${section.key}`"
              :tabindex="activeMaterialSectionKey === section.key ? 0 : -1"
              @click="selectMaterialSection(section.key)"
              @keydown="handleMaterialTabKeydown($event, section.key)"
            >
              <span class="material-tab-label">{{ section.title }}</span>
              <span class="material-tab-meta">
                <strong>{{ section.materials.length }}</strong>
                <small :class="`is-${materialTabStatusKey(section)}`">{{ materialTabStatusLabel(section) }}</small>
              </span>
            </button>
          </nav>

          <article
            v-if="activeMaterialSection"
            :id="`material-panel-${activeMaterialSection.key}`"
            class="material-lane material-section-card material-active-section"
            role="tabpanel"
            :aria-labelledby="`material-tab-${activeMaterialSection.key}`"
          >
            <header class="material-section-head">
              <div class="material-section-title">
                <div class="material-section-title-row">
                  <div class="material-section-heading">
                    <span>课堂素材</span>
                    <strong>{{ activeMaterialSection.title }}</strong>
                  </div>
                  <div class="material-section-actions">
                    <label class="file-button material-upload-button">
                      <span aria-hidden="true">＋</span>{{ activeMaterialSection.uploadLabel }}
                      <input type="file" :accept="activeMaterialSection.accept || undefined" multiple @change="state.uploadLessonMaterial($event, activeMaterialSection.category)" />
                    </label>
                  </div>
                </div>
                <small>{{ activeMaterialSection.materials.length }} 个文件 · {{ activeMaterialSection.description }}</small>
              </div>
            </header>

            <div v-if="activeMaterialSection.kind === 'file'" class="courseware-list material-file-list">
              <label v-if="!activeMaterialSection.materials.length" class="material-add-tile material-add-tile--file">
                <span class="material-add-icon" aria-hidden="true">＋</span>
                <strong>{{ activeMaterialSection.uploadLabel }}</strong>
                <small>点击选择文件</small>
                <input type="file" :accept="activeMaterialSection.accept || undefined" multiple @change="state.uploadLessonMaterial($event, activeMaterialSection.category)" />
              </label>
              <article v-for="material in activeMaterialSection.materials" :key="material.id" class="courseware-file-card">
                <span class="courseware-file-type">{{ material.fileExt ? material.fileExt.toUpperCase() : material.file?.extension?.toUpperCase() || '文件' }}</span>
                <div>
                  <input
                    v-if="sameId(editingMaterialId, material.id)"
                    :ref="setMaterialNameInput"
                    v-model="materialNameDraft"
                    class="material-name-input"
                    maxlength="255"
                    :disabled="materialNameSaving"
                    @click.stop
                    @keydown.enter.prevent="saveMaterialName(material)"
                    @keydown.esc.prevent.stop="cancelMaterialNameEdit"
                    @blur="saveMaterialName(material)"
                  />
                  <button
                    v-else
                    type="button"
                    class="material-name-trigger"
                    :title="material.title || material.file?.originalFilename || '未命名课件'"
                    @click.stop="startMaterialNameEdit(material)"
                  >{{ material.title || material.file?.originalFilename || '未命名课件' }}</button>
                  <small>{{ sameId(editingMaterialId, material.id) && materialNameSaving ? '正在保存名称…' : '仅内部归档' }}</small>
                </div>
                <button class="material-remove-icon" type="button" :aria-label="`删除${material.title || '课件'}`" @click="state.removeLessonMaterial(material)">×</button>
              </article>
            </div>

            <div v-else class="material-card-grid">
              <label v-if="!activeMaterialSection.materials.length" class="material-add-tile">
                <span class="material-add-icon" aria-hidden="true">＋</span>
                <strong>{{ activeMaterialSection.uploadLabel }}</strong>
                <small>点击选择文件</small>
                <input type="file" :accept="activeMaterialSection.accept || undefined" multiple @change="state.uploadLessonMaterial($event, activeMaterialSection.category)" />
              </label>
              <article v-for="material in activeMaterialSection.materials" :key="material.id" class="material-media-card" :class="{ hidden: !material.visible }">
                <div class="material-visual">
                  <button v-if="material.type !== '课堂视频'" class="material-replace-trigger" type="button" @click="openMaterialReplace(material, activeMaterialSection.category)">
                    <ProtectedMedia :file-id="material.fileId" :src="material.image" :alt="material.title" />
                    <span>点击替换</span>
                  </button>
                  <div v-else class="material-video-frame">
                    <ProtectedMedia tag="video" :file-id="material.fileId" :src="material.image" controls preload="metadata" :aria-label="material.title" />
                    <button class="material-video-replace" type="button" @click="openMaterialReplace(material, activeMaterialSection.category)">替换</button>
                  </div>
                  <button class="material-remove-icon" type="button" :aria-label="`删除${material.title || activeMaterialSection.title}`" @click="state.removeLessonMaterial(material)">×</button>
                </div>
                <div class="material-card-copy">
                  <div class="material-card-title">
                    <span>{{ material.type }}</span>
                    <input
                      v-if="sameId(editingMaterialId, material.id)"
                      :ref="setMaterialNameInput"
                      v-model="materialNameDraft"
                      class="material-name-input"
                      maxlength="255"
                      :disabled="materialNameSaving"
                      @click.stop
                      @keydown.enter.prevent="saveMaterialName(material)"
                      @keydown.esc.prevent.stop="cancelMaterialNameEdit"
                      @blur="saveMaterialName(material)"
                    />
                    <button
                      v-else
                      type="button"
                      class="material-name-trigger"
                      :title="material.title || '未命名素材'"
                      @click.stop="startMaterialNameEdit(material)"
                    >{{ material.title || '未命名素材' }}</button>
                  </div>
                  <small v-if="sameId(editingMaterialId, material.id) && materialNameSaving" class="material-name-saving">正在保存名称…</small>
                  <label class="material-visibility-switch">
                    <input type="checkbox" :checked="material.visible" @change="state.toggleMaterialVisible(material)" />
                    <span class="switch-track" aria-hidden="true"><span></span></span>
                    <span>家长可见</span>
                  </label>
                  <small>{{ material.visible ? '将显示在家长展示页' : '仅保存到内部档案' }}</small>
                </div>
              </article>
            </div>

            <div v-if="activeMaterialSection.key === 'classroom' && !classroomMaterialCount" class="no-material-confirm">
              <button class="ghost" :class="{ selected: state.materialsConfirmedEmpty }" @click="state.confirmNoLessonMaterials">
                {{ state.materialsConfirmedEmpty ? '已确认本节无资料' : '本节无资料' }}
              </button>
            </div>
          </article>
        </section>

        <input ref="materialReplaceInput" class="visually-hidden" type="file" :accept="replaceAccept" @change="handleMaterialReplace" />
      </section>

      <section v-if="state.currentStep === 2" class="step-panel">
        <StudentDeliveryBoard
          :state="state"
          @drawer-state="studentDeliveryDrawerOpen = $event"
          @mobile-detail-state="studentDeliveryMobileDetailOpen = $event"
        />
      </section>

      <section v-if="state.currentStep === 3" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 4 步</span>
            <strong>课后任务与家长展示</strong>
          </div>
          <div class="section-actions">
            <button class="ghost" type="button" @click="saveHomeworkDraft">保存本步</button>
            <button class="secondary" type="button" @click="showSharePreview = true">家长页预览</button>
          </div>
        </div>
        <section class="parent-delivery-panel guided-homework-panel">
          <article class="guided-card homework-status-card">
            <div class="homework-status-control">
              <strong>课后任务</strong>
              <label class="homework-status-switch" aria-label="切换课后任务状态">
                <input
                  type="checkbox"
                  :checked="state.homework.taskMode === 'ASSIGNED'"
                  @change="state.setHomeworkMode($event.target.checked ? 'ASSIGNED' : 'NONE')"
                />
                <span class="switch-track" aria-hidden="true"><span></span></span>
              </label>
              <span class="homework-status-value" :class="{ active: state.homework.taskMode === 'ASSIGNED' }">
                {{ state.homework.taskMode === 'ASSIGNED' ? '已布置' : '未布置' }}
              </span>
            </div>
          </article>

          <article v-if="state.homework.taskMode === 'ASSIGNED'" class="guided-card">
            <strong>课后任务信息</strong>
            <div class="homework-field-list">
              <div class="homework-field-row">
                <div class="homework-field-label">
                  <span>任务内容 <em>必填</em></span>
                </div>
                <button
                  class="homework-field-preview"
                  :class="{ empty: !state.homework.content.trim() }"
                  type="button"
                  :title="state.homework.content || '点击填写任务内容'"
                  @click="openHomeworkEditor('content')"
                >
                  <span>{{ state.homework.content || '点击填写任务内容' }}</span>
                  <strong>{{ state.homework.content ? '编辑' : '填写' }}</strong>
                </button>
              </div>
              <div class="homework-field-row">
                <div class="homework-field-label">
                  <span>完成方式 <em>可选</em></span>
                  <label class="homework-field-switch">
                    <input
                      type="checkbox"
                      :checked="homeworkOptionalFieldEnabled.requirement"
                      aria-label="设置完成方式或家长配合"
                      @change="toggleHomeworkOptionalField('requirement', $event.target.checked, $event)"
                    />
                    <span class="switch-track" aria-hidden="true"><span></span></span>
                    <small>{{ !homeworkOptionalFieldEnabled.requirement ? '未设置' : (state.homework.requirement ? '已设置' : '待填写') }}</small>
                  </label>
                </div>
                <button
                  class="homework-field-preview"
                  :class="{ empty: !state.homework.requirement.trim(), disabled: !homeworkOptionalFieldEnabled.requirement }"
                  type="button"
                  :disabled="!homeworkOptionalFieldEnabled.requirement"
                  :title="state.homework.requirement || '点击填写完成方式或家长配合说明'"
                  @click="openHomeworkEditor('requirement')"
                >
                  <span>{{ homeworkOptionalFieldEnabled.requirement && state.homework.requirement ? state.homework.requirement : '未设置完成方式或家长配合' }}</span>
                  <strong>{{ homeworkOptionalFieldEnabled.requirement ? (state.homework.requirement ? '编辑' : '填写') : '未设置' }}</strong>
                </button>
              </div>
              <div class="homework-field-row">
                <div class="homework-field-label">
                  <span>回收日期 <em>可选</em></span>
                  <label class="homework-field-switch">
                    <input
                      type="checkbox"
                      :checked="homeworkOptionalFieldEnabled.dueDate"
                      aria-label="设置预计回收或检查日期"
                      @change="toggleHomeworkOptionalField('dueDate', $event.target.checked, $event)"
                    />
                    <span class="switch-track" aria-hidden="true"><span></span></span>
                    <small>{{ !homeworkOptionalFieldEnabled.dueDate ? '未设置' : (state.homework.dueDate ? '已设置' : '待填写') }}</small>
                  </label>
                </div>
                <div
                  class="homework-date-field"
                  :class="{ disabled: !homeworkOptionalFieldEnabled.dueDate }"
                  @click="homeworkOptionalFieldEnabled.dueDate && openHomeworkDatePicker()"
                >
                  <input
                    ref="homeworkDateInput"
                    v-model="state.homework.dueDate"
                    type="date"
                    :min="state.activeTask.dateValue || undefined"
                    :disabled="!homeworkOptionalFieldEnabled.dueDate"
                    aria-label="预计回收或检查日期"
                  />
                </div>
              </div>
            </div>
            <div class="homework-example-row">
              <span>任务模板</span>
              <button v-for="example in homeworkExamples" :key="example.label" type="button" class="ghost" @click="applyHomeworkExample(example)">
                {{ example.label }}
              </button>
            </div>
          </article>

          <article v-if="state.homework.taskMode === 'ASSIGNED'" class="extension-resource-panel">
            <div class="mini-head">
              <div>
                <span>配套学习资源（可选）</span>
                <strong>{{ state.selectedExternalLinks.length ? `已选 ${state.selectedExternalLinks.length} 个资源` : '未关联学习资源' }}</strong>
              </div>
              <button class="ghost" type="button" @click="openResourceDrawer">选择资源</button>
            </div>
            <div class="selected-resource-chips">
              <button v-for="link in state.selectedExternalLinks" :key="link.id" type="button" class="resource-chip selected" @click="state.toggleHomeworkLink(link.id)">
                <strong>{{ link.title }}</strong>
                <span>×</span>
              </button>
            </div>
          </article>

        </section>

        <div v-if="showResourceDrawer" class="drawer-backdrop" @click.self="showResourceDrawer = false">
          <aside class="library-drawer resource-drawer">
            <header class="drawer-head">
              <div>
                <span>延伸资源</span>
                <strong>选择配套学习资源</strong>
              </div>
              <button class="ghost" @click="showResourceDrawer = false">关闭</button>
            </header>
            <section class="resource-picker-tools">
              <input v-model="resourceSearch" placeholder="搜索资源名称、平台或备注" />
              <div class="resource-filter-tags">
                <button v-for="filter in resourceFilterOptions" :key="filter" :class="{ selected: resourceFilter === filter }" @click="resourceFilter = filter">{{ filter }}</button>
              </div>
            </section>
            <section class="resource-drawer-list">
              <small v-if="resourceLoading" class="empty-note">正在加载资源...</small>
              <template v-else>
                <label v-for="link in filteredExternalResources" :key="link.id" class="resource-choice" :class="{ selected: state.homework.externalLinkIds.some((id) => sameId(id, link.id)) }">
                  <input
                    type="checkbox"
                    :checked="state.homework.externalLinkIds.some((id) => sameId(id, link.id))"
                    @change="state.toggleHomeworkLink(link.id)"
                  />
                  <span>
                    <strong>{{ link.title }}</strong>
                    <small>{{ link.platform }} · {{ link.note }}</small>
                  </span>
                </label>
                <small v-if="!filteredExternalResources.length" class="empty-note">没有找到符合条件的资源。</small>
              </template>
            </section>
            <footer class="drawer-actions">
              <span>已选 {{ state.selectedExternalLinks.length }} 个</span>
              <button class="primary" @click="showResourceDrawer = false">确认选择</button>
            </footer>
          </aside>
        </div>

        <div v-if="showSharePreview" class="drawer-backdrop" @click.self="showSharePreview = false">
          <aside class="library-drawer share-preview-drawer">
            <header class="drawer-head">
              <div>
                <span>家长展示页预览</span>
                <strong>{{ state.activeStudent?.name || '未选择学生' }}</strong>
              </div>
              <button class="ghost" @click="showSharePreview = false">关闭</button>
            </header>
            <div class="student-tabs review-student-tabs">
              <button v-for="row in state.attendingRows" :key="`${row.lessonId}-${row.studentId}`" :class="{ selected: sameId(row.studentId, state.activeStudentId) }" @click="state.activeStudentId = row.studentId">
                {{ studentFor(row.studentId).name }}<em v-if="row.studentArchived" class="archived-reference">（已归档）</em>
              </button>
            </div>
            <DeliveryPreview
              :active-student="state.activeStudent"
              :active-session-student="state.activeSessionStudent"
              :active-course="state.activeCourse"
              :active-task="state.activeTask"
              :active-image-template="state.activeImageTemplate"
              :materials="state.materials"
              :homework="state.homework"
              :display-config="state.displayConfig"
              :selected-external-links="state.selectedExternalLinks"
              :school="state.school"
              :export-text="state.exportText"
              :copied="state.copied"
              :preview-pulse="state.previewPulse"
              :comment-pulse="state.commentPulse"
              :parent-share-url="state.parentShareUrl"
              :qr-text="state.qrText"
              :file-name-for="state.fileNameFor"
              review-only
            />
          </aside>
        </div>

        <div v-if="homeworkEditorOpen" class="drawer-backdrop homework-editor-backdrop" @click.self="closeHomeworkEditor">
          <section class="homework-editor-modal" role="dialog" aria-modal="true" :aria-label="homeworkEditorTitle" @keydown.esc="closeHomeworkEditor">
            <header class="drawer-head">
              <div>
                <span>课后任务</span>
                <strong>{{ homeworkEditorTitle }}</strong>
              </div>
              <button class="ghost" type="button" @click="closeHomeworkEditor">关闭</button>
            </header>
            <textarea
              ref="homeworkEditorTextarea"
              v-model="homeworkEditorDraft"
              rows="8"
              :placeholder="homeworkEditorPlaceholder"
            />
            <footer class="drawer-actions">
              <span>输入完成后保存</span>
              <div>
                <button class="ghost" type="button" @click="closeHomeworkEditor">取消</button>
                <button class="primary" type="button" @click="saveHomeworkEditor">保存</button>
              </div>
            </footer>
          </section>
        </div>
      </section>

      <section v-if="state.currentStep === 4" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 5 步</span>
            <strong>提交归档与交付收尾</strong>
          </div>
          <button class="primary" :disabled="state.isProcessing || state.currentWarnings.length" @click="state.archiveAll">
            完成本节归档交付
          </button>
        </div>
        <section class="archive-checklist-panel">
          <article class="archive-summary-card">
            <div>
              <span>收口进度</span>
              <strong>{{ state.archiveChecklistProgress.done }}/{{ state.archiveChecklistProgress.total }} 已完成</strong>
            </div>
            <div class="progress-track slim">
              <i :style="{ width: `${state.archiveChecklistProgress.percent}%` }"></i>
            </div>
            <div v-if="state.currentWarnings.length" class="archive-blocker">
              <strong>还有 {{ state.currentWarnings.length }} 项前置内容未完成</strong>
              <small>{{ state.currentWarnings.slice(0, 3).join('、') }}{{ state.currentWarnings.length > 3 ? '……' : '' }}</small>
            </div>
            <div v-else-if="!state.archiveChecklistReady" class="archive-result-status">
              <strong>待完成项</strong>
              <small>{{ state.archiveChecklistPending.join('、') }}</small>
            </div>
            <div v-else class="archive-result-status">
              <strong>归档交付清单已就绪</strong>
            </div>
          </article>

          <section class="archive-checklist">
            <article
              v-for="item in state.archiveChecklistItems"
              :key="item.key"
              class="archive-check-row"
              :class="{ done: state.isArchiveRecorded(item.item), working: state.isArchiveWorking(item.item) }"
            >
              <div class="archive-check-mark">{{ state.isArchiveRecorded(item.item) ? '✓' : '·' }}</div>
              <div class="archive-check-copy">
                <span>{{ item.title }}</span>
                <strong>{{ item.item.status }}</strong>
                <small v-if="item.meta">{{ item.meta }}</small>
                <em v-if="item.item.detail">{{ item.item.detail }}</em>
                <template v-if="item.key === 'studentCloudArchive' && state.activeWorkspace?.cloudBatch">
                  <small>
                    百度网盘：{{ state.activeWorkspace.cloudBatch.completedFiles || 0 }}/{{ state.activeWorkspace.cloudBatch.totalFiles || 0 }} 个文件
                    · {{ state.activeWorkspace.cloudBatch.percent || 0 }}%
                    <span v-if="state.activeWorkspace.cloudBatch.currentFilename"> · {{ state.activeWorkspace.cloudBatch.currentFilename }}</span>
                  </small>
                  <div v-if="typeof state.cloudBatchIsWorking === 'function' ? state.cloudBatchIsWorking(state.activeWorkspace.cloudBatch) : ['QUEUED', 'RUNNING'].includes(state.activeWorkspace.cloudBatch.status)" class="progress-track slim">
                    <i :style="{ width: `${state.activeWorkspace.cloudBatch.percent || 0}%` }"></i>
                  </div>
                </template>
                <details v-if="item.key === 'parentTouch' && state.sharePage.publishedSnapshot" class="touch-fallback">
                  <summary>学生访问凭证（可人工发送）</summary>
                  <div v-for="row in state.attendingRows" :key="`touch-${row.lessonId}-${row.studentId}`" class="touch-fallback-row">
                    <div>
                      <strong>{{ studentFor(row.studentId).name }}<em v-if="row.studentArchived" class="archived-reference">（已归档）</em></strong>
                      <small>{{ studentFor(row.studentId).parent }} · 展示页 V{{ state.sharePage.publishedVersion }}</small>
                    </div>
                    <span class="credential-status">链接已生成</span>
                    <button class="ghost" @click="state.manualCopyStudentLink(row)">{{ state.copiedStudentId === row.studentId ? '已复制' : '复制并记录人工发送' }}</button>
                  </div>
                </details>
              </div>
              <div class="archive-check-actions">
                <button v-if="item.key === 'parentTouch'" class="secondary" :disabled="state.isProcessing || (typeof state.isParentTouchResending === 'function' && state.isParentTouchResending(item.item))" @click="state.pushParentTouch">{{ parentTouchActionLabel(item) }}</button>
                <button v-if="item.key === 'studentCloudArchive'" class="secondary" :disabled="cloudArchiveActionDisabled(item)" @click="state.pushArchiveItem(item.key)">{{ cloudArchiveActionLabel(item) }}</button>
                <template v-if="item.key === 'teacherEffectArchive'">
                  <button v-if="['PENDING', 'FAILED', 'SKIPPED'].includes(teacherEffectStatus) || !teacherEffect.id" class="secondary" :disabled="state.isProcessing" @click="openTeacherEffectDrawer">{{ teacherEffectStatus === 'FAILED' ? '重新配置并生成' : '配置并生成课效图' }}</button>
                  <button v-else-if="teacherEffectStatus === 'GENERATING'" class="secondary" disabled>生成中…</button>
                  <button v-else-if="['GENERATED', 'CONFIRMED'].includes(teacherEffectStatus)" class="secondary" :disabled="state.isProcessing" @click="openTeacherEffectDrawer">重新生成</button>
                  <button v-if="teacherEffectStatus === 'FAILED' && teacherEffect.id" class="ghost" :disabled="state.isProcessing" @click="state.retryTeacherEffect">重试任务</button>
                  <span v-if="['CONFIRMED', 'SKIPPED'].includes(teacherEffectStatus)" class="status-pill">{{ item.item.status }}</span>
                </template>
                <button v-if="item.key === 'wheatTrace'" class="secondary" :disabled="state.isProcessing || state.isArchiveDone(item.item)" @click="state.generateWheatTraceTask">{{ state.isArchiveDone(item.item) ? item.item.status : item.action }}</button>
              </div>
            </article>
          </section>

        </section>
      </section>

      <div v-if="showTeacherEffectDrawer" class="drawer-backdrop" @click.self="closeTeacherEffectDrawer">
        <aside class="library-drawer teacher-effect-drawer" role="dialog" aria-modal="true" aria-label="配置老师课效长图">
          <header class="drawer-head">
            <div>
              <span>老师课效长图</span>
              <strong>{{ teacherEffectStatus === 'GENERATED' || teacherEffectStatus === 'CONFIRMED' ? '编辑并重新生成' : '配置并生成' }}</strong>
              <small>调整配置和图片顺序，预览内容即本次保存的长图</small>
            </div>
            <button class="ghost" type="button" @click="closeTeacherEffectDrawer">关闭</button>
          </header>

          <section class="teacher-effect-drawer-body">
            <div class="teacher-effect-form">
              <label>
                <span>长图标题</span>
                <input v-model="teacherEffectDraft.title" type="text" placeholder="请输入课效长图标题" />
              </label>
              <div class="teacher-effect-layout-fields">
                <label>
                  <span>宽度（px）</span>
                  <input v-model.number="teacherEffectDraft.width" type="number" min="320" max="1600" step="1" />
                </label>
                <label>
                  <span>图片间距（px）</span>
                  <input v-model.number="teacherEffectDraft.imageGap" type="number" min="0" max="80" step="1" />
                </label>
              </div>
            </div>

            <TeacherEffectPreview
              ref="teacherEffectPreviewRef"
              :title="teacherEffectDraft.title"
              :width="teacherEffectDraft.width"
              :image-gap="teacherEffectDraft.imageGap"
              :sources="selectedTeacherEffectSources"
              @state="teacherEffectPreviewState = $event"
            />

            <section class="teacher-effect-source-section">
              <header>
                <div>
                  <span>已选图片（{{ selectedTeacherEffectSources.length }}）</span>
                  <small>图片顺序即长图中的展示顺序</small>
                </div>
              </header>
              <div v-if="selectedTeacherEffectSources.length" class="teacher-effect-source-list">
                <article v-for="(source, index) in selectedTeacherEffectSources" :key="`selected-${source.sourceAssetId}`" class="teacher-effect-source-row selected">
                  <ProtectedMedia :file-id="source.fileId" :src="source.image" :alt="source.title" />
                  <div>
                    <strong>{{ source.title }}</strong>
                    <small>{{ source.meta }}</small>
                  </div>
                  <div class="teacher-effect-source-actions">
                    <button class="icon-button" type="button" :disabled="index === 0" :aria-label="`将${source.title}上移`" @click="moveTeacherEffectSource(index, -1)">↑</button>
                    <button class="icon-button" type="button" :disabled="index === selectedTeacherEffectSources.length - 1" :aria-label="`将${source.title}下移`" @click="moveTeacherEffectSource(index, 1)">↓</button>
                    <button class="ghost" type="button" @click="toggleTeacherEffectSource(source.sourceAssetId)">移除</button>
                  </div>
                </article>
              </div>
              <small v-else class="empty-note">还没有可生成的图片，请先确认学生作品或上传课堂图片。</small>
            </section>

            <section class="teacher-effect-source-section">
              <header>
                <div>
                  <span>可选素材</span>
                  <small>只展示已就绪的课堂图片和已确认学生作品</small>
                </div>
              </header>
              <div v-if="availableTeacherEffectSources.length" class="teacher-effect-source-list">
                <article v-for="source in availableTeacherEffectSources" :key="`available-${source.sourceAssetId}`" class="teacher-effect-source-row">
                  <ProtectedMedia :file-id="source.fileId" :src="source.image" :alt="source.title" />
                  <div>
                    <strong>{{ source.title }}</strong>
                    <small>{{ source.meta }}</small>
                  </div>
                  <button class="secondary" type="button" :class="{ selected: teacherEffectSourceSelected(source.sourceAssetId) }" @click="toggleTeacherEffectSource(source.sourceAssetId)">加入</button>
                </article>
              </div>
              <small v-else class="empty-note">所有可用素材都已加入，或当前还没有符合条件的素材。</small>
            </section>
          </section>

          <footer class="drawer-actions teacher-effect-drawer-actions">
            <span v-if="teacherEffectValidationMessage" class="teacher-effect-validation-error">{{ teacherEffectValidationMessage }}</span>
            <span v-else-if="teacherEffectPreviewState.status === 'loading'">{{ selectedTeacherEffectSources.length }} 张图片 · 正在更新预览</span>
            <span v-else>{{ selectedTeacherEffectSources.length }} 张图片 · 预览内容即保存版本</span>
            <div>
              <button class="ghost" type="button" @click="closeTeacherEffectDrawer">取消</button>
              <button class="primary" type="button" :disabled="state.isProcessing || teacherEffectSubmitting || !teacherEffectDraftValid || teacherEffectPreviewState.status !== 'ready'" @click="saveTeacherEffectAndGenerate">保存并生成</button>
            </div>
          </footer>
        </aside>
      </div>

      <div
        v-if="state.cloudProviderPicker?.open"
        class="drawer-backdrop cloud-provider-picker-backdrop"
        @click.self="state.cancelCloudProviderPicker"
      >
        <section
          class="cloud-provider-picker-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cloud-provider-picker-title"
          @keydown.esc="state.cancelCloudProviderPicker"
        >
          <header class="drawer-head">
            <div>
              <span>百度网盘归档</span>
              <strong id="cloud-provider-picker-title">选择同步账号</strong>
            </div>
            <button class="ghost" type="button" @click="state.cancelCloudProviderPicker">关闭</button>
          </header>
          <div class="cloud-provider-picker-list">
            <label
              v-for="provider in state.cloudProviderPicker.providers"
              :key="provider.id"
              class="cloud-provider-picker-option"
              :class="{ selected: sameId(state.cloudProviderPicker.selectedProviderId, provider.id) }"
            >
              <input v-model="state.cloudProviderPicker.selectedProviderId" type="radio" :value="provider.id" />
              <span class="cloud-provider-picker-copy">
                <strong>{{ provider.name || '百度网盘账号' }}</strong>
                <small>{{ provider.baiduDisplayName || '百度账号已授权' }}<template v-if="provider.baiduUid"> · UID {{ provider.baiduUid }}</template></small>
              </span>
              <span class="status-pill success">已启用 · 已授权</span>
            </label>
          </div>
          <footer class="drawer-actions">
            <div>
              <button class="ghost" type="button" @click="state.cancelCloudProviderPicker">取消</button>
              <button class="primary" type="button" :disabled="!state.cloudProviderPicker.selectedProviderId" @click="state.resolveCloudProviderPicker(state.cloudProviderPicker.selectedProviderId)">确定同步</button>
            </div>
          </footer>
        </section>
      </div>

      <footer v-if="state.currentStep !== 2 || (!studentDeliveryDrawerOpen && !studentDeliveryMobileDetailOpen)" class="wizard-actions">
        <button class="ghost" :disabled="state.currentStep === 0" @click="state.prevStep">上一步</button>
        <button v-if="state.currentStep < state.steps.length - 1" class="primary" :disabled="state.currentStep === 2 && state.counts.studentDeliveryCompleted < state.counts.attend" @click="state.nextStep">下一步</button>
        <button v-else class="primary" :disabled="state.isProcessing || state.currentWarnings.length" @click="state.archiveAll">完成归档交付</button>
      </footer>
    </template>
  </section>
</template>
