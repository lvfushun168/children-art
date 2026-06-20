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
  school: {
    type: Object,
    required: true
  }
})

defineEmits(['update:activeNav'])
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

    <section class="nav-summary">
      <span>今日待处理</span>
      <strong>{{ pendingCount }} 个班</strong>
      <small>从课表自动生成课后交付任务</small>
    </section>
  </aside>
</template>
