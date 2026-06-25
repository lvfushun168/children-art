<script setup>
import { computed, reactive, ref } from 'vue'

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
const activeCategory = ref('all')

const pendingLessons = computed(() => props.state.visibleTasks.filter((task) => task.status !== '已完成'))
const wheatTodos = computed(() => props.state.wheatTraces.filter((trace) => trace.status !== '已人工处理' && trace.status !== '无需处理'))
const importTodos = computed(() => props.state.importPreviewRows.filter((row) => row.status !== '可导入'))
const cloudTodos = computed(() => props.state.visibleTasks.filter((task) => task.cloudArchiveStatus === '同步失败'))
const totalCount = computed(() => pendingLessons.value.length + wheatTodos.value.length + importTodos.value.length + cloudTodos.value.length)
const categories = computed(() => [
  { id: 'all', label: '全部', count: totalCount.value, desc: '按优先级查看所有待办' },
  { id: 'lessons', label: '今日课后', count: pendingLessons.value.length, desc: '未完成课后交付' },
  { id: 'wheat', label: '小麦留痕', count: wheatTodos.value.length, desc: '需回小麦人工处理' },
  { id: 'cloud', label: '网盘同步', count: cloudTodos.value.length, desc: '归档同步异常' },
  { id: 'imports', label: '导入异常', count: importTodos.value.length, desc: '资料导入待修正' }
])
const showGroup = (id) => activeCategory.value === 'all' || activeCategory.value === id

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
          <strong>{{ totalCount }} 个待办</strong>
        </div>
        <button class="ghost" @click="$emit('close')">关闭</button>
      </header>

      <div class="todo-center-layout">
        <nav class="todo-category-menu">
          <button
            v-for="category in categories"
            :key="category.id"
            :class="{ active: activeCategory === category.id }"
            @click="activeCategory = category.id"
          >
            <span>
              <strong>{{ category.label }}</strong>
              <small>{{ category.desc }}</small>
            </span>
            <b>{{ category.count }}</b>
          </button>
        </nav>

        <div class="todo-list-pane">
          <section v-if="showGroup('lessons')" class="todo-group">
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

          <section v-if="showGroup('wheat')" class="todo-group">
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

          <section v-if="showGroup('cloud')" class="todo-group">
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

          <section v-if="showGroup('imports')" class="todo-group">
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
        </div>
      </div>
    </aside>
  </div>
</template>
