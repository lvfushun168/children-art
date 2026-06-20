<script setup>
import PageHead from '../components/layout/PageHead.vue'
import DeliveryPreview from '../components/tasks/DeliveryPreview.vue'
import TaskList from '../components/tasks/TaskList.vue'
import TaskWizard from '../components/tasks/TaskWizard.vue'

defineProps({
  state: {
    type: Object,
    required: true
  }
})

defineEmits(['navigate'])
</script>

<template>
  <div v-if="state.toast" class="toast">{{ state.toast }}</div>
  <PageHead eyebrow="老师工作台" title="今日课后任务">
    <div class="progress-card">
      <span>当前班级完成度</span>
      <strong>{{ state.taskProgress }}%</strong>
      <div class="progress-track">
        <i :style="{ width: `${state.taskProgress}%` }"></i>
      </div>
    </div>
  </PageHead>

  <div class="task-layout">
    <TaskList
      :tasks="state.tasks"
      :active-task-id="state.activeTaskId"
      :classes="state.classes"
      :courses="state.courses"
      @select-task="state.selectTask"
    />

    <TaskWizard :state="state" @navigate="$emit('navigate', $event)" />

    <DeliveryPreview
      :active-student="state.activeStudent"
      :active-session-student="state.activeSessionStudent"
      :active-course="state.activeCourse"
      :active-image-template="state.activeImageTemplate"
      :school="state.school"
      :export-text="state.exportText"
      :copied="state.copied"
      :preview-pulse="state.previewPulse"
      :comment-pulse="state.commentPulse"
      :file-name-for="state.fileNameFor"
      @copy-export="state.copyExport"
    />
  </div>
</template>
