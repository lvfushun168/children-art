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

// 菜单里拨动时间时实时写回输入框，这样点空白处关闭菜单也不会丢掉选择。
// 菜单刚打开时会先报一次“当前时间”，那一次不算用户的选择，要跳过。
let skipInitialChange = false
const syncWhileEditing = (value) => {
  if (skipInitialChange) {
    skipInitialChange = false
    return
  }
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return
  update({ hours: value.getHours(), minutes: value.getMinutes() })
}

const update = (value) => {
  const next = value && value.hours !== undefined && value.hours !== null
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
      :text-input="{ format: 'HH:mm', enterSubmit: true, tabSubmit: true, applyOnBlur: true, selectOnFocus: false }"
      :input-attrs="{ clearable: !required, required, inputmode: 'none' }"
      :aria-labels="{ input: ariaLabel }"
      :placeholder="placeholder"
      @update:model-value="update"
      @open="skipInitialChange = true"
      @internal-model-change="syncWhileEditing"
    />
  </div>
</template>
