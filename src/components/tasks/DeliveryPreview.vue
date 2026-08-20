<script setup>
import ProtectedMedia from '../common/ProtectedMedia.vue'

defineProps({
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
    required: true
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
      <div
        class="image-frame"
        :class="{
          processed: activeSessionStudent.processed,
          square: activeImageTemplate.ratio === '1:1',
          raw: activeImageTemplate.ratio === '原比例'
        }"
      >
        <ProtectedMedia :file-id="activeSessionStudent.processedFileId || activeSessionStudent.originalFileId || activeSessionStudent.imageFileIds?.[0]" :src="activeSessionStudent.image" :alt="activeStudent.name" />
        <span v-if="activeImageTemplate.watermark !== '隐藏水印'">{{ school.name }}</span>
      </div>
      <strong>{{ activeStudent.name }} · {{ activeCourse.title }}</strong>
      <small>
        图片状态：{{ activeSessionStudent.imageProcessStatus || '未处理' }} ·
        {{ activeSessionStudent.imageConfirmed ? '老师已确认' : '待老师确认' }}
      </small>
      <small v-if="displayConfig.showLessonType">
        {{ activeTask.lessonType }}
      </small>
      <p>{{ activeSessionStudent.comment || '暂无课评' }}</p>
      <div v-if="displayConfig.showHighlight && activeSessionStudent.highlight" class="highlight-note">
        <strong>高光作品</strong>
        <small>{{ activeSessionStudent.highlightNote }}</small>
      </div>
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
        <small v-if="homework.dueDate">预计回收：{{ formatHomeworkDate(homework.dueDate) }}</small>
        <a v-for="link in selectedExternalLinks" :key="link.id" :href="link.url">{{ link.title }}</a>
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
