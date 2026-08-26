<script setup>
import { computed, ref, watch } from 'vue'
import {
  CALENDAR_DEFAULT_END,
  CALENDAR_DEFAULT_START,
  buildCalendarWeeks,
  dateRangeDays,
  endOfMonthValue,
  formatTimeRange,
  groupLessonsByDate,
  layoutTimelineLessons,
  parseDateValue,
  summarizeLessons,
  startOfMonthValue,
  timelineBounds as getTimelineBounds,
  weekdayIndex
} from '../../utils/scheduleCalendar.js'

const props = defineProps({
  lessons: { type: Array, default: () => [] },
  dateFrom: { type: String, default: '' },
  dateTo: { type: String, default: '' },
  mode: { type: String, default: 'week' },
  today: { type: String, default: '' }
})

const emit = defineEmits(['open-lesson', 'select-date'])

const selectedDate = ref('')
const expandedDate = ref('')

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']
const sourceLabels = {
  WHEAT_CALENDAR: '小麦课表',
  WHEAT_COPY: '小麦复制',
  WHEAT_EXCEL: '小麦 Excel',
  CLASS_SCHEDULE: '固定排课',
  MANUAL: '手动补录'
}

const statusClass = (value) => ({
  已完成: 'is-done',
  处理中: 'is-processing',
  异常: 'is-warning'
}[value] || 'is-pending')

const parseDateLabel = (value, withWeekday = true) => {
  const date = parseDateValue(value)
  if (!date) return '日期待定'
  const label = `${date.getMonth() + 1}月${date.getDate()}日`
  if (!withWeekday) return label
  return `${label}（周${weekdayLabels[weekdayIndex(value)]}）`
}

const monthLabel = computed(() => {
  const start = parseDateValue(props.dateFrom)
  const end = parseDateValue(props.dateTo)
  if (!start) return '课表'
  if (end && (start.getFullYear() !== end.getFullYear() || start.getMonth() !== end.getMonth())) {
    return `${parseDateLabel(props.dateFrom, false)} - ${parseDateLabel(props.dateTo, false)}`
  }
  return `${start.getFullYear()}年${start.getMonth() + 1}月`
})

const monthAnchor = computed(() => {
  if (props.mode !== 'month') return ''
  return props.dateFrom === startOfMonthValue(props.dateFrom)
    && props.dateTo === endOfMonthValue(props.dateFrom)
    ? props.dateFrom
    : ''
})

const lessonsByDate = computed(() => groupLessonsByDate(props.lessons))
const selectedLessons = computed(() => lessonsByDate.value.get(selectedDate.value) || [])
const selectedDateLabel = computed(() => parseDateLabel(selectedDate.value))

const dateInRange = (value) => Boolean(value)
  && (!props.dateFrom || value >= props.dateFrom)
  && (!props.dateTo || value <= props.dateTo)

const initialDate = () => {
  if (dateInRange(props.today)) return props.today
  if (dateInRange(props.dateFrom)) return props.dateFrom
  return dateRangeDays(props.dateFrom, props.dateTo)[0] || ''
}

const chooseDate = (dateValue) => {
  if (!dateInRange(dateValue)) return
  selectedDate.value = dateValue
  expandedDate.value = dateValue
  emit('select-date', dateValue)
}

const openLesson = (lesson) => emit('open-lesson', lesson)

const summaryFor = (dateValue, limit = 3) => summarizeLessons(lessonsByDate.value.get(dateValue) || [], limit)

const calendarWeeks = computed(() => buildCalendarWeeks(props.dateFrom, props.dateTo, {
  monthAnchor: monthAnchor.value
}))
const calendarDays = computed(() => dateRangeDays(props.dateFrom, props.dateTo))

const timelineDays = computed(() => calendarDays.value.map((dateValue) => ({
  dateValue,
  lessons: lessonsByDate.value.get(dateValue) || []
})))

