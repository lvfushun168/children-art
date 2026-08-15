<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from '../services/api'

const props = defineProps({
  state: { type: Object, required: true },
  route: { type: Object, required: true }
})

const loading = ref(true)
const error = ref('')
const content = ref(null)
const tokenValid = computed(() => Boolean(content.value))
const lesson = computed(() => content.value?.lesson || {})
const student = computed(() => content.value?.student || {})
const studentRow = computed(() => ({
  ...student.value,
  image: student.value.artworks?.[0]?.fileUrl || '',
  comment: student.value.feedback?.content || ''
}))
const materials = computed(() => content.value?.materials || [])
const homework = computed(() => content.value?.homework || {})
const externalLinks = computed(() => content.value?.externalLinks || [])
const displayConfig = computed(() => ({ showMaterials: true, showHomework: homework.value.visible !== false, showHighlight: true, ...(content.value?.displayConfig || {}) }))
const publishedAt = computed(() => content.value?.publishedAt || '')

onMounted(async () => {
  if (!props.route.token) {
    loading.value = false
    error.value = '缺少公开访问凭证'
    return
  }
  try {
    const response = await api.parent.publicShare(props.route.token)
    content.value = response?.content || response
  } catch (requestError) {
    error.value = requestError?.message || '分享链接无法访问'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="parent-h5">
    <section v-if="loading || !tokenValid" class="share-access-state">
      <strong>{{ loading ? '正在加载展示页' : '链接无法访问' }}</strong>
      <p>{{ loading ? '请稍候。' : (error || '分享链接未发布、访问密钥错误、已失效或已被机构关闭。') }}</p>
    </section>

    <template v-else>
      <header class="parent-brand">
        <div>
          <span>课</span>
          <div>
            <strong>课后成果</strong>
            <small>{{ lesson.className || '' }} · 课堂展示</small>
          </div>
        </div>
        <small>已发布 · {{ publishedAt }}</small>
      </header>

      <section class="parent-hero">
        <span>{{ lesson.dateValue || '' }} · {{ lesson.startTime || '' }} · {{ lesson.lessonType || '' }}</span>
        <h1>{{ student.name || '学生' }}的课后成果</h1>
        <p>{{ lesson.courseTitle || '' }}</p>
      </section>

      <section v-if="route.type === 'student'" class="parent-content">
        <img v-if="studentRow.image" class="parent-artwork" :src="studentRow.image" :alt="student.name" />
        <article class="parent-section">
          <span>老师课评</span>
          <p>{{ studentRow?.comment }}</p>
        </article>
        <article v-if="displayConfig.showHighlight && studentRow?.highlight" class="parent-section highlight">
          <span>高光作品</span>
          <p>{{ studentRow.highlightNote }}</p>
        </article>
        <article v-if="displayConfig.showMaterials && materials.length" class="parent-section">
          <span>范画与课堂步骤</span>
          <div class="parent-materials">
            <img v-for="material in materials.filter((item) => item.fileUrl)" :key="material.fileUrl" :src="material.fileUrl" :alt="material.title || material.fileName" />
          </div>
        </article>
        <article v-if="displayConfig.showHomework" class="parent-section homework">
          <span>课后任务</span>
          <p>{{ homework.content }}</p>
          <small>{{ homework.requirement }} · {{ homework.dueDate }}</small>
          <a v-for="link in externalLinks" :key="link.title" :href="link.url">{{ link.title }}</a>
        </article>
      </section>

      <section v-else class="parent-class-grid">
        <article>
          <img v-if="studentRow.image" :src="studentRow.image" :alt="student.name" />
          <strong>{{ student.name }}</strong>
          <small>{{ studentRow.highlight ? '高光作品' : '课堂作品' }}</small>
        </article>
      </section>

    </template>
  </main>
</template>
