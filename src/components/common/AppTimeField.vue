<script setup>
import { computed } from 'vue'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import { zhCN } from 'date-fns/locale/zh-CN'
import { normalizeTimeValue } from '../../utils/datePresets.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '选择时间' },
  ariaLabel: { type: String, default: '选择时间' },
  disabled: { type: Boolean, default: false },
  required: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'change'])

const pad = (value) => String(value).padStart(2, '0')

const pickerValue = computed(() => {
  const value = normalizeTimeValue(props.modelValue)
  if (!value) return null
  const [hours, minutes] = value.split(':').map(Number)
  return { hours, minutes, seconds: 0 }
})

const update = (value) => {
  const next = value instanceof Date && !Number.isNaN(value.getTime())
    ? `${pad(value.getHours())}:${pad(value.getMinutes())}`
    : value && value.hours !== undefined && value.hours !== null
      ? `${pad(value.hours)}:${pad(value.minutes ?? 0)}`
      : ''
  emit('update:modelValue', next)
  emit('change', next)
}
</script>

<template>
  <div class="app-dp app-dp-time">
    <VueDatePicker
      :model-value="pickerValue"
      :time-picker="true"
      :locale="zhCN"
      :teleport="true"
      :disabled="disabled"
      :auto-apply="true"
      :time-config="{ is24: true, enableSeconds: false, minutesGridIncrement: 5, minutesIncrement: 5 }"
      :formats="{ input: 'HH:mm', preview: 'HH:mm' }"
      :input-attrs="{ clearable: !required, required, inputmode: 'none' }"
      :aria-labels="{ input: ariaLabel }"
      :placeholder="placeholder"
      @update:model-value="update"
    />
  </div>
</template>
