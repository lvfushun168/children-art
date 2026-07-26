<script setup>
defineProps({
  activeGroupId: {
    type: String,
    required: true
  },
  navGroups: {
    type: Array,
    required: true
  },
  pendingCount: {
    type: Number,
    required: true
  },
  todoCount: {
    type: Number,
    required: true
  },
  wheatPendingCount: {
    type: Number,
    required: true
  },
  school: {
    type: Object,
    required: true
  }
})

defineEmits(['select-group', 'open-todo-center'])
</script>

<template>
  <aside class="nav-rail">
    <div class="brand">
      <span class="brand-mark">课</span>
      <div>
        <strong>课后交付系统</strong>
        <small>{{ school.name }} · {{ school.campus }}</small>
      </div>
    </div>

    <nav class="nav-groups" aria-label="一级板块">
      <button
        v-for="group in navGroups"
        :key="group.id"
        type="button"
        class="nav-group-button"
        :class="{ active: activeGroupId === group.id }"
        @click="$emit('select-group', group.id)"
      >
        <strong>{{ group.label }}</strong>
        <small>{{ group.description }}</small>
      </button>
    </nav>

    <button class="nav-summary todo-entry" @click="$emit('open-todo-center')">
      <span>待办中心</span>
      <strong>{{ todoCount }} 个待办</strong>
      <small>{{ pendingCount }} 个课后交付 · {{ wheatPendingCount }} 个小麦留痕</small>
    </button>
  </aside>
</template>
