<script setup>
import { computed, ref, watch } from 'vue'
import { sameId } from '../../services/mappers'
import DateTimeRangeField from '../common/DateTimeRangeField.vue'

const props = defineProps({
  tasks: {
    type: Array,
    required: true
  },
  activeTaskId: {
    type: [Number, String],
    required: true
  },
  classes: {
    type: Array,
    required: true
  },
  courses: {
    type: Array,
    required: true
  },
  teachers: {
    type: Array,
    required: true
  },
  students: {
    type: Array,
    required: true
  },
  loadReferences: {
    type: Function,
    default: null
  },
  progressForTask: {
    type: Function,
    required: true
  }
})

const emit = defineEmits(['select-task', 'add-lesson'])

const showLessonDialog = ref(false)
const lessonTypeOptions = ['收费课', '免费课', '体验课']
const lessonModeOptions = [
  { label: '临时补课', value: 'temporary' },
  { label: '已有班级补录', value: 'class' }
]
const lessonDraft = ref(createLessonDraft('temporary'))
const formError = ref('')
const isSubmitting = ref(false)

function localDateValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function firstActive(items, predicate = () => true) {
  return items.find((item) => !item.archived && predicate(item))?.id
}

function createLessonDraft(mode = 'temporary') {
  return {
    mode,
    dateValue: localDateValue(),
    startTime: '',
    endTime: '',
    classId: mode === 'class' ? firstActive(props.classes, (item) => item.classTypeName !== '临时班') : null,
    teacherId: firstActive(props.teachers),
    courseId: firstActive(props.courses),
    studentIds: [],
    topic: '',
    lessonType: '收费课'
  }
}

const openLessonDialog = async () => {
  try { await props.loadReferences?.() } catch { /* dialog can still show its empty state */ }
  lessonDraft.value = createLessonDraft('temporary')
  formError.value = ''
  isSubmitting.value = false
  showLessonDialog.value = true
}

const selectedClass = computed(() => props.classes.find((item) => sameId(item.id, lessonDraft.value.classId)))
const isTemporary = computed(() => lessonDraft.value.mode === 'temporary')
const activeClasses = computed(() => props.classes.filter((klass) => !klass.archived && klass.classTypeName !== '临时班'))
const activeTeachers = computed(() => props.teachers.filter((teacher) => !teacher.archived))
const activeCourses = computed(() => props.courses.filter((course) => !course.archived))
const activeStudents = computed(() => props.students.filter((student) => !student.archived && ['在读', '请假'].includes(student.status)))
const classOptions = computed(() => activeClasses.value.map((klass) => ({ label: klass.name, value: klass.id })))
const teacherOptions = computed(() =>
  activeTeachers.value.map((teacher) => ({ label: teacher.name, value: teacher.id }))
)
const courseOptions = computed(() => activeCourses.value.map((course) => ({ label: course.title, value: course.id })))
const studentOptions = computed(() => activeStudents.value.map((student) => ({
  label: student.name,
  value: student.id,
  description: student.classIds?.length ? `已有 ${student.classIds.length} 个班级归属` : '暂无班级归属'
})))

watch(
  () => lessonDraft.value.mode,
  (mode) => {
    if (mode === 'temporary') {
      lessonDraft.value.classId = null
      return
    }
    lessonDraft.value.studentIds = []
    if (!lessonDraft.value.classId) {
      lessonDraft.value.classId = firstActive(activeClasses.value, () => true)
    }
  }
)

watch(
  () => lessonDraft.value.classId,
  () => {
    if (selectedClass.value) {
      lessonDraft.value.teacherId = selectedClass.value.teacherId
      lessonDraft.value.courseId = selectedClass.value.courseId
    }
  }
)

const saveLesson = () => {
  if (isSubmitting.value) return
  const draft = lessonDraft.value
  if (!draft.dateValue || !draft.startTime || !draft.endTime) {
    formError.value = '请填写日期、开始时间和结束时间'
    return
  }
  if (draft.endTime <= draft.startTime) {
    formError.value = '结束时间必须晚于开始时间'
    return
  }
  if (!draft.teacherId || !draft.courseId) {
    formError.value = '请选择任课老师和课程类别/课程资料'
    return
  }
  if (isTemporary.value && !draft.studentIds.length) {
    formError.value = '临时课至少需要选择一名学生'
    return
  }
  if (!isTemporary.value && !draft.classId) {
    formError.value = '请选择班级'
    return
  }
  formError.value = ''
  isSubmitting.value = true
  emit('add-lesson', {
    temporary: isTemporary.value,
    classId: isTemporary.value ? undefined : draft.classId,
    teacherId: draft.teacherId,
    courseId: draft.courseId,
    dateValue: draft.dateValue,
    startTime: draft.startTime,
    endTime: draft.endTime,
    lessonType: draft.lessonType,
    topic: draft.topic,
    studentIds: isTemporary.value ? [...draft.studentIds] : undefined
  })
  showLessonDialog.value = false
}
</script>

