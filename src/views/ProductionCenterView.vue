<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'
import DateRangeFilter from '../components/archive/DateRangeFilter.vue'
import PptistWorkspace from '../components/production/PptistWorkspace.vue'

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

const listTab = ref('create')
const workspaceRef = ref(null)
const latestDeck = ref(null)
const editorDocument = ref(null)
const editorKey = ref(0)
const exporting = ref(false)
const templateName = ref('')
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
  props.state.portfolioTemplates.find((item) => item.id === createDraft.templateId) || props.state.portfolioTemplates[0]
)
const projectRecords = computed(() => (project.value ? props.state.orderedProjectRecords(project.value) : []))
const projectExportJobs = computed(() => props.state.exportJobs.filter((job) => job.sourceId === project.value?.id))
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
  return props.state.archiveRecords
    .filter((record) => record.studentId === Number(createDraft.studentId))
    .filter((record) => props.state.canEditArchiveRecord(record))
    .filter((record) => !createDraft.dateStart || (record.dateValue || '') >= createDraft.dateStart)
    .filter((record) => !createDraft.dateEnd || (record.dateValue || '') <= createDraft.dateEnd)
    .filter((record) => !createDraft.highlightOnly || record.highlight)
    .slice()
    .sort((a, b) => String(a.dateValue).localeCompare(String(b.dateValue)))
})
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
  props.state.students.map((student) => ({
    label: `${student.name} · ${props.state.classes.find((klass) => klass.id === student.classId)?.name || '未分班'}`,
    value: student.id
  }))
)

const openProjectInEditor = (item) => {
  props.state.openPortfolioProject(item)
  if (!item.deck) props.state.generatePortfolioDeck(item)
  editorDocument.value = clone(item.deck)
  latestDeck.value = clone(item.deck)
  editorKey.value += 1
}

