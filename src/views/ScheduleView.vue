<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'
import PaginationBar from '../components/common/PaginationBar.vue'

const props = defineProps({
  state: { type: Object, required: true },
  groupLabel: { type: String, default: '' }
})

const emit = defineEmits(['backToGroup', 'open-task'])

const pad = (value) => String(value).padStart(2, '0')
const toIsoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const fromIsoDate = (value) => {
  const [year, month, day] = String(value || '').split('-').map(Number)
  return year && month && day ? new Date(year, month - 1, day) : new Date()
}
const startOfWeek = (date) => {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = result.getDay()
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1))
  return result
}
const endOfWeek = (date) => {
  const result = startOfWeek(date)
  result.setDate(result.getDate() + 6)
  return result
}
const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1)
const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0)

const today = new Date()
const preset = ref('week')
const dateFrom = ref(toIsoDate(startOfWeek(today)))
const dateTo = ref(toIsoDate(endOfWeek(today)))
const teacherId = ref('all')
const classId = ref('all')
const page = ref(1)
const ready = ref(false)

const applyPreset = (value) => {
  preset.value = value
  const base = new Date()
  if (value === 'today') {
    dateFrom.value = toIsoDate(base)
    dateTo.value = toIsoDate(base)
  } else if (value === 'month') {
    dateFrom.value = toIsoDate(startOfMonth(base))
    dateTo.value = toIsoDate(endOfMonth(base))
  } else if (value === 'week') {
    dateFrom.value = toIsoDate(startOfWeek(base))
    dateTo.value = toIsoDate(endOfWeek(base))
  }
}

const markCustom = () => {
  preset.value = 'custom'
}

const teacherOptions = computed(() => (props.state.teachers || [])
  .filter((teacher) => !teacher.archived)
  .map((teacher) => ({ value: String(teacher.id), label: teacher.name || '未命名老师' })))
const classOptions = computed(() => (props.state.classes || [])
  .filter((klass) => !klass.archived)
  .map((klass) => ({ value: String(klass.id), label: klass.name || '未命名班级' })))

const visibleLessons = computed(() => {
  const lessons = Array.isArray(props.state.scheduleLessons) ? props.state.scheduleLessons : []
  if (props.state.isAdmin) return lessons
  const allowed = new Set((props.state.authorizedClassIds || []).map((id) => String(id)))
  return lessons.filter((lesson) => allowed.has(String(lesson.classId)))
})

const groupedLessons = computed(() => {
  const groups = new Map()
  visibleLessons.value.forEach((lesson) => {
    const key = lesson.dateValue || ''
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(lesson)
  })
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dateValue, lessons]) => ({
      dateValue,
      label: dateLabel(dateValue),
      lessons: [...lessons].sort((left, right) => `${left.dateValue} ${left.startTime || left.time}`.localeCompare(`${right.dateValue} ${right.startTime || right.time}`))
    }))
})

const mobileLessons = computed(() => groupedLessons.value.flatMap((group) =>
  group.lessons.map((lesson) => ({
    ...lesson,
    scheduleDate: group.label,
    scheduleDateValue: group.dateValue
  }))
))

const dateLabel = (value) => {
  if (!value) return '未设置日期'
  const date = fromIsoDate(value)
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
  return `${date.getMonth() + 1}月${date.getDate()}日（周${weekday}）`
}

const sourceLabel = (value) => ({
  WHEAT_CALENDAR: '小麦课表',
  WHEAT_COPY: '小麦复制',
  WHEAT_EXCEL: '小麦 Excel',
  MANUAL: '手动补录'
}[value] || value || '未标记来源')

const statusClass = (value) => ({
  已完成: 'is-done',
  处理中: 'is-processing',
  异常: 'is-warning'
}[value] || 'is-pending')

const rangeLabel = computed(() => {
  if (!dateFrom.value || !dateTo.value) return '请选择日期范围'
  return dateFrom.value === dateTo.value ? dateFrom.value : `${dateFrom.value} 至 ${dateTo.value}`
})
const pageCount = computed(() => Math.max(1, Math.ceil(Number(props.state.scheduleMeta?.total || 0) / Number(props.state.scheduleMeta?.pageSize || 200))))

