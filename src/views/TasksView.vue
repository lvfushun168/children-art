<script setup>
import { computed, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'
import TaskList from '../components/tasks/TaskList.vue'
import TaskWizard from '../components/tasks/TaskWizard.vue'
import { sameId } from '../services/mappers'

const props = defineProps({
  state: {
    type: Object,
    required: true
  },
  workspaceLaunch: {
    type: Object,
    default: null
  },
  groupLabel: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['navigate', 'backToGroup', 'backToSource'])

const workspaceOpen = ref(false)
const workspaceSource = computed(() => props.workspaceLaunch?.source || 'today')
const todayTasks = computed(() => {
  const matched = props.state.visibleTasks.filter((task) => task.dateValue === props.state.latestLessonDate)
  return matched.length ? matched : props.state.visibleTasks
})
const unfinishedTasks = computed(() => todayTasks.value.filter((task) => task.status !== '已完成'))
const completedTasks = computed(() => todayTasks.value.filter((task) => task.status === '已完成'))
const nextTask = computed(() => unfinishedTasks.value[0] || todayTasks.value[0])

const openTask = (task) => {
  props.state.selectTask(task)
  workspaceOpen.value = true
}

watch(() => props.workspaceLaunch, (launch) => {
  workspaceOpen.value = Boolean(launch)
}, { immediate: true })

const backFromWorkspace = () => {
  if (workspaceSource.value === 'schedule') {
    emit('backToSource', 'schedule')
    return
  }
  workspaceOpen.value = false
}
</script>

<template>
  <div v-if="state.toast" class="toast">{{ state.toast }}</div>
  <template v-if="!workspaceOpen">
    <button v-if="groupLabel" class="module-back-link" type="button" @click="$emit('backToGroup')">← 返回{{ groupLabel }}</button>
    <PageHead eyebrow="老师工作台" :title="`${state.currentUser?.name || '老师'}，今天辛苦了`" />
    <section v-if="!state.isAdmin && !state.currentUser?.teacherLinked" class="notice-box" role="alert">
      <strong>当前账号尚未关联老师档案</strong>
      <small>请联系管理员在“基础信息 → 老师”中绑定已有账号，关联完成后才能看到本人课次。</small>
    </section>
    <section class="today-hero">
      <div>
        <span>今日课后</span>
        <h2 v-if="unfinishedTasks.length">还有 {{ unfinishedTasks.length }} 节课待交付</h2>
        <h2 v-else>今天的课后交付都完成了</h2>
      </div>
      <button v-if="nextTask" class="primary hero-action" @click="openTask(nextTask)">
        {{ state.progressForTask(nextTask) ? '继续处理' : '开始处理' }}
        <small>{{ nextTask.time }} · {{ nextTask.className || state.classes.find((item) => sameId(item.id, nextTask.classId))?.name }}</small>
      </button>
    </section>
    <div class="today-summary">
      <article><strong>{{ todayTasks.length }}</strong><span>今日课次</span></article>
      <article><strong>{{ unfinishedTasks.length }}</strong><span>待完成</span></article>
      <article><strong>{{ completedTasks.length }}</strong><span>已交付</span></article>
    </div>
    <TaskList
      class="today-task-list"
      :tasks="todayTasks"
      :active-task-id="state.activeTaskId"
      :classes="state.classes"
      :courses="state.courses"
      :teachers="state.teachers"
      :load-references="() => state.ensurePageData?.('tasks')"
      :progress-for-task="state.progressForTask"
      @select-task="openTask"
      @add-lesson="state.addLesson"
    />
  </template>

  <template v-else>
    <div class="focus-breadcrumb">
      <button class="back-link" @click="backFromWorkspace">← 返回{{ workspaceSource === 'schedule' ? '课表' : '今日课后' }}</button>
    </div>
    <div class="focus-layout">
      <TaskWizard :state="state" @back="backFromWorkspace" @navigate="emit('navigate', $event)" />
    </div>
  </template>
</template>
