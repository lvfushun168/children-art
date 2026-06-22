<script setup>
import { reactive } from 'vue'
import PageHead from '../components/layout/PageHead.vue'

const props = defineProps({
  state: { type: Object, required: true }
})

const reasons = reactive({})
const updateTrace = (trace, status) => {
  if (props.state.markTrace(trace, status, reasons[trace.id] || '')) reasons[trace.id] = ''
}
</script>

<template>
  <PageHead eyebrow="小麦旁路留痕" title="小麦留痕待办">
  </PageHead>

  <section>
    <article class="panel">
      <div class="section-head">
        <div>
          <span>人工处理清单</span>
          <strong>{{ state.wheatTraces.length }} 条留痕</strong>
        </div>
      </div>
      <div v-for="trace in state.wheatTraces" :key="trace.id" class="trace-row" :class="trace.status">
        <div>
          <strong>{{ trace.lesson }}</strong>
          <span>{{ trace.course }} · {{ trace.teacher }} · {{ trace.type }}</span>
          <small>{{ trace.source }} · {{ trace.note }}</small>
          <small v-if="trace.operator">最近操作：{{ trace.operator }} · {{ trace.processedAt }}</small>
        </div>
        <em>{{ trace.status }}</em>
        <input v-model="reasons[trace.id]" placeholder="异常、无需处理或更正原因" />
        <div class="button-pair">
          <button v-if="['待处理', '异常'].includes(trace.status)" class="secondary" @click="updateTrace(trace, '已人工处理')">已处理</button>
          <button v-if="['待处理', '异常'].includes(trace.status)" class="ghost" @click="updateTrace(trace, '无需处理')">无需处理</button>
          <button v-if="trace.status === '待处理'" class="ghost" @click="updateTrace(trace, '异常')">异常</button>
          <button v-if="state.isAdmin && ['已人工处理', '无需处理'].includes(trace.status)" class="ghost" @click="updateTrace(trace, '待处理')">更正为待处理</button>
        </div>
      </div>
    </article>

    <details class="advanced-state trace-audit">
      <summary>查看留痕状态变更记录</summary>
      <div class="notice-box">
        <strong>一期边界</strong>
        <small>本系统只生成待办和状态记录，不自动读取或回写小麦课程完成状态。</small>
      </div>
      <div class="audit-list">
        <strong>小麦留痕审计</strong>
        <div v-for="log in state.statusChangeLogs.filter((item) => item.objectType === '小麦留痕').slice(0, 8)" :key="log.id" class="audit-row">
          <strong>{{ log.before }} → {{ log.after }}</strong>
          <span>{{ log.operator }} · {{ log.time }}</span>
          <small>{{ log.reason }}</small>
        </div>
      </div>
    </details>
  </section>
</template>