<template>
  <aside class="task-list panel">
    <div class="section-head">
      <div>
        <span>课表生成</span>
        <strong>{{ tasks.length }} 个课后任务</strong>
      </div>
      <button class="secondary" @click="openLessonDialog">新增临时课</button>
    </div>
    <button
      v-for="task in tasks"
      :key="task.id"
      class="task-card"
      :class="{ active: sameId(task.id, activeTaskId) }"
      @click="$emit('select-task', task)"
    >
      <span class="time">{{ task.time }}</span>
      <span>
        <strong>
          {{ task.className || classes.find((item) => sameId(item.id, task.classId))?.name || '未配置班级' }}
          <em v-if="task.classArchived" class="archived-reference">已归档</em>
        </strong>
        <small>
          {{ task.courseTitle || courses.find((item) => sameId(item.id, task.courseId))?.title || '待配置课程' }}
          <em v-if="task.topic"> · 课题：{{ task.topic }}</em>
          <em v-if="task.courseArchived" class="archived-reference">已归档</em>
          · {{ task.teacher }}
          <em v-if="task.teacherArchived" class="archived-reference">已归档</em>
          · {{ task.lessonType }}
        </small>
        <i class="mini-progress"><b :style="{ width: `${progressForTask(task)}%` }"></b></i>
      </span>
      <em>{{ task.status }} · {{ progressForTask(task) }}%</em>
    </button>

    <div
      v-if="showLessonDialog"
      class="directory-drawer-backdrop lesson-drawer-backdrop"
      @click.self="showLessonDialog = false"
    >
      <section
        class="master-detail panel directory-drawer lesson-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="新增课次 / 手动补录"
      >
        <div class="section-head">
          <div>
            <span>新增课次 / 手动补录</span>
            <strong>{{ isTemporary ? '创建临时课' : '补录班级课次' }}</strong>
          </div>
          <div class="button-pair lesson-drawer-actions">
            <button class="ghost" type="button" @click="showLessonDialog = false">关闭</button>
            <button class="primary" type="button" :disabled="isSubmitting" @click="saveLesson">
              {{ isSubmitting ? '正在创建…' : isTemporary ? '创建临时课' : '创建课后待办' }}
            </button>
          </div>
        </div>

        <div class="lesson-mode-switch" role="tablist" aria-label="课次类型">
          <button
            v-for="option in lessonModeOptions"
            :key="option.value"
            type="button"
            :class="{ active: lessonDraft.mode === option.value }"
            @click="lessonDraft.mode = option.value"
          >
            {{ option.label }}
          </button>
        </div>

        <div class="form-grid">
          <DateTimeRangeField
            class="wide"
            :date="lessonDraft.dateValue"
            :start-time="lessonDraft.startTime"
            :end-time="lessonDraft.endTime"
            @update:date="lessonDraft.dateValue = $event"
            @update:start-time="lessonDraft.startTime = $event"
            @update:end-time="lessonDraft.endTime = $event"
          />
          <label v-if="!isTemporary">
            班级
            <AdaptiveSelect v-model="lessonDraft.classId" :options="classOptions" />
          </label>
          <label>
            任课老师
            <AdaptiveSelect v-model="lessonDraft.teacherId" :options="teacherOptions" />
          </label>
          <label>
            课程类别/课程资料
            <AdaptiveSelect v-model="lessonDraft.courseId" :options="courseOptions" />
          </label>
          <label v-if="isTemporary" class="wide">
            本次学生
            <AdaptiveMultiSelect
              v-model="lessonDraft.studentIds"
              :options="studentOptions"
              placeholder="请选择本节课学生"
              searchable
              search-placeholder="输入学生姓名搜索"
            />
            <small class="field-hint">仅可选择已有的在读或请假学生，创建后将生成本节课独立的临时班。</small>
          </label>
          <label>本次课题<input v-model="lessonDraft.topic" maxlength="255" placeholder="可选，如：素描考级" /></label>
          <label>
            课次类型
            <AdaptiveSelect v-model="lessonDraft.lessonType" :options="lessonTypeOptions" />
          </label>
        </div>

        <p v-if="formError" class="lesson-form-error">{{ formError }}</p>
      </section>
    </div>
  </aside>
</template>
