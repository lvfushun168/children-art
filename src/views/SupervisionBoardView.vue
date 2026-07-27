<script setup>
import { computed, reactive, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'

const props = defineProps({
  state: {
    type: Object,
    required: true
  },
  groupLabel: {
    type: String,
    default: ''
  }
})

defineEmits(['backToGroup'])

const activeTab = ref('today')
const selectedDate = ref(props.state.latestLessonDate || '')
const selectedMonth = ref(props.state.availableLessonMonths[0] || props.state.latestLessonDate?.slice(0, 7) || '')
const selectedMonthlyTeacher = ref('')
const activeLessonId = ref(null)
const todayStage = ref('list')
const monthStage = ref('list')
const lessonDrafts = reactive({})
const monthlyDraft = reactive({ score: 8, comment: '' })

const teacherOptions = computed(() => props.state.teachers.filter((teacher) => teacher.role !== '管理员'))
const teacherNameById = (id) => props.state.teachers.find((teacher) => teacher.id === Number(id))?.name || ''
const isListStage = computed(() =>
  (activeTab.value === 'today' && todayStage.value === 'list') ||
  (activeTab.value === 'month' && monthStage.value === 'list')
)

watch(() => props.state.latestLessonDate, (value) => {
  if (!selectedDate.value && value) selectedDate.value = value
}, { immediate: true })

watch(teacherOptions, (teachers) => {
  if (!selectedMonthlyTeacher.value && teachers[0]) selectedMonthlyTeacher.value = teachers[0].name
}, { immediate: true })

watch(activeTab, () => {
  todayStage.value = 'list'
  monthStage.value = 'list'
})

watch(selectedDate, () => {
  activeLessonId.value = null
  todayStage.value = 'list'
})

watch(selectedMonth, () => {
  monthStage.value = 'list'
})

const statusOrder = {
  异常: 0,
  待处理: 1,
  处理中: 2,
  已完成: 3
}

const scoreDraftFor = (lesson) => {
  if (!lessonDrafts[lesson.lessonId]) {
    lessonDrafts[lesson.lessonId] = {
      score: lesson.review?.score ?? 8,
      comment: lesson.review?.comment || ''
    }
  }
  return lessonDrafts[lesson.lessonId]
}

const todayLessons = computed(() =>
  props.state.supervisionLessonRecords
    .filter((lesson) => lesson.dateValue === selectedDate.value)
    .sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9) || a.time.localeCompare(b.time))
)

const todayStats = computed(() => {
  const completed = todayLessons.value.filter((lesson) => lesson.status === '已完成')
  return {
    total: todayLessons.value.length,
    completed: completed.length,
    working: todayLessons.value.filter((lesson) => ['待处理', '处理中'].includes(lesson.status)).length,
    exception: todayLessons.value.filter((lesson) => lesson.status === '异常').length,
    pendingReview: completed.filter((lesson) => !lesson.review).length
  }
})

const teacherDayStats = computed(() =>
  teacherOptions.value.map((teacher) => {
    const lessons = todayLessons.value.filter((lesson) => lesson.teacher === teacher.name)
    const completed = lessons.filter((lesson) => lesson.status === '已完成')
    const scores = completed.map((lesson) => lesson.review?.score).filter((score) => Number.isFinite(Number(score))).map(Number)
    return {
      teacher,
      lessons,
      total: lessons.length,
      completed: completed.length,
      working: lessons.filter((lesson) => ['待处理', '处理中'].includes(lesson.status)).length,
      exception: lessons.filter((lesson) => lesson.status === '异常').length,
      pendingReview: completed.filter((lesson) => !lesson.review).length,
      averageScore: scores.length ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10 : null,
      completionRate: lessons.length ? Math.round((completed.length / lessons.length) * 100) : 0
    }
  })
)

const activeLesson = computed(() =>
  todayLessons.value.find((lesson) => lesson.lessonId === activeLessonId.value) || null
)

watch(todayLessons, (lessons) => {
  if (!lessons.some((lesson) => lesson.lessonId === activeLessonId.value)) {
    activeLessonId.value = null
    todayStage.value = 'list'
  }
}, { immediate: true })

const checkpointsFor = (lesson) => [
  { label: '资料', done: lesson.status === '已完成' || lesson.materials?.length > 0 },
  { label: '作品', done: lesson.status === '已完成' || lesson.worksCount > 0 },
  { label: '课评', done: lesson.status === '已完成' || lesson.studentWorks?.some((work) => work.feedback) },
  { label: '展示', done: lesson.status === '已完成' || lesson.shareReadyCount > 0 },
  { label: '归档', done: lesson.status === '已完成' || lesson.archivedCount > 0 },
  { label: '小麦', done: ['已人工处理', '无需处理'].includes(lesson.wheatStatus) }
]

