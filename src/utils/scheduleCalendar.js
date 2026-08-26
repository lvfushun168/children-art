export const CALENDAR_WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
export const CALENDAR_GRID_MINUTES = 30
export const CALENDAR_FALLBACK_DURATION = 60
export const CALENDAR_DEFAULT_START = 8 * 60
export const CALENDAR_DEFAULT_END = 22 * 60

const pad = (value) => String(value).padStart(2, '0')

export const toDateValue = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const parseDateValue = (value) => {
  const match = String(value || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return date.getFullYear() === Number(match[1])
    && date.getMonth() === Number(match[2]) - 1
    && date.getDate() === Number(match[3])
    ? date
    : null
}

export const addDaysValue = (value, days) => {
  const date = parseDateValue(value)
  if (!date) return ''
  date.setDate(date.getDate() + Number(days || 0))
  return toDateValue(date)
}

export const compareDateValues = (left, right) => String(left || '').localeCompare(String(right || ''))

export const weekdayIndex = (value) => {
  const date = parseDateValue(value)
  if (!date) return -1
  const day = date.getDay()
  return day === 0 ? 6 : day - 1
}

export const startOfWeekValue = (value) => {
  const date = parseDateValue(value)
  if (!date) return ''
  date.setDate(date.getDate() - weekdayIndex(value))
  return toDateValue(date)
}

export const endOfWeekValue = (value) => addDaysValue(startOfWeekValue(value), 6)

export const startOfMonthValue = (value) => {
  const date = parseDateValue(value)
  if (!date) return ''
  return toDateValue(new Date(date.getFullYear(), date.getMonth(), 1))
}

export const endOfMonthValue = (value) => {
  const date = parseDateValue(value)
  if (!date) return ''
  return toDateValue(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

export const dateRangeDays = (dateFrom, dateTo) => {
  if (!parseDateValue(dateFrom) || !parseDateValue(dateTo) || compareDateValues(dateFrom, dateTo) > 0) return []
  const days = []
  let current = dateFrom
  while (compareDateValues(current, dateTo) <= 0) {
    days.push(current)
    current = addDaysValue(current, 1)
  }
  return days
}

export const rangeDayCount = (dateFrom, dateTo) => dateRangeDays(dateFrom, dateTo).length

export const buildCalendarWeeks = (dateFrom, dateTo, { monthAnchor = dateFrom } = {}) => {
  if (!dateRangeDays(dateFrom, dateTo).length) return []
  const first = startOfWeekValue(dateFrom)
  const last = endOfWeekValue(dateTo)
  const anchor = parseDateValue(monthAnchor)
  const anchorMonth = anchor ? `${anchor.getFullYear()}-${pad(anchor.getMonth() + 1)}` : ''
  const cells = dateRangeDays(first, last).map((dateValue) => {
    const date = parseDateValue(dateValue)
    const monthKey = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
    return {
      dateValue,
      dayNumber: date.getDate(),
      weekdayIndex: weekdayIndex(dateValue),
      weekdayLabel: CALENDAR_WEEKDAYS[weekdayIndex(dateValue)],
      monthKey,
      isInRange: compareDateValues(dateValue, dateFrom) >= 0 && compareDateValues(dateValue, dateTo) <= 0,
      isCurrentMonth: !anchorMonth || monthKey === anchorMonth
    }
  })
  const weeks = []
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7))
  return weeks
}

export const sortLessons = (lessons = []) => [...(Array.isArray(lessons) ? lessons : [])].sort((left, right) => {
  const dateResult = compareDateValues(left?.dateValue, right?.dateValue)
  if (dateResult) return dateResult
  const leftTime = timeToMinutes(left?.startTime || left?.time)
  const rightTime = timeToMinutes(right?.startTime || right?.time)
  if (leftTime !== null && rightTime !== null && leftTime !== rightTime) return leftTime - rightTime
  if (leftTime === null && rightTime !== null) return 1
  if (leftTime !== null && rightTime === null) return -1
  return String(left?.id ?? '').localeCompare(String(right?.id ?? ''), undefined, { numeric: true })
})

export const groupLessonsByDate = (lessons = []) => {
  const groups = new Map()
  sortLessons(lessons).forEach((lesson) => {
    const dateValue = String(lesson?.dateValue || '')
    if (!groups.has(dateValue)) groups.set(dateValue, [])
    groups.get(dateValue).push(lesson)
  })
  return groups
}

export const summarizeLessons = (lessons = [], limit = 3) => {
  const sorted = sortLessons(lessons)
  const safeLimit = Math.max(0, Number(limit) || 0)
  return {
    items: sorted.slice(0, safeLimit),
    remaining: Math.max(0, sorted.length - safeLimit),
    total: sorted.length
  }
}

export const timeToMinutes = (value) => {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}

export const floorToGrid = (minutes, grid = CALENDAR_GRID_MINUTES) => Math.floor(minutes / grid) * grid
export const ceilToGrid = (minutes, grid = CALENDAR_GRID_MINUTES) => Math.ceil(minutes / grid) * grid

export const lessonTimeWindow = (lesson, fallbackDuration = CALENDAR_FALLBACK_DURATION) => {
  const start = timeToMinutes(lesson?.startTime || lesson?.time)
  if (start === null) return null
  const rawEndValue = String(lesson?.endTime || '').trim()
  const rawEnd = timeToMinutes(rawEndValue)
  const hasEndValue = Boolean(rawEndValue)
  const hasInvalidEnd = hasEndValue && (rawEnd === null || rawEnd <= start)
  if (hasInvalidEnd) return null
  const hasValidEnd = rawEnd !== null && rawEnd > start
  return {
    start,
    end: hasValidEnd ? rawEnd : start + fallbackDuration,
    hasValidEnd,
    hasInvalidEnd: false
  }
}

export const timelineBounds = (lessons = [], {
  defaultStart = CALENDAR_DEFAULT_START,
  defaultEnd = CALENDAR_DEFAULT_END,
  grid = CALENDAR_GRID_MINUTES,
  fallbackDuration = CALENDAR_FALLBACK_DURATION
} = {}) => {
  const windows = lessons.map((lesson) => lessonTimeWindow(lesson, fallbackDuration)).filter(Boolean)
  if (!windows.length) return { start: defaultStart, end: defaultEnd }
  const earliest = Math.min(...windows.map((window) => window.start))
  const latest = Math.max(...windows.map((window) => window.end))
  const start = Math.min(defaultStart, floorToGrid(earliest, grid))
  const end = Math.max(defaultEnd, ceilToGrid(latest, grid))
  return { start, end: end > start ? end : start + grid }
}

const overlapping = (left, right) => left.start < right.end && right.start < left.end

export const layoutTimelineLessons = (lessons = [], {
  start = CALENDAR_DEFAULT_START,
  end = CALENDAR_DEFAULT_END,
  fallbackDuration = CALENDAR_FALLBACK_DURATION,
  minHeightMinutes = 30
} = {}) => {
  const entries = sortLessons(lessons)
    .map((lesson) => ({ lesson, window: lessonTimeWindow(lesson, fallbackDuration) }))
  const invalid = entries.filter((entry) => !entry.window).map(({ lesson }) => ({ lesson, invalidTime: true }))
  const valid = entries.filter((entry) => entry.window)
    .sort((left, right) => left.window.start - right.window.start || left.window.end - right.window.end)
  const clusters = []
  valid.forEach((entry) => {
    const cluster = clusters[clusters.length - 1]
    if (!cluster || entry.window.start >= cluster.end) {
      clusters.push({ end: entry.window.end, entries: [entry] })
    } else {
      cluster.entries.push(entry)
      cluster.end = Math.max(cluster.end, entry.window.end)
    }
  })

  const positioned = []
  clusters.forEach((cluster) => {
    const placed = []
    cluster.entries.forEach((entry) => {
      const occupied = new Set(placed
        .filter((item) => overlapping(item.window, entry.window))
        .map((item) => item.column))
      let column = 0
      while (occupied.has(column)) column += 1
      placed.push({ ...entry, column })
    })
    const columnCount = Math.max(1, ...placed.map((entry) => entry.column + 1))
    placed.forEach((entry) => {
      const duration = Math.max(minHeightMinutes, entry.window.end - entry.window.start)
      const span = Math.max(1, end - start)
      positioned.push({
        lesson: entry.lesson,
        startMinutes: entry.window.start,
        endMinutes: entry.window.end,
        hasValidEnd: entry.window.hasValidEnd,
        hasInvalidEnd: entry.window.hasInvalidEnd,
        column: entry.column,
        columns: columnCount,
        topPercent: ((entry.window.start - start) / span) * 100,
        heightPercent: (duration / span) * 100,
        leftPercent: (entry.column / columnCount) * 100,
        widthPercent: (1 / columnCount) * 100
      })
    })
  })
  return { positioned, invalid }
}

export const resolveCalendarMode = (preset, dateFrom, dateTo) => {
  if (preset === 'today' || rangeDayCount(dateFrom, dateTo) === 1) return 'day'
  if (preset === 'week') return 'week'
  if (preset === 'month') return 'month'
  return rangeDayCount(dateFrom, dateTo) <= 7 ? 'range' : 'month'
}

export const shiftDateRange = (dateFrom, dateTo, direction, mode = 'custom') => {
  const sign = Number(direction) < 0 ? -1 : 1
  if (mode === 'month') {
    const anchor = parseDateValue(dateFrom)
    if (!anchor) return { dateFrom, dateTo }
    anchor.setMonth(anchor.getMonth() + sign)
    const next = toDateValue(anchor)
    return { dateFrom: startOfMonthValue(next), dateTo: endOfMonthValue(next) }
  }
  const days = mode === 'week' ? 7 : mode === 'day' ? 1 : Math.max(1, rangeDayCount(dateFrom, dateTo))
  return { dateFrom: addDaysValue(dateFrom, sign * days), dateTo: addDaysValue(dateTo, sign * days) }
}

export const formatTimeRange = (lesson) => {
  const startValue = String(lesson?.time || lesson?.startTime || '').trim()
  const endValue = String(lesson?.endTime || '').trim()
  const start = timeToMinutes(startValue)
  if (start === null) return '时间异常'
  const startLabel = startValue.slice(0, 5)
  if (!endValue) return `${startLabel}（结束时间未设置）`
  const end = timeToMinutes(endValue)
  if (end === null || end <= start) return `${startLabel}（结束时间异常）`
  return `${startLabel}-${endValue.slice(0, 5)}`
}