const bounds = computed(() => getTimelineBounds(props.lessons, {
  defaultStart: CALENDAR_DEFAULT_START,
  defaultEnd: CALENDAR_DEFAULT_END
}))

const timeTicks = computed(() => {
  const ticks = []
  const span = Math.max(1, bounds.value.end - bounds.value.start)
  for (let minutes = bounds.value.start; minutes <= bounds.value.end; minutes += 30) {
    ticks.push({
      minutes,
      label: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
      topPercent: ((minutes - bounds.value.start) / span) * 100
    })
  }
  return ticks
})

const timelineHeight = computed(() => Math.max(520, ((bounds.value.end - bounds.value.start) / 30) * 36))

const timelineColumns = computed(() => timelineDays.value.map((day) => ({
  ...day,
  layout: layoutTimelineLessons(day.lessons, {
    start: bounds.value.start,
    end: bounds.value.end
  })
})))

const mobileMonthDays = computed(() => calendarWeeks.value.flat())
const mobileDateDays = computed(() => calendarDays.value)

const lessonTime = (lesson) => formatTimeRange(lesson)
const lessonClassName = (lesson) => lesson?.className || '未配置班级'
const lessonTeacher = (lesson) => lesson?.teacher || '未配置老师'
const lessonCourse = (lesson) => lesson?.courseTitle || lesson?.course || '未配置课程类别'
const lessonStatus = (lesson) => lesson?.status || '待处理'
const lessonSource = (lesson) => sourceLabels[lesson?.sourceType] || lesson?.sourceType || '未标记来源'
const lessonAriaLabel = (lesson) => `${lessonTime(lesson)}，${lessonClassName(lesson)}，${lessonStatus(lesson)}，处理本节课`

const lessonDetails = (lesson) => [
  `老师：${lessonTeacher(lesson)}`,
  `课程：${lessonCourse(lesson)}`,
  `课题：${lesson?.topic || '未填写'}`,
  `类型：${lesson?.lessonType || '其他'}`,
  `来源：${lessonSource(lesson)}`
].join(' · ')

const eventStyle = (event) => ({
  top: `${event.topPercent}%`,
  height: `${event.heightPercent}%`,
  left: `calc(${event.leftPercent}% + 3px)`,
  width: `calc(${event.widthPercent}% - 6px)`
})

const isSelected = (dateValue) => selectedDate.value === dateValue
const isToday = (dateValue) => Boolean(props.today && props.today === dateValue)

watch(() => [props.dateFrom, props.dateTo, props.today], () => {
  if (!dateInRange(selectedDate.value)) selectedDate.value = initialDate()
  if (!expandedDate.value || !dateInRange(expandedDate.value)) expandedDate.value = selectedDate.value
}, { immediate: true })
</script>

