<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'
import PaginationBar from '../components/common/PaginationBar.vue'
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
  }
})
defineEmits(['backToGroup'])

const selectedId = ref(null)
const detailRecord = ref(null)
const mode = ref('detail')
const activeTab = ref('task')
const workMode = ref('list')
const editingWorkId = ref(null)
const workError = ref('')
const isMobileFlow = ref(false)
const mobileShowingDetail = ref(false)
const queryInput = ref('')
const taskTypeInput = ref('all')
const ownerInput = ref('all')
const lessonInput = ref('all')
const statusInput = ref('all')
const dueFromInput = ref('')
const dueToInput = ref('')
let cleanupMobileMedia = () => {}
const pageState = computed(() => props.state.directoryPages?.extraTasks || { items: [], page: 1, pageSize: 20, total: 0 })
const tasks = computed(() => pageState.value.items || [])
const selected = computed(() => detailRecord.value || tasks.value.find((task) => sameId(task.id, selectedId.value)) || null)
const drawerOpen = computed(() => mode.value === 'new' || Boolean(selected.value && (!isMobileFlow.value || mobileShowingDetail.value)))
const selectedWorks = computed(() => selected.value ? props.state.extraTaskWorksForTask(selected.value.id) : [])

const taskTypeOptions = [{ label: '全部类型', value: 'all' }, '学生课外任务', '亲子观察任务', '学生课外作品', '材料准备提醒', '其他']
const taskStatusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '待发布', value: 'DRAFT' }, { label: '已发布', value: 'PUBLISHED' },
  { label: '进行中', value: 'IN_PROGRESS' }, { label: '待归档', value: 'PENDING_ARCHIVE' },
  { label: '已归档', value: 'ARCHIVED' }, { label: '已取消', value: 'CANCELED' }
]
const ownerOptions = computed(() => [{ label: '全部负责人', value: 'all' }, ...(props.state.teachers || []).map((teacher) => ({ label: teacher.name, value: teacher.id }))])
const lessonFilterOptions = computed(() => [{ label: '全部课次', value: 'all' }, ...(props.state.tasks || []).map((task) => ({ label: `${task.date || task.dateValue} · ${task.className || task.classId || ''}`, value: task.id }))])

const lessonOptions = computed(() =>
  props.state.tasks.map((task) => {
    const klass = props.state.classes.find((item) => sameId(item.id, task.classId))
    return { id: task.id, label: `${task.date} ${task.time} · ${klass?.name || '班级'} · ${task.teacher}` }
  })
)

const blankDraft = () => ({
  title: '',
  taskType: '学生课外任务',
  owner: props.state.currentUser?.name || '',
  relatedLessonId: '',
  content: '',
  dueDate: '',
  status: '待发布',
  note: ''
})

const draft = ref(blankDraft())
const studentOptions = computed(() =>
  props.state.students.filter((student) => !student.archived).map((student) => {
    const klass = props.state.classes.find((item) => sameId(item.id, student.classId))
    return { label: `${student.name} · ${klass?.name || '未归属班级'}`, value: student.id }
  })
)
const defaultWorkDate = () => {
  const relatedLesson = props.state.tasks.find((task) => sameId(task.id, selected.value?.relatedLessonId))
  return relatedLesson?.dateValue || new Date().toISOString().slice(0, 10)
}
const blankWorkDraft = () => ({
  studentId: studentOptions.value[0]?.value || '',
  dateValue: defaultWorkDate(),
  artwork: '',
  title: '',
  description: '',
  tagsText: '课外作品',
  note: '',
  highlight: false,
  highlightNote: ''
})
const workDraft = ref(blankWorkDraft())
const resetDraft = () => {
  draft.value = mode.value === 'new' ? blankDraft() : JSON.parse(JSON.stringify(selected.value || blankDraft()))
  if (!draft.value.relatedLessonId) draft.value.relatedLessonId = ''
}
const resetWorkDraft = () => {
  workDraft.value = blankWorkDraft()
  editingWorkId.value = null
  workError.value = ''
}