const reload = async () => {
  if (!dateFrom.value || !dateTo.value || dateFrom.value > dateTo.value) return
  try {
    await props.state.loadScheduleLessons({
      dateFrom: dateFrom.value,
      dateTo: dateTo.value,
      teacherId: teacherId.value === 'all' ? undefined : teacherId.value,
      classId: classId.value === 'all' ? undefined : classId.value,
      page: page.value,
      pageSize: 200
    }, { force: true })
  } catch {
    // The composable stores the user-facing error; keep the page mounted for retry.
  }
}

const resetFilters = () => {
  teacherId.value = 'all'
  classId.value = 'all'
  page.value = 1
  applyPreset('week')
}

const changePage = (nextPage) => {
  page.value = Math.min(pageCount.value, Math.max(1, nextPage))
}

const openLesson = (lesson) => emit('open-task', lesson)

watch([dateFrom, dateTo, teacherId, classId], () => {
  if (!ready.value) return
  page.value = 1
  void reload()
})
watch(page, () => {
  if (ready.value) void reload()
})

onMounted(async () => {
  try {
    await props.state.ensurePageData?.('schedule')
  } catch {
    // 页面仍保留日期筛选和服务端错误空态。
  }
  ready.value = true
  await reload()
})
</script>

<template>
  <div class="schedule-page directory-page">
    <button v-if="groupLabel" class="module-back-link" type="button" @click="emit('backToGroup')">← 返回{{ groupLabel }}</button>
    <PageHead eyebrow="课后工作" title="课表 / 上课安排">
    </PageHead>

    <form class="directory-toolbar panel schedule-toolbar" @submit.prevent="reload">
      <div class="schedule-presets">
        <span>查看范围</span>
        <button v-for="item in [{ value: 'today', label: '今天' }, { value: 'week', label: '本周' }, { value: 'month', label: '本月' }, { value: 'custom', label: '自定义' }]" :key="item.value" type="button" :class="{ selected: preset === item.value }" @click="item.value === 'custom' ? markCustom() : applyPreset(item.value)">
          {{ item.label }}
        </button>
      </div>
      <label>
        <span>开始日期</span>
        <input v-model="dateFrom" type="date" @change="markCustom" />
      </label>
      <label>
        <span>结束日期</span>
        <input v-model="dateTo" type="date" @change="markCustom" />
      </label>
      <label>
        <span>任课老师</span>
        <AdaptiveSelect v-model="teacherId" :options="[{ label: '全部老师', value: 'all' }, ...teacherOptions]" />
      </label>
      <label>
        <span>班级</span>
        <AdaptiveSelect v-model="classId" :options="[{ label: '全部班级', value: 'all' }, ...classOptions]" />
      </label>
      <div class="button-pair directory-toolbar-actions">
        <button class="secondary" type="submit" :disabled="state.scheduleLoading">查询</button>
        <button class="ghost" type="button" @click="resetFilters">重置</button>
      </div>
    </form>

    <section class="master-list panel directory-list-panel">
      <div class="section-head">
        <div>
          <span>课表列表</span>
          <strong>{{ state.scheduleMeta?.total || 0 }} 条课次</strong>
        </div>
        <small v-if="state.scheduleLoading">正在加载…</small>
        <small v-else>{{ rangeLabel }} · {{ props.state.isAdmin ? '全部课次' : '本人授权班级' }}</small>
      </div>

      <div v-if="state.scheduleError" class="notice-box error-box" role="alert">
        <small>{{ state.scheduleError }}</small>
        <button class="ghost" type="button" @click="reload">重试</button>
      </div>
      <div v-else-if="state.scheduleLoading" class="notice-box">
        <small>正在加载课表，请稍候……</small>
      </div>
      <div v-else-if="!groupedLessons.length" class="notice-box">
        <strong>当前范围没有课次</strong>
        <small>如果刚导入了月课表，请选择对应月份；“今日课后”只显示当天课次。</small>
      </div>
      <div v-else class="directory-table-wrap">
        <table class="directory-table schedule-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>班级</th>
              <th>上课老师</th>
              <th>课程类别 / 本次课题</th>
              <th>状态</th>
              <th>来源</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="group in groupedLessons" :key="group.dateValue">
              <tr class="schedule-date-row">
                <th colspan="7">
                  <div>
                    <span>{{ group.dateValue }}</span>
                    <strong>{{ group.label }}</strong>
                    <em>{{ group.lessons.length }} 节</em>
                  </div>
                </th>
              </tr>
              <tr v-for="lesson in group.lessons" :key="lesson.id" class="directory-table-row" @click="openLesson(lesson)">
                <td class="schedule-time-cell"><strong>{{ lesson.time || '待定' }}</strong><small v-if="lesson.endTime">至 {{ lesson.endTime }}</small></td>
                <td><strong>{{ lesson.className || '未配置班级' }}</strong></td>
                <td>{{ lesson.teacher || '未配置老师' }}</td>
                <td class="schedule-course-cell">
                  <strong>{{ lesson.courseTitle || lesson.course || '未配置课程类别' }}</strong>
                  <small :class="{ 'topic-empty': !lesson.topic }">课题：{{ lesson.topic || '未填写' }}</small>
                </td>
                <td><span class="schedule-status-tag" :class="statusClass(lesson.status)">{{ lesson.status }}</span></td>
                <td>{{ sourceLabel(lesson.sourceType) }}</td>
                <td><button class="ghost" type="button" @click.stop="openLesson(lesson)">处理本节课</button></td>
              </tr>
            </template>
          </tbody>
        </table>

        <div class="directory-mobile-cards">
          <button v-for="lesson in mobileLessons" :key="lesson.id" type="button" class="directory-card schedule-mobile-card" @click="openLesson(lesson)">
            <strong>{{ lesson.className || '未配置班级' }}</strong>
            <span>{{ lesson.scheduleDate }} · {{ lesson.time || '待定' }}{{ lesson.endTime ? ` 至 ${lesson.endTime}` : '' }}</span>
            <small>{{ lesson.teacher || '未配置老师' }} · {{ lesson.courseTitle || lesson.course || '未配置课程类别' }}</small>
            <small :class="{ 'topic-empty': !lesson.topic }">课题：{{ lesson.topic || '未填写' }}</small>
            <em>{{ lesson.status }} · {{ sourceLabel(lesson.sourceType) }}</em>
          </button>
        </div>

        <PaginationBar :page="state.scheduleMeta?.page || 1" :page-size="state.scheduleMeta?.pageSize || 200" :total="state.scheduleMeta?.total || 0" :loading="state.scheduleLoading" @change="changePage" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.schedule-page {
  min-width: 0;
}

