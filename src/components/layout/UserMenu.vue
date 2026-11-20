<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppIcon from '../common/AppIcon.vue'
import AdaptiveSelect from '../common/AdaptiveSelect.vue'

const props = defineProps({
  currentUser: {
    type: Object,
    required: true
  },
  permissionSummary: {
    type: Object,
    required: true
  },
  themeOptions: {
    type: Array,
    required: true
  },
  activeTheme: {
    type: String,
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

const emit = defineEmits(['logout', 'updateTheme', 'switch-campus'])

const open = ref(false)
const menuRef = ref(null)
const campusOptions = computed(() => props.availableCampuses.map((campus) => ({
  value: campus.id,
  label: campus.name,
  description: campus.code
})))

const selectCampus = (campusId) => {
  emit('switch-campus', campusId)
  open.value = false
}

const closeFromOutside = (event) => {
  if (!open.value || menuRef.value?.contains(event.target)) return
  open.value = false
}

const closeFromKeyboard = (event) => {
  if (event.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', closeFromOutside)
  document.addEventListener('keydown', closeFromKeyboard)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeFromOutside)
  document.removeEventListener('keydown', closeFromKeyboard)
})
</script>

<template>
  <div ref="menuRef" class="user-menu">
    <button class="user-trigger" @click="open = !open">
      <span>{{ currentUser.name.slice(0, 1) }}</span>
      <strong>{{ currentUser.name }}</strong>
      <small>{{ currentUser.role }}</small>
    </button>

    <section v-if="open" class="user-popover">
      <div class="user-card-head">
        <span>{{ currentUser.name.slice(0, 1) }}</span>
        <div>
          <strong>{{ currentUser.name }}</strong>
          <small>{{ currentUser.role }} · {{ permissionSummary.taskScope }}</small>
        </div>
      </div>

      <section v-if="campusOptions.length" class="user-option-group">
        <span>当前校区</span>
        <AdaptiveSelect
          :model-value="activeCampusId"
          :options="campusOptions"
          :disabled="campusSwitching || campusOptions.length < 2"
          placeholder="请选择校区"
          @update:model-value="selectCampus"
        />
      </section>


      <section class="user-option-group compact">
        <span>界面主题</span>
        <button
          v-for="theme in themeOptions"
          :key="theme.id"
          type="button"
          :class="{ selected: activeTheme === theme.id }"
          @click="$emit('updateTheme', theme.id)"
        >
          <strong>{{ theme.label }}</strong>
        </button>
      </section>

      <button class="ghost" @click="$emit('logout')"><AppIcon name="logout" :size="15" />退出登录</button>
    </section>
  </div>
</template>