const loadDirectory = async (page = 1) => {
  detailRecord.value = null
  selectedId.value = null
  mode.value = 'detail'
  await props.state.loadDirectoryPage?.('extraTasks', {
    page,
    pageSize: 20,
    query: queryInput.value.trim() || undefined,
    taskType: taskTypeInput.value === 'all' ? undefined : taskTypeInput.value,
    ownerId: ownerInput.value === 'all' ? undefined : ownerInput.value,
    relatedLessonId: lessonInput.value === 'all' ? undefined : lessonInput.value,
    dueFrom: dueFromInput.value || undefined,
    dueTo: dueToInput.value || undefined,
    status: statusInput.value === 'all' ? undefined : statusInput.value
  })
}
const resetFilters = () => {
  queryInput.value = ''
  taskTypeInput.value = 'all'
  ownerInput.value = 'all'
  lessonInput.value = 'all'
  statusInput.value = 'all'
  dueFromInput.value = ''
  dueToInput.value = ''
  return loadDirectory(1)
}

watch(selected, () => {
  if (mode.value !== 'new') resetDraft()
  resetWorkDraft()
  if (selected.value) void props.state.loadDirectoryExtraTaskWorks?.(selected.value.id)
}, { immediate: true })

const selectTask = async (task) => {
  selectedId.value = task.id
  detailRecord.value = null
  mode.value = 'detail'
  activeTab.value = 'task'
  workMode.value = 'list'
  resetDraft()
  if (isMobileFlow.value) mobileShowingDetail.value = true
  try {
    const detail = await props.state.loadDirectoryDetail?.('extraTasks', task)
    if (sameId(selectedId.value, task.id)) {
      detailRecord.value = detail || task
      draft.value = JSON.parse(JSON.stringify(detail || task))
    }
  } catch {
    detailRecord.value = task
  }
}

const startNew = () => {
  mode.value = 'new'
  selectedId.value = null
  detailRecord.value = null
  activeTab.value = 'task'
  draft.value = blankDraft()
  if (isMobileFlow.value) mobileShowingDetail.value = true
}

const startEdit = () => {
  if (!selected.value) return
  mode.value = 'edit'
  activeTab.value = 'task'
  resetDraft()
}

const save = async () => {
  const wasNew = mode.value === 'new'
  const saved = wasNew
    ? await props.state.addExtraTask(draft.value)
    : await props.state.updateExtraTask(selected.value.id, draft.value)
  if (!saved) return
  if (wasNew) {
    mobileShowingDetail.value = false
    await loadDirectory(1)
    resetDraft()
    return
  }
  selectedId.value = saved.id
  mode.value = 'detail'
  if (isMobileFlow.value) mobileShowingDetail.value = true
  await loadDirectory(wasNew ? 1 : pageState.value.page)
  selectedId.value = saved.id
  detailRecord.value = await props.state.loadDirectoryDetail?.('extraTasks', saved).catch(() => saved)
  resetDraft()
}

const handleWorkImage = (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  workDraft.value.artworkFile = file
  workDraft.value.artwork = URL.createObjectURL(file)
  if (!workDraft.value.title) workDraft.value.title = file.name.replace(/\.[^.]+$/, '')
}

const startNewWork = () => {
  activeTab.value = 'works'
  workMode.value = 'new'
  resetWorkDraft()
}

const startEditWork = (record) => {
  activeTab.value = 'works'
  workMode.value = 'edit'
  editingWorkId.value = record.id
  workError.value = ''
  workDraft.value = {
    studentId: record.studentId,
    dateValue: record.dateValue || defaultWorkDate(),
    fileId: record.fileId || null,
    artwork: record.artwork || '',
    title: record.title || '',
    description: record.description || '',
    tagsText: (record.tags || []).join('、'),
    note: record.note || '',
    highlight: Boolean(record.highlight),
    highlightNote: record.highlightNote || '',
    version: record.version
  }
}