const submitLessonReview = (lesson) => {
  const draft = scoreDraftFor(lesson)
  props.state.saveQualityReview({
    lessonId: lesson.lessonId,
    score: draft.score,
    comment: draft.comment
  })
}

const setLessonScore = (lesson, score) => {
  if (lesson.status !== '已完成') return
  scoreDraftFor(lesson).score = score
}

const openLessonReview = (lesson) => {
  activeLessonId.value = lesson.lessonId
  todayStage.value = 'review'
}

const backToTodayList = () => {
  todayStage.value = 'list'
}

const monthlyStats = computed(() =>
  teacherOptions.value.map((teacher) => props.state.teacherMonthStats(teacher.name, selectedMonth.value))
)

const maxMonthlyTotal = computed(() => Math.max(1, ...monthlyStats.value.map((item) => item.total)))
const monthlyYAxisTicks = computed(() => {
  const max = maxMonthlyTotal.value
  return [max, Math.ceil(max * 0.75), Math.ceil(max * 0.5), Math.ceil(max * 0.25), 0]
    .map((value) => Math.min(max, Math.max(0, value)))
    .filter((value, index, list) => list.indexOf(value) === index)
})

const monthLessons = computed(() =>
  props.state.lessonsForTeacherMonth(selectedMonthlyTeacher.value, selectedMonth.value)
    .sort((a, b) => a.dateValue.localeCompare(b.dateValue) || a.time.localeCompare(b.time))
)

const selectedMonthlyStats = computed(() =>
  props.state.teacherMonthStats(selectedMonthlyTeacher.value, selectedMonth.value)
)

const syncMonthlyDraft = () => {
  const existing = props.state.monthlyReviewForTeacher(selectedMonthlyTeacher.value, selectedMonth.value)
  monthlyDraft.score = existing?.score ?? Math.max(7, Math.round((selectedMonthlyStats.value.averageScore || 8) * 10) / 10)
  monthlyDraft.comment = existing?.comment || ''
}

watch([selectedMonthlyTeacher, selectedMonth, () => props.state.monthlyTeacherReviews.length], syncMonthlyDraft, { immediate: true })

const chooseMonthlyTeacher = (teacher) => {
  selectedMonthlyTeacher.value = teacher
}

const openMonthlyReview = (teacher = selectedMonthlyTeacher.value) => {
  selectedMonthlyTeacher.value = teacher
  monthStage.value = 'review'
}

const backToMonthList = () => {
  monthStage.value = 'list'
}

const submitMonthlyReview = () => {
  props.state.saveMonthlyTeacherReview({
    teacher: selectedMonthlyTeacher.value,
    month: selectedMonth.value,
    score: monthlyDraft.score,
    comment: monthlyDraft.comment
  })
}
</script>

