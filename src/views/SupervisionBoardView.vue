<script setup>
import { computed, reactive, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'
import { sameId } from '../services/mappers'

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

const selectedDate = ref(props.state.latestLessonDate || '')
const activeLessonId = ref(null)
const todayStage = ref('list')
const lessonDrafts = reactive({})

const teacherOptions = computed(() => props.state.teachers.filter((teacher) => teacher.role !== '管理员'))
const isListStage = computed(() => todayStage.value === 'list')

watch(() => props.state.latestLessonDate, (value) => {
  if (!selectedDate.value && value) selectedDate.value = value
}, { immediate: true })

watch(selectedDate, () => {
  activeLessonId.value = null
  todayStage.value = 'list'
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
    pendingReview: completed.filter((lesson) => lesson.review?.status !== '已评分').length
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
      pendingReview: completed.filter((lesson) => lesson.review?.status !== '已评分').length,
      averageScore: scores.length ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10 : null,
      completionRate: lessons.length ? Math.round((completed.length / lessons.length) * 100) : 0
    }
  })
)

const activeLesson = computed(() =>
  todayLessons.value.find((lesson) => sameId(lesson.lessonId, activeLessonId.value)) || null
)

watch(todayLessons, (lessons) => {
  if (!lessons.some((lesson) => sameId(lesson.lessonId, activeLessonId.value))) {
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

</script>

<template>
  <div v-if="state.toast" class="toast">{{ state.toast }}</div>
  <button v-if="groupLabel && isListStage" class="module-back-link" type="button" @click="$emit('backToGroup')">← 返回{{ groupLabel }}</button>

  <PageHead eyebrow="课后工作 / 管理员" title="教管看板" />

  <section class="supervision-view">
    <div class="supervision-tabs" role="tablist" aria-label="教管看板维度">
      <button class="active" type="button">今日跟进</button>
    </div>

    <template v-if="todayStage === 'list'">
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
            :class="{ active: sameId(lesson.lessonId, activeLesson?.lessonId) }"
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

    <template v-else>
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

  </section>
</template>