<template>
  <div class="schedule-calendar">
    <div class="schedule-calendar-desktop">
      <template v-if="mode === 'month'">
        <div class="schedule-month-title">
          <strong>{{ monthLabel }}</strong>
          <small>点击课次进入处理，点击日期查看当天全部课次</small>
        </div>
        <div class="schedule-weekday-grid" aria-hidden="true">
          <span v-for="weekday in weekdayLabels" :key="weekday">周{{ weekday }}</span>
        </div>
        <div class="schedule-month-grid">
          <div
            v-for="cell in mobileMonthDays"
            :key="cell.dateValue"
            class="schedule-month-cell"
            :class="{
              'is-outside': !cell.isInRange || !cell.isCurrentMonth,
              'is-selected': isSelected(cell.dateValue),
              'is-today': isToday(cell.dateValue)
            }"
          >
            <div class="schedule-cell-head">
              <button
                class="schedule-date-button"
                type="button"
                :disabled="!cell.isInRange"
                :aria-label="`${parseDateLabel(cell.dateValue)}，${summaryFor(cell.dateValue).total} 节课次`"
                @click="chooseDate(cell.dateValue)"
              >
                <strong>{{ cell.dayNumber }}</strong>
                <small v-if="summaryFor(cell.dateValue).total">{{ summaryFor(cell.dateValue).total }} 节</small>
              </button>
              <span v-if="isToday(cell.dateValue)" class="schedule-today-mark">今天</span>
            </div>
            <div class="schedule-month-events">
              <button
                v-for="lesson in summaryFor(cell.dateValue).items"
                :key="lesson.id"
                class="schedule-month-event"
                type="button"
                :aria-label="lessonAriaLabel(lesson)"
                :title="lessonDetails(lesson)"
                @click.stop="openLesson(lesson)"
              >
                <span class="schedule-event-dot" :class="statusClass(lessonStatus(lesson))" aria-hidden="true"></span>
                <span>{{ lesson.time || '待定' }}</span>
                <strong>{{ lessonClassName(lesson) }}</strong>
                <span class="schedule-event-popover" role="tooltip">{{ lessonDetails(lesson) }}</span>
              </button>
              <button
                v-if="summaryFor(cell.dateValue).remaining"
                class="schedule-more-button"
                type="button"
                @click="chooseDate(cell.dateValue)"
              >
                还有 {{ summaryFor(cell.dateValue).remaining }} 节
              </button>
            </div>
          </div>
        </div>

        <section v-if="expandedDate" class="schedule-day-detail" aria-live="polite">
          <div class="schedule-day-detail-head">
            <div>
              <span>当天课次</span>
              <strong>{{ selectedDateLabel }}</strong>
            </div>
            <small>{{ selectedLessons.length }} 节</small>
          </div>
          <div v-if="!selectedLessons.length" class="schedule-day-empty">当天没有课次</div>
          <div v-else class="schedule-day-detail-list">
            <button
              v-for="lesson in selectedLessons"
              :key="lesson.id"
              class="schedule-lesson-card"
              type="button"
              :aria-label="lessonAriaLabel(lesson)"
              @click="openLesson(lesson)"
            >
              <span class="schedule-lesson-card-time">{{ lessonTime(lesson) }}</span>
              <span class="schedule-lesson-card-main">
                <strong>{{ lessonClassName(lesson) }}</strong>
                <small>{{ lessonTeacher(lesson) }} · {{ lessonCourse(lesson) }}</small>
                <small :class="{ 'topic-empty': !lesson.topic }">课题：{{ lesson.topic || '未填写' }}</small>
              </span>
              <span class="schedule-lesson-card-side">
                <em class="schedule-status-tag" :class="statusClass(lessonStatus(lesson))">{{ lessonStatus(lesson) }}</em>
                <small>{{ lessonSource(lesson) }}</small>
              </span>
            </button>
          </div>
        </section>
      </template>

      <template v-else>
        <div class="schedule-timeline-title">
          <strong>{{ mode === 'day' ? parseDateLabel(dateFrom) : `${parseDateLabel(dateFrom, false)} - ${parseDateLabel(dateTo, false)}` }}</strong>
          <small>点击课次进入处理，悬停或聚焦查看详细信息</small>
        </div>
        <div class="schedule-timeline-scroll">
          <div class="schedule-timeline-head" :style="{ '--timeline-columns': timelineColumns.length }">
            <div class="schedule-time-axis-label">时间</div>
            <div v-for="day in timelineColumns" :key="day.dateValue" class="schedule-timeline-day-head" :class="{ 'is-today': isToday(day.dateValue), 'is-selected': isSelected(day.dateValue) }">
              <button type="button" @click="chooseDate(day.dateValue)">
                <span>周{{ weekdayLabels[weekdayIndex(day.dateValue)] }}</span>
                <strong>{{ parseDateLabel(day.dateValue, false) }}</strong>
                <small>{{ day.lessons.length }} 节</small>
              </button>
            </div>
          </div>
          <div class="schedule-timeline-body" :style="{ '--timeline-columns': timelineColumns.length, '--timeline-height': `${timelineHeight}px` }">
            <div class="schedule-timeline-axis">
              <span v-for="tick in timeTicks" :key="tick.minutes" :style="{ top: `${tick.topPercent}%` }">{{ tick.label }}</span>
            </div>
            <div v-for="day in timelineColumns" :key="day.dateValue" class="schedule-timeline-day" :class="{ 'is-today': isToday(day.dateValue), 'is-selected': isSelected(day.dateValue) }" @click="chooseDate(day.dateValue)">
              <span v-for="tick in timeTicks" :key="`${day.dateValue}-${tick.minutes}`" class="schedule-time-grid-line" :style="{ top: `${tick.topPercent}%` }" aria-hidden="true"></span>
              <button
                v-for="event in day.layout.positioned"
                :key="event.lesson.id"
                class="schedule-timeline-event"
                :class="{ 'has-missing-end': !event.hasValidEnd, 'has-invalid-end': event.hasInvalidEnd }"
                :style="eventStyle(event)"
                type="button"
                  :aria-label="lessonAriaLabel(event.lesson)"
                  :title="lessonDetails(event.lesson)"
                @click.stop="openLesson(event.lesson)"
              >
                <span class="schedule-event-dot" :class="statusClass(lessonStatus(event.lesson))" aria-hidden="true"></span>
                <strong>{{ lessonClassName(event.lesson) }}</strong>
                <small>{{ lessonTime(event.lesson) }}</small>
                <span class="schedule-event-popover" role="tooltip">{{ lessonDetails(event.lesson) }}</span>
              </button>
              <div v-if="day.layout.invalid.length" class="schedule-timeline-invalid-list">
                <button
                  v-for="item in day.layout.invalid"
                  :key="item.lesson.id"
                  class="schedule-timeline-invalid"
                  type="button"
                  :aria-label="lessonAriaLabel(item.lesson)"
                  @click.stop="openLesson(item.lesson)"
                >
                  <strong>{{ lessonClassName(item.lesson) }}</strong>
                  <small>{{ lessonTime(item.lesson) }} · {{ lessonStatus(item.lesson) }}</small>
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <div class="schedule-calendar-mobile">
      <template v-if="mode === 'month'">
        <div class="schedule-weekday-grid" aria-hidden="true">
          <span v-for="weekday in weekdayLabels" :key="weekday">{{ weekday }}</span>
        </div>
        <div class="schedule-mobile-month-grid">
          <div
            v-for="cell in mobileMonthDays"
            :key="cell.dateValue"
            class="schedule-mobile-month-cell"
            :class="{ 'is-outside': !cell.isInRange || !cell.isCurrentMonth, 'is-selected': isSelected(cell.dateValue), 'is-today': isToday(cell.dateValue) }"
          >
            <button
              type="button"
              :disabled="!cell.isInRange"
              :aria-label="`${parseDateLabel(cell.dateValue)}，${summaryFor(cell.dateValue).total} 节课次`"
              @click="chooseDate(cell.dateValue)"
            >
              <strong>{{ cell.dayNumber }}</strong>
              <span v-if="summaryFor(cell.dateValue).total" class="schedule-mobile-count">{{ summaryFor(cell.dateValue).total }}</span>
              <span v-if="summaryFor(cell.dateValue).total" class="schedule-mobile-dots" aria-hidden="true">
                <i v-for="lesson in summaryFor(cell.dateValue).items.slice(0, 3)" :key="lesson.id" class="schedule-event-dot" :class="statusClass(lessonStatus(lesson))"></i>
              </span>
            </button>
          </div>
        </div>
      </template>
      <div v-else class="schedule-mobile-date-strip" role="tablist" aria-label="选择日期">
        <button
          v-for="dateValue in mobileDateDays"
          :key="dateValue"
          type="button"
          role="tab"
          :aria-selected="isSelected(dateValue)"
          :class="{ selected: isSelected(dateValue), 'is-today': isToday(dateValue) }"
          @click="chooseDate(dateValue)"
        >
          <span>周{{ weekdayLabels[weekdayIndex(dateValue)] }}</span>
          <strong>{{ parseDateLabel(dateValue, false) }}</strong>
          <small>{{ (lessonsByDate.get(dateValue) || []).length }} 节</small>
        </button>
      </div>

      <section class="schedule-mobile-day-detail" aria-live="polite">
        <div class="schedule-day-detail-head">
          <div>
            <span>当天课次</span>
            <strong>{{ selectedDateLabel }}</strong>
          </div>
          <small>{{ selectedLessons.length }} 节</small>
        </div>
        <div v-if="!selectedLessons.length" class="schedule-day-empty">当天没有课次</div>
        <div v-else class="schedule-day-detail-list">
          <button
            v-for="lesson in selectedLessons"
            :key="lesson.id"
            class="schedule-lesson-card"
            type="button"
            :aria-label="lessonAriaLabel(lesson)"
            @click="openLesson(lesson)"
          >
            <span class="schedule-lesson-card-time">{{ lessonTime(lesson) }}</span>
            <span class="schedule-lesson-card-main">
              <strong>{{ lessonClassName(lesson) }}</strong>
              <small>{{ lessonTeacher(lesson) }} · {{ lessonCourse(lesson) }}</small>
              <small :class="{ 'topic-empty': !lesson.topic }">课题：{{ lesson.topic || '未填写' }}</small>
            </span>
            <span class="schedule-lesson-card-side">
              <em class="schedule-status-tag" :class="statusClass(lessonStatus(lesson))">{{ lessonStatus(lesson) }}</em>
              <small>{{ lessonSource(lesson) }}</small>
            </span>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.schedule-calendar {
  min-width: 0;
  --schedule-calendar-border: color-mix(in srgb, var(--color-primary) 18%, var(--color-border-soft));
  --schedule-calendar-wash: color-mix(in srgb, var(--color-primary-mist) 38%, var(--color-surface));
  --schedule-calendar-header: color-mix(in srgb, var(--color-primary-soft) 64%, var(--color-surface));
  --schedule-calendar-today: color-mix(in srgb, var(--color-primary-mist) 58%, var(--color-surface));
}