<template>
  <div v-if="state.toast" class="toast">{{ state.toast }}</div>
  <button v-if="groupLabel && isListStage" class="module-back-link" type="button" @click="$emit('backToGroup')">← 返回{{ groupLabel }}</button>

  <PageHead eyebrow="课后工作 / 管理员" title="教管看板" />

  <section class="supervision-view">
    <div class="supervision-tabs" role="tablist" aria-label="教管看板维度">
      <button :class="{ active: activeTab === 'today' }" type="button" @click="activeTab = 'today'">今日跟进</button>
      <button :class="{ active: activeTab === 'month' }" type="button" @click="activeTab = 'month'">月度评分</button>
    </div>

    <template v-if="activeTab === 'today' && todayStage === 'list'">
      <div class="supervision-toolbar">
        <label>
          日期
          <input v-model="selectedDate" type="date" />
        </label>
        <div class="supervision-toolbar-metrics">
          <article><span>今日课次</span><strong>{{ todayStats.total }}</strong></article>
          <article><span>已完成</span><strong>{{ todayStats.completed }}</strong></article>
          <article><span>处理中</span><strong>{{ todayStats.working }}</strong></article>
          <article><span>异常</span><strong>{{ todayStats.exception }}</strong></article>
          <article><span>待评分</span><strong>{{ todayStats.pendingReview }}</strong></article>
        </div>
      </div>

      <section class="supervision-teacher-grid">
        <button
          v-for="item in teacherDayStats"
          :key="item.teacher.id"
          class="supervision-teacher-card"
          type="button"
        >
          <span>{{ item.teacher.name }}</span>
          <strong>{{ item.completed }}/{{ item.total }} 节</strong>
          <small>{{ item.working }} 处理中 · {{ item.exception }} 异常 · {{ item.pendingReview }} 待评分</small>
          <div class="progress-track slim"><i :style="{ width: `${item.completionRate}%` }"></i></div>
          <em>{{ item.averageScore === null ? '暂无评分' : `${item.averageScore} 分` }}</em>
        </button>
      </section>

      <section class="supervision-today-layout">
        <div class="supervision-lesson-list">
          <article
            v-for="lesson in todayLessons"
            :key="lesson.id"
            class="supervision-lesson-row"
            :class="{ active: lesson.lessonId === activeLesson?.lessonId }"
            role="button"
            tabindex="0"
            @click="openLessonReview(lesson)"
            @keydown.enter.prevent="openLessonReview(lesson)"
            @keydown.space.prevent="openLessonReview(lesson)"
          >
            <div class="supervision-lesson-main">
              <span class="time">{{ lesson.time }}</span>
              <div>
                <strong>{{ lesson.className }} · {{ lesson.course }}</strong>
                <small>{{ lesson.teacher }} · {{ lesson.lessonType }} · {{ lesson.date }}</small>
                <div class="supervision-checkpoints">
                  <span v-for="checkpoint in checkpointsFor(lesson)" :key="checkpoint.label" :class="{ done: checkpoint.done }">
                    {{ checkpoint.label }}
                  </span>
                </div>
              </div>
              <em>{{ lesson.status }} · {{ lesson.progress }}%</em>
            </div>
            <div class="supervision-review-state">
              <strong>{{ lesson.review ? `${lesson.review.score} 分` : lesson.reviewStatus }}</strong>
              <small>{{ lesson.wheatStatus }} · {{ lesson.cloudArchiveStatus }}</small>
              <button
                class="secondary"
                type="button"
                :disabled="lesson.status !== '已完成'"
                @click.stop="openLessonReview(lesson)"
              >
                {{ lesson.review ? '调整评分' : '评分' }}
              </button>
            </div>
          </article>
          <small v-if="!todayLessons.length" class="empty-note">所选日期暂无课后工作。</small>
        </div>
      </section>
    </template>

    <template v-else-if="activeTab === 'today'">
      <button class="back-link" type="button" @click="backToTodayList">← 返回今日跟进</button>
      <section class="supervision-review-page">
        <aside class="supervision-review-panel">
          <template v-if="activeLesson">
            <div class="mini-head">
              <div>
                <span>课次评分</span>
                <strong>{{ activeLesson.teacher }} · {{ activeLesson.className }}</strong>
              </div>
              <em>{{ activeLesson.status }}</em>
            </div>
            <small>{{ activeLesson.date }} {{ activeLesson.time }} · {{ activeLesson.course }}</small>
            <div class="supervision-checkpoints review-checkpoints">
              <span v-for="checkpoint in checkpointsFor(activeLesson)" :key="checkpoint.label" :class="{ done: checkpoint.done }">
                {{ checkpoint.label }}
              </span>
            </div>
            <div class="star-score-control" :class="{ disabled: activeLesson.status !== '已完成' }">
              <div class="star-score-head">
                <strong>{{ scoreDraftFor(activeLesson).score }} 分</strong>
                <button class="ghost" type="button" :disabled="activeLesson.status !== '已完成'" @click="setLessonScore(activeLesson, 0)">0 分</button>
              </div>
              <div class="star-score-row" aria-label="课次评分">
                <button
                  v-for="point in 10"
                  :key="point"
                  type="button"
                  :class="{ active: point <= scoreDraftFor(activeLesson).score }"
                  :disabled="activeLesson.status !== '已完成'"
                  :title="`${point} 分`"
                  @click="setLessonScore(activeLesson, point)"
                >
                  {{ point <= scoreDraftFor(activeLesson).score ? '★' : '☆' }}
                </button>
              </div>
            </div>
            <textarea v-model="scoreDraftFor(activeLesson).comment" rows="5" placeholder="评语" :disabled="activeLesson.status !== '已完成'"></textarea>
            <button class="primary" type="button" :disabled="activeLesson.status !== '已完成'" @click="submitLessonReview(activeLesson)">保存课次评分</button>
            <div v-if="activeLesson.review" class="review-history-note">
              <strong>{{ activeLesson.review.reviewer }} · {{ activeLesson.review.reviewedAt }}</strong>
              <span>{{ activeLesson.review.comment || '未填写评语' }}</span>
            </div>
          </template>
          <small v-else class="empty-note">暂无可评分课次。</small>
        </aside>
      </section>
    </template>

    <template v-else-if="monthStage === 'list'">
      <div class="supervision-toolbar">
        <label>
          月份
          <input v-model="selectedMonth" type="month" />
        </label>
        <label>
          老师
          <select v-model="selectedMonthlyTeacher">
            <option v-for="teacher in teacherOptions" :key="teacher.id" :value="teacher.name">{{ teacher.name }}</option>
          </select>
        </label>
      </div>

      <section class="monthly-histogram">
        <div class="monthly-chart-head">
          <strong>老师月度课次完成情况</strong>
          <span><i></i> 总课次 <b></b> 已完成</span>
        </div>
        <div class="monthly-chart-body">
          <div class="monthly-y-axis">
            <span v-for="tick in monthlyYAxisTicks" :key="tick">{{ tick }}</span>
          </div>
          <div class="monthly-plot">
            <span v-for="tick in monthlyYAxisTicks" :key="`line-${tick}`" class="monthly-grid-line"></span>
            <button
              v-for="item in monthlyStats"
              :key="item.teacher"
              class="monthly-bar-card"
              :class="{ active: selectedMonthlyTeacher === item.teacher }"
              type="button"
              @click="chooseMonthlyTeacher(item.teacher)"
            >
              <div class="monthly-bar-shell" :title="`${item.teacher}：${item.completed}/${item.total} 节`">
                <i :style="{ height: `${item.total ? Math.max(6, (item.total / maxMonthlyTotal) * 100) : 0}%` }"></i>
                <b :style="{ height: `${item.total ? (item.completed / maxMonthlyTotal) * 100 : 0}%` }"></b>
              </div>
              <strong>{{ item.teacher }}</strong>
              <span>{{ item.completed }}/{{ item.total }} 节</span>
              <small>{{ item.pendingReview }} 待评分 · {{ item.averageScore === null ? '暂无均分' : `${item.averageScore} 均分` }}</small>
            </button>
          </div>
        </div>
      </section>

      <section class="monthly-review-layout">
        <div class="supervision-lesson-list">
          <div class="supervision-month-summary">
            <article><span>完成率</span><strong>{{ selectedMonthlyStats.completionRate }}%</strong></article>
            <article><span>完成课次</span><strong>{{ selectedMonthlyStats.completed }}</strong></article>
            <article><span>异常课次</span><strong>{{ selectedMonthlyStats.exception }}</strong></article>
            <article><span>平均课次分</span><strong>{{ selectedMonthlyStats.averageScore ?? '无' }}</strong></article>
          </div>
          <button class="primary supervision-month-review-entry" type="button" @click="openMonthlyReview()">进入月度总评</button>

          <article v-for="lesson in monthLessons" :key="lesson.id" class="supervision-month-row">
            <div>
              <strong>{{ lesson.date }} {{ lesson.time }} · {{ lesson.className }}</strong>
              <small>{{ lesson.course }} · {{ lesson.lessonType }} · {{ lesson.status }}</small>
            </div>
            <em>{{ lesson.review ? `${lesson.review.score} 分` : lesson.reviewStatus }}</em>
          </article>
          <small v-if="!monthLessons.length" class="empty-note">所选月份暂无课次。</small>
        </div>
      </section>
    </template>

    <template v-else>
      <button class="back-link" type="button" @click="backToMonthList">← 返回月度评分</button>
      <section class="supervision-review-page">
        <aside class="supervision-review-panel">
          <div class="mini-head">
            <div>
              <span>月度总评</span>
              <strong>{{ selectedMonthlyTeacher }} · {{ selectedMonth }}</strong>
            </div>
            <em>{{ selectedMonthlyStats.monthlyReview ? `${selectedMonthlyStats.monthlyReview.score} 分` : '未评分' }}</em>
          </div>
          <div class="supervision-month-summary review-month-summary">
            <article><span>完成率</span><strong>{{ selectedMonthlyStats.completionRate }}%</strong></article>
            <article><span>完成课次</span><strong>{{ selectedMonthlyStats.completed }}</strong></article>
            <article><span>异常课次</span><strong>{{ selectedMonthlyStats.exception }}</strong></article>
            <article><span>平均课次分</span><strong>{{ selectedMonthlyStats.averageScore ?? '无' }}</strong></article>
          </div>
          <div class="star-score-control">
            <div class="star-score-head">
              <strong>{{ monthlyDraft.score }} 分</strong>
              <button class="ghost" type="button" @click="monthlyDraft.score = 0">0 分</button>
            </div>
            <div class="star-score-row" aria-label="月度评分">
              <button
                v-for="point in 10"
                :key="point"
                type="button"
                :class="{ active: point <= monthlyDraft.score }"
                :title="`${point} 分`"
                @click="monthlyDraft.score = point"
              >
                {{ point <= monthlyDraft.score ? '★' : '☆' }}
              </button>
            </div>
          </div>
          <textarea v-model="monthlyDraft.comment" rows="6" placeholder="月度评语"></textarea>
          <button class="primary" type="button" @click="submitMonthlyReview">保存月度总评</button>
          <div v-if="selectedMonthlyStats.monthlyReview" class="review-history-note">
            <strong>{{ selectedMonthlyStats.monthlyReview.reviewer }} · {{ selectedMonthlyStats.monthlyReview.reviewedAt }}</strong>
            <span>{{ selectedMonthlyStats.monthlyReview.comment || '未填写评语' }}</span>
          </div>
        </aside>
      </section>
    </template>
  </section>
</template>
