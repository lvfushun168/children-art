<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

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
const timeRangeField = ref(null)
const timePickerOpen = ref('')
const timePickerHour = ref('')
const timePickerMinute = ref('')
const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'))
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'))

const currentTimeFor = (field) => field === 'start' ? props.startTime : props.endTime
const parseTime = (value) => {
  const [hour = '', minute = ''] = String(value || '').split(':')
  return {
    hour: /^\d{1,2}$/.test(hour) ? hour.padStart(2, '0') : '',
    minute: /^\d{1,2}$/.test(minute) ? minute.padStart(2, '0') : ''
  }
}

const openTimePicker = (field) => {
  const current = parseTime(currentTimeFor(field))
  timePickerOpen.value = field
  timePickerHour.value = current.hour
  timePickerMinute.value = current.minute
}

const closeTimePicker = () => {
  timePickerOpen.value = ''
}

const applyTimePicker = () => {
  if (!timePickerOpen.value || !timePickerHour.value || !timePickerMinute.value) return
  emit(timePickerOpen.value === 'start' ? 'update:startTime' : 'update:endTime', `${timePickerHour.value}:${timePickerMinute.value}`)
  closeTimePicker()
}

const handleOutsidePointer = (event) => {
  if (!timeRangeField.value?.contains(event.target)) closeTimePicker()
}

onMounted(() => document.addEventListener('pointerdown', handleOutsidePointer))
onBeforeUnmount(() => document.removeEventListener('pointerdown', handleOutsidePointer))
</script>

<template>
  <div ref="timeRangeField" class="date-time-range-field" @keydown.esc="closeTimePicker">
    <span class="date-time-range-label">上课时间</span>
    <div class="date-time-range-controls">
      <label class="date-time-range-item date-time-range-date">
        <span>日期</span>
        <input
          :value="props.date"
          type="date"
          aria-label="上课日期"
          @input="emit('update:date', $event.target.value)"
        />
      </label>
      <div class="date-time-range-item date-time-range-time" @click="openTimePicker('start')">
        <span>开始</span>
        <input
          :value="props.startTime"
          type="time"
          readonly
          aria-label="开始时间"
          @input="emit('update:startTime', $event.target.value)"
          @click.stop.prevent="openTimePicker('start')"
          @keydown.enter.prevent="openTimePicker('start')"
        />
        <div v-if="timePickerOpen === 'start'" class="time-picker-popover" role="dialog" aria-label="选择开始时间" @click.stop>
          <div class="time-picker-controls">
            <select v-model="timePickerHour" aria-label="开始时间小时">
              <option disabled value="">时</option>
              <option v-for="hour in hours" :key="`start-hour-${hour}`" :value="hour">{{ hour }}</option>
            </select>
            <span>:</span>
            <select v-model="timePickerMinute" aria-label="开始时间分钟">
              <option disabled value="">分</option>
              <option v-for="minute in minutes" :key="`start-minute-${minute}`" :value="minute">{{ minute }}</option>
            </select>
          </div>
          <div class="time-picker-actions">
            <button type="button" class="ghost" @click="closeTimePicker">取消</button>
            <button type="button" class="primary" :disabled="!timePickerHour || !timePickerMinute" @click="applyTimePicker">确定</button>
          </div>
        </div>
      </div>
      <span class="date-time-range-separator">至</span>
      <div class="date-time-range-item date-time-range-time" @click="openTimePicker('end')">
        <span>结束</span>
        <input
          :value="props.endTime"
          type="time"
          readonly
          aria-label="结束时间"
          @input="emit('update:endTime', $event.target.value)"
          @click.stop.prevent="openTimePicker('end')"
          @keydown.enter.prevent="openTimePicker('end')"
        />
        <div v-if="timePickerOpen === 'end'" class="time-picker-popover" role="dialog" aria-label="选择结束时间" @click.stop>
          <div class="time-picker-controls">
            <select v-model="timePickerHour" aria-label="结束时间小时">
              <option disabled value="">时</option>
              <option v-for="hour in hours" :key="`end-hour-${hour}`" :value="hour">{{ hour }}</option>
            </select>
            <span>:</span>
            <select v-model="timePickerMinute" aria-label="结束时间分钟">
              <option disabled value="">分</option>
              <option v-for="minute in minutes" :key="`end-minute-${minute}`" :value="minute">{{ minute }}</option>
            </select>
          </div>
          <div class="time-picker-actions">
            <button type="button" class="ghost" @click="closeTimePicker">取消</button>
            <button type="button" class="primary" :disabled="!timePickerHour || !timePickerMinute" @click="applyTimePicker">确定</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