.schedule-calendar-desktop,
.schedule-calendar-mobile {
  display: grid;
  gap: 12px;
}

.schedule-calendar-mobile {
  display: none;
}

.schedule-month-title,
.schedule-timeline-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.schedule-month-title strong,
.schedule-timeline-title strong {
  color: var(--color-heading);
  font-size: 17px;
}

.schedule-month-title small,
.schedule-timeline-title small,
.schedule-day-detail-head span,
.schedule-day-detail-head small,
.schedule-lesson-card small,
.schedule-timeline-day-head small {
  color: var(--color-muted);
  font-size: 12px;
}

.schedule-weekday-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  border: 1px solid var(--schedule-calendar-border);
  border-bottom: 0;
  border-radius: 10px 10px 0 0;
  background: var(--schedule-calendar-header);
}

.schedule-weekday-grid span {
  padding: 10px 8px;
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 800;
  text-align: center;
}

.schedule-month-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid var(--schedule-calendar-border);
  border-radius: 0 0 10px 10px;
}

.schedule-month-cell {
  min-height: 142px;
  padding: 8px;
  border-right: 1px solid var(--schedule-calendar-border);
  border-bottom: 1px solid var(--schedule-calendar-border);
  background: var(--schedule-calendar-wash);
}

.schedule-month-cell:nth-child(7n) {
  border-right: 0;
}

