<script setup>
import { ref } from 'vue'

defineProps({
  currentUser: {
    type: Object,
    required: true
  },
  permissionSummary: {
    type: Object,
    required: true
  },
  teachers: {
    type: Array,
    required: true
  }
})

defineEmits(['switchUser', 'logout'])

const open = ref(false)
</script>

<template>
  <div class="user-menu">
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

      <label>
        演示切换账号
        <select :value="currentUser.id" @change="$emit('switchUser', Number($event.target.value))">
          <option v-for="teacher in teachers" :key="teacher.id" :value="teacher.id">
            {{ teacher.name }} · {{ teacher.role }}
          </option>
        </select>
      </label>

      <button class="ghost" @click="$emit('logout')">退出登录</button>
    </section>
  </div>
</template>
