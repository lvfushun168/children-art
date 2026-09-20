<script setup>
import AppIcon from '../common/AppIcon.vue'

defineProps({
  counts: {
    type: Object,
    required: true
  },
  reportPulse: {
    type: Boolean,
    required: true
  },
  activeTask: {
    type: Object,
    required: true
  }
})

defineEmits(['show-archives', 'show-students', 'show-wheat'])
</script>

<template>
  <section class="report-view" :class="{ pulse: reportPulse }">
    <div class="success-badge">本节课交付已闭环</div>
    <div class="report-grid">
      <article>
        <span>作品已上传</span>
        <strong>{{ counts.artworkCount }} 张 / {{ counts.matched }} 位学生</strong>
      </article>
      <article>
        <span>总课评</span>
        <strong>{{ counts.totalFeedbackReady ? '已确认' : '待填写' }}</strong>
      </article>
      <article>
        <span>家长展示页</span>
        <strong>{{ counts.shareReady }}/{{ counts.attend }}</strong>
      </article>
      <article>
        <span>小麦消课</span>
        <strong>{{ activeTask.wheatStatus }}</strong>
      </article>
    </div>
    <div class="report-actions">
      <button class="primary" @click="$emit('show-archives')"><AppIcon name="archive" :size="16" />查看本节课档案</button>
      <button class="secondary" @click="$emit('show-students')"><AppIcon name="student" :size="16" />查看学生成长记录</button>
      <button class="secondary" @click="$emit('show-wheat')"><AppIcon name="todo" :size="16" />打开待办中心</button>
    </div>
  </section>
</template>
