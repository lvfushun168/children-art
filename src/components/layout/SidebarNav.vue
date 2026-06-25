<script setup>
defineProps({
  activeNav: {
    type: String,
    required: true
  },
  navItems: {
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

defineEmits(['update:activeNav', 'open-todo-center'])
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

    <nav class="main-nav">
      <button
        v-for="item in navItems"
        :key="item.id"
        :class="{ active: activeNav === item.id }"
        @click="$emit('update:activeNav', item.id)"
      >
        {{ item.label }}
      </button>
    </nav>

    <button class="nav-summary todo-entry" @click="$emit('open-todo-center')">
      <span>待办中心</span>
      <strong>{{ todoCount }} 个待办</strong>
      <small>{{ pendingCount }} 个课后交付 · {{ wheatPendingCount }} 个小麦留痕</small>
    </button>
  </aside>
</template>
