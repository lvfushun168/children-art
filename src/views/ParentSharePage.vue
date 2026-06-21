<script setup>
import { computed } from 'vue'

const props = defineProps({
  state: { type: Object, required: true },
  route: { type: Object, required: true }
})

const workspace = computed(() => props.state.getLessonWorkspace(props.route.lessonId))
const snapshot = computed(() => workspace.value?.sharePage?.publishedSnapshot)
const lesson = computed(() => snapshot.value?.lesson)
const klass = computed(() => snapshot.value?.klass)
const course = computed(() => snapshot.value?.course)
const student = computed(() => snapshot.value?.students.find((item) => item.id === props.route.studentId))
const studentRow = computed(() => snapshot.value?.studentDeliveries.find((item) => item.studentId === props.route.studentId))
const classRows = computed(() =>
  (snapshot.value?.studentDeliveries || [])
    .filter((row) => row.attendance === '到课')
    .map((row) => ({ ...row, student: snapshot.value.students.find((item) => item.id === row.studentId) }))
)
const tokenValid = computed(() => props.state.isShareAccessible(props.route))
</script>

<template>
  <main class="parent-h5">
    <section v-if="!tokenValid" class="share-access-state">
      <strong>链接无法访问</strong>
      <p>分享链接未发布、访问密钥错误、已失效或已被机构关闭。</p>
    </section>

    <template v-else>
      <header class="parent-brand">
        <div>
          <span>课</span>
          <div>
            <strong>{{ snapshot.school.name }}</strong>
            <small>{{ snapshot.school.campus }} · 课后成果</small>
          </div>
        </div>
        <small>已发布 V{{ workspace.sharePage.publishedVersion }}</small>
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
          <p>{{ studentRow?.comment }}</p>
        </article>
        <article v-if="snapshot.displayConfig.showHighlight && studentRow?.highlight" class="parent-section highlight">
          <span>高光作品</span>
          <p>{{ studentRow.highlightNote }}</p>
        </article>
        <article v-if="snapshot.displayConfig.showMaterials" class="parent-section">
          <span>范画与课堂步骤</span>
          <div class="parent-materials">
            <img v-for="material in snapshot.materials.filter((item) => item.visible)" :key="material.id" :src="material.image" :alt="material.title" />
          </div>
        </article>
        <article v-if="snapshot.displayConfig.showHomework" class="parent-section homework">
          <span>课后任务</span>
          <p>{{ snapshot.homework.content }}</p>
          <small>{{ snapshot.homework.requirement }} · {{ snapshot.homework.dueDate }}</small>
          <a v-for="link in snapshot.externalLinks" :key="link.id" :href="link.url">{{ link.title }}</a>
        </article>
      </section>

      <section v-else class="parent-class-grid">
        <article v-for="row in classRows" :key="`${row.lessonId}-${row.studentId}`">
          <img :src="row.image" :alt="row.student?.name" />
          <strong>{{ row.student?.name }}</strong>
          <small>{{ row.highlight ? '高光作品' : '课堂作品' }}</small>
        </article>
      </section>

      <footer class="parent-footer">
        <small>链接有效至 {{ snapshot.displayConfig.expiresAt }}</small>
        <small>{{ snapshot.displayConfig.accessPolicy }} · {{ snapshot.displayConfig.allowForward ? '允许转发' : '不建议转发' }}</small>
        <small v-if="snapshot.displayConfig.showLessonType">课次类型仅为课后展示记录，不作为正式财务或课消依据。</small>
      </footer>
    </template>
  </main>
</template>
