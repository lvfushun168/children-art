<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const weekdays = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' }
]

const rows = computed(() => Array.isArray(props.modelValue) ? props.modelValue : [])
const hasDuplicate = computed(() => {
  const keys = rows.value.map((row) => `${row.weekday || ''}-${row.startTime || ''}`)
  return new Set(keys.filter((key) => key !== '-')).size !== keys.filter((key) => key !== '-').length
})

const updateRow = (index, key, value) => {
  const next = rows.value.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : { ...row })
  emit('update:modelValue', next)
}

const addRow = () => {
  emit('update:modelValue', [...rows.value, { weekday: 1, startTime: '17:40', endTime: '19:10' }])
}

const removeRow = (index) => {
  emit('update:modelValue', rows.value.filter((_, rowIndex) => rowIndex !== index))
}
</script>

<template>
  <div class="schedule-slot-editor">
    <div class="schedule-slot-head">
      <div>
        <strong>固定上课时段</strong>
        <small>一个班级可以配置多个每周时段，所有时段使用班级默认老师和课程。</small>
      </div>
      <button class="ghost" type="button" :disabled="disabled" @click="addRow">＋添加时段</button>
    </div>

    <div v-if="!rows.length" class="schedule-slot-empty">
      暂无固定时段。筹备中的班级可以稍后配置；保存为“开班中”时至少需要一个时段。
    </div>

    <div v-for="(row, index) in rows" :key="row.id || `new-${index}`" class="schedule-slot-row">
      <label>
        <span>星期</span>
        <AdaptiveSelect :model-value="row.weekday" :options="weekdays" :disabled="disabled" @update:model-value="updateRow(index, 'weekday', Number($event))" />
      </label>
      <label>
        <span>开始</span>
        <input :value="row.startTime || ''" type="time" :disabled="disabled" @input="updateRow(index, 'startTime', $event.target.value)" />
      </label>
      <label>
        <span>结束</span>
        <input :value="row.endTime || ''" type="time" :required="!row.id" :disabled="disabled" @input="updateRow(index, 'endTime', $event.target.value)" />
      </label>
      <button class="danger-text" type="button" :disabled="disabled" @click="removeRow(index)">删除</button>
      <small v-if="row.id && !row.endTime" class="legacy-slot-note">历史数据未识别到结束时间，可先保留，之后补充。</small>
    </div>

    <small v-if="hasDuplicate" class="form-error">固定时段不能重复配置相同星期和开始时间。</small>
  </div>
</template>

<style scoped>
.schedule-slot-editor {
  display: grid;
  gap: 12px;
  grid-column: 1 / -1;
  padding: 14px;
  border: 1px solid var(--color-border-soft);
  border-radius: 14px;
  background: var(--color-surface-muted);
}
.schedule-slot-head,
.schedule-slot-row {
  display: flex;
  align-items: end;
  gap: 10px;
  flex-wrap: wrap;
}
.schedule-slot-head {
  justify-content: space-between;
  align-items: center;
}
.schedule-slot-head div,
.schedule-slot-row label {
  display: grid;
  gap: 5px;
}
.schedule-slot-head small,
.schedule-slot-row span,
.schedule-slot-empty,
.legacy-slot-note {
  color: var(--color-muted);
  font-size: 12px;
}
.schedule-slot-row label {
  min-width: 130px;
}
.schedule-slot-row input {
  min-height: 38px;
}
.schedule-slot-row .danger-text {
  margin-bottom: 8px;
}
.legacy-slot-note {
  flex-basis: 100%;
  color: var(--color-status-warning-text);
}
.form-error {
  color: var(--color-danger);
}
</style>