.schedule-month-cell:nth-last-child(-n + 7) {
  border-bottom: 0;
}

.schedule-month-cell.is-outside {
  background: color-mix(in srgb, var(--color-primary-soft) 18%, var(--color-surface-muted));
  opacity: .7;
}

.schedule-month-cell.is-selected {
  background: color-mix(in srgb, var(--color-primary-soft) 34%, var(--schedule-calendar-wash));
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--color-primary) 58%, transparent);
}

.schedule-month-cell.is-selected .schedule-date-button {
  color: var(--color-primary);
}

.schedule-month-cell.is-today .schedule-date-button strong {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-surface-warm);
}

.schedule-cell-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
  min-height: 28px;
}

.schedule-date-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-heading);
  text-align: left;
}

.schedule-date-button:not(:disabled) {
  cursor: pointer;
}

.schedule-date-button small {
  color: var(--color-muted);
  font-size: 11px;
  font-weight: 600;
}

.schedule-today-mark {
  padding: 3px 6px;
  border-radius: 999px;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 10px;
  font-weight: 800;
}

.schedule-month-events {
  display: grid;
  gap: 5px;
  margin-top: 7px;
}

.schedule-month-event {
  position: relative;
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: 4px;
  width: 100%;
  min-width: 0;
  padding: 5px 6px;
  overflow: visible;
  border: 1px solid var(--schedule-calendar-border);
  border-radius: 6px;
  background: color-mix(in srgb, var(--color-primary-soft) 72%, var(--color-surface));
  color: var(--color-heading);
  font-size: 11px;
  text-align: left;
  cursor: pointer;
}

