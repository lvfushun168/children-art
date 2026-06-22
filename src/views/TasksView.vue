<script setup>
import { computed, ref } from 'vue'
import PageHead from '../components/layout/PageHead.vue'
import DeliveryPreview from '../components/tasks/DeliveryPreview.vue'
import TaskList from '../components/tasks/TaskList.vue'
import TaskWizard from '../components/tasks/TaskWizard.vue'

const props = defineProps({
  state: {
    type: Object,
    required: true
  }
})

defineEmits(['navigate'])

const workspaceOpen = ref(false)
const unfinishedTasks = computed(() => props.state.visibleTasks.filter((task) => task.status !== '已完成'))
const completedTasks = computed(() => props.state.visibleTasks.filter((task) => task.status === '已完成'))
const nextTask = computed(() => unfinishedTasks.value[0] || props.state.visibleTasks[0])

const openTask = (task) => {
  props.state.selectTask(task)
  workspaceOpen.value = true
}
</script>

<template>
  <div v-if="state.toast" class="toast">{{ state.toast }}</div>
  <template v-if="!workspaceOpen">
    <PageHead eyebrow="老师工作台" :title="`${state.currentUser?.name || '老师'}，今天辛苦了`" />
    <section class="today-hero">
      <div>
        <span>今日课后</span>
        <h2 v-if="unfinishedTasks.length">还有 {{ unfinishedTasks.length }} 节课待交付</h2>
        <h2 v-else>今天的课后交付都完成了</h2>
        <p>{{ unfinishedTasks.length ? '从最近一节课开始，系统会一步一步带你完成。' : '作品、课评和家长展示都已妥善归档。' }}</p>
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
      <span>一次只处理一节课，进度会自动保存</span>
    </div>
    <div class="focus-layout" :class="{ 'with-preview': state.currentStep === 5 }">
      <TaskWizard :state="state" @back="workspaceOpen = false" @navigate="$emit('navigate', $event)" />

      <DeliveryPreview
        v-if="state.currentStep === 5"
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
        @copy-export="state.copyExport"
      />
    </div>
  </template>
</template>
