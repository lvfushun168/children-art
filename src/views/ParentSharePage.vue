<script setup>
import { computed } from 'vue'

const props = defineProps({
  state: {
    type: Object,
    required: true
  },
  route: {
    type: Object,
    required: true
  }
})

const lesson = computed(() => props.state.tasks.find((task) => task.id === props.route.lessonId) || props.state.tasks[0])
const klass = computed(() => props.state.classes.find((item) => item.id === lesson.value?.classId))
const course = computed(() => props.state.courses.find((item) => item.id === lesson.value?.courseId))
const student = computed(() => props.state.students.find((item) => item.id === props.route.studentId) || props.state.students[0])
const studentRow = computed(() => props.state.sessionStudents.find((item) => item.id === student.value?.id))
const classRows = computed(() =>
  props.state.sessionStudents
    .filter((row) => row.attendance === '到课')
    .map((row) => ({ ...row, student: props.state.students.find((item) => item.id === row.id) }))
)
const tokenValid = computed(() => Boolean(props.route.token))
</script>

<template>
  <main class="parent-h5">
    <section v-if="!tokenValid" class="share-access-state">
      <strong>链接无法访问</strong>
      <p>分享链接缺少访问密钥、已失效或已被机构关闭。</p>
    </section>

    <template v-else>
      <header class="parent-brand">
        <div>
          <span>课</span>
          <div>
            <strong>{{ state.school.name }}</strong>
            <small>{{ state.school.campus }} · 课后成果</small>
          </div>
        </div>
        <small>{{ state.displayConfig.publicStatus }}</small>
      </header>

      <section class="parent-hero">
        <span>{{ lesson.date }} · {{ lesson.time }} · {{ lesson.lessonType }}</span>
        <h1 v-if="route.type === 'student'">{{ student.name }}的课后成果</h1>
        <h1 v-else>{{ klass.name }}课堂成果</h1>
        <p>{{ course.title }} · {{ course.goal }}</p>
      </section>

      <section v-if="route.type === 'student'" class="parent-content">
        <img class="parent-artwork" :src="studentRow?.image" :alt="student.name" />

        <article class="parent-section">
          <span>老师课评</span>
          <p>{{ studentRow?.comment || `${student.nickname}今天课堂投入认真，作品中能看到自己的色彩选择和表达。` }}</p>
        </article>

        <article v-if="state.displayConfig.showHighlight && studentRow?.highlight" class="parent-section highlight">
          <span>高光作品</span>
          <p>{{ studentRow.highlightNote }}</p>
        </article>

        <article v-if="state.displayConfig.showMaterials" class="parent-section">
          <span>范画与课堂步骤</span>
          <div class="parent-materials">
            <img v-for="material in state.materials.filter((item) => item.visible)" :key="material.id" :src="material.image" :alt="material.title" />
          </div>
        </article>

        <article v-if="state.displayConfig.showHomework" class="parent-section homework">
          <span>课后任务</span>
          <p>{{ state.homework.content }}</p>
          <small>{{ state.homework.requirement }} · {{ state.homework.dueDate }}</small>
          <a v-for="link in state.selectedExternalLinks" :key="link.id" :href="link.url">{{ link.title }}</a>
        </article>
      </section>

      <section v-else class="parent-class-grid">
        <article v-for="row in classRows" :key="row.id">
          <img :src="row.image" :alt="row.student?.name" />
          <strong>{{ row.student?.name }}</strong>
          <small>{{ row.highlight ? '高光作品' : '课堂作品' }}</small>
        </article>
      </section>

      <footer class="parent-footer">
        <small>链接有效至 {{ state.displayConfig.expiresAt }}</small>
        <small>{{ state.displayConfig.accessPolicy }} · {{ state.displayConfig.allowForward ? '允许转发' : '不建议转发' }}</small>
        <small v-if="state.displayConfig.showLessonType">课次类型仅为课后展示记录，不作为正式财务或课消依据。</small>
      </footer>
    </template>
  </main>
</template>
