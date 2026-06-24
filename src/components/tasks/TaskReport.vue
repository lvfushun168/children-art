<script setup>
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
        <strong>{{ counts.matched }}/{{ counts.attend }}</strong>
      </article>
      <article>
        <span>课评确认</span>
        <strong>{{ counts.confirmed }}/{{ counts.attend }}</strong>
      </article>
      <article>
        <span>家长展示页</span>
        <strong>{{ counts.shareReady }}/{{ counts.attend }}</strong>
      </article>
      <article>
        <span>小麦留痕</span>
        <strong>{{ activeTask.wheatStatus }}</strong>
      </article>
    </div>
    <div class="report-actions">
      <button class="primary" @click="$emit('show-archives')">查看本节课档案</button>
      <button class="secondary" @click="$emit('show-students')">查看学生成长记录</button>
      <button class="secondary" @click="$emit('show-wheat')">处理小麦留痕</button>
    </div>
  </section>
</template>
