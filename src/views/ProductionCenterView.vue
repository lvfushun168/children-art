<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'
import DateRangeFilter from '../components/archive/DateRangeFilter.vue'
import PptistWorkspace from '../components/production/PptistWorkspace.vue'
import ProtectedMedia from '../components/common/ProtectedMedia.vue'
import { sameId } from '../services/mappers'

const props = defineProps({
  state: {
    type: Object,
    required: true
  },
  groupLabel: {
    type: String,
    default: ''
  },
  handoff: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['backToGroup', 'handoffConsumed'])

const clone = (value) => JSON.parse(JSON.stringify(value))

const workspaceRef = ref(null)
const latestDeck = ref(null)
const editorDocument = ref(null)
const editorKey = ref(0)
const setupStep = ref('student')
const exporting = ref(false)
const templateName = ref('')
const templateKeyword = ref('')
const showTemplateSaveDialog = ref(false)
const leaveAfterTemplateDecision = ref(false)
const createDraft = reactive({
  templateId: 'term-a4-landscape',
  studentId: '',
  termLabel: '2026 春季',
  dateStart: '',
  dateEnd: '',
  highlightOnly: false,
  title: ''
})
const assetFilter = reactive({
  keyword: '',
  highlightOnly: false
})

const project = computed(() => props.state.activePortfolioProject)
const template = computed(() => (project.value ? props.state.portfolioTemplateFor(project.value) : selectedTemplate.value))
const selectedTemplate = computed(() =>
  props.state.portfolioTemplates.find((item) => sameId(item.id, createDraft.templateId)) || props.state.portfolioTemplates[0]
)
const filteredTemplates = computed(() => {
  const keyword = templateKeyword.value.trim()
  if (!keyword) return props.state.portfolioTemplates
  return props.state.portfolioTemplates.filter((item) =>
    [item.name, item.desc, item.projectType]
      .filter(Boolean)
      .some((value) => String(value).includes(keyword))
  )
})
const projectRecords = computed(() => (project.value ? props.state.orderedProjectRecords(project.value) : []))
const exportFileName = computed(() => (project.value ? props.state.portfolioFileNameFor(project.value) : '作品册.pdf'))
const allProjectRecords = computed(() => projectRecords.value)
const visibleProjectRecords = computed(() => {
  const keyword = assetFilter.keyword.trim()
  return allProjectRecords.value
    .filter((record) => !assetFilter.highlightOnly || record.highlight)
    .filter((record) => {
      if (!keyword) return true
      return [record.title, record.course, record.date, record.feedback, record.highlightNote]
        .filter(Boolean)
        .some((value) => String(value).includes(keyword))
    })
})
const selectedStudentRecords = computed(() => {
  if (!createDraft.studentId) return []
  return (props.state.portfolioRecordPool || [])
    .filter((record) => sameId(record.studentId, createDraft.studentId))
    .filter((record) => !createDraft.dateStart || (record.dateValue || '') >= createDraft.dateStart)
    .filter((record) => !createDraft.dateEnd || (record.dateValue || '') <= createDraft.dateEnd)
    .filter((record) => !createDraft.highlightOnly || record.highlight)
    .slice()
    .sort((a, b) => String(a.dateValue).localeCompare(String(b.dateValue))
      || Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
      || String(a.id).localeCompare(String(b.id), undefined, { numeric: true }))
})
const portfolioRecordsLoading = computed(() => Boolean(props.state.portfolioRecordsLoading))
const portfolioRecordsError = computed(() => props.state.portfolioRecordsError || '')
const estimatedSlides = computed(() => {
  const workCount = selectedStudentRecords.value.length
  if (!workCount) return 0
  let pages = 3
  let rest = workCount
  while (rest > 0) {
    const size = rest >= 4 ? 4 : rest === 3 ? 2 : rest
    pages += 1
    rest -= size
  }
  return pages
})
const studentOptions = computed(() =>
  props.state.students.filter((student) => !student.archived).map((student) => ({
    label: `${student.name} · ${props.state.classes.find((klass) => sameId(klass.id, student.classId))?.name || '未分班'}`,
    value: student.id
  }))
)

watch(() => props.state.portfolioTemplates.length, () => {
  if (!props.state.portfolioTemplates.some((item) => sameId(item.id, createDraft.templateId))) {
    createDraft.templateId = props.state.portfolioTemplates[0]?.id || ''
  }
}, { immediate: true })

watch(() => createDraft.studentId, (studentId) => {
  if (!studentId) return
  void props.state.loadPortfolioRecordsForStudent?.(studentId)
})

const goTemplateStep = () => {
  if (!createDraft.studentId) {
    props.state.notify('请先选择学生')
    return
  }
  if (portfolioRecordsLoading.value) {
    props.state.notify('正在加载该学生的全部作品，请稍候')
    return
  }
  if (!selectedStudentRecords.value.length) {
    props.state.notify('当前范围内没有可用作品')
    return
  }
  setupStep.value = 'template'
}

const openProjectInEditor = async (item) => {
  props.state.openPortfolioProject(item)
  editorDocument.value = null
  latestDeck.value = null
  if (!item.deck) await props.state.generatePortfolioDeck(item)
  if (!item.deck) return
  editorDocument.value = clone(item.deck)
  latestDeck.value = clone(item.deck)
  editorKey.value += 1
}

const confirmCreate = async () => {
  if (!createDraft.studentId) {
    props.state.notify('请先选择学生')
    return
  }
  if (portfolioRecordsLoading.value) {
    props.state.notify('正在加载该学生的全部作品，请稍候')
    return
  }
  if (!selectedStudentRecords.value.length) {
    props.state.notify('当前范围内没有可用作品')
    return
  }
  const created = props.state.createPortfolioProject({
    templateId: createDraft.templateId,
    studentId: createDraft.studentId,
    termLabel: createDraft.termLabel,
    dateStart: createDraft.dateStart,
    dateEnd: createDraft.dateEnd,
    title: createDraft.title,
    recordIds: selectedStudentRecords.value.map((record) => record.id)
  })
  if (!created) return
  await openProjectInEditor(created)
}

const backToList = () => {
  if (project.value?.deck?.slides?.length) {
    openTemplateSaveDialog(true)
    return
  }
  leaveWorkbench()
}

const leaveWorkbench = () => {
  captureDeck()
  props.state.closePortfolioProject()
  editorDocument.value = null
  latestDeck.value = null
  setupStep.value = 'template'
  showTemplateSaveDialog.value = false
  leaveAfterTemplateDecision.value = false
}

const captureDeck = () => {
  const deck = workspaceRef.value?.getDocument?.() || latestDeck.value
  if (project.value && deck) {
    latestDeck.value = clone(deck)
    props.state.setPortfolioDeck(project.value, deck)
  }
  return deck
}

const onWorkspaceChange = (deck) => {
  latestDeck.value = clone(deck)
}

const copyText = async (text, successMessage) => {
  if (!text) {
    props.state.notify('没有可复制的内容')
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    props.state.notify(successMessage)
  } catch {
    props.state.notify('复制失败，请手动选择内容复制')
  }
}

const copyRecordImage = async (record) => {
  if (!record?.artwork) {
    props.state.notify('这条作品没有图片')
    return
  }
  try {
    if (window.ClipboardItem && navigator.clipboard?.write) {
      const response = await fetch(record.artwork)
      const blob = await response.blob()
      if (blob.type.startsWith('image/')) {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
        props.state.notify(`已复制图片：${record.course}`)
        return
      }
    }
    await navigator.clipboard.writeText(record.artwork)
    props.state.notify(`已复制图片链接：${record.course}`)
  } catch {
    await copyText(record.artwork, `已复制图片链接：${record.course}`)
  }
}

const copyRecordText = async (record) => {
  const text = record.feedback || record.highlightNote || record.description
  await copyText(text, `已复制课评：${record.course}`)
}

const dropRecordImage = async (record) => {
  const ok = await workspaceRef.value?.insertImage?.(record)
  if (ok) props.state.notify(`已放入作品：${record.course}`)
}

const onRecordDragStart = (event, record) => {
  event.dataTransfer.setData('text/portfolio-record', String(record.id))
  event.dataTransfer.effectAllowed = 'copy'
}

const onWorkbenchDrop = (event) => {
  const recordId = event.dataTransfer?.getData('text/portfolio-record')
  const record = allProjectRecords.value.find((item) => sameId(item.id, recordId))
  if (record) dropRecordImage(record)
}

const openTemplateSaveDialog = (leaveAfterSave = false) => {
  captureDeck()
  templateName.value = templateName.value || `${props.state.projectSubjectLabel(project.value)} · ${props.state.projectDateRangeLabel(project.value)}模板`
  leaveAfterTemplateDecision.value = leaveAfterSave
  showTemplateSaveDialog.value = true
}

const saveAsTemplate = async () => {
  const deck = captureDeck()
  if (!deck) {
    props.state.notify('当前没有可保存的模板内容')
    return
  }
  const saved = await props.state.savePortfolioDeckAsTemplate(project.value, { name: templateName.value })
  if (!saved) return
  templateName.value = ''
  showTemplateSaveDialog.value = false
  if (leaveAfterTemplateDecision.value) leaveWorkbench()
  leaveAfterTemplateDecision.value = false
}

const skipTemplateSave = () => {
  showTemplateSaveDialog.value = false
  leaveAfterTemplateDecision.value = false
  leaveWorkbench()
  props.state.notify('已保留本次项目内容，模板不变')
}

const recordExport = async () => {
  const deck = captureDeck()
  if (!project.value || !deck?.slides?.length) {
    props.state.notify('请先生成作品册内容')
    return
  }
  exporting.value = true
  await nextTick()
  try {
    const exported = await workspaceRef.value?.exportPdfBlob?.(exportFileName.value)
    if (!exported?.blob) {
      props.state.notify('无法获取工作台页面，请先等待编辑器加载完成')
      return
    }
    await props.state.recordPortfolioExport(project.value, exported)
  } finally {
    exporting.value = false
  }
}

watch(
  () => props.handoff,
  (payload) => {
    if (!payload?.recordIds?.length) return
    const openHandoffProject = async () => {
      setupStep.value = 'template'
      createDraft.studentId = payload.studentId ? String(payload.studentId) : ''
      await props.state.loadPortfolioRecordsForStudent?.(createDraft.studentId)
      const created = props.state.createPortfolioProject({
        templateId: createDraft.templateId,
        studentId: payload.studentId || null,
        recordIds: payload.recordIds,
        termLabel: createDraft.termLabel
      })
      if (!created) return
      await openProjectInEditor(created)
      emit('handoffConsumed')
    }
    void openHandoffProject()
  },
  { immediate: true }
)
</script>

<template>
  <div v-if="state.toast" class="toast">{{ state.toast }}</div>

  <template v-if="!project">
    <button v-if="groupLabel && setupStep === 'student'" class="module-back-link" type="button" @click="$emit('backToGroup')">← 返回{{ groupLabel }}</button>
    <button v-else-if="setupStep === 'template'" class="module-back-link" type="button" @click="setupStep = 'student'">← 返回上一步</button>
    <PageHead eyebrow="课后工作 · 学期作品册" title="制作中心" />

    <section class="pc-create-shell">
      <section class="panel pc-create-main">
        <div class="section-head">
          <div>
            <span>{{ setupStep === 'student' ? '新建作品册' : '选择模板' }}</span>
            <strong>{{ setupStep === 'student' ? '先选择学生和作品范围' : '可选择模板，也可以直接使用系统默认模板' }}</strong>
          </div>
        </div>

        <template v-if="setupStep === 'student'">
          <section class="pc-start-settings pc-step-panel">
            <div class="form-grid pc-create-form">
              <label class="wide">
                学生
                <select v-model="createDraft.studentId">
                  <option value="">请选择学生</option>
                  <option v-for="option in studentOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
              </label>
              <label>
                学期
                <input v-model="createDraft.termLabel" placeholder="例如：2026 春季" />
              </label>

              <label class="wide">作品册标题<input v-model="createDraft.title" placeholder="留空使用学生姓名和学期命名" /></label>
            </div>
            <DateRangeFilter v-model:start="createDraft.dateStart" v-model:end="createDraft.dateEnd" />

            <section class="pc-create-preview">
              <div>
                <span>生成预估</span>
                <strong>{{ selectedStudentRecords.length }} 幅作品 · 约 {{ estimatedSlides }} 页</strong>
                <small>{{ portfolioRecordsLoading ? '正在加载该学生的全部作品…' : createDraft.studentId ? '下一步选择模板' : '请选择学生' }}</small>
              </div>
              <button class="primary" :disabled="portfolioRecordsLoading || !selectedStudentRecords.length" @click="goTemplateStep">下一步：选择模板</button>
            </section>
          </section>

          <section class="pc-record-preview panel">
            <div class="mini-head">
              <div>
                <span>本次作品</span>
                <strong>{{ selectedStudentRecords.length }} 幅</strong>
              </div>
            </div>
            <div class="pc-record-list">
              <article v-for="record in selectedStudentRecords" :key="record.id" class="pc-record-row">
                <ProtectedMedia :file-id="record.fileId" :src="record.artwork" :alt="record.course" />
                <div>
                  <strong>{{ record.course }}</strong>
                  <small>{{ record.date }} · {{ record.className }}</small>
                </div>
                <em v-if="record.highlight">高光</em>
              </article>
              <div v-if="!selectedStudentRecords.length" class="notice-box">
                <small v-if="portfolioRecordsLoading">正在加载该学生的全部作品…</small>
                <small v-else-if="portfolioRecordsError">{{ portfolioRecordsError }}</small>
                <small v-else-if="createDraft.studentId">该学生暂无可用作品。</small>
                <small v-else>请选择学生后查看作品。</small>
              </div>
            </div>
          </section>
        </template>

        <template v-else>
          <section class="pc-template-step">
            <div class="pc-picked-summary">
              <div>
                <span>已选条件</span>
                <strong>{{ selectedStudentRecords[0]?.studentName || '学生' }} · {{ createDraft.termLabel }}</strong>
                <small>{{ selectedStudentRecords.length }} 幅作品 · 约 {{ estimatedSlides }} 页</small>
              </div>
            </div>

            <div class="pc-template-picker">
              <div class="mini-head">
                <div>
                  <span>模板库</span>
                  <strong>{{ filteredTemplates.length }} / {{ state.portfolioTemplates.length }} 个模板</strong>
                </div>
              </div>
              <input v-model="templateKeyword" class="pc-search" placeholder="搜索模板名称、风格或用途" />
              <div class="pc-template-list">
                <button
                  v-for="item in filteredTemplates"
                  :key="item.id"
                  class="pc-template-row"
                  :class="{ selected: sameId(createDraft.templateId, item.id) }"
                  @click="createDraft.templateId = item.id"
                >
                  <span class="pc-template-preview">{{ item.name.slice(0, 1) }}</span>
                  <span class="pc-template-copy">
                    <strong>{{ item.name }}</strong>
                    <small>{{ item.desc }}</small>
                  </span>
                  <em>{{ item.slideCount || item.deck?.slides?.length || '自动' }} 页 · A4</em>
                </button>
                <div v-if="!filteredTemplates.length" class="notice-box">
                  <small>暂无可用自定义模板，将使用系统默认模板。</small>
                </div>
              </div>
            </div>

            <section class="pc-create-preview">
              <div>
                <span>将使用模板</span>
                <strong>{{ selectedTemplate?.name || '系统默认模板' }}</strong>
                <small>{{ selectedStudentRecords.length }} 幅作品 · 约 {{ estimatedSlides }} 页</small>
              </div>
              <button class="primary" :disabled="portfolioRecordsLoading || !selectedStudentRecords.length" @click="confirmCreate">进入 PPT 工作台</button>
            </section>
          </section>
        </template>
      </section>
    </section>
  </template>

  <template v-else>
    <div class="pc-editor-page">
      <header class="pc-editor-head panel">
        <button class="back-link" @click="backToList">← 返回模板选择</button>
        <div>
          <span>{{ template?.name }} · A4 横向 · 右上角打孔</span>
          <strong>{{ project.title }}</strong>
          <small>{{ state.projectSubjectLabel(project) }} · {{ state.projectClassLabel(project) }} · {{ project.recordIds.length }} 幅作品 · {{ project.deck?.slides?.length || 0 }} 页</small>
        </div>
        <div class="pc-editor-actions">
          <button class="ghost" @click="openTemplateSaveDialog(false)">保存为模板</button>
          <button class="primary" :disabled="exporting" @click="recordExport">{{ exporting ? '正在导出...' : '导出作品册' }}</button>
        </div>
      </header>

      <section class="pc-workbench" @dragover.prevent @drop.prevent="onWorkbenchDrop">
        <div class="panel pc-ppt-stage">
          <PptistWorkspace
            v-if="editorDocument"
            :key="editorKey"
            ref="workspaceRef"
            :document="editorDocument"
            @change="onWorkspaceChange"
            @error="(error) => state.notify(`PPT 工作台异常：${error.message}`)"
          />
        </div>

        <aside class="panel pc-asset-panel">
          <div class="mini-head">
            <div>
              <span>学生作品池</span>
              <strong>{{ visibleProjectRecords.length }} / {{ allProjectRecords.length }} 幅</strong>
            </div>
          </div>
          <input v-model="assetFilter.keyword" class="pc-search" placeholder="搜索课程、日期、课评" />
          <label class="archive-check pc-inline-check">
            <input v-model="assetFilter.highlightOnly" type="checkbox" />
            <span>只看高光</span>
          </label>
          <div class="pc-asset-list">
            <article
              v-for="record in visibleProjectRecords"
              :key="record.id"
              class="pc-asset-card"
              draggable="true"
              @dragstart="onRecordDragStart($event, record)"
            >
              <ProtectedMedia :file-id="record.fileId" :src="record.artwork" :alt="record.course" />
              <div>
                <strong>{{ record.course }}</strong>
                <small>{{ record.date }} · {{ record.className }}</small>
                <em v-if="record.highlight">高光作品</em>
              </div>
              <div class="button-pair">
                <button class="ghost" @click="copyRecordImage(record)">复制图片</button>
                <button class="ghost" @click="copyRecordText(record)">复制课评</button>
              </div>
            </article>
          </div>

          <section class="pc-export-box">
            <div>
              <span>导出文件名</span>
              <strong>{{ exportFileName }}</strong>
              <small>{{ state.portfolioCloudPathFor(project) }}</small>
            </div>
          </section>
        </aside>
      </section>
    </div>
  </template>

  <div v-if="showTemplateSaveDialog" class="modal-backdrop">
    <section class="import-modal pc-template-modal">
      <div class="modal-head">
        <div>
          <span>{{ leaveAfterTemplateDecision ? '离开工作台' : '保存模板' }}</span>
          <strong>{{ leaveAfterTemplateDecision ? '是否把本次排版保存成新模板？' : '为本次排版命名' }}</strong>
        </div>
        <button class="ghost" @click="showTemplateSaveDialog = false">关闭</button>
      </div>
      <label>
        模板名称
        <input v-model="templateName" placeholder="例如：彤彤春季成长册模板" />
      </label>
      <div class="modal-actions">
        <button v-if="leaveAfterTemplateDecision" class="ghost" @click="skipTemplateSave">不保存，返回模板选择</button>
        <button v-else class="ghost" @click="showTemplateSaveDialog = false">取消</button>
        <button class="primary" :disabled="!templateName.trim()" @click="saveAsTemplate">保存模板</button>
      </div>
    </section>
  </div>
</template>
