<script setup>
import { ref } from 'vue'

const props = defineProps({
  date: {
    type: String,
    default: ''
  },
  startTime: {
    type: String,
    default: ''
  },
  endTime: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:date', 'update:startTime', 'update:endTime'])
const dateInput = ref(null)

const openDatePicker = () => {
  const input = dateInput.value
  if (!input) return
  input.focus({ preventScroll: true })
  if (typeof input.showPicker === 'function') {
    try {
      input.showPicker()
    } catch {
      // Some browsers reject showPicker when the control is already open.
      // Focus still provides the native fallback.
    }
  }
}
</script>

<template>
  <div class="date-time-range-field">
    <span class="date-time-range-label">上课时间</span>
    <div class="date-time-range-controls">
      <div class="date-time-range-item date-time-range-date" @click="openDatePicker">
        <span>日期</span>
        <input
          ref="dateInput"
          :value="props.date"
          type="date"
          aria-label="上课日期"
          @input="emit('update:date', $event.target.value)"
        />
      </div>
      <div class="date-time-range-item">
        <span>开始</span>
        <input
          :value="props.startTime"
          type="time"
          aria-label="开始时间"
          @input="emit('update:startTime', $event.target.value)"
        />
      </div>
      <span class="date-time-range-separator">至</span>
      <div class="date-time-range-item">
        <span>结束</span>
        <input
          :value="props.endTime"
          type="time"
          aria-label="结束时间"
          @input="emit('update:endTime', $event.target.value)"
        />
      </div>
    </div>
  </div>
</template>
