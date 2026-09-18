<script setup>
import { computed } from 'vue'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import { zhCN } from 'date-fns/locale/zh-CN'

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

const displayFormat = 'yyyy-MM-dd HH:mm'

const parseDateValue = (value) => {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null
}

const parseTimeValue = (value) => {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
    ? { hours, minutes }
    : null
}

const dateTimeFor = (dateValue, timeValue) => {
  const date = parseDateValue(dateValue)
  const time = parseTimeValue(timeValue)
  if (!date || !time) return null
  date.setHours(time.hours, time.minutes, 0, 0)
  return date
}

const pickerValue = computed(() => {
  const start = dateTimeFor(props.date, props.startTime)
  const end = dateTimeFor(props.date, props.endTime)
  if (start && end) return [start, end]
  if (start) return [start, null]
  return null
})

const pickerStartDate = computed(() => parseDateValue(props.date) || undefined)

const partsFromPickerValue = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      date: `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`,
      time: `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
    }
  }

  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/)
  if (!match) return null
  return {
    date: `${match[1]}-${match[2]}-${match[3]}`,
    time: `${String(match[4]).padStart(2, '0')}:${match[5]}`
  }
}

const updateFromPicker = (value) => {
  if (!value) {
    emit('update:date', '')
    emit('update:startTime', '')
    emit('update:endTime', '')
    return
  }

  const values = Array.isArray(value) ? value : [value]
  const start = partsFromPickerValue(values[0])
  const end = partsFromPickerValue(values[1])
  if (!start) return

  emit('update:date', start.date)
  emit('update:startTime', start.time)
  if (end) emit('update:endTime', end.time)
}
</script>

<template>
  <div class="date-time-range-field">
    <span class="date-time-range-label">上课时间</span>
    <VueDatePicker
      :model-value="pickerValue"
      :range="{ partialRange: false }"
      :locale="zhCN"
      :start-date="pickerStartDate"
      :auto-apply="true"
      :formats="{ input: displayFormat, preview: displayFormat }"
      :text-input="{
        format: displayFormat,
        rangeSeparator: ' 至 ',
        enterSubmit: true,
        tabSubmit: true,
        applyOnBlur: true,
        selectOnFocus: false
      }"
      :time-config="{
        enableSeconds: false,
        is24: true,
        minutesIncrement: 5,
        minutesGridIncrement: 5,
        timePickerInline: true
      }"
      :config="{ closeOnAutoApply: true }"
      :input-attrs="{ 'aria-label': '上课日期和时间范围' }"
      placeholder="选择日期和时间范围"
      @update:model-value="updateFromPicker"
    />
  </div>
</template>
