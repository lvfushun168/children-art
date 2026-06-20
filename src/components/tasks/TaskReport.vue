<script setup>
defineProps({
  counts: {
    type: Object,
    required: true
  },
  reportPulse: {
    type: Boolean,
    required: true
  }
})

defineEmits(['show-archives', 'show-students'])
</script>

<template>
  <section class="report-view" :class="{ pulse: reportPulse }">
    <div class="success-badge">本节课交付已闭环</div>
    <div class="report-grid">
      <article>
        <span>作品处理</span>
        <strong>{{ counts.processed }}/{{ counts.attend }}</strong>
      </article>
      <article>
        <span>课评生成</span>
        <strong>{{ counts.comments }}/{{ counts.attend }}</strong>
      </article>
      <article>
        <span>家长群材料</span>
        <strong>已生成</strong>
      </article>
      <article>
        <span>系统归档</span>
        <strong>{{ counts.archived }}/{{ counts.attend }}</strong>
      </article>
    </div>
    <div class="report-actions">
      <button class="primary" @click="$emit('show-archives')">查看本节课档案</button>
      <button class="secondary" @click="$emit('show-students')">查看学生成长记录</button>
    </div>
  </section>
</template>
