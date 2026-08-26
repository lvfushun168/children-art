import assert from 'node:assert/strict'
import test from 'node:test'

import {
  addDaysValue,
  buildCalendarWeeks,
  dateRangeDays,
  endOfMonthValue,
  endOfWeekValue,
  formatTimeRange,
  groupLessonsByDate,
  layoutTimelineLessons,
  lessonTimeWindow,
  rangeDayCount,
  resolveCalendarMode,
  shiftDateRange,
  startOfMonthValue,
  startOfWeekValue,
  summarizeLessons,
  timelineBounds
} from '../src/utils/scheduleCalendar.js'
import { loadAllPageItems } from '../src/utils/pagination.js'

const lesson = (id, dateValue, time, endTime, extra = {}) => ({
  id,
  dateValue,
  time,
  endTime,
  className: `班级${id}`,
  ...extra
})

test('uses Monday-first week boundaries and includes both range endpoints', () => {
  assert.equal(startOfWeekValue('2026-08-23'), '2026-08-17')
  assert.equal(endOfWeekValue('2026-08-23'), '2026-08-23')
  assert.deepEqual(dateRangeDays('2026-08-25', '2026-08-27'), [
    '2026-08-25',
    '2026-08-26',
    '2026-08-27'
  ])
  assert.equal(rangeDayCount('2026-08-25', '2026-08-27'), 3)
})

test('builds complete month rows across month, year and leap-day boundaries', () => {
  const february = buildCalendarWeeks('2024-02-01', '2024-02-29', { monthAnchor: '2024-02-01' })
  assert.equal(february.length, 5)
  assert.equal(february[0][0].dateValue, '2024-01-29')
  assert.equal(february.at(-1).at(-1).dateValue, '2024-03-03')
  assert.equal(february.flat().filter((cell) => cell.isInRange).length, 29)
  assert.equal(startOfMonthValue('2026-12-31'), '2026-12-01')
  assert.equal(endOfMonthValue('2026-12-01'), '2026-12-31')
  assert.equal(addDaysValue('2026-12-31', 1), '2027-01-01')

  const custom = buildCalendarWeeks('2026-08-26', '2026-09-10', { monthAnchor: '' })
  assert.equal(custom.flat().find((cell) => cell.dateValue === '2026-09-01').isCurrentMonth, true)
  assert.equal(custom.flat().find((cell) => cell.dateValue === '2026-08-25').isInRange, false)
})

test('resolves calendar presentation from preset and custom range length', () => {
  assert.equal(resolveCalendarMode('today', '2026-08-26', '2026-08-26'), 'day')
  assert.equal(resolveCalendarMode('week', '2026-08-24', '2026-08-30'), 'week')
  assert.equal(resolveCalendarMode('month', '2026-08-01', '2026-08-31'), 'month')
  assert.equal(resolveCalendarMode('custom', '2026-08-25', '2026-08-31'), 'range')
  assert.equal(resolveCalendarMode('custom', '2026-08-01', '2026-08-31'), 'month')
  assert.deepEqual(shiftDateRange('2026-08-24', '2026-08-30', 1, 'week'), {
    dateFrom: '2026-08-31',
    dateTo: '2026-09-06'
  })
  assert.deepEqual(shiftDateRange('2026-08-25', '2026-08-27', -1, 'custom'), {
    dateFrom: '2026-08-22',
    dateTo: '2026-08-24'
  })
})

test('groups lessons, sorts time and reports month-cell overflow', () => {
  const lessons = [
    lesson('3', '2026-08-26', '19:00', '20:00'),
    lesson('1', '2026-08-26', '17:40', '19:10'),
    lesson('2', '2026-08-26', '18:00', '19:00'),
    lesson('4', '2026-08-26', '20:00', '21:00'),
    lesson('5', '2026-08-27', '18:00', '19:00')
  ]
  const groups = groupLessonsByDate(lessons)
  assert.deepEqual(groups.get('2026-08-26').map((item) => item.id), ['1', '2', '3', '4'])
  assert.deepEqual(summarizeLessons(groups.get('2026-08-26'), 3), {
    items: groups.get('2026-08-26').slice(0, 3),
    remaining: 1,
    total: 4
  })
})

test('lays out overlapping lessons side by side and keeps missing end times visible', () => {
  const lessons = [
    lesson('a', '2026-08-26', '10:00', '12:00'),
    lesson('b', '2026-08-26', '10:30', '11:00'),
    lesson('c', '2026-08-26', '11:00', '13:00'),
    lesson('d', '2026-08-26', '14:00', '')
  ]
  const bounds = timelineBounds(lessons)
  const result = layoutTimelineLessons(lessons, bounds)
  const byId = new Map(result.positioned.map((item) => [item.lesson.id, item]))
  assert.equal(byId.get('a').columns, 2)
  assert.notEqual(byId.get('a').column, byId.get('b').column)
  assert.equal(byId.get('d').hasValidEnd, false)
  assert.equal(byId.get('d').endMinutes - byId.get('d').startMinutes, 60)
  assert.equal(result.invalid.length, 0)
  assert.equal(lessonTimeWindow(lesson('x', '2026-08-26', 'bad', '10:00')), null)
  assert.equal(lessonTimeWindow(lesson('z', '2026-08-26', '10:00', '09:00')), null)
  assert.equal(formatTimeRange(lesson('y', '2026-08-26', '17:40', '')), '17:40（结束时间未设置）')
  assert.equal(formatTimeRange(lesson('z', '2026-08-26', '10:00', '09:00')), '10:00（结束时间异常）')

  const invalidEnd = layoutTimelineLessons([lesson('z', '2026-08-26', '10:00', '09:00')], bounds)
  assert.deepEqual(invalidEnd.invalid.map((item) => item.lesson.id), ['z'])
})

test('loads and merges every page when a calendar range exceeds 200 lessons', async () => {
  const calls = []
  const result = await loadAllPageItems(async ({ page, pageSize, dateFrom }) => {
    calls.push({ page, pageSize, dateFrom })
    const total = 405
    const start = (page - 1) * pageSize
    return {
      page,
      pageSize,
      total,
      items: Array.from({ length: Math.min(pageSize, total - start) }, (_, index) => ({ id: start + index + 1 }))
    }
  }, (value) => ({ ...value, mapped: true }), { dateFrom: '2026-08-01' })

  assert.deepEqual(calls.map((call) => call.page), [1, 2, 3])
  assert.ok(calls.every((call) => call.pageSize === 200 && call.dateFrom === '2026-08-01'))
  assert.equal(result.total, 405)
  assert.equal(result.items.length, 405)
  assert.equal(result.items[0].mapped, true)
  assert.equal(result.items.at(-1).id, 405)
})
