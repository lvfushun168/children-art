<script setup>
import { computed, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'
import TaskList from '../components/tasks/TaskList.vue'
import TaskWizard from '../components/tasks/TaskWizard.vue'

const props = defineProps({
  state: {
    type: Object,
    required: true
  },
  openWorkspaceSignal: {
    type: Number,
    default: 0
  },
  groupLabel: {
    type: String,
    default: ''
  }
})

defineEmits(['navigate', 'backToGroup'])

const workspaceOpen = ref(false)
const unfinishedTasks = computed(() => props.state.visibleTasks.filter((task) => task.status !== '已完成'))
const completedTasks = computed(() => props.state.visibleTasks.filter((task) => task.status === '已完成'))
const nextTask = computed(() => unfinishedTasks.value[0] || props.state.visibleTasks[0])

const openTask = (task) => {
  props.state.selectTask(task)
  workspaceOpen.value = true
}

watch(() => props.openWorkspaceSignal, (signal) => {
  if (signal) workspaceOpen.value = true
})
</script>

<template>
  <div v-if="state.toast" class="toast">{{ state.toast }}</div>
  <template v-if="!workspaceOpen">
    <button v-if="groupLabel" class="module-back-link" type="button" @click="$emit('backToGroup')">← 返回{{ groupLabel }}</button>
    <PageHead eyebrow="老师工作台" :title="`${state.currentUser?.name || '老师'}，今天辛苦了`" />
    <section class="today-hero">
      <div>
        <span>今日课后</span>
        <h2 v-if="unfinishedTasks.length">还有 {{ unfinishedTasks.length }} 节课待交付</h2>
        <h2 v-else>今天的课后交付都完成了</h2>
      </div>
      <button v-if="nextTask" class="primary hero-action" @click="openTask(nextTask)">
        {{ state.progressForTask(nextTask) ? '继续处理' : '开始处理' }}
        <small>{{ nextTask.time }} · {{ state.classes.find((item) => item.id === nextTask.classId)?.name }}</small>
      </button>
    </section>
    <div class="today-summary">
      <article><strong>{{ state.visibleTasks.length }}</strong><span>今日课次</span></article>
      <article><strong>{{ unfinishedTasks.length }}</strong><span>待完成</span></article>
      <article><strong>{{ completedTasks.length }}</strong><span>已交付</span></article>
    </div>
    <TaskList
      class="today-task-list"
      :tasks="state.visibleTasks"
      :active-task-id="state.activeTaskId"
      :classes="state.classes"
      :courses="state.courses"
      :teachers="state.teachers"
      :progress-for-task="state.progressForTask"
      @select-task="openTask"
      @add-lesson="state.addLesson"
    />
  </template>

  <template v-else>
    <div class="focus-breadcrumb">
      <button class="back-link" @click="workspaceOpen = false">← 返回今日课后</button>
    </div>
    <div class="focus-layout">
      <TaskWizard :state="state" @back="workspaceOpen = false" @navigate="$emit('navigate', $event)" />
    </div>
  </template>
</template>
