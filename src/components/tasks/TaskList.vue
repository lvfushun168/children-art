<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  tasks: {
    type: Array,
    required: true
  },
  activeTaskId: {
    type: Number,
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
  progressForTask: {
    type: Function,
    required: true
  }
})

const emit = defineEmits(['select-task', 'add-lesson'])

const showLessonDialog = ref(false)
const lessonDraft = ref({
  date: '6月21日',
  time: '20:10',
  classId: props.classes[0]?.id,
  teacherId: props.teachers.find((item) => item.role === '老师')?.id,
  courseId: props.courses[0]?.id,
  lessonType: '收费课',
  status: '待处理',
  importedFrom: '手动补录'
})

const selectedClass = computed(() => props.classes.find((item) => item.id === Number(lessonDraft.value.classId)))

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
      <button class="secondary" @click="showLessonDialog = true">补录课次</button>
    </div>
    <button
      v-for="task in tasks"
      :key="task.id"
      class="task-card"
      :class="{ active: task.id === activeTaskId }"
      @click="$emit('select-task', task)"
    >
      <span class="time">{{ task.time }}</span>
      <span>
        <strong>{{ classes.find((item) => item.id === task.classId).name }}</strong>
        <small>{{ courses.find((item) => item.id === task.courseId).title }} · {{ task.teacher }} · {{ task.lessonType }}</small>
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
          <label>日期<input v-model="lessonDraft.date" /></label>
          <label>时间<input v-model="lessonDraft.time" /></label>
          <label>
            班级
            <select v-model.number="lessonDraft.classId">
              <option v-for="klass in classes" :key="klass.id" :value="klass.id">{{ klass.name }}</option>
            </select>
          </label>
          <label>
            任课老师
            <select v-model.number="lessonDraft.teacherId">
              <option v-for="teacher in teachers.filter((item) => item.role === '老师')" :key="teacher.id" :value="teacher.id">
                {{ teacher.name }}
              </option>
            </select>
          </label>
          <label>
            课程主题
            <select v-model.number="lessonDraft.courseId">
              <option v-for="course in courses" :key="course.id" :value="course.id">{{ course.title }}</option>
            </select>
          </label>
          <label>
            课次类型
            <select v-model="lessonDraft.lessonType">
              <option>收费课</option>
              <option>免费课</option>
              <option>体验课</option>
            </select>
          </label>
          <label>
            初始状态
            <select v-model="lessonDraft.status">
              <option>待处理</option>
              <option>处理中</option>
              <option>异常</option>
            </select>
          </label>
          <label>
            数据来源
            <select v-model="lessonDraft.importedFrom">
              <option>手动补录</option>
              <option>小麦课表复制</option>
              <option>小麦 Excel 导入</option>
            </select>
          </label>
        </div>

        <div class="notice-box">
          <strong>创建后规则</strong>
          <small>选择班级后自动带出学生名单；课次类型会展示到家长页，但不作为正式财务或课消依据。</small>
        </div>

        <footer class="modal-actions">
          <button class="ghost" @click="showLessonDialog = false">取消</button>
          <button class="primary" @click="saveLesson">创建课后待办</button>
        </footer>
      </section>
    </div>
  </aside>
</template>
