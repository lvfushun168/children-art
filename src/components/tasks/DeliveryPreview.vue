<script setup>
import { computed } from 'vue'
import ProtectedMedia from '../common/ProtectedMedia.vue'

const props = defineProps({
  activeStudent: {
    type: Object,
    default: null
  },
  activeSessionStudent: {
    type: Object,
    default: null
  },
  activeCourse: {
    type: Object,
    required: true
  },
  activeTask: {
    type: Object,
    required: true
  },
  activeImageTemplate: {
    type: Object,
    default: null
  },
  materials: {
    type: Array,
    required: true
  },
  homework: {
    type: Object,
    required: true
  },
  displayConfig: {
    type: Object,
    required: true
  },
  selectedExternalLinks: {
    type: Array,
    required: true
  },
  school: {
    type: Object,
    required: true
  },
  exportText: {
    type: String,
    required: true
  },
  copied: {
    type: Boolean,
    required: true
  },
  previewPulse: {
    type: Boolean,
    required: true
  },
  commentPulse: {
    type: Boolean,
    required: true
  },
  parentShareUrl: {
    type: String,
    required: true
  },
  qrText: {
    type: String,
    required: true
  },
  reviewOnly: {
    type: Boolean,
    default: false
  },
  fileNameFor: {
    type: Function,
    required: true
  }
})

defineEmits(['copy-export'])

const imageTemplate = computed(() => {
  const template = props.activeImageTemplate || {}
  const config = template.config || {}
  const ratio = config.canvas?.aspectRatio || template.ratio || 'original'
  return {
    ...template,
    ratio: ratio === 'original' ? '原比例' : ratio
  }
})

const artworkFileId = (artwork) => artwork?.displayFileId
  || artwork?.fileId
  || (artwork?.imageConfirmed ? artwork?.processedFileId : null)
  || artwork?.originalFileId
  || artwork?.imageFileIds?.[0]
  || null

const artworkImage = (artwork) => artwork?.image || artwork?.artwork || artwork?.fileUrl || ''
const artworkHasMedia = (artwork) => Boolean(artworkFileId(artwork) || artworkImage(artwork))

const previewArtworks = computed(() => {
  const row = props.activeSessionStudent
  const nested = Array.isArray(row?.artworks)
    ? row.artworks
      .filter((artwork) => artwork?.imageMatched !== false && artworkHasMedia(artwork))
      .slice()
      .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    : []
  if (nested.length) return nested
  if (!row) return []

  const legacyFileIds = Array.isArray(row.imageFileIds) ? row.imageFileIds.filter(Boolean) : []
  if (legacyFileIds.length > 1) {
    return legacyFileIds.map((fileId, index) => ({
      ...row,
      artworkId: `${row.studentId || 'student'}-${fileId}-${index}`,
      fileId,
      displayFileId: fileId,
      image: index === 0 ? row.image || '' : '',
      artworkTitle: row.artworkTitle || `学生作品${index + 1}`,
      title: row.title || `学生作品${index + 1}`
    }))
  }
  return artworkHasMedia(row) ? [{ ...row, artworkTitle: row.artworkTitle || row.title || '学生作品' }] : []
})

const artworkTitle = (artwork, index) => artwork?.artworkTitle || artwork?.title || `学生作品${index + 1}`
const artworkStatus = (artwork) => artwork?.imageProcessStatus || '未处理'
const artworkConfirmation = (artwork) => artwork?.imageConfirmed ? '老师已确认' : '待老师确认'

const homeworkIsAssigned = (value) => value?.taskMode
  ? value.taskMode === 'ASSIGNED'
  : Boolean(String(value?.content || '').trim())
const formatHomeworkDate = (value) => {
  if (!value) return ''
  const [year, month, day] = String(value).slice(0, 10).split('-')
  return year && month && day ? `${year}年${Number(month)}月${Number(day)}日` : String(value)
}
</script>

<template>
  <aside class="preview panel" :class="{ 'preview-pulse': previewPulse, 'comment-pulse': commentPulse }">
    <div class="section-head">
      <div>
        <span>家长展示预览</span>
        <strong>{{ activeStudent?.name || '未选择' }}</strong>
      </div>
      <button v-if="!reviewOnly" class="ghost" @click="$emit('copy-export')">{{ copied ? '已复制' : '复制链接' }}</button>
    </div>
    <article class="delivery-card" v-if="activeSessionStudent && activeStudent">
      <div v-if="previewArtworks.length" class="preview-artwork-list">
        <article
          v-for="(artwork, index) in previewArtworks"
          :key="`${artwork.artworkId || artwork.displayFileId || artwork.fileId || index}`"
          class="preview-artwork"
          :class="{ highlight: displayConfig.showHighlight && artwork.highlight }"
        >
          <div
            class="image-frame"
            :class="{
              square: imageTemplate.ratio === '1:1',
              raw: imageTemplate.ratio === '原比例'
            }"
          >
            <ProtectedMedia
              :file-id="artworkFileId(artwork)"
              :src="artworkImage(artwork)"
              :alt="`${activeStudent.name}${artworkTitle(artwork, index)}`"
            />
            <span v-if="displayConfig.showHighlight && artwork.highlight" class="preview-artwork-badge">高光作品</span>
          </div>
          <div class="preview-artwork-meta">
            <strong>{{ artworkTitle(artwork, index) }}</strong>
            <small>第 {{ index + 1 }} 张 · 图片状态：{{ artworkStatus(artwork) }} · {{ artworkConfirmation(artwork) }}</small>
            <small v-if="displayConfig.showHighlight && artwork.highlight && artwork.highlightNote" class="preview-artwork-note">{{ artwork.highlightNote }}</small>
          </div>
        </article>
      </div>
      <div v-else class="preview-artwork-empty">暂无可展示作品</div>
      <strong>{{ activeStudent.name }} · {{ activeCourse.title }}</strong>
      <small v-if="displayConfig.showLessonType">
        {{ activeTask.lessonType }}
      </small>
      <p>{{ activeSessionStudent.comment || '暂无课评' }}</p>
      <div v-if="displayConfig.showMaterials" class="preview-materials">
        <template v-for="material in materials.filter((item) => item.visible && item.type !== '课件')" :key="material.id">
          <ProtectedMedia
            v-if="material.type === '课堂视频'"
            tag="video"
            :file-id="material.fileId"
            :src="material.image"
            controls
            preload="metadata"
            :aria-label="material.title"
          />
          <ProtectedMedia v-else :file-id="material.fileId" :src="material.image" :alt="material.title" />
        </template>
      </div>
      <div v-if="displayConfig.showHomework && homeworkIsAssigned(homework)" class="homework-preview">
        <strong>课后任务</strong>
        <small>{{ homework.content }}</small>
        <small v-if="homework.requirement">完成方式：{{ homework.requirement }}</small>
        <small v-if="homework.dueDate">截止日期：{{ formatHomeworkDate(homework.dueDate) }}</small>
        <a v-for="link in selectedExternalLinks" :key="link.id" :href="link.url" target="_blank" rel="noopener noreferrer">{{ link.title }}</a>
      </div>
      <div v-if="!reviewOnly" class="share-box">
        <div class="qr-code">{{ qrText }}</div>
        <div>
          <small>{{ parentShareUrl }}</small>
          <a class="share-open-link" :href="parentShareUrl" target="_blank">打开家长 H5</a>
        </div>
      </div>
      <small>{{ fileNameFor(activeSessionStudent) }}</small>
    </article>
    <textarea v-if="!reviewOnly" class="export-box" :value="exportText" readonly />
  </aside>
</template>