.schedule-month-event > span:not(.schedule-event-dot):not(.schedule-event-popover),
.schedule-month-event > strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.schedule-month-event:hover,
.schedule-month-event:focus-visible,
.schedule-timeline-event:hover,
.schedule-timeline-event:focus-visible,
.schedule-lesson-card:hover,
.schedule-lesson-card:focus-visible {
  border-color: var(--color-primary);
  outline: none;
}

.schedule-event-dot {
  display: inline-block;
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-status-muted-text);
}

.schedule-event-dot.is-done,
.schedule-event-dot.is-processing {
  background: var(--color-status-working-text);
}

.schedule-event-dot.is-warning {
  background: var(--color-status-warning-text);
}

.schedule-event-popover {
  position: absolute;
  z-index: 5;
  top: calc(100% + 6px);
  left: 0;
  display: none;
  width: max-content;
  max-width: 320px;
  padding: 8px 10px;
  border: 1px solid var(--schedule-calendar-border);
  border-radius: 8px;
  background: var(--schedule-calendar-header);
  box-shadow: var(--shadow-panel);
  color: var(--color-heading);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
  white-space: normal;
}

.schedule-month-event:hover .schedule-event-popover,
.schedule-month-event:focus-visible .schedule-event-popover,
.schedule-timeline-event:hover .schedule-event-popover,
.schedule-timeline-event:focus-visible .schedule-event-popover {
  display: block;
}

.schedule-more-button {
  width: fit-content;
  padding: 2px 4px;
  border: 0;
  background: transparent;
  color: var(--color-primary);
  font-size: 11px;
  cursor: pointer;
}

.schedule-day-detail,
.schedule-mobile-day-detail {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--schedule-calendar-border);
  border-radius: 10px;
  background: var(--schedule-calendar-wash);
}

.schedule-day-detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.schedule-day-detail-head > div {
  display: grid;
  gap: 3px;
}

.schedule-day-detail-head strong {
  color: var(--color-heading);
  font-size: 15px;
}

.schedule-day-detail-list {
  display: grid;
  gap: 8px;
}

.schedule-lesson-card {
  display: grid;
  grid-template-columns: minmax(100px, 145px) minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--schedule-calendar-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-heading);
  text-align: left;
  cursor: pointer;
}

.schedule-lesson-card-time {
  color: var(--color-heading);
  font-size: 13px;
  font-weight: 800;
}

