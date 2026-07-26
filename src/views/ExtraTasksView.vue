<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'

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

const selectedId = ref(props.state.extraTaskArchives[0]?.id || null)
const mode = ref('detail')
const isMobileFlow = ref(false)
const mobileShowingDetail = ref(false)
let cleanupMobileMedia = () => {}
const selected = computed(() => props.state.extraTaskArchives.find((task) => task.id === selectedId.value) || props.state.extraTaskArchives[0])

const lessonOptions = computed(() =>
  props.state.tasks.map((task) => {
    const klass = props.state.classes.find((item) => item.id === task.classId)
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
const resetDraft = () => {
  draft.value = mode.value === 'new' ? blankDraft() : JSON.parse(JSON.stringify(selected.value || blankDraft()))
  if (!draft.value.relatedLessonId) draft.value.relatedLessonId = ''
}

watch(selected, () => {
  if (mode.value !== 'new') resetDraft()
}, { immediate: true })

const selectTask = (task) => {
  selectedId.value = task.id
  mode.value = 'detail'
  resetDraft()
  if (isMobileFlow.value) mobileShowingDetail.value = true
}

const startNew = () => {
  mode.value = 'new'
  draft.value = blankDraft()
  if (isMobileFlow.value) mobileShowingDetail.value = true
}

const startEdit = () => {
  mode.value = 'edit'
  resetDraft()
}

const save = () => {
  const saved = mode.value === 'new'
    ? props.state.addExtraTask(draft.value)
    : props.state.updateExtraTask(selected.value.id, draft.value)
  selectedId.value = saved.id
  mode.value = 'detail'
  if (isMobileFlow.value) mobileShowingDetail.value = true
  resetDraft()
}

const returnToList = () => {
  mode.value = 'detail'
  resetDraft()
  mobileShowingDetail.value = false
}

onMounted(() => {
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
      <button class="secondary" @click="startEdit">编辑当前任务</button>
      <button class="primary" @click="startNew">新增课外任务</button>
    </div>
  </PageHead>

  <section class="extra-task-layout" :class="{ 'mobile-detail-open': isMobileFlow && mobileShowingDetail }">
    <aside v-show="!isMobileFlow || !mobileShowingDetail" class="panel master-list">
      <div class="section-head">
        <div>
          <span>任务列表</span>
          <strong>{{ state.extraTaskArchives.length }} 条记录</strong>
        </div>
      </div>
      <button
        v-for="task in state.extraTaskArchives"
        :key="task.id"
        class="master-row"
        :class="{ active: selected?.id === task.id && mode !== 'new' }"
        @click="selectTask(task)"
      >
        <strong>{{ task.title }}</strong>
        <span>{{ task.taskType }} · {{ task.status }}</span>
        <small>{{ task.relatedLesson }}</small>
      </button>
    </aside>

    <section v-show="!isMobileFlow || mobileShowingDetail" class="panel">
      <div class="section-head">
        <div>
          <span>{{ mode === 'new' ? '新增' : mode === 'edit' ? '编辑' : '详情' }}</span>
          <strong>{{ mode === 'new' ? '新增课外任务' : selected?.title }}</strong>
        </div>
        <div class="button-pair">
          <button v-if="mode !== 'detail'" class="ghost" @click="mode = 'detail'; resetDraft()">取消</button>
          <button v-if="mode !== 'detail'" class="primary" @click="save">保存归档</button>
        </div>
      </div>

      <div class="form-grid">
        <label>任务标题<input v-model="draft.title" /></label>
        <label>
          任务类型
          <select v-model="draft.taskType">
            <option>学生课外任务</option>
            <option>亲子观察任务</option>
            <option>学生课外作品</option>
            <option>材料准备提醒</option>
            <option>其他</option>
          </select>
        </label>
        <label>
          发布老师
          <select v-model="draft.owner">
            <option v-for="teacher in state.teachers" :key="teacher.id">{{ teacher.name }}</option>
          </select>
        </label>
        <label>
          关联课次
          <select v-model="draft.relatedLessonId">
            <option value="">无归属课次</option>
            <option v-for="lesson in lessonOptions" :key="lesson.id" :value="lesson.id">{{ lesson.label }}</option>
          </select>
        </label>
        <label>预计完成<input v-model="draft.dueDate" /></label>
        <label>
          状态
          <select v-model="draft.status">
            <option>待发布</option>
            <option>已发布</option>
            <option>待归档</option>
            <option>已归档</option>
            <option>异常</option>
          </select>
        </label>
        <label class="wide">任务内容<textarea v-model="draft.content" rows="5" /></label>
        <label class="wide">归档备注<textarea v-model="draft.note" rows="4" /></label>
      </div>
    </section>
  </section>
</template>