const cancelWorkEdit = () => {
  workMode.value = 'list'
  resetWorkDraft()
}

const saveWork = async () => {
  workError.value = ''
  if (!workDraft.value.studentId) {
    workError.value = '请选择学生。'
    return
  }
  if (!workDraft.value.artwork) {
    workError.value = '请上传作品图片。'
    return
  }
  const payload = {
    ...workDraft.value,
    tags: workDraft.value.tagsText.split(/[，,、]/)
  }
  const saved = workMode.value === 'new'
    ? await props.state.addExtraTaskWork(selected.value.id, payload)
    : await props.state.updateExtraTaskWork(editingWorkId.value, payload)
  if (!saved) return
  workMode.value = 'list'
  resetWorkDraft()
}

const deleteWork = (record) => {
  if (!window.confirm(`确定删除「${record.title}」吗？删除后课外作品档案中也会同步移除。`)) return
  props.state.deleteExtraTaskWork(record.id)
  if (sameId(editingWorkId.value, record.id)) cancelWorkEdit()
}

const returnToList = () => {
  mode.value = 'detail'
  activeTab.value = 'task'
  workMode.value = 'list'
  selectedId.value = null
  detailRecord.value = null
  resetDraft()
  mobileShowingDetail.value = false
}

const cancelEdit = () => {
  const wasNew = mode.value === 'new'
  mode.value = 'detail'
  activeTab.value = 'task'
  workMode.value = 'list'
  resetDraft()
  resetWorkDraft()
  if (wasNew) {
    selectedId.value = null
    detailRecord.value = null
    mobileShowingDetail.value = false
  }
}

onMounted(() => {
  void loadDirectory(1)
  const media = window.matchMedia('(max-width: 680px)')
  const syncMobile = () => {
    isMobileFlow.value = media.matches
    if (media.matches) mobileShowingDetail.value = false
  }
  syncMobile()
  media.addEventListener('change', syncMobile)
  cleanupMobileMedia = () => media.removeEventListener('change', syncMobile)
})

onBeforeUnmount(() => cleanupMobileMedia())
</script>

