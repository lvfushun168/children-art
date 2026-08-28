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

const emit = defineEmits(['close', 'select-task', 'open-supervision'])

const state = props.state
const reasons = reactive({})
const activeCategory = ref('lessons')

const listValue = (value) => {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.value)) return value.value
  return []
}

const stateList = (key) => listValue(state[key])
const lessonList = computed(() => stateList('visibleInboxLessons'))
const wheatTodos = computed(() => stateList('wheatTraces').filter((trace) => !['已人工处理', '无需处理'].includes(trace.status)))
const wecomTodos = computed(() => stateList('wecomSendTasks').filter((task) => ['待绑定家长群', '待老师确认发送', '发送失败'].includes(task.status)))
const cloudTodos = computed(() => stateList('cloudArchiveTodos').filter((job) => job.statusCode === 'FAILED' || job.status === '同步失败'))
const reviewTodos = computed(() => state.canQualityReview
  ? stateList('pendingReviewQueue').filter((review) => ['待评分', '已退回'].includes(review.status))
  : [])
const pendingLessons = computed(() => lessonList.value.filter((task) => task.status !== '已完成'))

const categories = computed(() => {
  const values = [
    { id: 'lessons', label: '课后交付', count: pendingLessons.value.length },
    { id: 'wecom', label: '企微待处理', count: wecomTodos.value.length },
    { id: 'wheat', label: '小麦消课', count: wheatTodos.value.length },
    { id: 'cloud', label: '网盘异常', count: cloudTodos.value.length }
  ]
  if (state.canQualityReview) values.push({ id: 'reviews', label: '待评分', count: reviewTodos.value.length })
  return values
})

const totalCount = computed(() => categories.value.reduce((total, category) => total + category.count, 0))

const lessonForId = (lessonId) => [
  ...stateList('inboxLessons'),
  ...stateList('visibleTasks'),
  ...stateList('scheduleLessons')
].find((lesson) => sameId(lesson.id, lessonId)) || null

const klassName = (task) => task.className
  || stateList('classes').find((item) => sameId(item.id, task.classId))?.name
  || lessonForId(task.lessonId)?.className
  || '未命名班级'

const courseName = (task) => task.course
  || task.courseTitle
  || stateList('courses').find((item) => sameId(item.id, task.courseId))?.title
  || lessonForId(task.lessonId)?.course
  || '未命名课程'

const lessonForCloudJob = (job) => lessonForId(job.lessonId)

const updateTrace = (trace, status) => {
  const reason = reasons[`wheat-${trace.id}`] || ''
  if (state.markTrace(trace, status, reason)) reasons[`wheat-${trace.id}`] = ''
}

const updateWecomTask = (task, status) => {
  const reason = reasons[`wecom-${task.id}`] || ''
  if (state.markWecomSendTask(task, status, reason)) reasons[`wecom-${task.id}`] = ''
}

const retryCloud = (job) => state.retryCloudArchiveTodo?.(job)

const goTask = (task) => {
  emit('select-task', task)
  emit('close')
}

