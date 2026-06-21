<script setup>
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
  fileNameFor: {
    type: Function,
    required: true
  }
})

defineEmits(['copy-export'])
</script>

<template>
  <aside class="preview panel" :class="{ 'preview-pulse': previewPulse, 'comment-pulse': commentPulse }">
    <div class="section-head">
      <div>
        <span>家长展示预览</span>
        <strong>{{ activeStudent?.name || '未选择' }}</strong>
      </div>
      <button class="ghost" @click="$emit('copy-export')">{{ copied ? '已复制' : '复制链接' }}</button>
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
        <img :src="activeSessionStudent.image" :alt="activeStudent.name" />
        <span v-if="activeImageTemplate.watermark !== '隐藏水印'">{{ school.name }}</span>
      </div>
      <strong>{{ activeStudent.name }} · {{ activeCourse.title }}</strong>
      <small>
        图片状态：{{ activeSessionStudent.imageProcessStatus || '未处理' }} ·
        {{ activeSessionStudent.imageConfirmed ? '老师已确认' : '待老师确认' }}
      </small>
      <small v-if="displayConfig.showLessonType">
        {{ activeTask.lessonType }} · 本信息仅为课后展示记录，不作为正式财务或课消依据
      </small>
      <p>{{ activeSessionStudent.comment || '课评生成后会在这里预览。' }}</p>
      <div v-if="displayConfig.showHighlight && activeSessionStudent.highlight" class="highlight-note">
        <strong>高光作品</strong>
        <small>{{ activeSessionStudent.highlightNote }}</small>
      </div>
      <div v-if="displayConfig.showMaterials" class="preview-materials">
        <img v-for="material in materials.filter((item) => item.visible)" :key="material.id" :src="material.image" :alt="material.title" />
      </div>
      <div v-if="displayConfig.showHomework" class="homework-preview">
        <strong>课后任务</strong>
        <small>{{ homework.content }}</small>
        <small>{{ homework.requirement }} · {{ homework.dueDate }}</small>
        <a v-for="link in selectedExternalLinks" :key="link.id" :href="link.url">{{ link.title }}</a>
      </div>
      <div class="share-box">
        <div class="qr-code">{{ qrText }}</div>
        <div>
          <small>{{ parentShareUrl }}</small>
          <a class="share-open-link" :href="parentShareUrl" target="_blank">打开家长 H5</a>
        </div>
      </div>
      <small>{{ fileNameFor(activeSessionStudent) }}</small>
    </article>
    <textarea class="export-box" :value="exportText" readonly />
  </aside>
</template>