.schedule-lesson-card-main,
.schedule-lesson-card-side {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.schedule-lesson-card-main strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.schedule-lesson-card-side {
  justify-items: end;
}

.schedule-lesson-card-side small {
  white-space: nowrap;
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

.schedule-status-tag.is-done,
.schedule-status-tag.is-processing {
  background: var(--color-status-working-bg);
  color: var(--color-status-working-text);
}

.schedule-status-tag.is-warning {
  background: var(--color-status-warning-bg);
  color: var(--color-status-warning-text);
}

.topic-empty {
  opacity: .72;
}

.schedule-timeline-scroll {
  overflow-x: auto;
  border: 1px solid var(--schedule-calendar-border);
  border-radius: 10px;
  background: var(--schedule-calendar-wash);
}

.schedule-timeline-head,
.schedule-timeline-body {
  display: grid;
  grid-template-columns: 64px repeat(var(--timeline-columns), minmax(136px, 1fr));
  min-width: max(760px, calc(64px + var(--timeline-columns) * 136px));
}

.schedule-timeline-head {
  border-bottom: 1px solid var(--schedule-calendar-border);
  background: var(--schedule-calendar-header);
}

.schedule-time-axis-label {
  padding: 11px 7px;
  color: var(--color-muted);
  font-size: 11px;
  text-align: center;
}

.schedule-timeline-day-head {
  border-left: 1px solid var(--schedule-calendar-border);
}

.schedule-timeline-day-head.is-today {
  background: var(--schedule-calendar-today);
}

.schedule-timeline-day-head.is-selected {
  box-shadow: inset 0 -3px 0 var(--color-primary);
}

.schedule-timeline-day-head.is-selected strong {
  color: var(--color-primary);
}

.schedule-timeline-day-head button {
  display: grid;
  gap: 2px;
  width: 100%;
  min-height: 65px;
  padding: 8px 7px;
  border: 0;
  background: transparent;
  color: var(--color-heading);
  text-align: left;
  cursor: pointer;
}

.schedule-timeline-day-head span,
.schedule-timeline-day-head small {
  color: var(--color-muted);
  font-size: 11px;
}

.schedule-timeline-day-head strong {
  font-size: 13px;
}

.schedule-timeline-body {
  height: var(--timeline-height);
}

.schedule-timeline-axis,
.schedule-timeline-day {
  position: relative;
  height: var(--timeline-height);
}

.schedule-timeline-axis {
  border-right: 1px solid var(--schedule-calendar-border);
}

.schedule-timeline-axis span {
  position: absolute;
  right: 7px;
  transform: translateY(-50%);
  color: var(--color-muted);
  font-size: 10px;
}

.schedule-timeline-day {
  overflow: visible;
  border-right: 1px solid var(--schedule-calendar-border);
  background: var(--schedule-calendar-wash);
}

.schedule-timeline-day:last-child {
  border-right: 0;
}

.schedule-timeline-day.is-today {
  background: var(--schedule-calendar-today);
}

.schedule-timeline-day.is-selected {
  background: color-mix(in srgb, var(--color-primary-soft) 34%, var(--schedule-calendar-wash));
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--color-primary) 38%, transparent);
}

.schedule-time-grid-line {
  position: absolute;
  right: 0;
  left: 0;
  border-top: 1px solid color-mix(in srgb, var(--color-primary) 12%, var(--color-border-soft));
  pointer-events: none;
}

.schedule-timeline-event {
  position: absolute;
  z-index: 2;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: auto auto;
  align-content: start;
  gap: 2px 4px;
  min-width: 0;
  min-height: 36px;
  padding: 6px;
  overflow: visible;
  border: 1px solid color-mix(in srgb, var(--color-primary) 28%, var(--color-border-soft));
  border-radius: 7px;
  background: color-mix(in srgb, var(--color-primary-soft) 88%, var(--color-surface));
  color: var(--color-heading);
  text-align: left;
  cursor: pointer;
}

.schedule-timeline-event strong,
.schedule-timeline-event small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.schedule-timeline-event strong {
  font-size: 11px;
}

.schedule-timeline-event small {
  grid-column: 2;
  color: var(--color-muted);
  font-size: 10px;
}

.schedule-timeline-event .schedule-event-dot {
  margin-top: 3px;
}

.schedule-timeline-event.has-missing-end {
  border-style: dashed;
}

.schedule-timeline-invalid-list {
  position: absolute;
  right: 4px;
  bottom: 6px;
  left: 4px;
  z-index: 3;
  display: grid;
  gap: 4px;
}

