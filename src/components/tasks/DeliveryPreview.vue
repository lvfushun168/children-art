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
  activeImageTemplate: {
    type: Object,
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
        <span>交付预览</span>
        <strong>{{ activeStudent?.name || '未选择' }}</strong>
      </div>
      <button class="ghost" @click="$emit('copy-export')">{{ copied ? '已复制' : '复制文案' }}</button>
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
      <small>图片模板：{{ activeImageTemplate.name }} · {{ activeImageTemplate.ratio }} · {{ activeImageTemplate.brightness }}</small>
      <p>{{ activeSessionStudent.comment || '课评生成后会在这里预览。' }}</p>
      <small>{{ fileNameFor(activeSessionStudent) }}</small>
    </article>
    <textarea class="export-box" :value="exportText" readonly />
  </aside>
</template>
