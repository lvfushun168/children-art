<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineProps({
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
  }
})

defineEmits(['logout', 'updateTheme'])

const open = ref(false)
const menuRef = ref(null)

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

      <div class="permission-list">
        <span>授权班级</span>
        <strong>{{ permissionSummary.visibleClasses.join('、') || '全部班级' }}</strong>
      </div>

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

      <button class="ghost" @click="$emit('logout')">退出登录</button>
    </section>
  </div>
</template>
