<script setup>
import { computed } from 'vue'
import AppDatePicker from './AppDatePicker.vue'
import AppTimeField from './AppTimeField.vue'
import { addMinutesToTime, timeToMinutes } from '../../utils/datePresets.js'

const DEFAULT_DURATION_MINUTES = 60

const props = defineProps({
  date: { type: String, default: '' },
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  label: { type: String, default: '上课时间' }
})

const emit = defineEmits(['update:date', 'update:startTime', 'update:endTime'])

const endBeforeStart = computed(() => {
  const start = timeToMinutes(props.startTime)
  const end = timeToMinutes(props.endTime)
  return start !== null && end !== null && end <= start
})

// 选开始时间时顺带推出结束时间：已有课时长度就保持不变，没有就默认一小时。
const updateStart = (value) => {
  const previousStart = timeToMinutes(props.startTime)
  const previousEnd = timeToMinutes(props.endTime)
  emit('update:startTime', value)
  if (timeToMinutes(value) === null) return
  const hadDuration = previousStart !== null && previousEnd !== null && previousEnd > previousStart
  if (hadDuration) {
    emit('update:endTime', addMinutesToTime(value, previousEnd - previousStart))
  } else if (previousEnd === null || previousEnd <= timeToMinutes(value)) {
    emit('update:endTime', addMinutesToTime(value, DEFAULT_DURATION_MINUTES))
  }
}
</script>

<template>
  <div class="date-time-range-field" role="group" :aria-label="label">
    <span class="date-time-range-label">{{ label }}</span>
    <div class="date-time-range-grid">
      <label class="date-time-range-date">
        <span>日期</span>
        <AppDatePicker :model-value="date" aria-label="上课日期" placeholder="选择日期" :clearable="false" @update:model-value="emit('update:date', $event)" />
      </label>
      <label>
        <span>开始</span>
        <AppTimeField :model-value="startTime" aria-label="开始时间" placeholder="开始时间" @update:model-value="updateStart" />
      </label>
      <label>
        <span>结束</span>
        <AppTimeField :model-value="endTime" aria-label="结束时间" placeholder="结束时间" @update:model-value="emit('update:endTime', $event)" />
      </label>
    </div>
    <small v-if="endBeforeStart" class="date-time-range-error" role="alert">结束时间需要晚于开始时间</small>
  </div>
</template>
