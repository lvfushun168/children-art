<script setup>
import { computed } from 'vue'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import { zhCN } from 'date-fns/locale/zh-CN'
import { parseDateValue, toDateValue } from '../../utils/scheduleCalendar.js'
import { singlePresetDates } from '../../utils/datePresets.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '选择日期' },
  ariaLabel: { type: String, default: '选择日期' },
  min: { type: String, default: '' },
  max: { type: String, default: '' },
  clearable: { type: Boolean, default: true },
  presets: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'change'])

const pickerValue = computed(() => parseDateValue(props.modelValue))
const presetDates = computed(() => (props.presets ? singlePresetDates() : []))

const update = (value) => {
  const next = value instanceof Date ? toDateValue(value) : ''
  emit('update:modelValue', next)
  emit('change', next)
}
</script>

<template>
  <div class="app-dp">
    <VueDatePicker
      :model-value="pickerValue"
      :locale="zhCN"
      :auto-apply="true"
      :teleport="true"
      :disabled="disabled"
      :min-date="parseDateValue(min) || undefined"
      :max-date="parseDateValue(max) || undefined"
      :preset-dates="presetDates"
      :time-config="{ enableTimePicker: false }"
      :week-start="1"
      :formats="{ input: 'yyyy-MM-dd', preview: 'yyyy-MM-dd' }"
      :text-input="{ format: 'yyyy-MM-dd', enterSubmit: true, tabSubmit: true, applyOnBlur: true, selectOnFocus: false }"
      :config="{ closeOnAutoApply: true }"
      :input-attrs="{ clearable, inputmode: 'none' }"
      :aria-labels="{ input: ariaLabel }"
      :placeholder="placeholder"
      @update:model-value="update"
    />
  </div>
</template>