.schedule-toolbar {
  align-items: end;
}

.schedule-presets {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.schedule-presets > span {
  margin-right: 6px;
  color: var(--color-muted);
  font-size: 13px;
}

.schedule-presets button {
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--color-border-soft);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-heading);
  cursor: pointer;
}

.schedule-presets button.selected {
  border-color: var(--color-border-strong);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 700;
}

.schedule-table {
  min-width: 920px;
}

.schedule-date-row th {
  padding: 12px;
  background: var(--color-surface-subtle);
}

.schedule-date-row th > div {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.schedule-date-row span,
.schedule-date-row em {
  color: var(--color-muted);
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
}

.schedule-date-row strong {
  color: var(--color-heading);
  font-size: 15px;
}

.schedule-date-row em {
  margin-left: auto;
}

.schedule-time-cell strong {
  color: var(--color-heading);
  font-size: 15px;
}

.schedule-time-cell small,
.schedule-course-cell small {
  display: block;
  margin-top: 4px;
  color: var(--color-muted);
  font-size: 12px;
}

.schedule-course-cell strong {
  color: var(--color-heading);
}

.schedule-course-cell .topic-empty,
.schedule-mobile-card .topic-empty {
  opacity: .72;
}

.schedule-status-tag {
  display: inline-flex;
  width: fit-content;
  padding: 3px 7px;
  border-radius: 999px;
  background: var(--color-status-muted-bg);
  color: var(--color-status-muted-text);
  font-size: 11px;
  font-style: normal;
  white-space: nowrap;
}

.schedule-status-tag.is-done {
  background: var(--color-status-working-bg);
  color: var(--color-status-working-text);
}

.schedule-status-tag.is-processing {
  background: var(--color-status-working-bg);
  color: var(--color-status-working-text);
}

.schedule-status-tag.is-warning {
  background: var(--color-status-warning-bg);
  color: var(--color-status-warning-text);
}

.schedule-mobile-card {
  gap: 6px;
}

.schedule-mobile-card em {
  color: var(--color-primary);
}

.schedule-mobile-card span,
.schedule-mobile-card small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 680px) {
  .schedule-presets {
    grid-column: 1 / -1;
  }

  .schedule-date-row th > div {
    gap: 7px;
  }
}
</style>
