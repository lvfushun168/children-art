<script setup>
import { computed, reactive, ref } from 'vue'
import { sameId } from '../../services/mappers'

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

const emit = defineEmits(['close', 'select-task', 'open-imports', 'open-supervision'])

const reasons = reactive({})
const activeCategory = ref('all')

const pendingLessons = computed(() => {
  const todayTasks = props.state.visibleTasks.filter((task) => task.dateValue === props.state.latestLessonDate)
  const scopedTasks = todayTasks.length ? todayTasks : props.state.visibleTasks
  return scopedTasks.filter((task) => task.status !== '已完成')
})
const wheatTodos = computed(() => props.state.wheatTraces.filter((trace) => trace.status !== '已人工处理' && trace.status !== '无需处理'))
const importTodos = computed(() => props.state.importPreviewRows.filter((row) => row.status !== '可导入'))
const cloudTodos = computed(() => props.state.visibleTasks.filter((task) => task.cloudArchiveStatus === '同步失败'))
const wecomTodos = computed(() => props.state.wecomSendTasks.filter((task) => ['待老师确认发送', '发送失败'].includes(task.status)))
const reviewTodos = computed(() => props.state.canQualityReview ? props.state.pendingQualityReviews : [])
const serverTodos = computed(() => (props.state.todos || []).filter((todo) => !['已完成', '已取消'].includes(todo.status)))
const totalCount = computed(() => pendingLessons.value.length + wheatTodos.value.length + importTodos.value.length + cloudTodos.value.length + wecomTodos.value.length + reviewTodos.value.length + serverTodos.value.length)
const categories = computed(() => [
  { id: 'all', label: '全部', count: totalCount.value },
  { id: 'lessons', label: '今日课后', count: pendingLessons.value.length },
  { id: 'reviews', label: '待评分', count: reviewTodos.value.length },
  { id: 'wecom', label: '企微发送', count: wecomTodos.value.length },
  { id: 'wheat', label: '小麦留痕', count: wheatTodos.value.length },
  { id: 'cloud', label: '网盘同步', count: cloudTodos.value.length },
  { id: 'imports', label: '导入异常', count: importTodos.value.length },
  { id: 'server', label: '服务端任务', count: serverTodos.value.length }
])
const showGroup = (id) => activeCategory.value === 'all' || activeCategory.value === id

const klassName = (task) => props.state.classes.find((item) => sameId(item.id, task.classId))?.name || '未命名班级'
const courseName = (task) => props.state.courses.find((item) => sameId(item.id, task.courseId))?.title || '未命名课程'

const updateTrace = (trace, status) => {
  if (props.state.markTrace(trace, status, reasons[trace.id] || '')) reasons[trace.id] = ''
}

const updateWecomTask = (task, status) => {
  if (props.state.markWecomSendTask(task, status, reasons[`wecom-${task.id}`] || '')) reasons[`wecom-${task.id}`] = ''
}

const goTask = (task) => {
  emit('select-task', task)
  emit('close')
}

const openSupervision = () => {
  emit('open-supervision')
  emit('close')
}

const serverTodoLesson = (todo) => props.state.visibleTasks.find((task) => sameId(task.id, todo.lessonId))
const completeServerTodo = (todo) => props.state.completeTodo?.(todo)
const cancelServerTodo = (todo) => props.state.cancelTodo?.(todo, reasons[`todo-${todo.id}`] || '')
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
            <strong>{{ category.label }}</strong>
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

          <section v-if="showGroup('reviews')" class="todo-group">
            <div class="mini-head"><div><span>课次质量评分</span><strong>{{ reviewTodos.length }} 节待评分</strong></div><button class="ghost" @click="openSupervision">去教管看板</button></div>
            <article v-for="lesson in reviewTodos" :key="lesson.id" class="todo-row static">
              <div>
                <strong>{{ lesson.date }} {{ lesson.time }} · {{ lesson.className }}</strong>
                <small>{{ lesson.course }} · {{ lesson.teacher }} · {{ lesson.lessonType }}</small>
              </div>
              <em>{{ lesson.reviewStatus }}</em>
            </article>
            <small v-if="!reviewTodos.length" class="empty-note">暂无待评分课次。</small>
          </section>

          <section v-if="showGroup('wecom')" class="todo-group">
            <div class="mini-head"><div><span>企微发送确认</span><strong>{{ wecomTodos.length }} 条待处理</strong></div></div>
            <article v-for="task in wecomTodos" :key="`wecom-${task.id}`" class="todo-trace-row">
              <div>
                <strong>{{ task.studentName }}（{{ task.targetName }}）</strong>
                <small>{{ task.lesson }} · 展示页 V{{ task.shareVersion }} · {{ task.shareUrl }}</small>
                <small v-if="task.failureReason">失败原因：{{ task.failureReason }}</small>
              </div>
              <em>{{ task.status }}</em>
              <input v-model="reasons[`wecom-${task.id}`]" placeholder="取消触达原因（必填）" />
              <div class="button-pair">
                <button class="secondary" @click="updateWecomTask(task, '已发送')">已确认发送</button>
                <button class="ghost" @click="state.manualCopyWecomTask(task)">复制链接人工发送</button>
                <button v-if="task.status === '发送失败'" class="ghost" @click="state.retryWecomSendTask(task)">重试发送</button>
                <button v-if="task.status !== '发送失败'" class="ghost" @click="updateWecomTask(task, '已取消')">取消触达</button>
              </div>
            </article>
            <small v-if="!wecomTodos.length" class="empty-note">暂无待确认的企微触达任务。</small>
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

          <section v-if="showGroup('server')" class="todo-group">
            <div class="mini-head"><div><span>服务端任务</span><strong>{{ serverTodos.length }} 条待处理</strong></div></div>
            <article v-for="todo in serverTodos" :key="`todo-${todo.id}`" class="todo-trace-row">
              <div>
                <strong>{{ todo.title || todo.todoType }}</strong>
                <small>{{ todo.description || '待处理任务' }}<span v-if="todo.dueAt"> · 截止 {{ todo.dueAt }}</span></small>
                <small v-if="serverTodoLesson(todo)">课次：{{ serverTodoLesson(todo).date }} {{ serverTodoLesson(todo).time }}</small>
              </div>
              <em>{{ todo.status }}</em>
              <input v-model="reasons[`todo-${todo.id}`]" placeholder="取消原因（可选完成或必填取消）" />
              <div class="button-pair">
                <button v-if="serverTodoLesson(todo)" class="ghost" @click="goTask(serverTodoLesson(todo))">打开课次</button>
                <button class="secondary" @click="completeServerTodo(todo)">完成</button>
                <button class="ghost" @click="cancelServerTodo(todo)">取消</button>
              </div>
            </article>
            <small v-if="!serverTodos.length" class="empty-note">暂无服务端待办。</small>
          </section>
        </div>
      </div>
    </aside>
  </div>
</template>
