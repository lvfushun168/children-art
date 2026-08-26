<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  state: { type: Object, required: true },
  classRecord: { type: Object, default: null },
  classOptions: { type: Array, default: () => [] },
  allowClassSelect: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'generated'])

const pad = (value) => String(value).padStart(2, '0')
const isoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const today = () => new Date()
const monthEnd = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0)

const selectedClassId = ref(null)
const dateFrom = ref(isoDate(today()))
const dateTo = ref(isoDate(monthEnd(today())))
const lessonType = ref('PAID')
const preview = ref(null)
const loading = ref(false)
const error = ref('')

const selectedClass = computed(() => {
  if (props.classRecord) return props.classRecord
  return props.classOptions.find((item) => String(item.id) === String(selectedClassId.value)) || null
})

const options = computed(() => props.classOptions
  .filter((item) => !item.archived && item.status === '开班中'
    && item.scheduleConfigured !== false && item.classTypeName !== '临时班')
  .map((item) => ({ value: String(item.id), label: item.name })))

const canSubmit = computed(() => Boolean(selectedClass.value?.id && dateFrom.value && dateTo.value && dateFrom.value <= dateTo.value))

const reset = () => {
  selectedClassId.value = props.classRecord?.id || options.value[0]?.value || null
  const base = today()
  dateFrom.value = isoDate(base)
  dateTo.value = isoDate(monthEnd(base))
  lessonType.value = 'PAID'
  preview.value = null
  error.value = ''
}

const loadPreview = async () => {
  if (!canSubmit.value) return
  loading.value = true
  error.value = ''
  try {
    preview.value = await props.state.previewLessonGeneration?.(selectedClass.value.id, {
      dateFrom: dateFrom.value, dateTo: dateTo.value, lessonType: lessonType.value
    })
  } catch (cause) {
    error.value = cause?.message || '预览失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

const generate = async () => {
  if (!canSubmit.value) return
  if (!preview.value) {
    await loadPreview()
    if (!preview.value) return
  }
  loading.value = true
  error.value = ''
  try {
    const result = await props.state.generateLessonGeneration?.(selectedClass.value.id, {
      dateFrom: dateFrom.value, dateTo: dateTo.value, lessonType: lessonType.value
    })
    if (!result) return
    emit('generated', result)
  } catch (cause) {
    error.value = cause?.message || '生成失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

watch(() => [props.classRecord?.id, props.classOptions.length], reset, { immediate: true })
watch(() => [selectedClassId.value, dateFrom.value, dateTo.value, lessonType.value], () => {
  preview.value = null
})
</script>

<template>
  <div class="dialog-backdrop" role="presentation" @click.self="emit('close')">
    <section class="generation-dialog" role="dialog" aria-modal="true" aria-labelledby="generation-title">
      <header class="dialog-head">
        <div>
          <h2 id="generation-title">固定排课</h2>
        </div>
        <button class="ghost" type="button" @click="emit('close')">关闭</button>
      </header>

      <div class="generation-form">
        <label v-if="allowClassSelect">
          <span>班级</span>
          <AdaptiveSelect v-model="selectedClassId" :options="options" />
        </label>
        <div v-else class="generation-class-summary">
          <span>班级</span>
          <strong>{{ selectedClass?.name || '未选择班级' }}</strong>
        </div>
        <label>
          <span>开始日期</span>
          <input v-model="dateFrom" type="date" />
        </label>
        <label>
          <span>结束日期</span>
          <input v-model="dateTo" type="date" />
        </label>
        <label>
          <span>课次类型</span>
          <AdaptiveSelect v-model="lessonType" :options="[{ label: '收费课', value: 'PAID' }, { label: '免费课', value: 'FREE' }, { label: '体验课', value: 'TRIAL' }]" />
        </label>
      </div>

      <div v-if="error" class="notice-box error-box">{{ error }}</div>
      <div v-if="preview" class="generation-preview">
        <strong>预计 {{ preview.candidateCount || 0 }} 节</strong>
        <span>其中已有 {{ preview.existingCount || 0 }} 节，待新生成 {{ preview.candidateCount - preview.existingCount || 0 }} 节。</span>
        <small v-if="preview.conflicts?.length">已存在的课次不会被覆盖。</small>
      </div>

      <footer class="dialog-actions">
        <button class="ghost" type="button" :disabled="loading" @click="emit('close')">取消</button>
        <button class="secondary" type="button" :disabled="loading || !canSubmit" @click="loadPreview">{{ loading ? '处理中…' : '预览数量' }}</button>
        <button class="primary" type="button" :disabled="loading || !canSubmit" @click="generate">确认生成</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 20px;
  background: color-mix(in srgb, var(--color-heading) 42%, transparent);
}
.generation-dialog {
  width: min(680px, 100%);
  display: grid;
  gap: 20px;
  padding: 24px;
  border-radius: 20px;
  background: var(--color-surface);
  box-shadow: var(--shadow-modal);
}
.dialog-head,
.dialog-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.dialog-head h2 {
  margin: 5px 0;
}
.dialog-head small,
.generation-class-summary span,
.generation-form label span,
.generation-preview span,
.generation-preview small {
  color: var(--color-muted);
  font-size: 13px;
}
.generation-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.generation-form label,
.generation-class-summary {
  display: grid;
  gap: 6px;
}
.generation-class-summary {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--color-surface-muted);
}
.generation-preview {
  display: grid;
  gap: 5px;
  padding: 14px;
  border-radius: 12px;
  background: var(--color-status-success-bg);
  color: var(--color-status-success-text);
}
.generation-preview strong {
  font-size: 20px;
}
@media (max-width: 640px) {
  .generation-form { grid-template-columns: 1fr; }
  .dialog-actions { flex-wrap: wrap; justify-content: flex-end; }
}
</style>