<template>
  <button
    v-if="groupLabel && (!isMobileFlow || !mobileShowingDetail)"
    class="module-back-link"
    type="button"
    @click="$emit('backToGroup')"
  >
    ← 返回{{ groupLabel }}
  </button>

  <button
    v-if="isMobileFlow && mobileShowingDetail"
    class="module-back-link"
    type="button"
    @click="returnToList"
  >
    ← 返回列表
  </button>

  <PageHead title="学生课外任务">
    <div class="button-pair">
      <button v-if="selected && mode === 'detail'" class="secondary" type="button" @click="startEdit">编辑当前任务</button>
      <button class="primary" @click="startNew">新增课外任务</button>
    </div>
  </PageHead>

  <section class="directory-page" :class="{ 'mobile-detail-open': isMobileFlow && mobileShowingDetail }">
    <form class="directory-toolbar panel" @submit.prevent="loadDirectory(1)">
      <label class="directory-search"><span>关键词</span><input v-model="queryInput" placeholder="任务标题、内容" /></label>
      <label><span>任务类型</span><AdaptiveSelect v-model="taskTypeInput" :options="taskTypeOptions" /></label>
      <label><span>负责人</span><AdaptiveSelect v-model="ownerInput" :options="ownerOptions" /></label>
      <label><span>课次</span><AdaptiveSelect v-model="lessonInput" :options="lessonFilterOptions" /></label>
      <label><span>状态</span><AdaptiveSelect v-model="statusInput" :options="taskStatusOptions" /></label>
      <label><span>截止日期起</span><input v-model="dueFromInput" type="date" /></label>
      <label><span>截止日期止</span><input v-model="dueToInput" type="date" /></label>
      <div class="button-pair directory-toolbar-actions"><button class="secondary" type="submit">查询</button><button class="ghost" type="button" @click="resetFilters">重置</button></div>
    </form>

    <section v-show="!isMobileFlow || !mobileShowingDetail" class="panel directory-list-panel">
      <div class="section-head">
        <div><span>任务列表</span><strong>{{ pageState.total }} 条记录</strong></div>
        <small v-if="state.directoryLoading?.extraTasks">正在加载…</small>
      </div>
      <div v-if="state.directoryErrors?.extraTasks" class="notice-box error-box"><small>{{ state.directoryErrors.extraTasks }}</small><button class="ghost" type="button" @click="loadDirectory(pageState.page)">重试</button></div>
      <div v-else-if="!tasks.length && !state.directoryLoading?.extraTasks" class="notice-box"><small>暂无符合条件的课外任务。</small></div>
      <div v-else class="directory-table-wrap">
        <table class="directory-table">
          <thead><tr><th>任务标题</th><th>类型 / 负责人</th><th>关联课次</th><th>截止日期</th><th>作品数</th><th>状态</th><th>操作</th></tr></thead>
          <tbody><tr v-for="task in tasks" :key="task.id" class="directory-table-row" :class="{ active: sameId(selected?.id, task.id) }" @click="selectTask(task)"><td><strong>{{ task.title }}</strong></td><td>{{ task.taskType }} · {{ task.owner || '未指定' }}</td><td>{{ task.relatedLessonDate || task.relatedLesson || '无归属课次' }}<small v-if="task.relatedClassName"> · {{ task.relatedClassName }}</small></td><td>{{ task.dueDate || '—' }}</td><td>{{ task.artworkCount || 0 }}<span v-if="task.highlightArtworkCount"> · 高光 {{ task.highlightArtworkCount }}</span></td><td><span class="status-tag">{{ task.status }}</span></td><td><button class="ghost" type="button" @click.stop="selectTask(task)">查看详情</button></td></tr></tbody>
        </table>
        <div class="directory-mobile-cards"><button v-for="task in tasks" :key="task.id" class="directory-card" type="button" @click="selectTask(task)"><strong>{{ task.title }}</strong><span>{{ task.taskType }} · {{ task.owner || '未指定负责人' }}</span><small>{{ task.relatedLessonDate || task.relatedLesson || '无归属课次' }} · {{ task.artworkCount || 0 }} 件作品</small><em>{{ task.status }}</em></button></div>
        <PaginationBar :page="pageState.page" :page-size="pageState.pageSize" :total="pageState.total" :loading="state.directoryLoading?.extraTasks" @change="loadDirectory" />
      </div>
    </section>

    <div v-if="drawerOpen" class="directory-drawer-backdrop" @click.self="returnToList">
      <section class="panel directory-drawer">
      <div class="section-head">
        <div>
          <span>{{ mode === 'new' ? '新增' : mode === 'edit' ? '编辑' : '详情' }}</span>
          <strong>{{ mode === 'new' ? '新增课外任务' : selected?.title }}</strong>
        </div>
        <div class="button-pair">
          <button v-if="mode === 'detail'" class="ghost" type="button" @click="returnToList">关闭</button>
          <button v-if="mode === 'detail' && activeTab === 'task'" class="secondary" type="button" @click="startEdit">编辑任务</button>
          <button v-if="mode !== 'detail'" class="ghost" type="button" @click="cancelEdit">取消</button>
          <button v-if="mode !== 'detail'" class="primary" @click="save">保存</button>
          <button v-if="mode === 'detail' && activeTab === 'works'" class="primary" @click="startNewWork">上传交付作品</button>
        </div>
      </div>

      <div v-if="mode !== 'new'" class="student-tabs extra-task-tabs">
        <button :class="{ selected: activeTab === 'task' }" @click="activeTab = 'task'">任务信息</button>
        <button :class="{ selected: activeTab === 'works' }" @click="activeTab = 'works'">交付作品 {{ selectedWorks.length }}</button>
      </div>

      <div v-if="activeTab === 'task'" class="form-grid">
        <label>任务标题<input v-model="draft.title" /></label>
        <label>
          任务类型
          <AdaptiveSelect v-model="draft.taskType" :options="['学生课外任务', '亲子观察任务', '学生课外作品', '材料准备提醒', '其他']" />
        </label>
          <label>
            发布老师
            <AdaptiveSelect v-model="draft.owner" :options="state.teachers.filter((teacher) => !teacher.archived).map((teacher) => teacher.name)" />
          </label>
        <label>
          关联课次
          <AdaptiveSelect v-model="draft.relatedLessonId" :options="[{ label: '无归属课次', value: '' }, ...lessonOptions.map((lesson) => ({ label: lesson.label, value: lesson.id }))]" />
        </label>
        <label>预计完成<input v-model="draft.dueDate" /></label>
        <label>
          状态
          <AdaptiveSelect v-model="draft.status" :options="['待发布', '已发布', '进行中', '待归档', '已归档', '已取消']" />
        </label>
        <label class="wide">任务内容<textarea v-model="draft.content" rows="5" /></label>
        <label class="wide">归档备注<textarea v-model="draft.note" rows="4" /></label>
      </div>

      <section v-else class="extra-task-works">
        <div v-if="workMode !== 'list'" class="extra-task-work-editor">
          <div class="section-head">
            <div>
              <span>{{ workMode === 'new' ? '新增交付作品' : '编辑交付作品' }}</span>
            </div>
          </div>
          <div class="form-grid">
            <label>
              学生
              <AdaptiveSelect v-model="workDraft.studentId" :options="studentOptions" />
            </label>
            <label>交付日期<input v-model="workDraft.dateValue" type="date" /></label>
            <label class="wide file-button extra-task-file" :class="{ disabled: workMode === 'edit' }">
              选择作品图片
              <input type="file" accept="image/*" :disabled="workMode === 'edit'" @change="handleWorkImage" />
            </label>
            <label class="wide">作品标题<input v-model="workDraft.title" placeholder="例如：浩浩的课外小鱼练习" /></label>
            <label class="wide">作品说明<textarea v-model="workDraft.description" rows="3" /></label>
            <label class="wide">标签<input v-model="workDraft.tagsText" placeholder="使用逗号或顿号分隔" /></label>
            <label class="wide">档案备注<textarea v-model="workDraft.note" rows="3" /></label>
          </div>
          <figure v-if="workDraft.artwork" class="extra-task-work-preview">
            <ProtectedMedia :file-id="workDraft.fileId" :src="workDraft.artwork" alt="课外作品预览" />
            <figcaption>归档预览</figcaption>
          </figure>
          <label class="archive-toggle-row">
            <input v-model="workDraft.highlight" type="checkbox" />
            <span>标记为高光作品</span>
          </label>
          <label v-if="workDraft.highlight">高光说明<textarea v-model="workDraft.highlightNote" rows="3" /></label>
          <div class="extra-task-editor-actions">
            <p v-if="workError">{{ workError }}</p>
            <div>
              <button class="ghost" @click="cancelWorkEdit">取消</button>
              <button class="primary" @click="saveWork">保存课外作品</button>
            </div>
          </div>
        </div>

        <template v-else>
          <div v-if="!selectedWorks.length" class="notice-box">
            <small>暂无归档交付作品。</small>
          </div>
          <div v-else class="extra-task-work-grid">
            <article v-for="work in selectedWorks" :key="work.id" class="archive-block extra-task-work-card">
              <ProtectedMedia :file-id="work.fileId" :src="work.artwork" :alt="work.title" />
              <div>
                <span>{{ work.studentName }} · {{ work.date }}</span>
                <strong>{{ work.title }}</strong>
                <p>{{ work.description || '暂无作品说明。' }}</p>
                <em v-if="work.highlight">高光作品</em>
              </div>
              <footer>
                <button class="secondary" @click="startEditWork(work)">编辑</button>
                <button class="danger-text" @click="deleteWork(work)">删除</button>
              </footer>
            </article>
          </div>
        </template>
      </section>
      </section>
    </div>
  </section>
</template>
