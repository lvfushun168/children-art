<script setup>
defineProps({
  tasks: {
    type: Array,
    required: true
  },
  activeTaskId: {
    type: Number,
    required: true
  },
  classes: {
    type: Array,
    required: true
  },
  courses: {
    type: Array,
    required: true
  }
})

defineEmits(['select-task'])
</script>

<template>
  <aside class="task-list panel">
    <div class="section-head">
      <div>
        <span>课表生成</span>
        <strong>{{ tasks.length }} 个课后任务</strong>
      </div>
    </div>
    <button
      v-for="task in tasks"
      :key="task.id"
      class="task-card"
      :class="{ active: task.id === activeTaskId }"
      @click="$emit('select-task', task)"
    >
      <span class="time">{{ task.time }}</span>
      <span>
        <strong>{{ classes.find((item) => item.id === task.classId).name }}</strong>
        <small>{{ courses.find((item) => item.id === task.courseId).title }} · {{ task.teacher }}</small>
      </span>
      <em>{{ task.status }}</em>
    </button>
  </aside>
</template>
