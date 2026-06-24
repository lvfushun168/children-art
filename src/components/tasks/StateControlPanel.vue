<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  state: { type: Object, required: true }
})

const lessonReason = ref('')
const exceptionType = ref('数据异常')
const shareReason = ref('调整展示内容')

watch(() => props.state.activeTask.id, () => {
  lessonReason.value = ''
  exceptionType.value = '数据异常'
  shareReason.value = '调整展示内容'
})

const changeLesson = (action) => {
  if (props.state.transitionLesson(action, lessonReason.value, exceptionType.value)) lessonReason.value = ''
}
</script>

<template>
  <section class="state-control">
    <article class="state-card">
      <div class="mini-head">
        <span>课次状态机</span>
        <strong>{{ state.activeTask.status }}</strong>
      </div>
      <div class="lesson-source-meta">
        <span>数据来源</span>
        <strong>{{ state.activeTask.importedFrom }}</strong>
        <small>旁路导入记录，不代表与小麦实时同步</small>
      </div>
      <label v-if="['待处理', '处理中'].includes(state.activeTask.status)">
        异常类型
        <select v-model="exceptionType">
          <option>数据异常</option>
          <option>素材缺失</option>
          <option>权限异常</option>
          <option>外部服务异常</option>
        </select>
      </label>
      <label>
        变更原因
        <input v-model="lessonReason" placeholder="异常、恢复或重开原因（必填）" />
      </label>
      <div class="button-pair">
        <button v-if="state.activeTask.status === '待处理'" class="primary" @click="changeLesson('start')">开始处理</button>
        <button v-if="['待处理', '处理中'].includes(state.activeTask.status)" class="ghost" @click="changeLesson('exception')">标记异常</button>
        <button v-if="state.activeTask.status === '异常'" class="primary" @click="changeLesson('recover')">恢复处理</button>
        <button v-if="state.activeTask.status === '已完成' && state.isAdmin" class="secondary" @click="changeLesson('reopen')">管理员重开</button>
      </div>
      <small v-if="state.activeTask.exceptionReason">最近异常：{{ state.activeTask.exceptionType }} · {{ state.activeTask.exceptionReason }}</small>
    </article>

    <article class="state-card">
      <div class="mini-head">
        <span>家长展示页</span>
        <strong>{{ state.sharePage.status }} · V{{ state.sharePage.status === '草稿' ? state.sharePage.draftVersion : state.sharePage.publishedVersion }}</strong>
      </div>
      <span>已发布版本：{{ state.sharePage.publishedVersion || '无' }}</span>
      <small v-if="state.sharePage.status === '草稿' && state.sharePage.publishedSnapshot">草稿修改不影响家长继续访问 V{{ state.sharePage.publishedVersion }}</small>
      <label>
        状态变更说明
        <input v-model="shareReason" placeholder="新草稿或撤销原因" />
      </label>
      <div class="button-pair">
        <button v-if="state.sharePage.status === '已发布'" class="secondary" @click="state.saveShareDraft(shareReason)">保存新草稿</button>
        <button v-if="state.sharePage.status !== '已失效'" class="primary" :disabled="state.isProcessing" @click="state.generateSharePages">{{ state.sharePage.publishedVersion ? '发布新版本' : '首次发布' }}</button>
        <button v-if="state.isAdmin && state.sharePage.publishedSnapshot && state.sharePage.status !== '已失效'" class="ghost" @click="state.revokeSharePage(shareReason)">撤销链接</button>
      </div>
      <small v-if="state.sharePage.revokedReason">撤销原因：{{ state.sharePage.revokedReason }}</small>
    </article>

    <article class="state-card audit-card">
      <div class="mini-head">
        <span>状态变更审计</span>
        <strong>{{ state.lessonStatusLogs.length }} 条</strong>
      </div>
      <div v-if="!state.lessonStatusLogs.length" class="audit-empty">尚无状态变更记录</div>
      <div v-for="log in state.lessonStatusLogs.slice(0, 6)" :key="log.id" class="audit-row">
        <strong>{{ log.objectType }}：{{ log.before }} → {{ log.after }}</strong>
        <span>{{ log.operator }} · {{ log.time }} · {{ log.source }}</span>
        <small>{{ log.reason }}</small>
      </div>
    </article>
  </section>
</template>
