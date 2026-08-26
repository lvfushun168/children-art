<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'
import ClassLessonGenerationDialog from '../components/masterdata/ClassLessonGenerationDialog.vue'
import ScheduleCalendar from '../components/schedule/ScheduleCalendar.vue'
import {
  endOfMonthValue,
  endOfWeekValue,
  resolveCalendarMode,
  shiftDateRange,
  startOfMonthValue,
  startOfWeekValue,
  toDateValue
} from '../utils/scheduleCalendar.js'

const props = defineProps({
  state: { type: Object, required: true },
  groupLabel: { type: String, default: '' }
})

const emit = defineEmits(['backToGroup', 'open-task'])

const today = new Date()
const todayValue = toDateValue(today)
const preset = ref('month')
const dateFrom = ref(startOfMonthValue(todayValue))
const dateTo = ref(endOfMonthValue(todayValue))
const teacherId = ref('all')
const classId = ref('all')
const ready = ref(false)
const showGenerationDialog = ref(false)
const rangeOptions = [
  { value: 'today', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'custom', label: '自定义' }
]

const applyPreset = (value) => {
  preset.value = value
  const base = new Date()
  if (value === 'today') {
    dateFrom.value = toDateValue(base)
    dateTo.value = toDateValue(base)
  } else if (value === 'month') {
    const current = toDateValue(base)
    dateFrom.value = startOfMonthValue(current)
    dateTo.value = endOfMonthValue(current)
  } else if (value === 'week') {
    const current = toDateValue(base)
    dateFrom.value = startOfWeekValue(current)
    dateTo.value = endOfWeekValue(current)
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
const canGenerateLessons = computed(() => {
  const read = (value) => value?.value ?? value
  return read(props.state.canEditMasterData) !== false && read(props.state.canEditLessons) !== false
})
const closeGenerationDialog = (result) => {
  showGenerationDialog.value = false
  props.state.notify?.(`新生成 ${result?.createdCount || 0} 节，已有 ${result?.existingCount || 0} 节，跳过 ${result?.skippedCount || 0} 节`)
}

const visibleLessons = computed(() => {
  const lessons = Array.isArray(props.state.scheduleLessons) ? props.state.scheduleLessons : []
  if (props.state.isAdmin) return lessons
  const allowed = new Set((props.state.authorizedClassIds || []).map((id) => String(id)))
  return lessons.filter((lesson) => allowed.has(String(lesson.classId)))
})

const rangeLabel = computed(() => {
  if (!dateFrom.value || !dateTo.value) return '请选择日期范围'
  return dateFrom.value === dateTo.value ? dateFrom.value : `${dateFrom.value} 至 ${dateTo.value}`
})
const calendarMode = computed(() => resolveCalendarMode(preset.value, dateFrom.value, dateTo.value))

const reload = async () => {
  if (!dateFrom.value || !dateTo.value || dateFrom.value > dateTo.value) return
  try {
    await props.state.loadScheduleLessons({
      dateFrom: dateFrom.value,
      dateTo: dateTo.value,
      teacherId: teacherId.value === 'all' ? undefined : teacherId.value,
      classId: classId.value === 'all' ? undefined : classId.value
    }, { force: true, allPages: true })
  } catch {
    // The composable stores the user-facing error; keep the page mounted for retry.
  }
}

const resetFilters = () => {
  teacherId.value = 'all'
  classId.value = 'all'
  applyPreset('month')
}

const navigateRange = (direction) => {
  if (!dateFrom.value || !dateTo.value) return
  const mode = preset.value === 'custom' ? 'custom' : calendarMode.value
  const next = shiftDateRange(dateFrom.value, dateTo.value, direction, mode)
  if (preset.value === 'today') preset.value = 'custom'
  dateFrom.value = next.dateFrom
  dateTo.value = next.dateTo
}

const openLesson = (lesson) => emit('open-task', lesson)

watch([dateFrom, dateTo, teacherId, classId], () => {
  if (!ready.value) return
  void reload()
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
      <button class="primary" type="button" :disabled="!canGenerateLessons" @click="showGenerationDialog = true">创建固定排课</button>
    </PageHead>

    <form class="directory-toolbar panel schedule-toolbar" @submit.prevent="reload">
      <label class="schedule-range-select">
        <span>查看范围</span>
        <AdaptiveSelect v-model="preset" :options="rangeOptions" @change="applyPreset" />
      </label>
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


      <div v-if="state.scheduleError" class="notice-box error-box" role="alert">
        <small>{{ state.scheduleError }}</small>
        <button class="ghost" type="button" @click="reload">重试</button>
      </div>
      <div v-else-if="state.scheduleLoading" class="notice-box">
        <small>正在加载课表，请稍候……</small>
      </div>
      <div v-else class="schedule-calendar-state">
        <div v-if="!visibleLessons.length" class="notice-box">
          <strong>当前范围没有课次</strong>
          <small>如果刚导入了月课表，请选择对应月份；“今日课后”只显示当天课次。</small>
        </div>
        <ScheduleCalendar
          :lessons="visibleLessons"
          :date-from="dateFrom"
          :date-to="dateTo"
          :mode="calendarMode"
          :today="todayValue"
          @open-lesson="openLesson"
        />
      </div>
    </section>
  </div>
  <ClassLessonGenerationDialog
    v-if="showGenerationDialog"
    :state="state"
    :class-options="state.classes || []"
    allow-class-select
    @close="showGenerationDialog = false"
    @generated="closeGenerationDialog"
  />
</template>

<style scoped>
.schedule-page {
  min-width: 0;
}

.schedule-calendar-state {
  display: grid;
  gap: 12px;
}

.schedule-calendar-state > .notice-box {
  border-color: color-mix(in srgb, var(--color-primary) 22%, var(--color-border-soft));
  background: color-mix(in srgb, var(--color-primary-soft) 42%, var(--color-surface));
}

.schedule-toolbar {
  align-items: end;
}

.schedule-range-select {
  flex: 0 1 190px;
  min-width: 180px;
}

.schedule-range-select > span {
  color: var(--color-muted);
  font-size: 13px;
}

.schedule-calendar-head-actions {
  display: grid;
  justify-items: end;
  gap: 7px;
}

.schedule-calendar-nav {
  display: flex;
  align-items: center;
  gap: 6px;
}

.schedule-calendar-nav button {
  min-width: 38px;
  min-height: 32px;
  padding: 0 9px;
}

@media (max-width: 680px) {
  .schedule-range-select {
    grid-column: 1 / -1;
  }

  .schedule-calendar-head-actions {
    justify-items: stretch;
  }

  .schedule-calendar-nav {
    justify-content: space-between;
  }

  .schedule-calendar-nav button {
    flex: 1;
  }
}
</style>