const openSupervision = () => {
  emit('open-supervision')
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
          <small>只显示需要当前用户采取动作的业务事项</small>
        </div>
        <button type="button" class="ghost" @click="$emit('close')">关闭</button>
      </header>

      <div class="todo-center-layout">
        <nav class="todo-category-menu" aria-label="待办分类">
          <button
            v-for="category in categories"
            :key="category.id"
            type="button"
            :class="{ active: activeCategory === category.id }"
            @click="activeCategory = category.id"
          >
            <strong>{{ category.label }}</strong>
            <b>{{ category.count }}</b>
          </button>
        </nav>

        <div class="todo-list-pane">
          <section v-if="activeCategory === 'lessons'" class="todo-group">
            <div class="mini-head"><div><span>课后交付</span><strong>{{ pendingLessons.length }} 节未完成</strong></div></div>
            <button v-for="task in pendingLessons" :key="task.id" type="button" class="todo-row" @click="goTask(task)">
              <div>
                <strong>{{ task.date || task.dateValue }} {{ task.time }} · {{ klassName(task) }}</strong>
                <small>{{ courseName(task) }} · {{ task.teacher }} · {{ task.lessonType }}</small>
              </div>
              <em>{{ task.status }} · {{ state.progressForTask(task) }}%</em>
            </button>
            <small v-if="!pendingLessons.length" class="empty-note">当前没有未完成的课后交付。</small>
          </section>

          <section v-if="activeCategory === 'wecom'" class="todo-group">
            <div class="mini-head"><div><span>企微待处理</span><strong>{{ wecomTodos.length }} 条待处理</strong></div></div>
            <article v-for="task in wecomTodos" :key="`wecom-${task.id}`" class="todo-trace-row">
              <div>
                <strong>{{ task.studentName }}（{{ task.targetName }}）</strong>
                <small>{{ task.lesson }} · 展示页 V{{ task.shareVersion }}</small>
                <small v-if="task.wecomGroupName">家长群：{{ task.wecomGroupName }}</small>
                <small v-else-if="task.status === '待绑定家长群'">请先在学生管理中绑定家长客户群</small>
                <small v-if="task.failureReason">失败原因：{{ task.failureReason }}</small>
              </div>
              <em>{{ task.status }}</em>
              <input v-model="reasons[`wecom-${task.id}`]" placeholder="取消发送原因（必填）" />
              <div class="button-pair">
                <button v-if="task.status === '待老师确认发送'" type="button" class="secondary" @click="updateWecomTask(task, '已发送')">人工确认已发送</button>
                <button type="button" class="ghost" @click="state.manualCopyWecomTask(task)">复制链接人工发送</button>
                <button v-if="task.status === '发送失败'" type="button" class="ghost" @click="state.retryWecomSendTask(task)">重试发送</button>
                <button v-if="task.status === '待绑定家长群'" type="button" class="ghost" @click="goTask(task)">打开课次</button>
                <button v-if="task.status !== '发送失败'" type="button" class="ghost" @click="updateWecomTask(task, '已取消')">取消发送</button>
              </div>
            </article>
            <small v-if="!wecomTodos.length" class="empty-note">暂无待确认的企微触达任务。</small>
          </section>

          <section v-if="activeCategory === 'wheat'" class="todo-group">
            <div class="mini-head"><div><span>小麦消课</span><strong>{{ wheatTodos.length }} 条待处理</strong></div></div>
            <small class="todo-guidance">请前往小麦助教完成消课，完成后返回本系统确认。</small>
            <article v-for="trace in wheatTodos" :key="trace.id" class="todo-trace-row">
              <div>
                <strong>{{ trace.lesson }}</strong>
                <small>{{ trace.course }} · {{ trace.teacher }} · {{ trace.note }}</small>
              </div>
              <em>{{ trace.status }}</em>
              <input v-model="reasons[`wheat-${trace.id}`]" placeholder="异常、无需处理或更正原因" />
              <div class="button-pair">
                <button type="button" class="secondary" @click="updateTrace(trace, '已人工处理')">标记已处理</button>
                <button type="button" class="ghost" @click="updateTrace(trace, '无需处理')">无需处理</button>
                <button v-if="trace.status === '待处理'" type="button" class="ghost" @click="updateTrace(trace, '异常')">异常</button>
              </div>
            </article>
            <small v-if="!wheatTodos.length" class="empty-note">暂无小麦消课待办。</small>
          </section>

          <section v-if="activeCategory === 'cloud'" class="todo-group">
            <div class="mini-head"><div><span>网盘异常</span><strong>{{ cloudTodos.length }} 条同步失败</strong></div></div>
            <article v-for="job in cloudTodos" :key="`cloud-${job.id}`" class="todo-trace-row">
              <div>
                <strong>{{ job.targetFilename || job.targetPath || '网盘归档任务' }}</strong>
                <small v-if="lessonForCloudJob(job)">{{ lessonForCloudJob(job).date }} {{ lessonForCloudJob(job).time }} · {{ klassName(lessonForCloudJob(job)) }}</small>
                <small v-if="job.failureReason">失败原因：{{ job.failureReason }}</small>
                <small v-if="job.failureCode">错误码：{{ job.failureCode }}</small>
              </div>
              <em>同步失败</em>
              <div class="button-pair">
                <button v-if="lessonForCloudJob(job)" type="button" class="ghost" @click="goTask(lessonForCloudJob(job))">打开课次</button>
                <button v-if="job.retryable !== false" type="button" class="secondary" @click="retryCloud(job)">重试同步</button>
              </div>
            </article>
            <small v-if="!cloudTodos.length" class="empty-note">暂无网盘同步异常。</small>
          </section>

          <section v-if="activeCategory === 'reviews'" class="todo-group">
            <div class="mini-head"><div><span>待评分</span><strong>{{ reviewTodos.length }} 节待评分</strong></div><button type="button" class="ghost" @click="openSupervision">去教管看板</button></div>
            <article v-for="review in reviewTodos" :key="`review-${review.id}`" class="todo-row static">
              <div>
                <strong>{{ review.date || review.dateValue }}<span v-if="review.time"> {{ review.time }}</span> · {{ review.className || klassName(review) }}</strong>
                <small>{{ review.courseTitle || review.course || courseName(review) }} · {{ review.teacher }} · {{ review.lessonType }}</small>
              </div>
              <em>{{ review.status }}</em>
            </article>
            <small v-if="!reviewTodos.length" class="empty-note">暂无待评分课次。</small>
          </section>
        </div>
      </div>
    </aside>
  </div>
</template>
