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
  <PageHead eyebrow="老师工作台" title="今日课后任务" />

  <div class="task-layout">
    <TaskList
      :tasks="state.visibleTasks"
      :active-task-id="state.activeTaskId"
      :classes="state.classes"
      :courses="state.courses"
      :teachers="state.teachers"
      :progress-for-task="state.progressForTask"
      @select-task="state.selectTask"
      @add-lesson="state.addLesson"
    />

    <TaskWizard :state="state" @navigate="$emit('navigate', $event)" />

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
      @copy-export="state.copyExport"
    />
  </div>
</template>
