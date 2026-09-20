<script setup>
import AppIcon from '../common/AppIcon.vue'

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
      <span class="brand-mark"><AppIcon name="brand" :size="22" /></span>
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
        :title="group.description || group.label"
        :aria-current="activeGroupId === group.id ? 'page' : undefined"
        @click="$emit('select-group', group.id)"
      >
        <span class="nav-group-icon"><AppIcon :name="group.icon || 'brand'" :size="18" /></span>
        <span class="nav-group-copy"><strong>{{ group.label }}</strong></span>
      </button>
    </nav>

    <button type="button" class="nav-summary todo-entry" @click="$emit('open-todo-center')">
      <span class="nav-summary-label"><AppIcon name="todo" :size="16" />待办中心</span>
      <strong>{{ todoCount }} 个待办</strong>
      <small>其中 {{ pendingCount }} 个课后交付 · {{ wheatPendingCount }} 个小麦消课</small>
    </button>
  </aside>
</template>
