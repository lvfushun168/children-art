<script setup>
import { computed, ref, watch } from 'vue'
import { sameId } from '../../services/mappers'

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
const statusOptions = ['待处理', '处理中', '异常']
const importSourceOptions = ['手动补录', '小麦课表复制', '小麦 Excel 导入']
const lessonDraft = ref({
  dateValue: '2026-06-21',
  time: '20:10',
  classId: props.classes.find((item) => !item.archived)?.id,
  teacherId: props.teachers.find((item) => !item.archived && item.role === '老师')?.id,
  courseId: props.courses.find((item) => !item.archived)?.id,
  topic: '',
  lessonType: '收费课',
  status: '待处理',
  importedFrom: '手动补录'
})

const openLessonDialog = async () => {
  try { await props.loadReferences?.() } catch { /* dialog can still show its empty state */ }
  showLessonDialog.value = true
}

const selectedClass = computed(() => props.classes.find((item) => sameId(item.id, lessonDraft.value.classId)))
const activeClasses = computed(() => props.classes.filter((klass) => !klass.archived))
const activeTeachers = computed(() => props.teachers.filter((teacher) => !teacher.archived))
const activeCourses = computed(() => props.courses.filter((course) => !course.archived))
const classOptions = computed(() => activeClasses.value.map((klass) => ({ label: klass.name, value: klass.id })))
const teacherOptions = computed(() =>
  activeTeachers.value.filter((item) => item.role === '老师').map((teacher) => ({ label: teacher.name, value: teacher.id }))
)
const courseOptions = computed(() => activeCourses.value.map((course) => ({ label: course.title, value: course.id })))

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
  emit('add-lesson', { ...lessonDraft.value })
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
      <button class="secondary" @click="openLessonDialog">补录课次</button>
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

    <div v-if="showLessonDialog" class="modal-backdrop">
      <section class="import-modal lesson-modal">
        <header class="modal-head">
          <div>
            <span>新增课次 / 手动补录</span>
            <strong>创建课后待办</strong>
          </div>
          <button class="ghost" @click="showLessonDialog = false">关闭</button>
        </header>

        <div class="form-grid">
          <label>日期<input v-model="lessonDraft.dateValue" type="date" /></label>
          <label>时间<input v-model="lessonDraft.time" /></label>
          <label>
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
          <label>本次课题<input v-model="lessonDraft.topic" maxlength="255" placeholder="可选，如：素描考级" /></label>
          <label>
            课次类型
            <AdaptiveSelect v-model="lessonDraft.lessonType" :options="lessonTypeOptions" />
          </label>
          <label>
            初始状态
            <AdaptiveSelect v-model="lessonDraft.status" :options="statusOptions" />
          </label>
          <label>
            数据来源
            <AdaptiveSelect v-model="lessonDraft.importedFrom" :options="importSourceOptions" />
          </label>
        </div>

        <footer class="modal-actions">
          <button class="ghost" @click="showLessonDialog = false">取消</button>
          <button class="primary" @click="saveLesson">创建课后待办</button>
        </footer>
      </section>
    </div>
  </aside>
</template>
