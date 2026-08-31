<script setup>
import { computed, ref, watch } from 'vue'
import { sameId } from '../../services/mappers'
import DateTimeRangeField from '../common/DateTimeRangeField.vue'

const props = defineProps({
  lesson: { type: Object, default: null },
  teachers: { type: Array, default: () => [] },
  courses: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'save'])

const form = ref({
  dateValue: '',
  startTime: '',
  endTime: '',
  teacherId: '',
  courseId: '',
  topic: '',
  lessonType: '收费课'
})
const formError = ref('')
const lessonTypeOptions = ['收费课', '免费课', '体验课', '其他']

const timeValue = (value) => String(value || '').slice(0, 5)

const syncForm = (lesson) => {
  if (!lesson) return
  Object.assign(form.value, {
    dateValue: lesson.dateValue || '',
    startTime: timeValue(lesson.startTime || lesson.time),
    endTime: timeValue(lesson.endTime),
    teacherId: lesson.teacherId ?? '',
    courseId: lesson.courseId ?? '',
    topic: lesson.topic || '',
    lessonType: lesson.lessonType || '其他'
  })
  formError.value = ''
}

watch(() => props.lesson, syncForm, { immediate: true, deep: true })

const optionsFor = (items, selectedId, labelFor, archivedLabel) => {
  const options = items
    .filter((item) => !item.archived)
    .map((item) => ({ value: item.id, label: labelFor(item) }))
  if (selectedId !== '' && selectedId !== null && selectedId !== undefined
    && !options.some((option) => sameId(option.value, selectedId))) {
    options.unshift({ value: selectedId, label: archivedLabel })
  }
  return options
}

const teacherOptions = computed(() => optionsFor(
  props.teachers,
  form.value.teacherId,
  (teacher) => teacher.name || '未命名老师',
  `${props.lesson?.teacher || '当前老师'}（已归档）`
))
const courseOptions = computed(() => optionsFor(
  props.courses,
  form.value.courseId,
  (course) => course.title || '未命名课程',
  `${props.lesson?.courseTitle || props.lesson?.course || '当前课程'}（已归档）`
))

const save = () => {
  if (!props.lesson || props.saving) return
  if (!form.value.dateValue || !form.value.startTime) {
    formError.value = '请填写日期和开始时间'
    return
  }
  if (form.value.endTime && form.value.endTime <= form.value.startTime) {
    formError.value = '结束时间必须晚于开始时间'
    return
  }
  if (!form.value.teacherId || !form.value.courseId) {
    formError.value = '请选择任课老师和课程类别/课程资料'
    return
  }
  formError.value = ''
  emit('save', {
    teacherId: form.value.teacherId,
    courseId: form.value.courseId,
    dateValue: form.value.dateValue,
    startTime: form.value.startTime,
    endTime: form.value.endTime || undefined,
    lessonType: form.value.lessonType,
    topic: form.value.topic,
    version: Number(props.lesson.version || 0)
  })
}
</script>

<template>
  <div v-if="lesson" class="drawer-backdrop lesson-editor-drawer-backdrop" @click.self="$emit('close')">
    <aside class="library-drawer lesson-editor-drawer" role="dialog" aria-modal="true" aria-label="编辑课次">
      <div class="drawer-head">
        <div>
          <span>编辑课次</span>
          <strong>{{ lesson.className || '未配置班级' }}</strong>
        </div>
        <button class="ghost" type="button" :disabled="saving" @click="$emit('close')">关闭</button>
      </div>

      <form class="lesson-editor-form" @submit.prevent="save">
        <DateTimeRangeField
          class="wide"
          :date="form.dateValue"
          :start-time="form.startTime"
          :end-time="form.endTime"
          @update:date="form.dateValue = $event"
          @update:start-time="form.startTime = $event"
          @update:end-time="form.endTime = $event"
        />
        <label>
          任课老师
          <AdaptiveSelect v-model="form.teacherId" :options="teacherOptions" :disabled="saving" />
        </label>
        <label>
          课程类别/课程资料
          <AdaptiveSelect v-model="form.courseId" :options="courseOptions" :disabled="saving" />
        </label>
        <label class="wide">
          本次课题
          <input v-model="form.topic" maxlength="255" placeholder="可选，如：素描考级" :disabled="saving" />
        </label>
        <label>
          课次类型
          <AdaptiveSelect v-model="form.lessonType" :options="lessonTypeOptions" :disabled="saving" />
        </label>

        <p class="lesson-editor-readonly">班级和学生关系不可在这里修改；如需更换班级或学生，请删除后重新创建。</p>
        <p v-if="formError" class="lesson-form-error" role="alert">{{ formError }}</p>
        <div class="lesson-editor-actions">
          <button class="ghost" type="button" :disabled="saving" @click="$emit('close')">取消</button>
          <button class="primary" type="submit" :disabled="saving">
            {{ saving ? '正在保存…' : '保存课次' }}
          </button>
        </div>
      </form>
    </aside>
  </div>
</template>

<style scoped>
.lesson-editor-drawer {
  grid-template-rows: auto minmax(0, 1fr);
}

.lesson-editor-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 14px;
  overflow: auto;
}

.lesson-editor-form > .wide,
.lesson-editor-readonly,
.lesson-form-error,
.lesson-editor-actions {
  grid-column: 1 / -1;
}

.lesson-editor-form > label {
  display: grid;
  gap: 6px;
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 700;
}

.lesson-editor-form input {
  width: 100%;
}

.lesson-editor-readonly,
.lesson-form-error {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
}

.lesson-editor-readonly {
  color: var(--color-muted);
}

.lesson-form-error {
  color: var(--color-status-warning-text);
}

.lesson-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 2px;
}

@media (max-width: 560px) {
  .lesson-editor-form {
    grid-template-columns: 1fr;
  }

  .lesson-editor-form > label,
  .lesson-editor-form > .wide,
  .lesson-editor-readonly,
  .lesson-form-error,
  .lesson-editor-actions {
    grid-column: 1;
  }
}
</style>
