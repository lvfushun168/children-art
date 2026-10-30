<script setup>
import { computed } from 'vue'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import { zhCN } from 'date-fns/locale/zh-CN'
import { parseDateValue, toDateValue } from '../../utils/scheduleCalendar.js'
import { rangePresetDates } from '../../utils/datePresets.js'

const props = defineProps({
  start: { type: String, default: '' },
  end: { type: String, default: '' },
  placeholder: { type: String, default: '选择日期范围' },
  ariaLabel: { type: String, default: '选择日期范围' },
  clearable: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['update:start', 'update:end', 'change'])

const pickerValue = computed(() => {
  const start = parseDateValue(props.start)
  const end = parseDateValue(props.end)
  return start && end ? [start, end] : null
})
const presetDates = computed(() => rangePresetDates())

const update = (value) => {
  const [first, second] = Array.isArray(value) ? value : []
  const start = first instanceof Date ? toDateValue(first) : ''
  const end = second instanceof Date ? toDateValue(second) : start
  emit('update:start', start)
  emit('update:end', end)
  emit('change', { start, end })
}
</script>

<template>
  <div class="app-dp app-dp-range">
    <VueDatePicker
      :model-value="pickerValue"
      :range="{ partialRange: false }"
      :locale="zhCN"
      :auto-apply="true"
      :teleport="true"
      :disabled="disabled"
      :preset-dates="presetDates"
      :time-config="{ enableTimePicker: false }"
      :week-start="1"
      :formats="{ input: 'yyyy-MM-dd', preview: 'yyyy-MM-dd' }"
      :text-input="{ format: 'yyyy-MM-dd', rangeSeparator: ' 至 ', enterSubmit: true, tabSubmit: true, applyOnBlur: true, selectOnFocus: false }"
      :config="{ closeOnAutoApply: true }"
      :input-attrs="{ clearable, inputmode: 'none' }"
      :aria-labels="{ input: ariaLabel }"
      :placeholder="placeholder"
      @update:model-value="update"
    />
  </div>
</template>
