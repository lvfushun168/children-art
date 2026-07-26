<script setup>
import { computed, reactive, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'
import DateRangeFilter from '../components/archive/DateRangeFilter.vue'
import PortfolioPageCanvas from '../components/production/PortfolioPageCanvas.vue'
import PortfolioInspector from '../components/production/PortfolioInspector.vue'

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

const steps = ['选料', '套版', '微调', '导出']
const listTab = ref('projects')
const showCreateModal = ref(false)
const showBatchModal = ref(false)
const selectedPageIndex = ref(0)
const selectedSlotKey = ref('')
const viewMode = ref('spread')
const dragFromIndex = ref(null)
const pickedProjectIds = ref([])
const createDraft = reactive({ scope: 'student', templateId: 'growth-a4', studentId: '', classId: '', title: '' })
const batchDraft = reactive({ classId: '', templateId: 'growth-a4', dateStart: '', dateEnd: '', highlightOnly: false, titleSuffix: '成长手册' })

const project = computed(() => props.state.activePortfolioProject)
const template = computed(() => (project.value ? props.state.portfolioTemplateFor(project.value) : null))
const pageSize = computed(() => props.state.portfolioPageSizes[template.value?.pageSize || 'A4'])
const projectRecords = computed(() => (project.value ? props.state.orderedProjectRecords(project.value) : []))
const issues = computed(() => (project.value ? props.state.portfolioIssuesFor(project.value) : []))
const errorIssues = computed(() => issues.value.filter((issue) => issue.level === 'error'))
const issuePages = computed(() => (project.value ? props.state.portfolioIssuePagesFor(project.value) : {}))
const usedRecordIds = computed(() => (project.value ? props.state.projectUsedRecordIds(project.value) : new Set()))

const stage = computed(() => project.value?.stage ?? 0)
const stepStatus = computed(() => {
  const current = project.value
  if (!current) return []
  return [
    { title: steps[0], done: current.recordIds.length ? 1 : 0, total: 1, label: `${current.recordIds.length} 件` },
    { title: steps[1], done: current.pages.length ? 1 : 0, total: 1, label: current.pages.length ? `${current.pages.length} 页` : '未套版' },
    {
      title: steps[2],
      done: current.pages.length && !errorIssues.value.length ? 1 : 0,
      total: 1,
      label: !current.pages.length ? '待套版' : errorIssues.value.length ? `${errorIssues.value.length} 项待改` : '已就绪'
    },
    { title: steps[3], done: current.status === '已导出' ? 1 : 0, total: 1, label: current.status === '已导出' ? `V${current.version}` : '未导出' }
  ]
})

const currentPage = computed(() => project.value?.pages[selectedPageIndex.value] || null)
const currentLayout = computed(() => (currentPage.value ? props.state.portfolioPageLayout(currentPage.value) : null))
const currentSlot = computed(() => currentLayout.value?.slots.find((slot) => slot.key === selectedSlotKey.value) || null)
const layoutCandidates = computed(() =>
  currentPage.value ? props.state.portfolioLayoutsForScope(currentPage.value.kind) : []
)
const spreads = computed(() => (project.value ? props.state.spreadsFor(project.value) : []))
const activeSpreadIndex = computed(() =>
  Math.max(0, spreads.value.findIndex((spread) => spread.some((entry) => entry.index === selectedPageIndex.value)))
)
const visiblePages = computed(() => {
  if (!project.value?.pages.length) return []
  if (viewMode.value === 'single') return [{ page: currentPage.value, index: selectedPageIndex.value }]
  return spreads.value[activeSpreadIndex.value] || []
})

const studentOptions = computed(() => [
  { label: '请选择学生', value: '' },
  ...props.state.students.map((student) => ({ label: `${student.name} · ${props.state.classes.find((klass) => klass.id === student.classId)?.name || '未分班'}`, value: student.id }))
])
const classOptions = computed(() => [
  { label: '请选择班级', value: '' },
  ...props.state.classes.map((klass) => ({ label: klass.name, value: klass.id }))
])
const poolStudentOptions = computed(() => [
  { label: '全部学生', value: 'all' },
  ...props.state.students.map((student) => ({ label: student.name, value: student.id }))
])
const poolClassOptions = computed(() => [
  { label: '全部班级', value: 'all' },
  ...props.state.classes.map((klass) => ({ label: klass.name, value: klass.id }))
])
const templateOptions = computed(() =>
  props.state.portfolioTemplates.map((item) => ({ label: item.name, value: item.id, description: item.desc }))
)
const estimatedPages = computed(() => {
  if (!project.value || !template.value) return 0
  const structure = template.value.structure
  const workPages = Math.ceil(projectRecords.value.length / project.value.book.worksPerPage) || 0
  return (structure.includes('cover') ? 1 : 0) + (structure.includes('intro') ? 1 : 0) + workPages + (structure.includes('closing') ? 1 : 0)
})
const batchPreview = computed(() => {
  if (!batchDraft.classId) return []
  return props.state.batchCandidates(batchDraft)
})
const projectExportJobs = computed(() =>
  props.state.exportJobs.filter((job) => job.sourceId === project.value?.id)
)

const kindLabels = { cover: '封面', intro: '引言', work: '作品页', closing: '寄语', blank: '空白页' }

const goStage = (index) => {
  if (!project.value) return
  if (index >= 2 && !project.value.pages.length) {
    props.state.notify('请先在第 2 步生成页面')
    return
  }
  project.value.stage = index
}

const openProject = (item) => {
  props.state.openPortfolioProject(item)
  selectedPageIndex.value = 0
  selectedSlotKey.value = ''
}

const backToList = () => {
  props.state.closePortfolioProject()
  selectedSlotKey.value = ''
}

const openCreateModal = () => {
  createDraft.scope = 'student'
  createDraft.templateId = 'growth-a4'
  createDraft.studentId = ''
  createDraft.classId = ''
  createDraft.title = ''
  showCreateModal.value = true
}

const confirmCreate = () => {
  const payload = {
    templateId: createDraft.templateId,
    title: createDraft.title,
    studentId: createDraft.scope === 'student' ? createDraft.studentId : null,
    classId: createDraft.scope === 'class' ? createDraft.classId : null
  }
  if (createDraft.scope === 'student' && !payload.studentId) {
    props.state.notify('请先选择学生')
    return
  }
  if (createDraft.scope === 'class' && !payload.classId) {
    props.state.notify('请先选择班级')
    return
  }
  props.state.createPortfolioProject(payload)
  showCreateModal.value = false
  selectedPageIndex.value = 0
  selectedSlotKey.value = ''
}

const openBatchModal = () => {
  batchDraft.classId = ''
  batchDraft.dateStart = ''
  batchDraft.dateEnd = ''
  batchDraft.highlightOnly = false
  showBatchModal.value = true
}

const pickedProjects = computed(() =>
  props.state.visiblePortfolioProjects.filter((item) => pickedProjectIds.value.includes(item.id))
)

const toggleProjectPick = (item) => {
  pickedProjectIds.value = pickedProjectIds.value.includes(item.id)
    ? pickedProjectIds.value.filter((id) => id !== item.id)
    : [...pickedProjectIds.value, item.id]
}

const exportPickedProjects = () => {
  if (!props.state.exportPortfolioBatch(pickedProjects.value)) return
  pickedProjectIds.value = []
  listTab.value = 'exports'
}

const confirmBatch = () => {
  if (!batchDraft.classId) {
    props.state.notify('请先选择班级')
    return
  }
  const result = props.state.createBatchPortfolios({ ...batchDraft })
  if (result.created.length) showBatchModal.value = false
}

const selectSlot = (pageIndex, slot) => {
  selectedPageIndex.value = pageIndex
  selectedSlotKey.value = slot.key
}

const focusPage = (index) => {
  selectedPageIndex.value = index
  selectedSlotKey.value = ''
}

const moveSpread = (direction) => {
  const target = activeSpreadIndex.value + direction
  const spread = spreads.value[target]
  if (!spread) return
  selectedPageIndex.value = spread[0].index
  selectedSlotKey.value = ''
}

const movePageIndex = (direction) => {
  const target = selectedPageIndex.value + direction
  if (target < 0 || target >= (project.value?.pages.length || 0)) return
  selectedPageIndex.value = target
  selectedSlotKey.value = ''
}

const onThumbDragStart = (index) => {
  dragFromIndex.value = index
}

const onThumbDrop = (index) => {
  if (dragFromIndex.value === null) return
  props.state.reorderPage(project.value, dragFromIndex.value, index)
  selectedPageIndex.value = index
  dragFromIndex.value = null
}

const onPoolDragStart = (event, record) => {
  event.dataTransfer.setData('text/portfolio-record', String(record.id))
  event.dataTransfer.effectAllowed = 'copy'
}

const assignFromPool = (record) => {
  if (!currentSlot.value || currentSlot.value.type !== 'image') {
    props.state.notify('请先在画布上点选一个图片位')
    return
  }
  props.state.assignRecordToSlot(project.value, currentPage.value, currentSlot.value, record.id)
}

const dropOnSlot = (pageIndex, payload) => {
  const page = project.value.pages[pageIndex]
  if (!page || payload.slot.type !== 'image') return
  props.state.assignRecordToSlot(project.value, page, payload.slot, payload.recordId)
  selectSlot(pageIndex, payload.slot)
}

const removeCurrentPage = () => {
  if (!project.value?.pages.length) return
  if (!window.confirm(`确定删除第 ${selectedPageIndex.value + 1} 页吗？`)) return
  props.state.removePage(project.value, selectedPageIndex.value)
  selectedPageIndex.value = Math.max(0, Math.min(selectedPageIndex.value, project.value.pages.length - 1))
  selectedSlotKey.value = ''
}

const runAutoPaginate = () => {
  if (!project.value) return
  if (project.value.pages.length && !window.confirm('重新套版会按当前设置重新铺页，手动改写过的页面文字会被重置。确定继续吗？')) return
  props.state.autoPaginate(project.value)
  selectedPageIndex.value = 0
  selectedSlotKey.value = ''
}

const exportProject = (type) => props.state.exportPortfolio(project.value, type)
const publishLink = () => props.state.publishPortfolioLink(project.value)

watch(
  () => props.handoff,
  (payload) => {
    if (!payload?.recordIds?.length) return
    const created = props.state.createPortfolioProject({
      templateId: 'growth-a4',
      studentId: payload.studentId || null,
      recordIds: payload.recordIds
    })
    created.stage = 1
    selectedPageIndex.value = 0
    selectedSlotKey.value = ''
    emit('handoffConsumed')
  },
  { immediate: true }
)

watch(
  () => project.value?.pages.length,
  (length) => {
    if (!length) return
    if (selectedPageIndex.value > length - 1) selectedPageIndex.value = length - 1
  }
)
</script>

<template>
  <div v-if="state.toast" class="toast">{{ state.toast }}</div>

  <!-- 项目列表 -->
  <template v-if="!project">
    <button v-if="groupLabel" class="module-back-link" type="button" @click="$emit('backToGroup')">← 返回{{ groupLabel }}</button>
    <PageHead eyebrow="课后工作 · 手册状交付物" title="制作中心">
      <div class="button-pair">
        <button class="secondary" @click="openBatchModal">按班级批量成册</button>
        <button class="primary" @click="openCreateModal">新建制作项目</button>
      </div>
    </PageHead>

    <div class="today-summary pf-stat-strip">
      <article><strong>{{ state.portfolioStats.total }}</strong><span>制作项目</span></article>
      <article><strong>{{ state.portfolioStats.drafting }}</strong><span>制作中</span></article>
      <article><strong>{{ state.portfolioStats.exported }}</strong><span>已导出</span></article>
      <article><strong>{{ state.portfolioStats.jobs }}</strong><span>导出记录</span></article>
    </div>

    <section class="pf-list-tabs panel">
      <button :class="{ active: listTab === 'projects' }" @click="listTab = 'projects'">制作项目</button>
      <button :class="{ active: listTab === 'exports' }" @click="listTab = 'exports'">导出记录</button>
    </section>

    <section v-if="listTab === 'projects'" class="panel">
      <div class="section-head">
        <div>
          <span>作品集与成长手册</span>
          <strong>{{ state.visiblePortfolioProjects.length }} 个项目</strong>
        </div>
      </div>
      <div v-if="pickedProjectIds.length" class="archive-selection-bar">
        <strong>已选 {{ pickedProjectIds.length }} 本册子</strong>
        <div class="button-pair">
          <button class="ghost" @click="pickedProjectIds = []">取消选择</button>
          <button class="primary" @click="exportPickedProjects">批量导出 PDF（打包 ZIP）</button>
        </div>
      </div>
      <article v-for="item in state.visiblePortfolioProjects" :key="item.id" class="pf-project-row">
        <label class="archive-pick" @click.stop>
          <input type="checkbox" :checked="pickedProjectIds.includes(item.id)" @change="toggleProjectPick(item)" />
        </label>
        <button class="pf-project-main" @click="openProject(item)">
          <span>
            <strong>{{ item.title }}</strong>
            <small>{{ item.projectType }} · {{ state.portfolioTemplateFor(item).name }} · {{ item.owner }}</small>
            <em>{{ item.recordIds.length }} 件作品 · {{ item.pages.length }} 页 · {{ steps[item.stage] }}</em>
          </span>
        </button>
        <div class="pf-project-side">
          <span class="pf-status-tag" :class="item.status === '已导出' ? 'done' : ''">{{ item.status }}</span>
          <small>{{ item.updatedAt }}</small>
          <div class="button-pair">
            <button class="ghost" @click="state.duplicatePortfolioProject(item)">复制</button>
            <button class="ghost danger-action" @click="state.removePortfolioProject(item)">删除</button>
          </div>
        </div>
      </article>
      <div v-if="!state.visiblePortfolioProjects.length" class="notice-box">
        <small>还没有制作项目。可以从「档案中心 → 学生作品档案」勾选作品带过来，也可以直接新建。</small>
      </div>
    </section>

    <section v-else class="panel">
      <div class="section-head">
        <div>
          <span>导出记录</span>
          <strong>{{ state.exportJobs.length }} 条</strong>
        </div>
      </div>
      <article v-for="job in state.exportJobs" :key="job.id" class="pf-export-row">
        <span>
          <strong>{{ job.title }}</strong>
          <small>{{ job.exportType }} · {{ job.pages }} 页 · {{ job.createdBy }} · {{ job.createdAt }}</small>
          <em>{{ job.fileUrl }}</em>
        </span>
        <div>
          <span class="pf-status-tag done">{{ job.status }}</span>
          <small>网盘：{{ job.cloudPath }}</small>
        </div>
      </article>
      <div v-if="!state.exportJobs.length" class="notice-box">
        <small>还没有导出记录。</small>
      </div>
    </section>
  </template>

  <!-- 制作流水线 -->
  <template v-else>
    <div class="focus-breadcrumb">
      <button class="back-link" @click="backToList">← 返回制作中心</button>
    </div>

    <section class="wizard panel">
      <header class="wizard-head pf-studio-head">
        <div>
          <span>{{ project.projectType }} · {{ template.name }} · {{ template.binding }}</span>
          <h2>{{ project.title }}</h2>
        </div>
        <div class="pf-studio-meta">
          <span>{{ state.projectSubjectLabel(project) }}</span>
          <small>{{ state.projectDateRangeLabel(project) }} · {{ project.recordIds.length }} 件作品</small>
        </div>
      </header>

      <nav class="stepper production-stepper">
        <button
          v-for="(step, index) in stepStatus"
          :key="step.title"
          :class="{ active: stage === index, finished: step.done === step.total }"
          @click="goStage(index)"
        >
          <b>{{ index + 1 }}</b>
          <span>
            <strong>{{ step.title }}</strong>
            <small>{{ step.label }}</small>
          </span>
        </button>
      </nav>

      <!-- 第 1 步：选料 -->
      <section v-if="stage === 0" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 1 步</span>
            <strong>从作品档案里挑要放进册子的作品</strong>
          </div>
          <button class="primary" :disabled="!project.recordIds.length" @click="goStage(1)">
            已选 {{ project.recordIds.length }} 件，去套版
          </button>
        </div>

        <section class="archive-filter-bar panel">
          <div class="archive-filter-fields compact-archive-filter-fields">
            <label>
              学生
              <AdaptiveSelect v-model="state.portfolioFilter.studentId" :options="poolStudentOptions" />
            </label>
            <label>
              班级
              <AdaptiveSelect v-model="state.portfolioFilter.classId" :options="poolClassOptions" />
            </label>
            <label class="archive-check">
              <input v-model="state.portfolioFilter.highlightOnly" type="checkbox" />
              <span>只看高光作品</span>
            </label>
          </div>
          <DateRangeFilter v-model:start="state.portfolioFilter.dateStart" v-model:end="state.portfolioFilter.dateEnd" />
        </section>

        <div class="pf-pool-head">
          <div><span>可选作品</span><strong>{{ state.portfolioRecordPool.length }} 件</strong></div>
          <button class="ghost" :disabled="!state.portfolioRecordPool.length" @click="state.selectAllPoolRecords(project)">全选当前结果</button>
        </div>

        <div class="pf-source-grid">
          <button
            v-for="record in state.portfolioRecordPool"
            :key="record.id"
            class="pf-source-card"
            :class="{ picked: project.recordIds.includes(record.id) }"
            @click="state.toggleProjectRecord(project, record.id)"
          >
            <img :src="record.artwork" :alt="record.studentName" />
            <strong>{{ record.title || `${record.studentName} · ${record.course}` }}</strong>
            <small>{{ record.date }} · {{ record.className }}</small>
            <div class="pf-source-tags">
              <em v-if="record.highlight">高光</em>
              <em v-if="record.framed" class="framed-tag">已装裱</em>
            </div>
            <span class="pf-source-check">{{ project.recordIds.includes(record.id) ? '✓' : '' }}</span>
          </button>
          <div v-if="!state.portfolioRecordPool.length" class="notice-box">
            <small>当前筛选条件下没有归档作品，可放宽日期或换学生。</small>
          </div>
        </div>
      </section>

      <!-- 第 2 步：套版 -->
      <section v-if="stage === 1" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 2 步</span>
            <strong>选册子模板，系统自动铺页</strong>
          </div>
          <button class="primary" :disabled="!project.recordIds.length" @click="runAutoPaginate">
            自动成册（约 {{ estimatedPages }} 页）
          </button>
        </div>

        <div class="pf-template-grid">
          <button
            v-for="item in state.portfolioTemplates"
            :key="item.id"
            class="pf-template-card"
            :class="{ selected: project.templateId === item.id }"
            @click="state.applyTemplate(project, item.id)"
          >
            <strong>{{ item.name }}</strong>
            <small>{{ item.desc }}</small>
            <em>{{ item.binding }} · {{ state.portfolioPageSizes[item.pageSize].label }} · 默认 {{ item.book.worksPerPage }} 件/页</em>
          </button>
        </div>

        <div class="pf-setting-grid">
          <article>
            <div class="mini-head"><span>每页作品数</span><strong>{{ project.book.worksPerPage }} 件</strong></div>
            <div class="pf-choice-row">
              <button v-for="count in [1, 2, 4]" :key="count" :class="{ selected: project.book.worksPerPage === count }" @click="project.book.worksPerPage = count">{{ count }} 件</button>
            </div>
          </article>
          <article>
            <div class="mini-head"><span>作品页正文</span></div>
            <div class="pf-choice-row">
              <button v-for="source in state.bodySources" :key="source.id" :class="{ selected: project.book.bodySource === source.id }" @click="project.book.bodySource = source.id">{{ source.label }}</button>
            </div>
          </article>
          <article>
            <div class="mini-head"><span>册子风格</span></div>
            <div class="pf-choice-row">
              <button v-for="theme in state.bookThemes" :key="theme.id" :class="{ selected: project.book.theme === theme.id }" @click="project.book.theme = theme.id">{{ theme.label }}</button>
            </div>
          </article>
        </div>

        <section class="pf-copy-panel">
          <div class="mini-head">
            <div><span>册子文字</span><strong>标题、引言、总结和寄语会自动填进对应页面</strong></div>
            <button class="ghost" :disabled="!project.recordIds.length" @click="state.generateProjectCopy(project)">按作品数据生成文案</button>
          </div>
          <div class="form-grid">
            <label>册子标题<input v-model="project.title" /></label>
            <label>交付对象<input v-model="project.target" placeholder="例如：彤彤妈妈" /></label>
            <label class="wide">开场说明<textarea v-model="project.intro" rows="3" /></label>
            <label class="wide">成长总结<textarea v-model="project.summary" rows="3" /></label>
            <label class="wide">老师寄语<textarea v-model="project.teacherMessage" rows="3" /></label>
          </div>
        </section>
      </section>

      <!-- 第 3 步：微调 -->
      <section v-if="stage === 2" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 3 步</span>
            <strong>逐页微调：换版式、换图、改文字</strong>
          </div>
          <button class="primary" :disabled="!project.pages.length" @click="goStage(3)">去导出</button>
        </div>

        <div class="pf-studio-layout">
          <aside class="pf-page-rail panel">
            <div class="mini-head">
              <span>页面</span>
              <strong>{{ project.pages.length }} 页</strong>
            </div>
            <div class="pf-thumb-list">
              <div
                v-for="(page, index) in project.pages"
                :key="page.id"
                class="pf-thumb"
                :class="{ active: selectedPageIndex === index, error: issuePages[index + 1] === 'error', warn: issuePages[index + 1] === 'warn' }"
                draggable="true"
                @dragstart="onThumbDragStart(index)"
                @dragover.prevent
                @drop="onThumbDrop(index)"
                @click="focusPage(index)"
              >
                <PortfolioPageCanvas
                  :project="project"
                  :page="page"
                  :page-no="index + 1"
                  :layout="state.portfolioPageLayout(page)"
                  :page-size="pageSize"
                  :resolve-slot="state.resolveSlot"
                  :watermark="project.book.showWatermark ? state.school.watermark : ''"
                />
                <span class="pf-thumb-label">
                  <strong>{{ index + 1 }}</strong>
                  <small>{{ kindLabels[page.kind] }}</small>
                  <i v-if="issuePages[index + 1]" :class="issuePages[index + 1]"></i>
                </span>
              </div>
            </div>
            <div class="pf-rail-actions">
              <div class="button-pair">
                <button class="ghost" :disabled="selectedPageIndex <= 0" @click="state.movePage(project, selectedPageIndex, -1)">上移</button>
                <button class="ghost" :disabled="selectedPageIndex >= project.pages.length - 1" @click="state.movePage(project, selectedPageIndex, 1)">下移</button>
              </div>
              <div class="button-pair">
                <button class="ghost" @click="state.duplicatePage(project, selectedPageIndex)">复制</button>
                <button class="ghost danger-action" @click="removeCurrentPage">删除</button>
              </div>
              <div class="button-pair pf-insert-pair">
                <button class="secondary" @click="state.insertPage(project, 'work', selectedPageIndex)">插入作品页</button>
                <button class="ghost" @click="state.insertPage(project, 'blank', selectedPageIndex)">插入空白页</button>
              </div>
            </div>
          </aside>

          <section class="pf-canvas-area panel">
            <div class="pf-canvas-head">
              <div class="pf-view-toggle">
                <button :class="{ selected: viewMode === 'spread' }" @click="viewMode = 'spread'">对页校对</button>
                <button :class="{ selected: viewMode === 'single' }" @click="viewMode = 'single'">单页编辑</button>
              </div>
              <div class="button-pair">
                <template v-if="viewMode === 'spread'">
                  <button class="ghost" :disabled="activeSpreadIndex <= 0" @click="moveSpread(-1)">上一对页</button>
                  <button class="ghost" :disabled="activeSpreadIndex >= spreads.length - 1" @click="moveSpread(1)">下一对页</button>
                </template>
                <template v-else>
                  <button class="ghost" :disabled="selectedPageIndex <= 0" @click="movePageIndex(-1)">上一页</button>
                  <button class="ghost" :disabled="selectedPageIndex >= project.pages.length - 1" @click="movePageIndex(1)">下一页</button>
                </template>
              </div>
            </div>

            <div class="pf-canvas-stage" :class="{ spread: viewMode === 'spread' }">
              <div v-for="entry in visiblePages" :key="entry.page.id" class="pf-canvas-slot">
                <PortfolioPageCanvas
                  :project="project"
                  :page="entry.page"
                  :page-no="entry.index + 1"
                  :layout="state.portfolioPageLayout(entry.page)"
                  :page-size="pageSize"
                  :resolve-slot="state.resolveSlot"
                  :selected-slot-key="selectedPageIndex === entry.index ? selectedSlotKey : ''"
                  :watermark="project.book.showWatermark ? state.school.watermark : ''"
                  editable
                  @select-slot="selectSlot(entry.index, $event)"
                  @drop-record="dropOnSlot(entry.index, $event)"
                />
                <small>第 {{ entry.index + 1 }} 页 · {{ kindLabels[entry.page.kind] }}</small>
              </div>
            </div>

            <section v-if="currentPage" class="pf-layout-candidates">
              <div class="mini-head">
                <span>第 {{ selectedPageIndex + 1 }} 页可选版式</span>
                <strong>{{ currentLayout.name }}</strong>
              </div>
              <div class="pf-candidate-row">
                <button
                  v-for="candidate in layoutCandidates"
                  :key="candidate.id"
                  class="pf-candidate"
                  :class="{ selected: candidate.id === currentPage.layoutId }"
                  @click="state.switchPageLayout(project, currentPage, candidate.id)"
                >
                  <PortfolioPageCanvas
                    :project="project"
                    :page="{ ...currentPage, layoutId: candidate.id }"
                    :page-no="selectedPageIndex + 1"
                    :layout="candidate"
                    :page-size="pageSize"
                    :resolve-slot="state.resolveSlot"
                    :watermark="''"
                  />
                  <small>{{ candidate.name }}</small>
                </button>
              </div>
            </section>

            <section class="pf-material-pool">
              <div class="mini-head">
                <div>
                  <span>素材池</span>
                  <strong>{{ projectRecords.length }} 件已选 · {{ state.unusedProjectRecords(project).length }} 件未上册</strong>
                </div>
                <button class="ghost" @click="goStage(0)">回第 1 步加作品</button>
              </div>
              <div class="pf-pool-row">
                <button
                  v-for="record in projectRecords"
                  :key="record.id"
                  class="pf-pool-item"
                  :class="{ used: usedRecordIds.has(record.id) }"
                  draggable="true"
                  @dragstart="onPoolDragStart($event, record)"
                  @click="assignFromPool(record)"
                >
                  <img :src="record.artwork" :alt="record.studentName" />
                  <small>{{ record.studentName }}</small>
                  <em v-if="!usedRecordIds.has(record.id)">未上册</em>
                </button>
              </div>
              <small class="pf-inspector-note">把图片拖到画布的图片位上，或者先点选画布图片位再点这里的作品。</small>
            </section>
          </section>

          <PortfolioInspector
            :state="state"
            :project="project"
            :page="currentPage"
            :page-index="selectedPageIndex"
            :active-slot="currentSlot"
            @clear-selection="selectedSlotKey = ''"
            @focus-page="focusPage"
          />
        </div>
      </section>

      <!-- 第 4 步：导出 -->
      <section v-if="stage === 3" class="step-panel">
        <div class="section-head">
          <div>
            <span>第 4 步</span>
            <strong>导出与交付</strong>
          </div>
        </div>

        <section class="pf-export-panel">
          <article class="archive-summary-card">
            <div>
              <span>成册体检</span>
              <strong>{{ errorIssues.length ? `${errorIssues.length} 项必须处理` : '全部通过，可以导出' }}</strong>
            </div>
            <article v-for="issue in issues" :key="issue.key" class="pf-issue-row" :class="issue.level">
              <div>
                <strong>{{ issue.title }}</strong>
                <small>{{ issue.detail }}</small>
              </div>
              <button v-if="issue.action === 'pad'" class="ghost" @click="state.padPortfolioPages(project)">补空白页</button>
              <button v-else-if="issue.pageNos.length" class="ghost" @click="goStage(2); focusPage(issue.pageNos[0] - 1)">去第 {{ issue.pageNos[0] }} 页</button>
            </article>
            <p v-if="!issues.length" class="pf-inspector-note">没有发现问题。</p>
          </article>

          <article class="pf-export-actions">
            <div class="mini-head">
              <div>
                <span>输出通道</span>
                <strong>{{ project.pages.length }} 页 · {{ state.portfolioPageSizes[template.pageSize].label }} · {{ template.binding }}</strong>
              </div>
            </div>
            <div class="pf-export-buttons">
              <button class="primary" :disabled="!state.portfolioReadyFor(project)" @click="exportProject('PDF')">导出 PDF 手册</button>
              <button class="secondary" :disabled="!state.portfolioReadyFor(project)" @click="exportProject('长图')">导出整册长图</button>
              <button class="secondary" :disabled="!state.portfolioReadyFor(project)" @click="publishLink">发布家长链接</button>
            </div>
            <small class="pf-inspector-note">导出文件会按机构规则落到百度网盘：{{ state.portfolioTemplateFor(project).projectType }} 目录。</small>
            <div v-if="project.collectionLink" class="pf-link-row">
              <div>
                <strong>家长链接已发布</strong>
                <small>{{ project.collectionLink }}</small>
              </div>
              <button class="ghost" @click="state.copyArchiveCollectionLink({ title: project.title, link: project.collectionLink })">复制链接</button>
            </div>
          </article>
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
              <strong>{{ job.exportType }} · {{ job.pages }} 页</strong>
              <small>{{ job.createdBy }} · {{ job.createdAt }}</small>
              <em>{{ job.fileUrl }}</em>
            </span>
            <div>
              <span class="pf-status-tag done">{{ job.status }}</span>
              <small>网盘：{{ job.cloudPath }}</small>
            </div>
          </article>
          <div v-if="!projectExportJobs.length" class="notice-box">
            <small>本项目还没有导出记录。</small>
          </div>
        </section>
      </section>

      <footer class="wizard-actions">
        <button class="ghost" :disabled="stage === 0" @click="goStage(stage - 1)">上一步</button>
        <button v-if="stage < 3" class="primary" @click="goStage(stage + 1)">下一步</button>
        <button v-else class="primary" :disabled="!state.portfolioReadyFor(project)" @click="exportProject('PDF')">导出 PDF 手册</button>
      </footer>
    </section>
  </template>

  <!-- 新建项目 -->
  <div v-if="showCreateModal" class="modal-backdrop">
    <section class="import-modal lesson-modal">
      <div class="modal-head">
        <div>
          <span>新建制作项目</span>
          <strong>选择册子类型和制作对象</strong>
        </div>
        <button class="ghost" @click="showCreateModal = false">关闭</button>
      </div>
      <div class="pf-choice-row">
        <button :class="{ selected: createDraft.scope === 'student' }" @click="createDraft.scope = 'student'">按学生</button>
        <button :class="{ selected: createDraft.scope === 'class' }" @click="createDraft.scope = 'class'">按班级</button>
      </div>
      <div class="form-grid">
        <label class="wide">
          册子模板
          <AdaptiveSelect v-model="createDraft.templateId" :options="templateOptions" />
        </label>
        <label v-if="createDraft.scope === 'student'" class="wide">
          学生
          <AdaptiveSelect v-model="createDraft.studentId" :options="studentOptions" />
        </label>
        <label v-else class="wide">
          班级
          <AdaptiveSelect v-model="createDraft.classId" :options="classOptions" />
        </label>
        <label class="wide">册子标题（留空自动生成）<input v-model="createDraft.title" /></label>
      </div>
      <div class="modal-actions">
        <button class="ghost" @click="showCreateModal = false">取消</button>
        <button class="primary" @click="confirmCreate">创建并去选料</button>
      </div>
    </section>
  </div>

  <!-- 批量成册 -->
  <div v-if="showBatchModal" class="modal-backdrop">
    <section class="import-modal lesson-modal">
      <div class="modal-head">
        <div>
          <span>按班级批量成册</span>
          <strong>一个班一次生成每人一本</strong>
        </div>
        <button class="ghost" @click="showBatchModal = false">关闭</button>
      </div>
      <div class="form-grid">
        <label>
          班级
          <AdaptiveSelect v-model="batchDraft.classId" :options="classOptions" />
        </label>
        <label>
          册子模板
          <AdaptiveSelect v-model="batchDraft.templateId" :options="templateOptions" />
        </label>
        <label>标题后缀<input v-model="batchDraft.titleSuffix" /></label>
        <label class="archive-check">
          <input v-model="batchDraft.highlightOnly" type="checkbox" />
          <span>只用高光作品</span>
        </label>
      </div>
      <DateRangeFilter v-model:start="batchDraft.dateStart" v-model:end="batchDraft.dateEnd" />
      <section v-if="batchPreview.length" class="pf-batch-preview">
        <div class="mini-head">
          <span>将生成</span>
          <strong>{{ batchPreview.filter((entry) => entry.records.length).length }} 本，跳过 {{ batchPreview.filter((entry) => !entry.records.length).length }} 人</strong>
        </div>
        <div class="pf-batch-rows">
          <span v-for="entry in batchPreview" :key="entry.student.id" :class="{ empty: !entry.records.length }">
            {{ entry.student.name }} · {{ entry.records.length }} 件
          </span>
        </div>
      </section>
      <div class="modal-actions">
        <button class="ghost" @click="showBatchModal = false">取消</button>
        <button class="primary" :disabled="!batchPreview.some((entry) => entry.records.length)" @click="confirmBatch">批量生成</button>
      </div>
    </section>
  </div>
</template>
