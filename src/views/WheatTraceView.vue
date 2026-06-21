<script setup>
import PageHead from '../components/layout/PageHead.vue'

defineProps({
  traces: {
    type: Array,
    required: true
  },
  importBatches: {
    type: Array,
    required: true
  }
})

defineEmits(['mark-trace'])
</script>

<template>
  <PageHead eyebrow="小麦旁路留痕" title="小麦留痕待办">
    <button class="primary">导入小麦数据</button>
  </PageHead>

  <section class="split-grid">
    <article class="panel">
      <div class="section-head">
        <div>
          <span>人工处理清单</span>
          <strong>{{ traces.length }} 条留痕</strong>
        </div>
      </div>
      <div v-for="trace in traces" :key="trace.id" class="trace-row" :class="trace.status">
        <div>
          <strong>{{ trace.lesson }}</strong>
          <span>{{ trace.course }} · {{ trace.teacher }} · {{ trace.type }}</span>
          <small>{{ trace.source }} · {{ trace.note }}</small>
        </div>
        <em>{{ trace.status }}</em>
        <div class="button-pair">
          <button class="secondary" @click="$emit('mark-trace', trace, '已人工处理')">已处理</button>
          <button class="ghost" @click="$emit('mark-trace', trace, '无需处理')">无需处理</button>
          <button class="ghost" @click="$emit('mark-trace', trace, '异常')">异常</button>
        </div>
      </div>
    </article>

    <article class="panel">
      <div class="section-head">
        <div>
          <span>导入记录</span>
          <strong>{{ importBatches.length }} 批</strong>
        </div>
      </div>
      <div v-for="batch in importBatches" :key="batch.id" class="template-row">
        <strong>{{ batch.source }}</strong>
        <span>{{ batch.time }} · 成功 {{ batch.success }} · 异常 {{ batch.failed }}</span>
        <small>{{ batch.note }}</small>
      </div>
      <div class="notice-box">
        <strong>一期边界</strong>
        <small>本系统只生成待办和状态记录，不自动读取或回写小麦课程完成状态。</small>
      </div>
    </article>
  </section>
</template>