const confirmCreate = () => {
  if (!createDraft.studentId) {
    props.state.notify('请先选择学生')
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
  props.state.generatePortfolioDeck(created)
  openProjectInEditor(created)
}

const backToList = () => {
  captureDeck()
  props.state.closePortfolioProject()
  editorDocument.value = null
  latestDeck.value = null
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

const insertRecordImage = async (record) => {
  const ok = await workspaceRef.value?.insertImage?.(record)
  if (ok) props.state.notify(`已插入作品：${record.course}`)
}

const insertRecordText = async (record) => {
  const text = record.feedback || record.highlightNote || record.description
  const ok = await workspaceRef.value?.insertText?.(text, `${record.course}课评`)
  if (ok) props.state.notify(`已插入课评：${record.course}`)
}

const onRecordDragStart = (event, record) => {
  event.dataTransfer.setData('text/portfolio-record', String(record.id))
  event.dataTransfer.effectAllowed = 'copy'
}

const onWorkbenchDrop = (event) => {
  const recordId = Number(event.dataTransfer?.getData('text/portfolio-record'))
  const record = allProjectRecords.value.find((item) => item.id === recordId)
  if (record) insertRecordImage(record)
}

const insertChatScreenshot = async (event) => {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  const fileUrl = URL.createObjectURL(file)
  const ok = await workspaceRef.value?.insertImage?.({ src: fileUrl, name: file.name })
  if (ok) props.state.notify('已插入聊天截图素材')
}

const saveAsTemplate = () => {
  const deck = captureDeck()
  if (!deck) {
    props.state.notify('当前没有可保存的模板内容')
    return
  }
  props.state.savePortfolioDeckAsTemplate(project.value, { name: templateName.value })
  templateName.value = ''
}

const finishWithoutTemplate = () => {
  captureDeck()
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
  props.state.recordPortfolioExport(project.value, {
    fileName: exportFileName.value,
    fileUrl: 'pptist://browser-export/pdf',
    pageCount: deck.slides.length,
    exportedAt: props.state.nowText()
  })
  exporting.value = false
}

watch(
  () => props.handoff,
  (payload) => {
    if (!payload?.recordIds?.length) return
    createDraft.studentId = payload.studentId ? String(payload.studentId) : ''
    const created = props.state.createPortfolioProject({
      templateId: createDraft.templateId,
      studentId: payload.studentId || null,
      recordIds: payload.recordIds,
      termLabel: createDraft.termLabel
    })
    props.state.generatePortfolioDeck(created)
    openProjectInEditor(created)
    emit('handoffConsumed')
  },
  { immediate: true }
)
</script>

<template>
  <div v-if="state.toast" class="toast">{{ state.toast }}</div>

  <template v-if="!project">
    <button v-if="groupLabel" class="module-back-link" type="button" @click="$emit('backToGroup')">← 返回{{ groupLabel }}</button>
    <PageHead eyebrow="课后工作 · 学期作品册" title="制作中心">
      <div class="button-pair">
        <button class="ghost" :class="{ active: listTab === 'records' }" @click="listTab = 'records'">导出记录</button>
      </div>
    </PageHead>

    <section v-if="listTab !== 'records'" class="pc-create-shell">
      <section class="panel pc-create-main">
        <div class="section-head">
          <div>
            <span>新建作品册</span>
            <strong>选择模板、学生和学期</strong>
          </div>
        </div>

        <div class="pc-template-grid">
          <button
            v-for="item in state.portfolioTemplates"
            :key="item.id"
            class="pc-template-card"
            :class="{ selected: createDraft.templateId === item.id }"
            @click="createDraft.templateId = item.id"
          >
            <span>{{ item.projectType }}</span>
            <strong>{{ item.name }}</strong>
            <small>{{ item.desc }}</small>
            <em>{{ item.slideCount || item.deck?.slides?.length || '自动' }} 页左右 · A4 横向</em>
          </button>
        </div>

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
          <label class="archive-check">
            <input v-model="createDraft.highlightOnly" type="checkbox" />
            <span>只使用高光作品</span>
          </label>
          <label class="wide">作品册标题<input v-model="createDraft.title" placeholder="留空使用学生姓名和学期命名" /></label>
        </div>
        <DateRangeFilter v-model:start="createDraft.dateStart" v-model:end="createDraft.dateEnd" />

        <section class="pc-create-preview">
          <div>
            <span>生成预估</span>
            <strong>{{ selectedStudentRecords.length }} 幅作品 · 约 {{ estimatedSlides }} 页</strong>
            <small>{{ selectedTemplate.name }}</small>
          </div>
          <button class="primary" :disabled="!selectedStudentRecords.length" @click="confirmCreate">进入 PPT 工作台</button>
        </section>
      </section>

      <section class="panel pc-side-list">
        <div class="section-head">
          <div>
            <span>制作项目</span>
            <strong>{{ state.visiblePortfolioProjects.length }} 个项目</strong>
          </div>
        </div>
        <article v-for="item in state.visiblePortfolioProjects" :key="item.id" class="pf-project-row">
          <button class="pf-project-main" @click="openProjectInEditor(item)">
            <span>
              <strong>{{ item.title }}</strong>
              <small>{{ state.projectSubjectLabel(item) }} · {{ state.projectClassLabel(item) }} · {{ state.projectDateRangeLabel(item) }}</small>
              <em>{{ item.recordIds.length }} 幅作品 · {{ item.deck?.slides?.length || item.pages.length || '待生成' }} 页 · {{ item.owner }}</em>
            </span>
          </button>
          <div class="pf-project-side">
            <span class="pf-status-tag" :class="item.status === '已导出' ? 'done' : ''">{{ item.status }}</span>
            <small>{{ item.updatedAt }}</small>
          </div>
        </article>
        <div v-if="!state.visiblePortfolioProjects.length" class="notice-box">
          <small>还没有制作项目。可以从档案中心带入作品，也可以在左侧直接新建。</small>
        </div>
      </section>
    </section>

    <section v-else class="panel">
      <div class="section-head">
        <div>
          <span>PDF 导出记录</span>
          <strong>{{ state.exportJobs.length }} 条</strong>
        </div>
        <button class="ghost" @click="listTab = 'create'">返回新建</button>
      </div>
      <article v-for="job in state.exportJobs" :key="job.id" class="pf-export-row">
        <span>
          <strong>{{ job.fileName || job.title }}</strong>
          <small>{{ job.exportType }} · {{ job.pages }} 页 · {{ job.createdBy }} · {{ job.createdAt }}</small>
          <em>{{ job.fileUrl }}</em>
        </span>
        <div>
          <span class="pf-status-tag done">{{ job.status }}</span>
          <small>归档：{{ job.cloudPath }}</small>
        </div>
      </article>
    </section>
  </template>

  <template v-else>
    <div class="pc-editor-page">
      <header class="pc-editor-head panel">
        <button class="back-link" @click="backToList">← 返回制作中心</button>
        <div>
          <span>{{ template?.name }} · A4 横向 · 右上角打孔</span>
          <strong>{{ project.title }}</strong>
          <small>{{ state.projectSubjectLabel(project) }} · {{ state.projectClassLabel(project) }} · {{ project.recordIds.length }} 幅作品 · {{ project.deck?.slides?.length || 0 }} 页</small>
        </div>
        <div class="pc-editor-actions">
          <button class="ghost" @click="finishWithoutTemplate">不保存为模板</button>
          <button class="ghost" @click="saveAsTemplate">保存为新模板</button>
          <button class="primary" :disabled="exporting" @click="recordExport">{{ exporting ? '正在记录...' : '完成并记录导出' }}</button>
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
              <img :src="record.artwork" :alt="record.course" />
              <div>
                <strong>{{ record.course }}</strong>
                <small>{{ record.date }} · {{ record.className }}</small>
                <em v-if="record.highlight">高光作品</em>
              </div>
              <div class="button-pair">
                <button class="ghost" @click="insertRecordImage(record)">插入图片</button>
                <button class="ghost" @click="insertRecordText(record)">插入课评</button>
              </div>
            </article>
          </div>

          <section class="pc-upload-block">
            <div>
              <span>补充素材</span>
              <strong>聊天截图 / 临时照片</strong>
            </div>
            <label class="ghost pc-upload-button">
              选择文件
              <input type="file" accept="image/*" @change="insertChatScreenshot" />
            </label>
          </section>

          <section class="pc-export-box">
            <div>
              <span>导出文件名</span>
              <strong>{{ exportFileName }}</strong>
              <small>{{ state.portfolioCloudPathFor(project) }}</small>
            </div>
            <input v-model="templateName" placeholder="保存为模板时的名称" />
            <small>PDF/PPT 导出请使用工作台内置导出菜单；点击完成后会生成系统导出记录。</small>
          </section>
        </aside>
      </section>

      <section class="panel">
        <div class="section-head">
          <div>
            <span>本项目导出记录</span>
            <strong>{{ projectExportJobs.length }} 条</strong>
          </div>
        </div>
        <article v-for="job in projectExportJobs" :key="job.id" class="pf-export-row">
          <span>
            <strong>{{ job.fileName }}</strong>
            <small>{{ job.createdBy }} · {{ job.createdAt }} · {{ job.pages }} 页</small>
            <em>{{ job.fileUrl }}</em>
          </span>
          <div>
            <span class="pf-status-tag done">{{ job.status }}</span>
            <small>归档：{{ job.cloudPath }}</small>
          </div>
        </article>
        <div v-if="!projectExportJobs.length" class="notice-box">
          <small>本项目还没有导出记录。</small>
        </div>
      </section>
    </div>
  </template>
</template>
