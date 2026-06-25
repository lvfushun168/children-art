<script setup>
import { computed, reactive } from 'vue'

const props = defineProps({
  state: {
    type: Object,
    required: true
  },
  open: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['close', 'select-task', 'open-imports'])

const reasons = reactive({})

const pendingLessons = computed(() => props.state.visibleTasks.filter((task) => task.status !== '已完成'))
const wheatTodos = computed(() => props.state.wheatTraces.filter((trace) => trace.status !== '已人工处理' && trace.status !== '无需处理'))
const importTodos = computed(() => props.state.importPreviewRows.filter((row) => row.status !== '可导入'))
const cloudTodos = computed(() => props.state.visibleTasks.filter((task) => task.cloudArchiveStatus === '同步失败'))

const klassName = (task) => props.state.classes.find((item) => item.id === task.classId)?.name || '未命名班级'
const courseName = (task) => props.state.courses.find((item) => item.id === task.courseId)?.title || '未命名课程'

const updateTrace = (trace, status) => {
  if (props.state.markTrace(trace, status, reasons[trace.id] || '')) reasons[trace.id] = ''
}

const goTask = (task) => {
  emit('select-task', task)
  emit('close')
}
</script>

<template>
  <div v-if="open" class="todo-backdrop" @click.self="$emit('close')">
    <aside class="todo-drawer">
      <header class="todo-drawer-head">
        <div>
          <span>待办中心</span>
          <strong>{{ pendingLessons.length + wheatTodos.length + importTodos.length + cloudTodos.length }} 个待办</strong>
        </div>
        <button class="ghost" @click="$emit('close')">关闭</button>
      </header>

      <section class="todo-group">
        <div class="mini-head"><div><span>今日课后</span><strong>{{ pendingLessons.length }} 节待交付</strong></div></div>
        <button v-for="task in pendingLessons" :key="task.id" class="todo-row" @click="goTask(task)">
          <div>
            <strong>{{ task.time }} · {{ klassName(task) }}</strong>
            <small>{{ courseName(task) }} · {{ task.teacher }} · {{ task.lessonType }}</small>
          </div>
          <em>{{ task.status }} · {{ state.progressForTask(task) }}%</em>
        </button>
        <small v-if="!pendingLessons.length" class="empty-note">今天的课后交付都处理完了。</small>
      </section>

      <section class="todo-group">
        <div class="mini-head"><div><span>小麦留痕</span><strong>{{ wheatTodos.length }} 条待处理</strong></div></div>
        <article v-for="trace in wheatTodos" :key="trace.id" class="todo-trace-row">
          <div>
            <strong>{{ trace.lesson }}</strong>
            <small>{{ trace.course }} · {{ trace.teacher }} · {{ trace.note }}</small>
          </div>
          <em>{{ trace.status }}</em>
          <input v-model="reasons[trace.id]" placeholder="异常、无需处理或更正原因" />
          <div class="button-pair">
            <button class="secondary" @click="updateTrace(trace, '已人工处理')">已处理</button>
            <button class="ghost" @click="updateTrace(trace, '无需处理')">无需处理</button>
            <button v-if="trace.status === '待处理'" class="ghost" @click="updateTrace(trace, '异常')">异常</button>
          </div>
        </article>
        <small v-if="!wheatTodos.length" class="empty-note">暂无小麦留痕待办。</small>
      </section>

      <section class="todo-group">
        <div class="mini-head"><div><span>导入异常</span><strong>{{ importTodos.length }} 条需处理</strong></div><button class="ghost" @click="$emit('open-imports')">去导入中心</button></div>
        <article v-for="row in importTodos" :key="row.id" class="todo-row static">
          <div>
            <strong>{{ row.name }}</strong>
            <small>{{ row.issue || row.status }}</small>
          </div>
          <em>{{ row.status }}</em>
        </article>
        <small v-if="!importTodos.length" class="empty-note">暂无导入异常。</small>
      </section>

      <section class="todo-group">
        <div class="mini-head"><div><span>网盘同步</span><strong>{{ cloudTodos.length }} 条异常</strong></div></div>
        <article v-for="task in cloudTodos" :key="task.id" class="todo-row static">
          <div>
            <strong>{{ klassName(task) }} · {{ courseName(task) }}</strong>
            <small>网盘归档同步失败，需稍后重试或检查网盘配置。</small>
          </div>
          <em>同步失败</em>
        </article>
        <small v-if="!cloudTodos.length" class="empty-note">暂无网盘同步异常。</small>
      </section>
    </aside>
  </div>
</template>
