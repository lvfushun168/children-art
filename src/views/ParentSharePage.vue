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
const studentArtworks = computed(() => (Array.isArray(student.value.artworks) ? student.value.artworks : [])
  .filter((artwork) => artwork?.fileUrl || artwork?.artwork || artwork?.downloadUrl)
  .map((artwork, index) => ({
    ...artwork,
    fileUrl: artwork.fileUrl || artwork.artwork || artwork.downloadUrl || '',
    title: artwork.title || `学生作品${index + 1}`,
    sortOrder: Number(artwork.sortOrder ?? index),
    highlight: Boolean(artwork.highlight),
    highlightNote: artwork.highlightNote || ''
  }))
  .sort((left, right) => left.sortOrder - right.sortOrder))
const studentRow = computed(() => ({
  ...student.value,
  artworks: studentArtworks.value,
  image: studentArtworks.value[0]?.fileUrl || '',
  comment: student.value.feedback?.content || ''
}))
const highlightedArtworks = computed(() => studentArtworks.value.filter((artwork) => artwork.highlight))
const materials = computed(() => content.value?.materials || [])
const homework = computed(() => content.value?.homework || {})
const externalLinks = computed(() => content.value?.externalLinks || [])
const hasHomework = computed(() => homework.value.taskMode
  ? homework.value.taskMode === 'ASSIGNED'
  : Boolean(String(homework.value.content || '').trim()))
const displayConfig = computed(() => {
  const config = {
    showMaterials: true,
    showHomework: true,
    showHighlight: true,
    ...(content.value?.displayConfig || {})
  }
  config.showHomework = hasHomework.value && homework.value.visible !== false && content.value?.displayConfig?.showHomework !== false
  return config
})
const publishedAt = computed(() => content.value?.publishedAt || '')
const formatHomeworkDate = (value) => {
  if (!value) return ''
  const [year, month, day] = String(value).slice(0, 10).split('-')
  return year && month && day ? `${year}年${Number(month)}月${Number(day)}日` : String(value)
}

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
        <div v-if="studentRow.artworks.length" class="parent-artwork-gallery">
          <figure v-for="(artwork, index) in studentRow.artworks" :key="`${artwork.artworkId || artwork.fileUrl}-${index}`" class="parent-artwork-figure" :class="{ highlight: artwork.highlight }">
            <img class="parent-artwork" :src="artwork.fileUrl" :alt="artwork.title || `${student.name}作品${index + 1}`" />
            <figcaption>{{ artwork.title }}<small v-if="artwork.highlight"> · 高光作品</small></figcaption>
          </figure>
        </div>
        <article class="parent-section">
          <span>老师课评</span>
          <p>{{ studentRow?.comment }}</p>
        </article>
        <article v-if="displayConfig.showHighlight && highlightedArtworks.length" class="parent-section highlight">
          <span>高光作品</span>
          <div class="parent-highlight-list">
            <div v-for="(artwork, index) in highlightedArtworks" :key="`${artwork.artworkId || artwork.fileUrl}-highlight-${index}`">
              <strong>{{ artwork.title }}</strong>
              <p v-if="artwork.highlightNote">{{ artwork.highlightNote }}</p>
            </div>
          </div>
        </article>
        <article v-if="displayConfig.showMaterials && materials.length" class="parent-section">
          <span>范画、步骤与课堂记录</span>
          <div class="parent-materials">
            <template v-for="material in materials.filter((item) => item.fileUrl)" :key="material.fileUrl">
              <video
                v-if="material.assetType === 'CLASSROOM_VIDEO' || material.type === '课堂视频' || material.mediaType?.startsWith('video/')"
                :src="material.fileUrl"
                controls
                preload="metadata"
                :aria-label="material.title || material.fileName"
              />
              <img v-else :src="material.fileUrl" :alt="material.title || material.fileName" />
            </template>
          </div>
        </article>
        <article v-if="displayConfig.showHomework && hasHomework" class="parent-section homework">
          <span>课后任务</span>
          <p>{{ homework.content }}</p>
          <small v-if="homework.requirement">完成方式：{{ homework.requirement }}</small>
          <small v-if="homework.dueDate">预计回收：{{ formatHomeworkDate(homework.dueDate) }}</small>
          <a v-for="link in externalLinks" :key="link.title" :href="link.url" target="_blank" rel="noopener noreferrer">{{ link.title }}</a>
        </article>
      </section>

      <section v-else class="parent-class-grid">
        <article>
          <div v-if="studentRow.artworks.length" class="parent-class-artworks">
            <img v-for="(artwork, index) in studentRow.artworks" :key="`${artwork.artworkId || artwork.fileUrl}-${index}`" :src="artwork.fileUrl" :alt="artwork.title || student.name" />
          </div>
          <strong>{{ student.name }}</strong>
          <small>{{ highlightedArtworks.length ? `${highlightedArtworks.length} 个高光作品` : `${studentRow.artworks.length} 张课堂作品` }}</small>
        </article>
      </section>

    </template>
  </main>
</template>
