<script setup>
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  status: {
    type: [String, Number],
    default: ''
  },
  icon: {
    type: String,
    default: ''
  },
  tone: {
    type: String,
    default: ''
  },
  size: {
    type: [Number, String],
    default: 13
  }
})

const statusText = computed(() => String(props.status ?? '').trim())

const includesAny = (words) => words.some((word) => statusText.value.includes(word))

const statusTone = computed(() => {
  if (props.tone) return props.tone
  if (includesAny(['失败', '异常', '错误', '退回', '失效'])) return 'danger'
  if (includesAny(['已完成', '已发送', '人工发送', '已人工处理', '已归档', '正式档案', '已装裱', '已入选', '进行中', '已启用', '已授权', '已准备', '已发布', '已评分', '成功'])) return 'success'
  if (includesAny(['处理中', '生成中', '同步中', '待'])) return 'pending'
  if (includesAny(['停用', '取消', '无需处理'])) return 'warning'
  return 'muted'
})

const iconName = computed(() => {
  if (props.icon) return props.icon
  if (statusTone.value === 'success') return 'check'
  if (statusTone.value === 'danger') return 'error'
  if (statusTone.value === 'warning') return 'warning'
  return 'pending'
})
</script>

<template>
  <span class="app-status-tag" :class="`is-${statusTone}`">
    <AppIcon :name="iconName" :size="size" />
    <span>{{ status }}</span>
  </span>
</template>
