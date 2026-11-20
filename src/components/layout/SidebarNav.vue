<script setup>
import { computed } from 'vue'
import AppIcon from '../common/AppIcon.vue'
import AdaptiveSelect from '../common/AdaptiveSelect.vue'

const props = defineProps({
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
  school: {
    type: Object,
    required: true
  },
  availableCampuses: {
    type: Array,
    default: () => []
  },
  activeCampusId: {
    type: [String, Number],
    default: ''
  },
  campusSwitching: {
    type: Boolean,
    default: false
  }
})

defineEmits(['select-group', 'open-todo-center', 'switch-campus'])

const campusOptions = computed(() => (props.availableCampuses || []).map((campus) => ({
  value: campus.id,
  label: campus.name,
  description: campus.code
})))
</script>

<template>
  <aside class="nav-rail">
    <div class="brand campus-brand">
      <span class="brand-mark"><AppIcon name="brand" :size="22" /></span>
      <div class="campus-brand-copy">
        <strong>课后交付系统</strong>
        <AdaptiveSelect
          :model-value="activeCampusId"
          :options="campusOptions"
          placeholder="请选择校区"
          :disabled="campusSwitching || campusOptions.length < 2"
          @update:model-value="$emit('switch-campus', $event)"
        />
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
    </button>
  </aside>
</template>