.schedule-timeline-invalid {
  position: relative;
  display: grid;
  gap: 2px;
  padding: 6px;
  border: 1px dashed var(--color-status-warning-text);
  border-radius: 6px;
  background: var(--color-status-warning-bg);
  color: var(--color-status-warning-text);
  text-align: left;
  cursor: pointer;
}

.schedule-timeline-invalid strong,
.schedule-timeline-invalid small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.schedule-timeline-invalid strong {
  font-size: 11px;
}

.schedule-timeline-invalid small {
  font-size: 10px;
}

.schedule-mobile-month-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid var(--schedule-calendar-border);
  border-radius: 10px;
}

.schedule-mobile-month-cell {
  min-height: 56px;
  border-right: 1px solid var(--schedule-calendar-border);
  border-bottom: 1px solid var(--schedule-calendar-border);
  background: var(--schedule-calendar-wash);
}

.schedule-mobile-month-cell:nth-child(7n) {
  border-right: 0;
}

.schedule-mobile-month-cell:nth-last-child(-n + 7) {
  border-bottom: 0;
}

.schedule-mobile-month-cell.is-outside {
  background: color-mix(in srgb, var(--color-primary-soft) 18%, var(--color-surface-muted));
  opacity: .6;
}

.schedule-mobile-month-cell.is-selected {
  box-shadow: inset 0 0 0 2px var(--color-primary);
}

.schedule-mobile-month-cell button {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 2px;
  width: 100%;
  height: 100%;
  min-height: 56px;
  padding: 5px 2px;
  border: 0;
  background: transparent;
  color: var(--color-heading);
  cursor: pointer;
}

.schedule-mobile-month-cell.is-today button > strong {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-surface-warm);
}

.schedule-mobile-count {
  color: var(--color-muted);
  font-size: 10px;
}

.schedule-mobile-dots {
  display: flex;
  gap: 3px;
}

.schedule-mobile-dots .schedule-event-dot {
  width: 5px;
  height: 5px;
}

.schedule-mobile-date-strip {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(70px, 1fr);
  overflow-x: auto;
  border: 1px solid var(--schedule-calendar-border);
  border-radius: 10px;
}

.schedule-mobile-date-strip button {
  display: grid;
  gap: 3px;
  min-height: 66px;
  padding: 9px 7px;
  border: 0;
  border-right: 1px solid var(--schedule-calendar-border);
  background: var(--schedule-calendar-wash);
  color: var(--color-heading);
  text-align: center;
  cursor: pointer;
}

.schedule-mobile-date-strip button:last-child {
  border-right: 0;
}

.schedule-mobile-date-strip button.selected {
  background: var(--color-primary-soft);
  box-shadow: inset 0 -3px 0 var(--color-primary);
  color: var(--color-primary);
}

.schedule-mobile-date-strip button.is-today strong {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.schedule-mobile-date-strip span,
.schedule-mobile-date-strip small {
  color: var(--color-muted);
  font-size: 10px;
}

.schedule-mobile-date-strip strong {
  font-size: 12px;
}

.schedule-day-empty {
  padding: 10px;
  border: 1px dashed var(--color-border-soft);
  border-radius: 8px;
  color: var(--color-muted);
  font-size: 12px;
  text-align: center;
}

@media (max-width: 680px) {
  .schedule-calendar-desktop {
    display: none;
  }

  .schedule-calendar-mobile {
    display: grid;
  }

  .schedule-day-detail,
  .schedule-mobile-day-detail {
    padding: 12px;
  }

  .schedule-lesson-card {
    grid-template-columns: 1fr auto;
    gap: 7px 10px;
    padding: 11px;
  }

  .schedule-lesson-card-time {
    grid-column: 1 / -1;
  }

  .schedule-lesson-card-side {
    justify-items: end;
  }

  .schedule-lesson-card-main small,
  .schedule-lesson-card-side small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
